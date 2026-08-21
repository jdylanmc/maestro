/**
 * Main process: the only place with authority.
 *
 * The renderer holds no Node integration and reaches nothing directly; every
 * capability it has arrives through a preload bridge over the channels in
 * `shared/contract.ts`. Process groups, git, durable state, and the Copilot seam
 * all live here.
 *
 * The quit path is the load-bearing part of this file. Closing shows a pre-close
 * summary, waits for acknowledgement, auto-Parks every Fleet, tears down every
 * process group, and **verifies zero survivors before exiting**. An unverified
 * shutdown is exactly what produced the defect this product exists to fix.
 */

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { FleetStore, defaultStorePath, type FleetRecord } from './fleet-store.ts';
import { createWorktree, isGitRepo, listWorktrees, pruneWorktrees } from './worktree.ts';
import { Supervisor, spawnInOwnGroup, survivorsOf } from './supervisor.ts';
import { FleetWatcher, observe, readEventLog, type FleetObservation } from './observe.ts';
import { CopilotSeam, PINNED_SDK_VERSION } from './copilot.ts';
import {
  CHANNELS,
  type AppState,
  type CloseSummary,
  type FleetView,
  type Liveness,
  type SubagentView,
} from '../shared/contract.ts';

/**
 * This module is bundled to CommonJS for Electron's main process, so `__dirname`
 * is the correct way to locate sibling bundles.
 *
 * `import.meta.url` is deliberately NOT used: esbuild rewrites it to an empty
 * object in a CJS bundle, making `import.meta.url` `undefined`, and
 * `fileURLToPath(undefined)` then throws at module load - before `app.whenReady()`
 * can fire. The symptom is an application that starts, logs nothing, and never
 * opens a window.
 */
declare const __dirname: string;
const here = __dirname;

let window: BrowserWindow | null = null;
let store: FleetStore;
const supervisor = new Supervisor();
const seam = new CopilotSeam();
const watchers = new Map<string, FleetWatcher>();
const observations = new Map<string, FleetObservation>();
const notices: string[] = [];

let selectedFleet: string | null = null;
let quitConfirmed = false;
/**
 * Set the instant the operator confirms, *before* teardown is awaited.
 *
 * Teardown takes seconds - it signals process groups and waits for them to die -
 * and any second close attempt during that window used to re-prompt. Because
 * `parkAll()` had already run by then, the second dialog cheerfully offered to
 * park zero Fleets. The flag closes that window.
 */
let quitting = false;

function note(message: string): void {
  notices.push(message);
  if (notices.length > 20) notices.shift();
}

/**
 * Liveness is observed, never stored.
 *
 * A Fleet with no recorded process group has nothing to observe, which is `Dead`
 * rather than unknown - it owns no processes. A recorded group with no live
 * members is `Dead`; with live members, `Alive`.
 */
async function livenessOf(record: FleetRecord): Promise<Liveness> {
  if (record.processGroupId === undefined) return 'Dead';
  const rows = await survivorsOf([record.processGroupId]);
  return rows.length > 0 ? 'Alive' : 'Dead';
}

function toView(node: {
  agentId: string;
  agentName: string;
  status: 'running' | 'completed' | 'failed';
  children: unknown[];
}): SubagentView {
  return {
    agentId: node.agentId,
    agentName: node.agentName,
    status: node.status,
    children: (node.children as Parameters<typeof toView>[0][]).map(toView),
  };
}

async function buildState(): Promise<AppState> {
  const fleets: FleetView[] = [];
  for (const record of store.list()) {
    const observation =
      observations.get(record.sessionId) ?? observe(await readEventLog(record.sessionId));
    fleets.push({
      name: record.name,
      sessionId: record.sessionId,
      worktreePath: record.worktreePath,
      branch: record.branch,
      intent: record.intent,
      liveness: await livenessOf(record),
      attention: observation.attention,
      pendingPermissions: observation.pendingPermissions,
      subagents: observation.tree.map(toView),
      eventCount: observation.eventCount,
      createdAt: record.createdAt,
      ...(observation.lastEventAt !== undefined ? { lastEventAt: observation.lastEventAt } : {}),
    });
  }

  return {
    repoRoot: store.repoRoot,
    fleets,
    selectedFleet,
    sdkVersion: PINNED_SDK_VERSION,
    sdkStarted: seam.isStarted,
    notices: [...notices],
  };
}

async function pushState(): Promise<void> {
  if (window === null || window.isDestroyed()) return;
  window.webContents.send(CHANNELS.stateChanged, await buildState());
}

/** Watch a Fleet's event log so its tree and Attention update live. */
async function watchFleet(record: FleetRecord): Promise<void> {
  if (watchers.has(record.sessionId)) return;
  const watcher = new FleetWatcher(record.sessionId, (observation) => {
    observations.set(record.sessionId, observation);
    void pushState();
  });
  watchers.set(record.sessionId, watcher);
  await watcher.start();
}

/**
 * Bind a Copilot Session to a Fleet that already exists.
 *
 * Bounded and fire-and-forget: a runtime that is slow, unreachable, or wedged
 * must degrade the Fleet, not prevent it. Whatever happens is reported through
 * the notices rather than thrown away.
 */
async function attachSession(fleet: string, sessionId: string, cwd: string): Promise<void> {
  const ready = await seam.whenReady();
  if (!ready) {
    note(`Fleet "${fleet}" has no Session: the Copilot seam is not running.`);
    await pushState();
    return;
  }
  try {
    await Promise.race([
      seam.createSession(sessionId, cwd),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('createSession timed out after 45s')), 45_000),
      ),
    ]);
  } catch (cause) {
    note(`Fleet "${fleet}" could not bind a Session: ${String(cause)}`);
  }
  await pushState();
}

async function createFleet(name: string): Promise<void> {
  const trimmed = name.trim();
  if (trimmed === '') throw new Error('a Fleet needs a name');
  if (store.get(trimmed) !== undefined) throw new Error(`a Fleet named "${trimmed}" already exists`);

  const { worktreePath, branch } = await createWorktree(store.repoRoot, trimmed);

  // Maestro mints the session id rather than learning it: SessionConfig.sessionId
  // is caller-suppliable, so the Fleet owns its binding from the first moment.
  const sessionId = randomUUID();

  const record: FleetRecord = {
    name: trimmed,
    sessionId,
    worktreePath,
    branch,
    intent: 'Running',
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  };

  // The Fleet exists as soon as its Worktree and process group do. Binding a
  // Session is done **after** the Fleet is durable, and never blocks it.
  //
  // This is not only a responsiveness choice. `createSession` has been observed to
  // hang inside the packaged application, and an await here left a Fleet with a
  // real worktree on disk and no record of it in the store - the worst of both
  // worlds, because a crash at that moment orphans the worktree silently.
  try {
    const { pgid } = spawnInOwnGroup('sleep', ['86400'], { cwd: worktreePath });
    supervisor.register(trimmed, pgid);
    await store.add({ ...record, processGroupId: pgid });
  } catch (cause) {
    note(`Fleet "${trimmed}" has no process group: ${String(cause)}`);
    await store.add(record);
  }

  void attachSession(trimmed, sessionId, worktreePath);

  const created = store.get(trimmed)!;
  await watchFleet(created);
  selectedFleet = trimmed;
}

async function promptFleet(name: string, prompt: string): Promise<void> {
  const record = store.get(name);
  if (record === undefined) throw new Error(`no Fleet named "${name}"`);
  if (!seam.isStarted) {
    note(`Cannot prompt "${name}": the Copilot seam is not running.`);
    return;
  }
  // Deliberately NOT awaited.
  //
  // This route ships no permission handler, which is what leaves requests pending
  // so Attention can be observed at all. The direct consequence is that a turn
  // requiring permission **never completes** - so awaiting the send would hang the
  // interface at exactly the moment the operator most needs it: when a Fleet is
  // blocked and wants them. Fire it, and let the event log report what happens.
  void seam.send(record.sessionId, prompt).catch((cause: unknown) => {
    note(`Prompt to "${name}" failed: ${String(cause)}`);
    void pushState();
  });
}

function buildCloseSummary(state: AppState): CloseSummary {
  const countSubagents = (nodes: readonly SubagentView[]): number =>
    nodes.reduce((total, node) => total + 1 + countSubagents(node.children), 0);
  return {
    fleets: state.fleets.map((f) => ({
      name: f.name,
      intent: f.intent,
      attention: f.attention,
      subagentCount: countSubagents(f.subagents),
    })),
    willPark: state.fleets.filter((f) => f.intent !== 'Parked').length,
  };
}

/**
 * The quit path.
 *
 * Auto-Park first so durable state is correct even if teardown then fails, then
 * tear down, then *verify*. If anything survives, say so loudly rather than
 * exiting quietly - a silent orphan is the exact failure this product exists to
 * prevent.
 */
async function performQuit(): Promise<void> {
  await store.parkAll();
  for (const watcher of watchers.values()) watcher.stop();
  watchers.clear();

  const seamErrors = await seam.stop();
  for (const error of seamErrors) note(`SDK shutdown: ${error}`);

  const survivors = await supervisor.shutdownAll();
  if (survivors.length > 0) {
    const detail = survivors.map((s) => `pid ${s.pid} (${s.command})`).join(', ');
    dialog.showErrorBox(
      'Maestro could not verify a clean shutdown',
      `These processes survived teardown and would have been orphaned:\n\n${detail}\n\n` +
        'They will be reaped on the next launch.',
    );
  }
}

function createWindow(): void {
  window = new BrowserWindow({
    width: 1360,
    height: 860,
    title: 'Maestro',
    backgroundColor: '#16181d',
    webPreferences: {
      preload: join(here, '..', 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devServer = process.env['MAESTRO_DEV_SERVER'];
  if (devServer !== undefined) void window.loadURL(devServer);
  else void window.loadFile(join(here, '..', 'renderer', 'index.html'));

  // Closing is a conversation, not an event: the renderer shows the pre-close
  // summary and only an acknowledgement gets us to `performQuit`.
  window.on('close', (event) => {
    if (quitConfirmed) return;
    // Teardown is already under way: hold the window open until it finishes, but
    // never ask a second time.
    if (quitting) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    window?.webContents.send(CHANNELS.requestClose);
  });

  window.on('closed', () => {
    window = null;
  });
}

async function bootstrap(): Promise<void> {
  // Durable state outside any worktree. `userData` is per-application and shared
  // across every worktree of the repository, which is the requirement.
  store = new FleetStore(defaultStorePath(app.getPath('userData')));
  await store.load();

  const repoRoot = process.env['MAESTRO_REPO'] ?? store.repoRoot;
  if (repoRoot !== '' && (await isGitRepo(repoRoot))) {
    await store.setRepoRoot(repoRoot);
    await pruneWorktrees(repoRoot);
  } else if (repoRoot !== '') {
    note(`${repoRoot} is not a git repository; Fleet creation is disabled.`);
  }

  // Reap anything a previous run left behind. Force Quit leaves survivors that no
  // shutdown hook could have caught, so the next launch is the only place to catch
  // them - and this must happen before Liveness is computed, or a dying orphan
  // would be reported as Alive.
  const recorded = store
    .list()
    .map((f) => f.processGroupId)
    .filter((p): p is number => typeof p === 'number');
  const stubborn = await supervisor.reapOrphans(recorded);
  if (stubborn.length > 0) note(`${stubborn.length} orphaned process(es) could not be reaped.`);

  const interrupted = await store.reconcileOnLaunch();
  if (interrupted.length > 0) {
    note(`Interrupted by an unclean exit: ${interrupted.join(', ')}`);
  }

  // Bounded, because the seam spawns a runtime child process and a slow or
  // unavailable runtime must degrade the application rather than hang it.
  try {
    await Promise.race([
      seam.start(),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('timed out after 20s')), 20_000),
      ),
    ]);
  } catch (cause) {
    note(`The Copilot seam did not start: ${String(cause)}`);
  }

  for (const record of store.list()) {
    await watchFleet(record);
    if (seam.isStarted) await seam.resumeSession(record.sessionId);
  }
  selectedFleet = store.list()[0]?.name ?? null;
}

function registerIpc(): void {
  ipcMain.handle(CHANNELS.getState, () => buildState());

  ipcMain.handle(CHANNELS.createFleet, async (_event, name: string) => {
    try {
      await createFleet(name);
    } catch (cause) {
      note(String(cause));
    }
    return buildState();
  });

  ipcMain.handle(CHANNELS.selectFleet, async (_event, name: string) => {
    if (store.get(name) !== undefined) selectedFleet = name;
    return buildState();
  });

  ipcMain.handle(CHANNELS.promptFleet, async (_event, name: string, prompt: string) => {
    await promptFleet(name, prompt);
    return buildState();
  });

  ipcMain.handle(CHANNELS.requestClose, async () => buildCloseSummary(await buildState()));

  ipcMain.handle(CHANNELS.confirmClose, async () => {
    if (quitting) return;
    quitting = true;
    try {
      await performQuit();
    } finally {
      quitConfirmed = true;
      window?.close();
      app.quit();
    }
  });

  ipcMain.handle(CHANNELS.cancelClose, () => undefined);
}

// Test isolation. This lets a harness run against a clean store without touching
// the operator's real Fleets. It is an input, not an output: nothing the route
// reports back travels through it.
const userDataOverride = process.env['MAESTRO_USER_DATA'];
if (userDataOverride !== undefined && userDataOverride !== '') {
  app.setPath('userData', userDataOverride);
}

/**
 * Exactly one Maestro at a time.
 *
 * Not a nicety: two instances would own overlapping process groups and the same
 * durable store, so each could reap the other's Fleets and neither could honestly
 * report zero survivors. During development a repeated-launch loop produced 952
 * live processes in a single process group, which is precisely the failure mode
 * this product exists to prevent - so the guard is structural rather than advisory.
 */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (window !== null && !window.isDestroyed()) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
}

app.whenReady().then(async () => {
  registerIpc();

  // The window comes first, deliberately. Bootstrap touches git, the process
  // table, and a runtime child process, and none of those may decide whether the
  // operator sees an interface. A route that shows nothing while it waits on a
  // provider has already failed the thing this product is for.
  createWindow();

  try {
    await bootstrap();
  } catch (cause) {
    note(`Startup did not complete: ${String(cause)}`);
  }
  await pushState();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Last line of defence. If the application is going down by any path that did not
// route through the pre-close summary, still take the process groups with it.
app.on('before-quit', () => {
  if (!quitConfirmed) void supervisor.shutdownAll();
});
