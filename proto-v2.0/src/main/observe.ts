/**
 * What a Fleet is doing, observed rather than reported.
 *
 * Everything here reads the runtime's own `events.jsonl`. Maestro reads **only
 * generic runtime evidence**: it does not special-case any orchestration skill,
 * and it never asks a Fleet to describe itself.
 *
 * ## Parentage
 *
 * `parentId` is not a parent-agent link. The runtime's own typings call it "ID of
 * the chronologically preceding event in the session, forming a linked chain",
 * and one measured session held 41,927 distinct values across 41,928 events. A
 * tree built from it is plausible and entirely fictional - parallel *siblings*
 * render as parent and child.
 *
 * The real edge is `subagent.started.data.toolCallId` joined to the `agentId` of
 * whichever agent emitted that tool call; an absent `agentId` there means the
 * main agent. Nothing in this file reads `parentId`.
 *
 * ## Liveness
 *
 * The tree updates **live** - helpers appear the moment they start - so this
 * module watches the log rather than sampling it when someone looks. The durable
 * log is the fallback for a Parked or Dead Fleet, whose processes are gone but
 * whose history is not.
 */

import { watch, type FSWatcher } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface RuntimeEvent {
  readonly type: string;
  readonly agentId?: string;
  readonly timestamp?: string;
  readonly data?: Record<string, unknown>;
  readonly [key: string]: unknown;
}

export interface SubagentNode {
  readonly agentId: string;
  readonly agentName: string;
  readonly parentAgentId: string | null;
  readonly status: 'running' | 'completed' | 'failed';
  children: SubagentNode[];
}

export interface FleetObservation {
  readonly tree: readonly SubagentNode[];
  /** Unmatched `permission.requested` ids: the Attention predicate. */
  readonly pendingPermissions: readonly string[];
  readonly attention: boolean;
  readonly eventCount: number;
  readonly lastEventAt?: string;
}

export function sessionStateRoot(): string {
  return join(homedir(), '.copilot', 'session-state');
}

export function eventLogPath(sessionId: string, root = sessionStateRoot()): string {
  return join(root, sessionId, 'events.jsonl');
}

export async function readEventLog(
  sessionId: string,
  root = sessionStateRoot(),
): Promise<readonly RuntimeEvent[]> {
  let raw: string;
  try {
    raw = await readFile(eventLogPath(sessionId, root), 'utf8');
  } catch {
    return [];
  }
  const events: RuntimeEvent[] = [];
  for (const line of raw.split('\n')) {
    if (line.trim() === '') continue;
    try {
      events.push(JSON.parse(line) as RuntimeEvent);
    } catch {
      // A partially written trailing line is normal while the runtime is active.
    }
  }
  return events;
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

/** Build the subagent tree. See the module comment for why `parentId` is absent. */
export function buildTree(events: readonly RuntimeEvent[]): readonly SubagentNode[] {
  const emitter = new Map<string, string | null>();
  for (const event of events) {
    if (!event.type.startsWith('tool.')) continue;
    const id = toolCallIdOf(event);
    if (id === undefined || emitter.has(id)) continue;
    emitter.set(id, typeof event.agentId === 'string' ? event.agentId : null);
  }

  const status = new Map<string, SubagentNode['status']>();
  for (const event of events) {
    if (typeof event.agentId !== 'string') continue;
    if (event.type === 'subagent.completed') status.set(event.agentId, 'completed');
    else if (event.type === 'subagent.failed') status.set(event.agentId, 'failed');
  }

  const nodes = new Map<string, SubagentNode>();
  for (const event of events) {
    if (event.type !== 'subagent.started') continue;
    const agentId = typeof event.agentId === 'string' ? event.agentId : undefined;
    const toolCallId =
      typeof event.data?.['toolCallId'] === 'string' ? (event.data['toolCallId'] as string) : undefined;
    if (agentId === undefined || toolCallId === undefined) continue;

    nodes.set(agentId, {
      agentId,
      agentName:
        typeof event.data?.['agentName'] === 'string' ? (event.data['agentName'] as string) : 'agent',
      parentAgentId: emitter.get(toolCallId) ?? null,
      status: status.get(agentId) ?? 'running',
      children: [],
    });
  }

  const roots: SubagentNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentAgentId !== null ? nodes.get(node.parentAgentId) : undefined;
    if (parent !== undefined) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/**
 * Attention: a Fleet observed to want its human.
 *
 * Computed per Fleet from that Fleet's own log and never inferred from another
 * Fleet's - Fleets have no awareness of each other, so a global indicator would
 * satisfy the letter of this and violate the isolation requirement.
 */
export function pendingPermissions(events: readonly RuntimeEvent[]): readonly string[] {
  const requested = new Set<string>();
  const completed = new Set<string>();
  for (const event of events) {
    const requestId = event.data?.['requestId'];
    if (typeof requestId !== 'string') continue;
    if (event.type === 'permission.requested') requested.add(requestId);
    else if (event.type === 'permission.completed') completed.add(requestId);
  }
  return [...requested].filter((id) => !completed.has(id));
}

export function observe(events: readonly RuntimeEvent[]): FleetObservation {
  const pending = pendingPermissions(events);
  const last = events[events.length - 1];
  return {
    tree: buildTree(events),
    pendingPermissions: pending,
    attention: pending.length > 0,
    eventCount: events.length,
    ...(typeof last?.timestamp === 'string' ? { lastEventAt: last.timestamp } : {}),
  };
}

/**
 * Watch one Fleet's event log and report every change.
 *
 * `fs.watch` plus a re-read, rather than an incremental tail: the log is appended
 * to continuously and correctness matters far more here than the cost of
 * re-parsing a file that is already in the page cache. A debounce keeps a burst
 * of appends from producing a burst of renders.
 */
export class FleetWatcher {
  private watcher: FSWatcher | undefined;
  private timer: NodeJS.Timeout | undefined;
  private readonly sessionId: string;
  private readonly root: string;
  private readonly onChange: (observation: FleetObservation) => void;

  constructor(
    sessionId: string,
    onChange: (observation: FleetObservation) => void,
    root = sessionStateRoot(),
  ) {
    this.sessionId = sessionId;
    this.onChange = onChange;
    this.root = root;
  }

  async start(): Promise<void> {
    await this.emit();
    try {
      this.watcher = watch(eventLogPath(this.sessionId, this.root), () => this.schedule());
    } catch {
      // The log does not exist until the Session produces its first event; the
      // directory watcher below covers that window.
      try {
        this.watcher = watch(join(this.root, this.sessionId), () => this.schedule());
      } catch {
        /* nothing to watch yet */
      }
    }
  }

  private schedule(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.emit(), 60);
  }

  private async emit(): Promise<void> {
    this.onChange(observe(await readEventLog(this.sessionId, this.root)));
  }

  stop(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.watcher?.close();
    this.watcher = undefined;
  }
}
