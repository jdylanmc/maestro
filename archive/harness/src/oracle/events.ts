/**
 * State Oracle probes that read the runtime's own event log.
 *
 * Ground truth is `~/.copilot/session-state/<session-id>/events.jsonl`, a
 * newline-delimited JSON log written by the runtime itself. The route under test
 * does not produce it and cannot edit it on the way past, which is exactly why
 * the subagent tree and Attention are asserted from here rather than from
 * anything the application reports.
 *
 * ## The parentage rule, and why it is enforced in code
 *
 * `parentId` looks like a parent-agent link and is not one. The runtime's own
 * typings describe it as "ID of the chronologically preceding event in the
 * session, forming a linked chain", and a measured session held 41,927 distinct
 * values across 41,928 events. Building a tree from it produces a plausible,
 * wholly fictional result in which consecutive parallel *siblings* appear as
 * parent and child - a failure that looks like success, which is the single most
 * dangerous shape a harness bug can take.
 *
 * The real edge is `subagent.started.data.toolCallId`, documented as "Tool call
 * ID of the parent tool invocation that spawned this sub-agent". The parent of a
 * subagent is the agent that *emitted* that tool call; an absent `agentId` on the
 * emitting event means the main agent. Revalidated across 36,517 events in two
 * sessions: 85 subagents, 100% resolved, zero unresolved, max depth 2.
 *
 * `buildSubagentTree` therefore never reads `parentId`, and `assertNoParentIdUse`
 * exists so that a future edit reintroducing it fails a test rather than a demo.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Evidence } from '../core/types.ts';

export interface RuntimeEvent {
  readonly type: string;
  readonly id?: string;
  readonly agentId?: string;
  readonly parentId?: string | null;
  readonly timestamp?: string;
  readonly ephemeral?: boolean;
  readonly data?: Record<string, unknown>;
  readonly [key: string]: unknown;
}

export interface SubagentNode {
  /** The subagent's own instance identifier. */
  readonly agentId: string;
  readonly agentName: string;
  /** The tool call that spawned it. */
  readonly toolCallId: string;
  /** The agent that emitted that tool call; `null` means the main agent. */
  readonly parentAgentId: string | null;
  readonly children: SubagentNode[];
}

export interface SubagentTree {
  readonly roots: readonly SubagentNode[];
  readonly byId: ReadonlyMap<string, SubagentNode>;
  /** Subagents whose spawning tool call could not be located. */
  readonly unresolved: readonly string[];
  readonly maxDepth: number;
}

/** Read and parse one session's event log. Malformed lines are skipped, not guessed at. */
export async function readEvents(
  sessionStateRoot: string,
  sessionId: string,
): Promise<{ readonly events: readonly RuntimeEvent[]; readonly evidence: Evidence }> {
  const path = join(sessionStateRoot, sessionId, 'events.jsonl');
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (cause) {
    return {
      events: [],
      evidence: { source: path, detail: `unreadable: ${String(cause)}` },
    };
  }

  const events: RuntimeEvent[] = [];
  let malformed = 0;
  for (const line of raw.split('\n')) {
    if (line.trim() === '') continue;
    try {
      events.push(JSON.parse(line) as RuntimeEvent);
    } catch {
      malformed += 1;
    }
  }

  return {
    events,
    evidence: {
      source: `${path} (events.jsonl)`,
      detail: `${events.length} events parsed${malformed > 0 ? `, ${malformed} malformed lines skipped` : ''}`,
    },
  };
}

/** List the session ids present under the session-state root. */
export async function listSessionIds(sessionStateRoot: string): Promise<readonly string[]> {
  try {
    const entries = await readdir(sessionStateRoot, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

function toolCallIdOf(event: RuntimeEvent): string | undefined {
  const direct = event['tool_call_id'];
  if (typeof direct === 'string') return direct;
  const data = event.data;
  if (data === undefined) return undefined;
  for (const key of ['toolCallId', 'tool_call_id', 'id']) {
    const value = data[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

/**
 * Build the subagent tree by joining each subagent's spawning `toolCallId` to the
 * `agentId` of whichever agent emitted that tool call.
 *
 * Deliberately reads only `type`, `agentId`, and `data`. `parentId` is never
 * consulted; see the module comment.
 */
export function buildSubagentTree(events: readonly RuntimeEvent[]): SubagentTree {
  // toolCallId -> agentId of the agent that emitted it (undefined value = main agent)
  const emitter = new Map<string, string | null>();
  for (const event of events) {
    if (!event.type.startsWith('tool.')) continue;
    const id = toolCallIdOf(event);
    if (id === undefined || emitter.has(id)) continue;
    emitter.set(id, typeof event.agentId === 'string' ? event.agentId : null);
  }

  const nodes = new Map<string, SubagentNode>();
  const spawnedBy = new Map<string, string>();
  const unresolved: string[] = [];

  for (const event of events) {
    if (event.type !== 'subagent.started') continue;
    const agentId = typeof event.agentId === 'string' ? event.agentId : undefined;
    const toolCallId = typeof event.data?.['toolCallId'] === 'string'
      ? (event.data['toolCallId'] as string)
      : undefined;
    if (agentId === undefined || toolCallId === undefined) continue;

    const agentName = typeof event.data?.['agentName'] === 'string'
      ? (event.data['agentName'] as string)
      : '(unnamed)';

    if (!emitter.has(toolCallId)) unresolved.push(agentId);
    const parentAgentId = emitter.get(toolCallId) ?? null;

    nodes.set(agentId, { agentId, agentName, toolCallId, parentAgentId, children: [] });
    spawnedBy.set(agentId, toolCallId);
  }

  const roots: SubagentNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentAgentId !== null ? nodes.get(node.parentAgentId) : undefined;
    if (parent !== undefined) parent.children.push(node);
    else roots.push(node);
  }

  const depthOf = (node: SubagentNode, guard: ReadonlySet<string>): number => {
    if (node.children.length === 0) return 1;
    const next = new Set(guard).add(node.agentId);
    let best = 1;
    for (const child of node.children) {
      if (guard.has(child.agentId)) continue; // cycle guard: a malformed log must not hang the harness
      best = Math.max(best, 1 + depthOf(child, next));
    }
    return best;
  };

  return {
    roots,
    byId: nodes,
    unresolved,
    maxDepth: roots.reduce((m, r) => Math.max(m, depthOf(r, new Set())), 0),
  };
}

export interface PendingPermission {
  readonly requestId: string;
  readonly timestamp?: string;
}

/**
 * Attention, as the runtime itself defines it: the set of `permission.requested`
 * events with no matching `permission.completed`, paired on `data.requestId`.
 *
 * This is the same predicate `permissions.pendingRequests()` documents -
 * "Reconstructs the set of pending tool permission requests from the session's
 * event history" - computed from the log rather than from the SDK, so the
 * assertion holds for a Parked Fleet whose process is gone.
 */
export function pendingPermissionRequests(
  events: readonly RuntimeEvent[],
): readonly PendingPermission[] {
  const requested = new Map<string, PendingPermission>();
  const completed = new Set<string>();

  for (const event of events) {
    const requestId = event.data?.['requestId'];
    if (typeof requestId !== 'string') continue;
    if (event.type === 'permission.requested') {
      requested.set(requestId, { requestId, ...(event.timestamp !== undefined ? { timestamp: event.timestamp } : {}) });
    } else if (event.type === 'permission.completed') {
      completed.add(requestId);
    }
  }

  return [...requested.values()].filter((r) => !completed.has(r.requestId));
}

/** Count of events the runtime marked transient and did not persist. */
export function ephemeralCount(events: readonly RuntimeEvent[]): number {
  return events.filter((e) => e.ephemeral === true).length;
}

/**
 * Guard against the single most dangerous regression this harness can suffer.
 *
 * Called by the test suite against this module's own source. If a future edit
 * reintroduces `parentId` as a structural input, a test fails - rather than the
 * harness quietly reporting a plausible, fictional tree.
 *
 * The guard deliberately does not scan itself: everything from its own
 * declaration onward is excluded, because this function necessarily mentions the
 * very identifier it forbids. It also strips comments and string literals, so
 * prose about `parentId` never trips it.
 */
export function assertNoParentIdUse(source: string): void {
  const selfMarker = 'export function assertNoParentIdUse';
  const selfAt = source.indexOf(selfMarker);
  const scanned = selfAt === -1 ? source : source.slice(0, selfAt);

  const stripped = scanned
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');

  const offending = stripped
    .split('\n')
    .filter((line) => /\bparentId\b/.test(line))
    // The interface field may be *declared*; it must never be read.
    .filter((line) => !/readonly parentId\?:/.test(line));

  if (offending.length > 0) {
    throw new Error(
      'events.ts reads `parentId`, which is a chronological chain pointer and not a ' +
        'parent-agent link. Offending lines:\n' + offending.join('\n'),
    );
  }
}
