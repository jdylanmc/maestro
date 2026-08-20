/**
 * Acceptance-slice step 1: "Create two named Fleets; each gets its own Worktree
 * and branch, enforced."
 *
 * Worktree-per-Fleet is a hard rule, not a strong default, and branch-per-Fleet
 * follows from it as a verified git constraint rather than a policy choice: two
 * worktrees cannot check out the same branch. That constraint is why the branch
 * assertion's falsifier uses a detached HEAD - git will not let a fixture put two
 * worktrees on one branch, so the realistic way for this assertion to be wrong is
 * a Fleet sitting on no branch at all.
 */

import type { Assertion, Falsifier, OracleContext } from '../core/types.ts';
import { fail, pass } from '../core/types.ts';
import { probeWorktrees, worktreesForFleet } from '../oracle/git.ts';
import { buildRepo } from '../oracle/fixture.ts';

async function falsifierFrom(
  specs: Parameters<typeof buildRepo>[0],
  why: string,
): Promise<Falsifier<OracleContext>> {
  const fixture = await buildRepo(specs);
  return {
    why,
    context: { repoRoot: fixture.repoRoot, fleets: fixture.fleets },
    cleanup: fixture.cleanup,
  };
}

export const worktreePerFleet: Assertion<OracleContext> = {
  id: 'slice1.worktree-per-fleet',
  sliceStep: 1,
  layer: 'state-oracle',
  describe: 'Every Fleet has exactly one Worktree of its own, and Fleets never share a checkout.',

  async check(context) {
    const { entries, evidence } = await probeWorktrees(context.repoRoot);
    const problems: string[] = [];
    const seen = new Map<string, string>();

    for (const fleet of context.fleets) {
      const owned = worktreesForFleet(entries, fleet);
      if (owned.length === 0) problems.push(`Fleet "${fleet}" has no Worktree of its own`);
      else if (owned.length > 1) problems.push(`Fleet "${fleet}" has ${owned.length} Worktrees`);

      for (const entry of owned) {
        const priorOwner = seen.get(entry.path);
        if (priorOwner !== undefined) {
          problems.push(`Worktree ${entry.path} is shared by "${priorOwner}" and "${fleet}"`);
        }
        seen.set(entry.path, fleet);
      }
    }

    return problems.length === 0
      ? pass(`All ${context.fleets.length} Fleets have exactly one Worktree each.`, [evidence])
      : fail(problems.join('; '), [evidence]);
  },

  falsifier() {
    return falsifierFrom(
      [
        { name: 'fleet-a', mode: 'own-branch' },
        { name: 'fleet-b', mode: 'none' },
      ],
      'fleet-b is declared as a Fleet but has no Worktree, so the assertion must fail',
    );
  },
};

export const branchPerFleet: Assertion<OracleContext> = {
  id: 'slice1.branch-per-fleet',
  sliceStep: 1,
  layer: 'state-oracle',
  describe: "Every Fleet's Worktree is on its own branch, and no two Fleets share one.",

  async check(context) {
    const { entries, evidence } = await probeWorktrees(context.repoRoot);
    const problems: string[] = [];
    const branchOwner = new Map<string, string>();

    for (const fleet of context.fleets) {
      const owned = worktreesForFleet(entries, fleet);
      if (owned.length === 0) {
        problems.push(`Fleet "${fleet}" has no Worktree, so it has no branch`);
        continue;
      }
      for (const entry of owned) {
        if (entry.branch === undefined) {
          problems.push(`Fleet "${fleet}" is on a detached HEAD rather than its own branch`);
          continue;
        }
        const prior = branchOwner.get(entry.branch);
        if (prior !== undefined && prior !== fleet) {
          problems.push(`Branch "${entry.branch}" is shared by "${prior}" and "${fleet}"`);
        }
        branchOwner.set(entry.branch, fleet);
      }
    }

    return problems.length === 0
      ? pass(
          `Each Fleet is on its own branch: ${[...branchOwner].map(([b, f]) => `${f}=>${b}`).join(', ')}.`,
          [evidence],
        )
      : fail(problems.join('; '), [evidence]);
  },

  falsifier() {
    return falsifierFrom(
      [
        { name: 'fleet-a', mode: 'own-branch' },
        { name: 'fleet-b', mode: 'detached' },
      ],
      'fleet-b sits on a detached HEAD, so it is on no branch and the assertion must fail',
    );
  },
};

export const slice1Assertions: readonly Assertion<OracleContext>[] = [
  worktreePerFleet,
  branchPerFleet,
];
