/**
 * Disposable runtime fixtures: session-state directories and real process groups.
 *
 * Like the git fixtures, these build the real thing. A falsifier made of mocks
 * proves only that the mock disagrees with the assertion, which is not the same
 * as proving the assertion is capable of failing. So the session fixtures write
 * genuine `events.jsonl` files in the runtime's own shape, and the process
 * fixtures spawn genuine detached process groups that `ps` can see.
 */

import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface SubagentSpec {
  /** Instance id. In real logs this equals the spawning tool call id. */
  readonly agentId: string;
  readonly agentName?: string;
  /** Which agent emitted the spawning tool call; `null` = the main agent. */
  readonly parentAgentId?: string | null;
  /**
   * Omit the spawning `tool.*` event entirely, so the join cannot resolve.
   * Used to falsify the "tree resolves completely" assertion.
   */
  readonly omitToolCall?: boolean;
}

export interface SessionSpec {
  readonly sessionId: string;
  readonly subagents?: readonly SubagentSpec[];
  /** Permission requests that are raised and never completed - i.e. Attention. */
  readonly pendingPermissions?: readonly string[];
  /** Permission requests that are raised and then completed. */
  readonly completedPermissions?: readonly string[];
  /** Emit a misleading `parentId` chain, to catch a harness that reads it. */
  readonly withMisleadingParentIds?: boolean;
}

export interface SessionFixture {
  readonly sessionStateRoot: string;
  readonly cleanup: () => Promise<void>;
}

/** Build a `~/.copilot/session-state`-shaped tree containing the given sessions. */
export async function buildSessionState(
  specs: readonly SessionSpec[],
): Promise<SessionFixture> {
  const sessionStateRoot = await mkdtemp(join(tmpdir(), 'maestro-session-state-'));

  for (const spec of specs) {
    const dir = join(sessionStateRoot, spec.sessionId);
    await mkdir(dir, { recursive: true });

    const lines: string[] = [];
    let seq = 0;
    let previousEventId: string | null = null;
    const nextId = (): string => `evt-${spec.sessionId}-${++seq}`;

    const emit = (event: Record<string, unknown>): void => {
      const id = nextId();
      // A real log always carries parentId as a chronological chain pointer.
      // Reproducing that faithfully is what makes the misleading-parentId
      // falsifier honest rather than synthetic.
      const parentId = spec.withMisleadingParentIds === true ? previousEventId : null;
      lines.push(JSON.stringify({ id, parentId, timestamp: new Date(1_700_000_000_000 + seq * 1000).toISOString(), ...event }));
      previousEventId = id;
    };

    emit({ type: 'session.started', data: {} });

    for (const sub of spec.subagents ?? []) {
      const parentAgentId = sub.parentAgentId ?? null;
      if (sub.omitToolCall !== true) {
        emit({
          type: 'tool.execution_start',
          ...(parentAgentId !== null ? { agentId: parentAgentId } : {}),
          data: { toolCallId: sub.agentId, name: 'task' },
        });
      }
      emit({
        type: 'subagent.started',
        agentId: sub.agentId,
        data: {
          toolCallId: sub.agentId,
          agentName: sub.agentName ?? 'explore',
          agentDisplayName: sub.agentName ?? 'explore',
          agentDescription: 'fixture subagent',
        },
      });
    }

    for (const requestId of spec.completedPermissions ?? []) {
      emit({ type: 'permission.requested', data: { requestId } });
      emit({ type: 'permission.completed', data: { requestId, result: { kind: 'approved' } } });
    }
    for (const requestId of spec.pendingPermissions ?? []) {
      emit({ type: 'permission.requested', data: { requestId } });
    }

    await writeFile(join(dir, 'events.jsonl'), lines.join('\n') + '\n', 'utf8');
  }

  return {
    sessionStateRoot,
    cleanup: async () => {
      await rm(sessionStateRoot, { recursive: true, force: true });
    },
  };
}

export interface ProcessGroupFixture {
  readonly processGroupIds: readonly number[];
  readonly cleanup: () => Promise<void>;
}

/**
 * Spawn `count` detached process groups that stay alive until cleaned up.
 *
 * Detached, because that is the only arrangement measured to work: a
 * non-detached child is not a process-group leader, so it cannot be signalled as
 * a group. Each child becomes its own group leader, and its pid is therefore its
 * pgid.
 */
export async function spawnLiveProcessGroups(count: number): Promise<ProcessGroupFixture> {
  const children: number[] = [];

  for (let i = 0; i < count; i += 1) {
    const child = spawn('sleep', ['120'], { detached: true, stdio: 'ignore' });
    child.unref();
    if (typeof child.pid === 'number') children.push(child.pid);
  }

  // Give the operating system a moment to make them visible to `ps`.
  await new Promise((resolve) => setTimeout(resolve, 120));

  const cleanup = async (): Promise<void> => {
    for (const pgid of children) {
      try {
        process.kill(-pgid, 'SIGKILL');
      } catch {
        /* already gone */
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  };

  return { processGroupIds: children, cleanup };
}

/**
 * Process-group ids that are guaranteed to have no live members: they are spawned
 * and then killed, so the ids are real and reachable but nothing survives in them.
 */
export async function spawnAndReapProcessGroups(count: number): Promise<ProcessGroupFixture> {
  const live = await spawnLiveProcessGroups(count);
  await live.cleanup();
  return { processGroupIds: live.processGroupIds, cleanup: async () => {} };
}
