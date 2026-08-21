/**
 * Acceptance-slice step 5: "Drive Fleet A into a permission request and observe
 * Attention surface on that Fleet."
 *
 * Attention is a sustained unmatched `permission.requested`, paired on
 * `data.requestId` - the runtime's own predicate, which
 * `permissions.pendingRequests()` documents as reconstructing "the set of pending
 * tool permission requests from the session's event history". Maestro consumes
 * it rather than implementing a permission layer of its own.
 *
 * Two assertions, because the requirement has two halves and the second is the
 * one a route is likely to get wrong. Attention must surface **on the Fleet that
 * is blocked**, and must not appear on a Fleet that is not - Fleets have no
 * awareness of each other, so a global "something needs you" indicator would
 * satisfy the first half while violating isolation.
 */

import type { Assertion, Falsifier, OracleContext } from '../core/types.ts';
import { claimFor, fail, pass } from '../core/types.ts';
import { pendingPermissionRequests, readEvents } from '../oracle/events.ts';
import { buildSessionState, type SessionSpec } from '../oracle/fixture-runtime.ts';

async function attentionFalsifier(
  sessions: readonly SessionSpec[],
  why: string,
): Promise<Falsifier<OracleContext>> {
  const fixture = await buildSessionState(sessions);
  return {
    why,
    context: {
      repoRoot: '/nonexistent',
      fleets: sessions.map((s, i) => (i === 0 ? 'fleet-a' : 'fleet-b')),
      claims: sessions.map((s, i) => ({
        name: i === 0 ? 'fleet-a' : 'fleet-b',
        sessionId: s.sessionId,
      })),
      sessionStateRoot: fixture.sessionStateRoot,
      phase: 'running',
    },
    cleanup: fixture.cleanup,
  };
}

async function attentionFor(
  context: OracleContext,
  fleet: string,
): Promise<{ pending: readonly string[]; evidence: ReturnType<typeof fail>['evidence'] }> {
  const sessionId = claimFor(context, fleet)?.sessionId;
  if (sessionId === undefined || context.sessionStateRoot === undefined) {
    return { pending: [], evidence: [] };
  }
  const { events, evidence } = await readEvents(context.sessionStateRoot, sessionId);
  return {
    pending: pendingPermissionRequests(events).map((p) => p.requestId),
    evidence: [evidence],
  };
}

export const attentionSurfacesOnBlockedFleet: Assertion<OracleContext> = {
  id: 'slice5.attention-surfaces',
  sliceStep: 5,
  layer: 'state-oracle',
  describe: 'A Fleet blocked on an unanswered permission request shows Attention.',

  async check(context) {
    const fleet = context.fleets[0];
    if (fleet === undefined) return fail('no Fleet to drive into a permission request');
    const { pending, evidence } = await attentionFor(context, fleet);

    return pending.length > 0
      ? pass(
          `Fleet "${fleet}" has ${pending.length} unanswered permission request(s): ${pending.join(', ')}.`,
          evidence,
        )
      : fail(
          `Fleet "${fleet}" shows no unanswered permission request, so Attention never surfaced.`,
          evidence,
        );
  },

  falsifier() {
    return attentionFalsifier(
      [{ sessionId: 'session-a', completedPermissions: ['req-1'] }],
      'the only permission request was completed, so nothing is pending and Attention must not surface',
    );
  },
};

export const attentionIsPerFleet: Assertion<OracleContext> = {
  id: 'slice5.attention-is-per-fleet',
  sliceStep: 5,
  layer: 'state-oracle',
  describe: 'Attention is observed per Fleet and never inferred from another Fleet.',

  async check(context) {
    if (context.fleets.length < 2) {
      return fail('fewer than two Fleets, so per-Fleet isolation cannot be demonstrated');
    }
    const [blocked, ...others] = context.fleets;
    const first = await attentionFor(context, blocked!);
    if (first.pending.length === 0) {
      return fail(`Fleet "${blocked}" is not blocked, so this assertion has nothing to isolate`);
    }

    const leaked: string[] = [];
    const evidence = [...first.evidence];
    for (const other of others) {
      const result = await attentionFor(context, other);
      evidence.push(...result.evidence);
      if (result.pending.length > 0) leaked.push(`${other} (${result.pending.join(', ')})`);
    }

    return leaked.length === 0
      ? pass(
          `Attention is confined to "${blocked}"; ${others.length} other Fleet(s) show none.`,
          evidence,
        )
      : fail(`Attention also appears on unblocked Fleets: ${leaked.join('; ')}`, evidence);
  },

  falsifier() {
    // Both Fleets are genuinely blocked. An assertion that confines Attention to
    // the first Fleet must fail, because the second one legitimately has its own.
    return attentionFalsifier(
      [
        { sessionId: 'session-a', pendingPermissions: ['req-1'] },
        { sessionId: 'session-b', pendingPermissions: ['req-2'] },
      ],
      'a second Fleet also has an unanswered request, so Attention is not confined to the first',
    );
  },
};

export const slice5Assertions: readonly Assertion<OracleContext>[] = [
  attentionSurfacesOnBlockedFleet,
  attentionIsPerFleet,
];
