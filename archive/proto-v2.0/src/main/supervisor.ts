/**
 * Process ownership: the requirement this whole product exists to satisfy.
 *
 * v1.0 failed it. A detached `herdr server` daemon kept Sessions and MCP servers
 * alive for two days past application exit, and macOS attributed their permission
 * prompts back to the launcher through inherited responsibility. So the rule here
 * is absolute: **no process may outlive the application.**
 *
 * Three measured facts shape this file, and each of them contradicts something
 * that sounds more obvious:
 *
 * 1. **Spawn detached, not attached.** c-0006 concluded the opposite; c-0009
 *    falsified it by measurement. A non-detached child is not a process-group
 *    leader, so it cannot be signalled as a group at all - and signalling the
 *    group is the only way to reach grandchildren.
 * 2. **`SIGTERM` is not enough.** Synthetic process trees die on it. A live
 *    Copilot Session does not: c-0012 measured five survivors stalling until
 *    `SIGKILL`. So teardown escalates rather than trusting the polite signal.
 * 3. **Reap on launch.** Being reparented to `launchd` in a packaged `.app` is
 *    harmless *provided* the application owns its groups and sweeps them at
 *    startup. Force Quit leaves survivors no shutdown hook can ever catch, and
 *    the only place to catch them is the next launch.
 */

import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface SupervisedGroup {
  readonly fleet: string;
  readonly pgid: number;
}

export interface SurvivorRow {
  readonly pid: number;
  readonly pgid: number;
  readonly command: string;
}

/**
 * Spawn a process as its own group leader and return the group id.
 *
 * `detached: true` makes the child a session/group leader, so `process.kill(-pgid)`
 * reaches it *and everything it spawns*. That transitive reach is the entire
 * point; a pid-based supervisor cannot see a grandchild.
 */
export function spawnInOwnGroup(
  command: string,
  args: readonly string[],
  options: { readonly cwd?: string; readonly env?: NodeJS.ProcessEnv } = {},
): { readonly pid: number; readonly pgid: number } {
  const child = spawn(command, [...args], {
    detached: true,
    stdio: 'ignore',
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    ...(options.env !== undefined ? { env: options.env } : {}),
  });
  child.unref();
  if (typeof child.pid !== 'number') {
    throw new Error(`failed to spawn ${command}: no pid`);
  }
  // A detached child is its own group leader, so pgid === pid.
  return { pid: child.pid, pgid: child.pid };
}

/** Every live process in any of the given groups, read from the OS process table. */
export async function survivorsOf(pgids: readonly number[]): Promise<readonly SurvivorRow[]> {
  if (pgids.length === 0) return [];
  let stdout = '';
  try {
    ({ stdout } = await run('ps', ['-A', '-o', 'pid=,pgid=,comm=']));
  } catch {
    return [];
  }
  const wanted = new Set(pgids);
  const rows: SurvivorRow[] = [];
  for (const line of stdout.split('\n')) {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
    if (m === null) continue;
    const pgid = Number(m[2]);
    if (!wanted.has(pgid)) continue;
    rows.push({ pid: Number(m[1]), pgid, command: m[3] ?? '' });
  }
  return rows;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Terminate a process group and *verify* it is gone, escalating if it is not.
 *
 * Returns the survivors that remained even after `SIGKILL`. An empty array is the
 * only acceptable result, and the caller reports rather than assumes it.
 */
export async function terminateGroup(
  pgid: number,
  options: { readonly graceMs?: number } = {},
): Promise<readonly SurvivorRow[]> {
  const graceMs = options.graceMs ?? 2000;

  try {
    process.kill(-pgid, 'SIGTERM');
  } catch {
    // ESRCH simply means the group is already gone.
    return [];
  }

  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline) {
    if ((await survivorsOf([pgid])).length === 0) return [];
    await sleep(100);
  }

  // Measured: a live Session stalls on SIGTERM. Escalate rather than report a
  // clean shutdown that did not happen.
  try {
    process.kill(-pgid, 'SIGKILL');
  } catch {
    return [];
  }
  await sleep(200);
  return survivorsOf([pgid]);
}

/**
 * The supervisor: it owns every process group any Fleet ever created, and it is
 * the only thing allowed to end them.
 */
export class Supervisor {
  private groups = new Map<string, number>();

  register(fleet: string, pgid: number): void {
    this.groups.set(fleet, pgid);
  }

  forget(fleet: string): void {
    this.groups.delete(fleet);
  }

  pgidFor(fleet: string): number | undefined {
    return this.groups.get(fleet);
  }

  all(): readonly SupervisedGroup[] {
    return [...this.groups].map(([fleet, pgid]) => ({ fleet, pgid }));
  }

  /**
   * Reap groups left behind by a previous run - the Force Quit case.
   *
   * Called at launch with the pgids recorded in durable state. A pgid may have
   * been recycled by the OS, so this is deliberately conservative: it is used to
   * clean up known-owned groups at startup, and its result is reported.
   */
  async reapOrphans(recorded: readonly number[]): Promise<readonly SurvivorRow[]> {
    const before = await survivorsOf(recorded);
    if (before.length === 0) return [];
    for (const pgid of new Set(before.map((r) => r.pgid))) {
      await terminateGroup(pgid, { graceMs: 500 });
    }
    return survivorsOf(recorded);
  }

  /**
   * Tear every group down and return whatever survived.
   *
   * The application must not exit until this returns empty, because "zero
   * surviving processes" is the requirement and an unverified shutdown is
   * precisely what produced the v1.0 defect.
   */
  async shutdownAll(): Promise<readonly SurvivorRow[]> {
    const pgids = [...this.groups.values()];
    for (const pgid of pgids) await terminateGroup(pgid);
    const remaining = await survivorsOf(pgids);
    if (remaining.length === 0) this.groups.clear();
    return remaining;
  }
}
