/**
 * Acceptance-slice step 3: "Prompt Fleet A so it delegates at least one subagent,
 * and the tree renders live with correct parentage."
 *
 * Parentage is the load-bearing word. A tree can render, look plausible, and be
 * entirely fictional - which is what happens if it is built from `parentId`. The
 * construction asserted here joins each subagent's spawning `toolCallId` to the
 * `agentId` of the agent that emitted that tool call, which is the only edge the
 * runtime's own typings describe as parentage.
 *
 * The liveness half of the requirement - helpers appearing the moment they start,
 * rather than when the operator next looks - is a screen fact and is asserted by
 * the Presentation Check. What is settled here is that the structure being
 * rendered is the true one.
 */

import type { Assertion, Falsifier, OracleContext } from '../core/types.ts';
import { claimFor, fail, pass } from '../core/types.ts';
import { buildSubagentTree, readEvents } from '../oracle/events.ts';
import { buildSessionState, type SessionSpec } from '../oracle/fixture-runtime.ts';

async function treeFalsifier(
  sessions: readonly SessionSpec[],
  why: string,
): Promise<Falsifier<OracleContext>> {
  const fixture = await buildSessionState(sessions);
  return {
    why,
    context: {
      repoRoot: '/nonexistent',
      fleets: ['fleet-a'],
      claims: [{ name: 'fleet-a', sessionId: sessions[0]!.sessionId }],
      sessionStateRoot: fixture.sessionStateRoot,
      phase: 'running',
    },
    cleanup: fixture.cleanup,
  };
}

/** The first Fleet is the one the slice prompts; steps 3 and 5 both act on it. */
function primaryFleet(context: OracleContext): string | undefined {
  return context.fleets[0];
}

export const subagentDelegated: Assertion<OracleContext> = {
  id: 'slice3.subagent-delegated',
  sliceStep: 3,
  layer: 'state-oracle',
  describe: 'Prompting Fleet A causes it to delegate at least one subagent.',

  async check(context) {
    const fleet = primaryFleet(context);
    if (fleet === undefined) return fail('no Fleet to prompt');
    const sessionId = claimFor(context, fleet)?.sessionId;
    if (sessionId === undefined || context.sessionStateRoot === undefined) {
      return fail(`Fleet "${fleet}" has no resolvable Session, so delegation cannot be observed`);
    }

    const { events, evidence } = await readEvents(context.sessionStateRoot, sessionId);
    const tree = buildSubagentTree(events);
    const count = tree.byId.size;

    return count > 0
      ? pass(`Fleet "${fleet}" delegated ${count} subagent(s).`, [evidence])
      : fail(`Fleet "${fleet}" delegated no subagents; step 3 never happened.`, [evidence]);
  },

  falsifier() {
    return treeFalsifier(
      [{ sessionId: 'session-a', subagents: [] }],
      'the session delegated no subagents at all, so the assertion must fail',
    );
  },
};

export const subagentParentageResolves: Assertion<OracleContext> = {
  id: 'slice3.parentage-resolves',
  sliceStep: 3,
  layer: 'state-oracle',
  describe:
    'Every subagent resolves to a real parent - the main agent or another subagent - with none left unresolved.',

  async check(context) {
    const fleet = primaryFleet(context);
    if (fleet === undefined) return fail('no Fleet to inspect');
    const sessionId = claimFor(context, fleet)?.sessionId;
    if (sessionId === undefined || context.sessionStateRoot === undefined) {
      return fail(`Fleet "${fleet}" has no resolvable Session`);
    }

    const { events, evidence } = await readEvents(context.sessionStateRoot, sessionId);
    const tree = buildSubagentTree(events);

    if (tree.byId.size === 0) {
      return fail('no subagents present, so parentage cannot be correct', [evidence]);
    }
    if (tree.unresolved.length > 0) {
      return fail(
        `${tree.unresolved.length} subagent(s) could not be joined to a spawning tool call: ${tree.unresolved.join(', ')}`,
        [evidence],
      );
    }

    const detail = [...tree.byId.values()]
      .map((n) => `${n.agentName}(${n.agentId.slice(0, 12)})<-${n.parentAgentId?.slice(0, 12) ?? 'main'}`)
      .join(', ');

    return pass(
      `All ${tree.byId.size} subagents resolved; ${tree.roots.length} root-spawned, max depth ${tree.maxDepth}.`,
      [evidence, { source: 'toolCallId -> emitting agentId join', detail }],
    );
  },

  falsifier() {
    return treeFalsifier(
      [
        {
          sessionId: 'session-a',
          subagents: [
            { agentId: 'tool-1', agentName: 'explore' },
            // No spawning tool call is emitted, so the join cannot resolve it.
            { agentId: 'tool-orphan', agentName: 'explore', omitToolCall: true },
          ],
        },
      ],
      'one subagent has no spawning tool call, so the parentage join must leave it unresolved',
    );
  },
};

/**
 * The regression guard, expressed as a route assertion rather than only as a unit
 * test: in a log whose `parentId` chain is fully populated, a correct tree is
 * still shallow and root-dominated. A harness that had drifted to reading
 * `parentId` would report a deep chain here instead.
 */
export const parentageIsNotTheEventChain: Assertion<OracleContext> = {
  id: 'slice3.parentage-is-not-event-chain',
  sliceStep: 3,
  layer: 'state-oracle',
  describe:
    'The subagent tree is built from the spawning tool call, not from the chronological event chain.',

  async check(context) {
    const fleet = primaryFleet(context);
    if (fleet === undefined) return fail('no Fleet to inspect');
    const sessionId = claimFor(context, fleet)?.sessionId;
    if (sessionId === undefined || context.sessionStateRoot === undefined) {
      return fail(`Fleet "${fleet}" has no resolvable Session`);
    }

    const { events, evidence } = await readEvents(context.sessionStateRoot, sessionId);
    const tree = buildSubagentTree(events);
    if (tree.byId.size === 0) return fail('no subagents present', [evidence]);

    // Every parent named must itself be a subagent in this session, or the main
    // agent. An event id can never satisfy that, so a tree built from the
    // chronological chain fails here by construction.
    const bogus = [...tree.byId.values()]
      .filter((n) => n.parentAgentId !== null && !tree.byId.has(n.parentAgentId))
      .map((n) => `${n.agentId} -> ${n.parentAgentId}`);

    return bogus.length === 0
      ? pass(
          `Every parent is the main agent or a subagent of this session (max depth ${tree.maxDepth}).`,
          [evidence],
        )
      : fail(`Parents that are not agents in this session: ${bogus.join(', ')}`, [evidence]);
  },

  falsifier() {
    return treeFalsifier(
      [
        {
          sessionId: 'session-a',
          subagents: [{ agentId: 'tool-1', agentName: 'explore', parentAgentId: 'not-an-agent' }],
        },
      ],
      'a subagent names a parent that is not an agent in the session, so the assertion must fail',
    );
  },
};

export const slice3Assertions: readonly Assertion<OracleContext>[] = [
  subagentDelegated,
  subagentParentageResolves,
  parentageIsNotTheEventChain,
];
