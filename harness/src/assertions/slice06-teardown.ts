/**
 * Acceptance-slice step 6: "Quit through the pre-close summary, auto-Parking both
 * Fleets with zero surviving processes; relaunch and find both Fleets with
 * identity, history, Worktree, and recomputed Liveness intact."
 *
 * This is the requirement the whole product exists to satisfy - durable state
 * persists, processes do not - and it is the one v1.0 failed: a detached
 * `herdr server` daemon kept Sessions alive for two days past application exit.
 * So it is asserted in both directions. Zero survivors is only half of it; a
 * route that never started anything would pass that half trivially, and a route
 * that deleted its state on quit would pass it enthusiastically.
 */

import type { Assertion, Falsifier, OracleContext } from '../core/types.ts';
import { claimFor, fail, pass } from '../core/types.ts';
import { probeProcessGroups } from '../oracle/process.ts';
import { probeWorktrees, worktreesForFleet } from '../oracle/git.ts';
import { listSessionIds } from '../oracle/events.ts';
import { buildRepo } from '../oracle/fixture.ts';
import {
  buildSessionState,
  spawnAndReapProcessGroups,
  spawnLiveProcessGroups,
} from '../oracle/fixture-runtime.ts';

/** Build an after-quit world: worktrees and session state intact, processes gone. */
async function teardownFalsifier(
  options: { readonly leaveSurvivors: boolean; readonly keepWorktrees: boolean },
  why: string,
): Promise<Falsifier<OracleContext>> {
  const repo = await buildRepo(
    options.keepWorktrees
      ? [
          { name: 'fleet-a', mode: 'own-branch' },
          { name: 'fleet-b', mode: 'own-branch' },
        ]
      : [],
  );
  const sessions = await buildSessionState([
    { sessionId: 'session-a' },
    { sessionId: 'session-b' },
  ]);
  const groups = options.leaveSurvivors
    ? await spawnLiveProcessGroups(2)
    : await spawnAndReapProcessGroups(2);

  return {
    why,
    context: {
      repoRoot: repo.repoRoot,
      fleets: ['fleet-a', 'fleet-b'],
      claims: [
        { name: 'fleet-a', sessionId: 'session-a', processGroupId: groups.processGroupIds[0] },
        { name: 'fleet-b', sessionId: 'session-b', processGroupId: groups.processGroupIds[1] },
      ],
      sessionStateRoot: sessions.sessionStateRoot,
      phase: 'after-quit',
    },
    cleanup: async () => {
      await groups.cleanup();
      await sessions.cleanup();
      await repo.cleanup();
    },
  };
}

function claimedGroups(context: OracleContext): readonly number[] {
  return context.fleets
    .map((f) => claimFor(context, f)?.processGroupId)
    .filter((p): p is number => typeof p === 'number');
}

export const zeroSurvivorsAfterQuit: Assertion<OracleContext> = {
  id: 'slice6.zero-survivors',
  sliceStep: 6,
  layer: 'state-oracle',
  describe: 'After quitting, no process survives in any process group a Fleet owned.',

  async check(context) {
    if (context.phase !== 'after-quit') {
      return fail(`teardown can only be asserted after the quit; phase is "${context.phase ?? 'unset'}"`);
    }
    const groups = claimedGroups(context);
    if (groups.length === 0) {
      return fail(
        'no Fleet recorded a process group, so zero survivors is unfalsifiable - ' +
          'a route that records nothing must not be able to pass teardown',
      );
    }

    const { rows, evidence } = await probeProcessGroups(groups);
    return rows.length === 0
      ? pass(`Zero survivors across ${groups.length} process group(s).`, [evidence])
      : fail(
          `${rows.length} process(es) survived the quit: ${rows
            .map((r) => `pid ${r.pid} (${r.command})`)
            .join(', ')}`,
          [evidence],
        );
  },

  falsifier() {
    return teardownFalsifier(
      { leaveSurvivors: true, keepWorktrees: true },
      'two process groups are still alive after the quit, so the assertion must fail',
    );
  },
};

export const durableStateSurvivesQuit: Assertion<OracleContext> = {
  id: 'slice6.durable-state-survives',
  sliceStep: 6,
  layer: 'state-oracle',
  describe:
    'After quitting, every Fleet still has its Worktree and its Session state on disk, ready to relaunch.',

  async check(context) {
    if (context.phase !== 'after-quit') {
      return fail(`durability can only be asserted after the quit; phase is "${context.phase ?? 'unset'}"`);
    }
    if (context.sessionStateRoot === undefined) {
      return fail('no session-state root supplied, so durability cannot be checked');
    }

    const { entries, evidence } = await probeWorktrees(context.repoRoot).catch(() => ({
      entries: [] as never[],
      evidence: { source: `git worktree list (cwd=${context.repoRoot})`, detail: 'unreadable' },
    }));
    const present = new Set(await listSessionIds(context.sessionStateRoot));

    const problems: string[] = [];
    for (const fleet of context.fleets) {
      if (worktreesForFleet(entries, fleet).length === 0) {
        problems.push(`Fleet "${fleet}" lost its Worktree on quit`);
      }
      const sessionId = claimFor(context, fleet)?.sessionId;
      if (sessionId === undefined) problems.push(`Fleet "${fleet}" claims no Session to resume`);
      else if (!present.has(sessionId)) {
        problems.push(`Fleet "${fleet}" lost Session ${sessionId} on quit`);
      }
    }

    return problems.length === 0
      ? pass(
          `All ${context.fleets.length} Fleets kept their Worktree and Session across the quit.`,
          [evidence],
        )
      : fail(problems.join('; '), [evidence]);
  },

  falsifier() {
    return teardownFalsifier(
      { leaveSurvivors: false, keepWorktrees: false },
      'the Worktrees were removed on quit, so durable state did not survive and the assertion must fail',
    );
  },
};

export const slice6Assertions: readonly Assertion<OracleContext>[] = [
  zeroSurvivorsAfterQuit,
  durableStateSurvivesQuit,
];
