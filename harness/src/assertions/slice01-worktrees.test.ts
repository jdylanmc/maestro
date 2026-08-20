import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { slice1Assertions, branchPerFleet, worktreePerFleet } from './slice01-worktrees.ts';
import { buildRepo } from '../oracle/fixture.ts';
import { runFalsificationSuite } from '../core/falsification.ts';
import { verifyRoute, HarnessSelfCheckFailed } from '../core/run.ts';
import type { Assertion, OracleContext } from '../core/types.ts';
import { pass } from '../core/types.ts';

describe('paired falsification', () => {
  test('every shipped assertion fails against its own falsifier', async () => {
    const report = await runFalsificationSuite(slice1Assertions);
    assert.deepEqual(report.vacuous, [], 'no assertion may pass against its falsifier');
    assert.deepEqual(report.errored, [], 'no assertion may throw against its falsifier');
    assert.equal(report.healthy, true);
    assert.equal(report.findings.length, slice1Assertions.length);
  });

  test('a vacuous assertion is detected and named', async () => {
    const alwaysPasses: Assertion<OracleContext> = {
      id: 'test.vacuous',
      sliceStep: 1,
      layer: 'state-oracle',
      describe: 'An assertion that has stopped testing anything.',
      async check() {
        return pass('looks fine to me');
      },
      async falsifier() {
        const fixture = await buildRepo([{ name: 'fleet-a', mode: 'none' }]);
        return {
          why: 'fleet-a has no Worktree, so nothing here should look fine',
          context: { repoRoot: fixture.repoRoot, fleets: fixture.fleets },
          cleanup: fixture.cleanup,
        };
      },
    };

    const report = await runFalsificationSuite([alwaysPasses]);
    assert.equal(report.healthy, false);
    assert.deepEqual(report.vacuous, ['test.vacuous']);
  });

  test('the harness refuses to report on a route when any assertion is vacuous', async () => {
    const alwaysPasses: Assertion<OracleContext> = {
      id: 'test.vacuous',
      sliceStep: 1,
      layer: 'state-oracle',
      describe: 'An assertion that has stopped testing anything.',
      async check() {
        return pass('looks fine to me');
      },
      async falsifier() {
        const fixture = await buildRepo([{ name: 'fleet-a', mode: 'none' }]);
        return {
          why: 'fleet-a has no Worktree',
          context: { repoRoot: fixture.repoRoot, fleets: fixture.fleets },
          cleanup: fixture.cleanup,
        };
      },
    };

    const good = await buildRepo([
      { name: 'fleet-a', mode: 'own-branch' },
      { name: 'fleet-b', mode: 'own-branch' },
    ]);
    try {
      await assert.rejects(
        () =>
          verifyRoute([...slice1Assertions, alwaysPasses], {
            repoRoot: good.repoRoot,
            fleets: good.fleets,
          }),
        HarnessSelfCheckFailed,
        'one vacuous assertion must invalidate the whole report, not degrade it',
      );
    } finally {
      await good.cleanup();
    }
  });
});

describe('slice step 1 against a correct route', () => {
  test('two Fleets, each with its own Worktree and branch, passes', async () => {
    const fixture = await buildRepo([
      { name: 'fleet-a', mode: 'own-branch' },
      { name: 'fleet-b', mode: 'own-branch' },
    ]);
    try {
      const report = await verifyRoute(slice1Assertions, {
        repoRoot: fixture.repoRoot,
        fleets: fixture.fleets,
      });
      assert.equal(report.route.passed, true, JSON.stringify(report.route.findings, null, 2));
      for (const finding of report.route.findings) {
        assert.ok(finding.result.evidence.length > 0, `${finding.assertionId} must carry evidence`);
      }
    } finally {
      await fixture.cleanup();
    }
  });

  test('a missing Worktree fails the worktree assertion', async () => {
    const fixture = await buildRepo([
      { name: 'fleet-a', mode: 'own-branch' },
      { name: 'fleet-b', mode: 'none' },
    ]);
    try {
      const result = await worktreePerFleet.check({
        repoRoot: fixture.repoRoot,
        fleets: fixture.fleets,
      });
      assert.equal(result.ok, false);
      assert.match(result.message, /fleet-b/);
    } finally {
      await fixture.cleanup();
    }
  });

  test('a detached HEAD fails the branch assertion', async () => {
    const fixture = await buildRepo([
      { name: 'fleet-a', mode: 'own-branch' },
      { name: 'fleet-b', mode: 'detached' },
    ]);
    try {
      const result = await branchPerFleet.check({
        repoRoot: fixture.repoRoot,
        fleets: fixture.fleets,
      });
      assert.equal(result.ok, false);
      assert.match(result.message, /detached/);
    } finally {
      await fixture.cleanup();
    }
  });
});
