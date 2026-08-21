import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { acceptanceSlice } from './index.ts';
import { selfCheck, verifyRoute, formatReport } from '../core/run.ts';
import { buildRepo } from '../oracle/fixture.ts';
import { buildSessionState, spawnAndReapProcessGroups } from '../oracle/fixture-runtime.ts';
import { fakeDriver } from './slice04-presentation.ts';

/**
 * A world in which a correct route has just been quit: two Fleets, each with its
 * own worktree, branch, and Session; Fleet A delegated a subagent and is blocked
 * on a permission request; and no process survives in either recorded group.
 */
async function correctAfterQuitWorld() {
  const repo = await buildRepo([
    { name: 'fleet-a', mode: 'own-branch' },
    { name: 'fleet-b', mode: 'own-branch' },
  ]);
  const sessions = await buildSessionState([
    {
      sessionId: 'session-a',
      subagents: [{ agentId: 'tc-1', agentName: 'explore' }],
      pendingPermissions: ['req-1'],
    },
    { sessionId: 'session-b' },
  ]);
  const groups = await spawnAndReapProcessGroups(2);

  return {
    world: {
      oracle: {
        repoRoot: repo.repoRoot,
        fleets: ['fleet-a', 'fleet-b'],
        claims: [
          { name: 'fleet-a', sessionId: 'session-a', processGroupId: groups.processGroupIds[0] },
          { name: 'fleet-b', sessionId: 'session-b', processGroupId: groups.processGroupIds[1] },
        ],
        sessionStateRoot: sessions.sessionStateRoot,
        phase: 'after-quit' as const,
      },
      presentation: { fleets: ['fleet-a', 'fleet-b'], driver: fakeDriver({ stale: false }) },
    },
    cleanup: async () => {
      await groups.cleanup();
      await sessions.cleanup();
      await repo.cleanup();
    },
  };
}

describe('the full acceptance slice', () => {
  test('every shipped assertion fails against its own falsifier', async () => {
    const report = await selfCheck(acceptanceSlice);
    assert.deepEqual(report.vacuous, [], 'no assertion may pass against its falsifier');
    assert.deepEqual(report.errored, [], 'no assertion may throw against its falsifier');
    assert.equal(report.healthy, true);
  });

  test('falsification granularity is per assertion, not per slice step', async () => {
    const report = await selfCheck(acceptanceSlice);
    const all = [
      ...acceptanceSlice.stateOracle.map((a) => a.id),
      ...acceptanceSlice.presentationCheck.map((a) => a.id),
    ];
    assert.equal(report.findings.length, all.length);
    assert.deepEqual(
      report.findings.map((f) => f.assertionId).sort(),
      [...all].sort(),
      'every assertion is falsified individually',
    );
    // More than one assertion per step in several steps: proves the granularity claim.
    const perStep = new Map<number, number>();
    for (const a of acceptanceSlice.stateOracle) {
      perStep.set(a.sliceStep, (perStep.get(a.sliceStep) ?? 0) + 1);
    }
    assert.ok([...perStep.values()].some((n) => n > 1));
  });

  test('all six slice steps are covered', () => {
    const steps = new Set([
      ...acceptanceSlice.stateOracle.map((a) => a.sliceStep),
      ...acceptanceSlice.presentationCheck.map((a) => a.sliceStep),
    ]);
    assert.deepEqual([...steps].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
  });

  test('a correct route passes every assertion and carries evidence', async () => {
    const { world, cleanup } = await correctAfterQuitWorld();
    try {
      const report = await verifyRoute(acceptanceSlice, world);
      assert.equal(
        report.route.passed,
        true,
        formatReport(report),
      );
      assert.equal(report.route.manualResidue.length, 0, 'a driver was supplied, so nothing is manual');
      for (const finding of report.route.findings) {
        if (finding.layer === 'state-oracle') {
          assert.ok(
            finding.result.evidence.length > 0,
            `${finding.assertionId} must carry external evidence`,
          );
        }
      }
    } finally {
      await cleanup();
    }
  });

  test('a surviving process fails the route without breaking the harness', async () => {
    const { world, cleanup } = await correctAfterQuitWorld();
    try {
      // Claim a process group that certainly has a live member: our own. It must
      // be the *group* id, not the pid - `ps` filters on pgid, and a pid that is
      // not a group leader matches nothing, which would make this test pass for
      // entirely the wrong reason.
      const ownPgid = Number(
        (await promisify(execFile)('ps', ['-o', 'pgid=', '-p', String(process.pid)])).stdout.trim(),
      );
      assert.ok(Number.isInteger(ownPgid) && ownPgid > 0, 'could not read our own pgid');

      const doomed = {
        ...world,
        oracle: {
          ...world.oracle,
          claims: [
            { name: 'fleet-a', sessionId: 'session-a', processGroupId: ownPgid },
            { name: 'fleet-b', sessionId: 'session-b', processGroupId: ownPgid },
          ],
        },
      };
      const report = await verifyRoute(acceptanceSlice, doomed);
      assert.equal(report.route.passed, false);
      const teardown = report.route.findings.find((f) => f.assertionId === 'slice6.zero-survivors');
      assert.equal(teardown?.result.ok, false);
      assert.match(teardown!.result.message, /survived the quit/);
    } finally {
      await cleanup();
    }
  });

  test('a route that records no process group cannot pass teardown', async () => {
    const { world, cleanup } = await correctAfterQuitWorld();
    try {
      const unrecorded = {
        ...world,
        oracle: {
          ...world.oracle,
          claims: [
            { name: 'fleet-a', sessionId: 'session-a' },
            { name: 'fleet-b', sessionId: 'session-b' },
          ],
        },
      };
      const report = await verifyRoute(acceptanceSlice, unrecorded);
      const teardown = report.route.findings.find((f) => f.assertionId === 'slice6.zero-survivors');
      assert.equal(teardown?.result.ok, false, 'recording nothing must not be a free pass');
      assert.match(teardown!.result.message, /unfalsifiable/);
    } finally {
      await cleanup();
    }
  });
});

describe('automation reach and manual residue', () => {
  test('with no Presentation Check driver, those assertions are disclosed as manual, not skipped', async () => {
    const { world, cleanup } = await correctAfterQuitWorld();
    try {
      const noDriver = { ...world, presentation: { fleets: world.presentation.fleets } };
      const report = await verifyRoute(acceptanceSlice, noDriver);

      assert.equal(
        report.route.manualResidue.length,
        acceptanceSlice.presentationCheck.length,
        'every un-automated assertion must be named',
      );
      // Pass or fail never depends on automation reach.
      assert.equal(report.route.passed, true);
      assert.equal(report.route.automationReach['presentation-check'], '0/2 (0%)');
      assert.match(formatReport(report), /Manual residue \(2\)/);
    } finally {
      await cleanup();
    }
  });

  test('with a driver, automation reach is full and residue is empty', async () => {
    const { world, cleanup } = await correctAfterQuitWorld();
    try {
      const report = await verifyRoute(acceptanceSlice, world);
      assert.equal(report.route.automationReach['presentation-check'], '2/2 (100%)');
      assert.match(formatReport(report), /Manual residue: none/);
    } finally {
      await cleanup();
    }
  });

  test('a stale-state driver fails panel re-scoping', async () => {
    const { world, cleanup } = await correctAfterQuitWorld();
    try {
      const stale = {
        ...world,
        presentation: { fleets: world.presentation.fleets, driver: fakeDriver({ stale: true }) },
      };
      const report = await verifyRoute(acceptanceSlice, stale);
      assert.equal(report.route.passed, false);
      const rescope = report.route.findings.find(
        (f) => f.assertionId === 'slice4.every-panel-rescopes',
      );
      assert.equal(rescope?.result.ok, false);
    } finally {
      await cleanup();
    }
  });
});
