/**
 * The complete Acceptance Slice, as one set of suites.
 *
 * Every route is judged by exactly this, which is the point: four stacks compared
 * on the same evidence rather than on how easy each was to instrument.
 */

import type { Suites } from '../core/run.ts';
import { slice1Assertions } from './slice01-worktrees.ts';
import { slice2Assertions } from './slice02-sessions.ts';
import { slice3Assertions } from './slice03-subagents.ts';
import { slice4Assertions } from './slice04-presentation.ts';
import { slice5Assertions } from './slice05-attention.ts';
import { slice6Assertions } from './slice06-teardown.ts';

export const acceptanceSlice: Suites = {
  stateOracle: [
    ...slice1Assertions,
    ...slice2Assertions,
    ...slice3Assertions,
    ...slice5Assertions,
    ...slice6Assertions,
  ],
  presentationCheck: [...slice4Assertions],
};

export const allAssertionIds: readonly string[] = [
  ...acceptanceSlice.stateOracle.map((a) => a.id),
  ...acceptanceSlice.presentationCheck.map((a) => a.id),
];
