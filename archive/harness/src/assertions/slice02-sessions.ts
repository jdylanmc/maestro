/**
 * Acceptance-slice step 2: "Present each Fleet's primary agent window, bound 1:1."
 *
 * The window is a screen fact and belongs to the Presentation Check. What the
 * State Oracle can settle from outside is the *binding* underneath it: exactly
 * one Copilot Session per Fleet, no Session serving two Fleets, and every claimed
 * Session actually existing in the runtime's own state directory.
 *
 * That split matters. A route could render two windows that are secretly the same
 * Session and look correct on screen; only the external check catches it.
 */

import type { Assertion, Falsifier, OracleContext } from '../core/types.ts';
import { claimFor, fail, pass } from '../core/types.ts';
import { listSessionIds } from '../oracle/events.ts';
import { buildSessionState, type SessionSpec } from '../oracle/fixture-runtime.ts';

async function sessionFalsifier(
  sessions: readonly SessionSpec[],
  claims: OracleContext['claims'],
  why: string,
): Promise<Falsifier<OracleContext>> {
  const fixture = await buildSessionState(sessions);
  return {
    why,
    context: {
      repoRoot: '/nonexistent',
      fleets: (claims ?? []).map((c) => c.name),
      claims,
      sessionStateRoot: fixture.sessionStateRoot,
      phase: 'running',
    },
    cleanup: fixture.cleanup,
  };
}

export const sessionPerFleet: Assertion<OracleContext> = {
  id: 'slice2.session-per-fleet',
  sliceStep: 2,
  layer: 'state-oracle',
  describe: 'Each Fleet is bound to exactly one Copilot Session, and no Session serves two Fleets.',

  async check(context) {
    if (context.sessionStateRoot === undefined) {
      return fail('no session-state root supplied, so the binding cannot be checked externally');
    }
    const present = new Set(await listSessionIds(context.sessionStateRoot));
    const evidence = [
      {
        source: `${context.sessionStateRoot} (session-state directory listing)`,
        detail: present.size === 0 ? '(no sessions)' : [...present].join(', '),
      },
    ];

    const problems: string[] = [];
    const owner = new Map<string, string>();

    for (const fleet of context.fleets) {
      const claim = claimFor(context, fleet);
      if (claim?.sessionId === undefined) {
        problems.push(`Fleet "${fleet}" claims no Session, so nothing is bound to its window`);
        continue;
      }
      if (!present.has(claim.sessionId)) {
        problems.push(`Fleet "${fleet}" claims Session ${claim.sessionId}, which does not exist`);
      }
      const prior = owner.get(claim.sessionId);
      if (prior !== undefined) {
        problems.push(`Session ${claim.sessionId} is shared by "${prior}" and "${fleet}"`);
      }
      owner.set(claim.sessionId, fleet);
    }

    return problems.length === 0
      ? pass(
          `All ${context.fleets.length} Fleets are bound 1:1 to existing Sessions: ${[...owner]
            .map(([s, f]) => `${f}=>${s}`)
            .join(', ')}.`,
          evidence,
        )
      : fail(problems.join('; '), evidence);
  },

  falsifier() {
    // One Session, two Fleets: the binding is 2:1, so the assertion must fail.
    return sessionFalsifier(
      [{ sessionId: 'session-shared' }],
      [
        { name: 'fleet-a', sessionId: 'session-shared' },
        { name: 'fleet-b', sessionId: 'session-shared' },
      ],
      'both Fleets are bound to the same Session, so the 1:1 binding must fail',
    );
  },
};

export const claimedSessionsExist: Assertion<OracleContext> = {
  id: 'slice2.claimed-sessions-exist',
  sliceStep: 2,
  layer: 'state-oracle',
  describe: "Every Session a Fleet claims is present in the runtime's own state directory.",

  async check(context) {
    if (context.sessionStateRoot === undefined) {
      return fail('no session-state root supplied, so claimed Sessions cannot be corroborated');
    }
    const present = new Set(await listSessionIds(context.sessionStateRoot));
    const missing: string[] = [];
    for (const fleet of context.fleets) {
      const sessionId = claimFor(context, fleet)?.sessionId;
      if (sessionId === undefined) missing.push(`${fleet} (no claim)`);
      else if (!present.has(sessionId)) missing.push(`${fleet} => ${sessionId}`);
    }
    const evidence = [
      {
        source: `${context.sessionStateRoot} (session-state directory listing)`,
        detail: present.size === 0 ? '(no sessions)' : [...present].join(', '),
      },
    ];
    return missing.length === 0
      ? pass(`Every claimed Session exists on disk (${present.size} present).`, evidence)
      : fail(`Sessions claimed but absent from runtime state: ${missing.join(', ')}`, evidence);
  },

  falsifier() {
    // The Fleet claims a Session the runtime has never heard of.
    return sessionFalsifier(
      [{ sessionId: 'session-a' }],
      [
        { name: 'fleet-a', sessionId: 'session-a' },
        { name: 'fleet-b', sessionId: 'session-that-never-existed' },
      ],
      'fleet-b claims a Session absent from runtime state, so the assertion must fail',
    );
  },
};

export const slice2Assertions: readonly Assertion<OracleContext>[] = [
  sessionPerFleet,
  claimedSessionsExist,
];
