/**
 * Drive the v2 Electron route through the acceptance slice, then judge it.
 *
 * This script is the route's *driver*, not its judge. It performs the six-step
 * slice the way an operator would - clicking, typing, quitting - and records only
 * identifiers as it goes. Every verdict is then produced by the harness from
 * external ground truth: git, `ps`, and the runtime's own event log.
 *
 * The separation matters. If this script decided anything, the route would be
 * grading its own homework.
 *
 *   node --experimental-strip-types src/routes/run-electron.ts \
 *     --app <path to Maestro.app/Contents/MacOS/Maestro> \
 *     --repo <path to a git repository>
 */

import { existsSync } from 'node:fs';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { ElectronPresentationDriver } from '../drivers/electron.ts';
import { acceptanceSlice } from '../assertions/index.ts';
import { formatReport, verifyRoute, HarnessSelfCheckFailed } from '../core/run.ts';
import type { RouteWorld } from '../core/run.ts';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const FLEET_A = 'fleet-a';
const FLEET_B = 'fleet-b';

interface Recorded {
  readonly name: string;
  readonly sessionId: string;
  readonly processGroupId?: number;
}

/**
 * Read the identifiers the route recorded, from its own durable store.
 *
 * This is the one place the route's state is read, and it is read as a *claim* to
 * be checked - the harness resolves every id against git, `ps`, and the event log.
 */
async function readClaims(userData: string): Promise<readonly Recorded[]> {
  let raw: string;
  try {
    raw = await readFile(join(userData, 'fleets.json'), 'utf8');
  } catch {
    return [];
  }
  const parsed = JSON.parse(raw) as {
    fleets: readonly { name: string; sessionId: string; processGroupId?: number }[];
  };
  return parsed.fleets.map((f) => ({
    name: f.name,
    sessionId: f.sessionId,
    ...(f.processGroupId !== undefined ? { processGroupId: f.processGroupId } : {}),
  }));
}

/** A running-phase oracle context, used only to satisfy the shared world shape. */
function liveOracle(repoRoot: string, claims: readonly Recorded[]) {
  return {
    repoRoot,
    fleets: claims.map((c) => c.name),
    claims: claims.map((c) => ({
      name: c.name,
      sessionId: c.sessionId,
      ...(c.processGroupId !== undefined ? { processGroupId: c.processGroupId } : {}),
    })),
    sessionStateRoot: join(homedir(), '.copilot', 'session-state'),
    phase: 'running' as const,
  };
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      app: { type: 'string' },
      repo: { type: 'string' },
    },
  });

  if (values.app === undefined || values.repo === undefined) {
    console.error('usage: run-electron.ts --app <executable> --repo <git repo>');
    return 64;
  }

  const userData = await mkdtemp(join(tmpdir(), 'maestro-route-'));
  const evidence: Record<string, unknown> = {};

  const driver = new ElectronPresentationDriver({
    executablePath: values.app,
    env: { MAESTRO_REPO: values.repo, MAESTRO_USER_DATA: userData, MAESTRO_FORCE_ASK: '1' },
  });

  console.log('--- launching the packaged route ---');
  await driver.launch();
  evidence['appPid'] = driver.pid;
  console.log(`launched, main pid ${driver.pid ?? 'unknown'}`);

  console.log('--- step 1: creating two Fleets ---');
  await driver.createFleet(FLEET_A);
  await driver.createFleet(FLEET_B);

  // Give the route time to bind Sessions, and **measure how long it takes**.
  //
  // This is not padding. Binding a Session means starting the Copilot runtime, and
  // how long that takes is a real cost of this stack's SDK path - so it belongs in
  // the executive report rather than being hidden inside a fixed sleep.
  console.log('--- waiting for Sessions to bind ---');
  const bindStart = Date.now();
  let bound: readonly Recorded[] = [];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    bound = await readClaims(userData);
    const allBound =
      bound.length >= 2 &&
      bound.every((c) => existsSync(join(homedir(), '.copilot', 'session-state', c.sessionId)));
    if (allBound) break;
    await sleep(2000);
  }
  const bindMs = Date.now() - bindStart;
  evidence['sessionBindMs'] = bindMs;
  evidence['sessionsBound'] = bound.filter((c) =>
    existsSync(join(homedir(), '.copilot', 'session-state', c.sessionId)),
  ).length;
  console.log(`sessions bound: ${String(evidence['sessionsBound'])}/2 after ${bindMs} ms`);

  console.log('--- steps 2 and 4: selection and re-scoping ---');
  await driver.selectFleet(FLEET_A);
  await sleep(400);
  evidence['snapshotAfterSelectingA'] = await driver.snapshot();

  // Step 3 needs a live model turn, which is quota-gated. A failure here is
  // recorded rather than hidden.
  console.log('--- step 3: prompting Fleet A ---');
  // Two things must happen from one prompt: a subagent must be delegated (step 3)
  // and a permission request must be raised and left unanswered (step 5). The
  // route ships no permission handler, so any request the runtime raises stays
  // pending - which is precisely what Attention is.
  await driver.promptFleet(
    'First use a subagent to summarise README.md. Then run the shell command: ' +
      'echo maestro-attention-probe > /tmp/maestro-attention-probe.txt',
  );
  await sleep(25000);
  evidence['subagentsVisibleAfterPrompt'] = await driver.visibleSubagents();

  console.log('--- step 4: selecting Fleet B ---');
  await driver.selectFleet(FLEET_B);
  await sleep(400);
  evidence['snapshotAfterSelectingB'] = await driver.snapshot();

  evidence['attentionOnA'] = await driver.attentionOn(FLEET_A);
  evidence['attentionOnB'] = await driver.attentionOn(FLEET_B);

  await driver.screenshot(join(userData, 'route.png')).catch(() => undefined);

  // Capture claims while the app is alive, so process groups are recorded before
  // teardown removes them.
  evidence['claimsWhileRunning'] = await readClaims(userData);

  // The Presentation Check must run **while the application is alive**. Running it
  // after the quit would report 0% automation reach for a route that is in fact
  // fully automatable - which is not a neutral omission: automation reach is an
  // input to the comparative evaluation, so under-reporting it would bias the
  // stack comparison this harness exists to make fair.
  console.log('--- step 4 (asserted live): Presentation Check ---');
  const presentationReport = await verifyRoute(
    { stateOracle: [], presentationCheck: acceptanceSlice.presentationCheck },
    { oracle: liveOracle(values.repo, await readClaims(userData)), presentation: { fleets: [FLEET_A, FLEET_B], driver } },
  );
  evidence['presentationFindings'] = presentationReport.route.findings.map((f) => ({
    id: f.assertionId,
    ok: f.result.ok,
    message: f.result.message,
  }));

  // Step 6 must go through the pre-close summary, not around it.
  console.log('--- step 6: quitting through the pre-close summary ---');
  let quitPath = 'pre-close summary';
  try {
    await driver.requestClose();
    await driver.quitThroughSummary();
    await sleep(3500);
  } catch (cause) {
    quitPath = `direct close (summary not reached: ${String(cause).slice(0, 120)})`;
  }
  evidence['quitPath'] = quitPath;
  await driver.close();
  await sleep(2000);

  const claims = await readClaims(userData);

  const world: RouteWorld = {
    oracle: {
      repoRoot: values.repo,
      fleets: claims.map((c) => c.name),
      claims: claims.map((c) => ({
        name: c.name,
        sessionId: c.sessionId,
        ...(c.processGroupId !== undefined ? { processGroupId: c.processGroupId } : {}),
      })),
      sessionStateRoot: join(homedir(), '.copilot', 'session-state'),
      phase: 'after-quit',
    },
    // The app is gone, so the Presentation Check cannot run against it now. Its
    // measurements were taken above while it was live and appear as evidence,
    // rather than being smuggled into a verdict.
    presentation: { fleets: claims.map((c) => c.name) },
  };

  await writeFile(join(userData, 'world.json'), JSON.stringify(world.oracle, null, 2), 'utf8');

  console.log('\n=== route evidence ===');
  console.log(JSON.stringify(evidence, null, 2));

  console.log('\n=== harness verdict ===');
  try {
    // State Oracle after the quit; the Presentation Check was measured live above
    // and its findings are merged in, so the report states one automation reach
    // for the whole route rather than two partial ones.
    const report = await verifyRoute(
      { stateOracle: acceptanceSlice.stateOracle, presentationCheck: [] },
      world,
    );
    const merged = {
      ...report,
      route: {
        ...report.route,
        passed:
          report.route.passed &&
          presentationReport.route.findings.every((f) => f.result.ok),
        findings: [...report.route.findings, ...presentationReport.route.findings],
        manualResidue: [
          ...report.route.manualResidue,
          ...presentationReport.route.manualResidue,
        ],
        automationReach: {
          'state-oracle': report.route.automationReach['state-oracle'] ?? 'n/a',
          'presentation-check':
            presentationReport.route.automationReach['presentation-check'] ?? 'n/a',
        },
      },
    };
    console.log(formatReport(merged));
    console.log(`\nartifacts: ${userData}`);
    return merged.route.passed ? 0 : 1;
  } catch (cause) {
    if (cause instanceof HarnessSelfCheckFailed) {
      console.error(cause.message);
      return 3;
    }
    throw cause;
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (cause: unknown) => {
    console.error(cause);
    process.exitCode = 3;
  },
);
