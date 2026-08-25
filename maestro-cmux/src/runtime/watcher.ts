import { statSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  countStalledCompletions,
  mergeOwnedRows,
  resolveSessionLog,
  STALLED_COMPLETIONS,
  summarize,
} from "../tree.js"
import type { Attention, RuntimeState } from "../types.js"

/**
 * The watcher: attention recomputed on a CLOCK rather than on a hook.
 *
 * Maestro publishes from hooks, and while a Session sits blocked no hook fires.
 * Measured ordering is `tool.execution_start` -> `preToolUse` ->
 * `permission.requested`, so even a tool-start hook runs before the request
 * exists. The only hook that can catch a live block is `notification`, and it
 * does not fire for every prompt variant - a Session blocked on "Allow
 * directory access" showed no badge at all, while its log held an outstanding
 * request the whole time. `detectAttention` would have returned it. Nothing
 * called it (issue #57, G-24).
 *
 * So this is deliberately NOT more clever derivation. It is the same derivation,
 * invoked by something that is still running when the Session is not.
 */

/** Where the hook runtime keeps one state file per Session. */
export function stateDir(): string {
  return join(tmpdir(), "maestro-cmux")
}

export interface WatchTarget {
  key: string
  cwd: string
  workspaceID: string
  surfaceID: string
  sessionId: string | undefined
  transcriptPath: string | undefined
  dismissed: string[]
  updatedAt: number
  /**
   * When a `postToolUse` hook last landed, or - for a Session that has not seen
   * one yet - when the Session started.
   *
   * The fallback is what keeps a RESUMED Session from badging itself the
   * instant it opens: its log already holds thousands of completions, and
   * without a floor every one of them would read as evidence that hooks are
   * failing. `startedAt` is set by the same `sessionStart` that resets the
   * counters, so it is the right floor. A Session with neither is not yet
   * demonstrably anything, and reports healthy.
   */
  healthSince: number | undefined
  /**
   * The last time a `tool.post` hook landed for THIS record, or undefined.
   *
   * Distinct from `healthSince`, which falls back to `startedAt`. Only a real
   * tool completion is evidence that the hook pipeline is alive, and only that
   * evidence may be shared between records - see `surfaceHealthFloor`.
   */
  lastToolAt: number | undefined
}

/**
 * A state file is watchable only if it names both the workspace to publish into
 * and the surface whose block to replace. Without a surface the watcher would
 * have to overwrite the whole description, clobbering co-resident Sessions.
 */
export function toWatchTarget(key: string, state: RuntimeState): WatchTarget | null {
  if (!state.workspaceID || !state.surfaceID) return null
  return {
    key,
    cwd: state.cwd,
    workspaceID: state.workspaceID,
    surfaceID: state.surfaceID,
    sessionId: state.sessionId,
    transcriptPath: state.transcriptPath,
    dismissed: state.dismissed ?? [],
    updatedAt: state.updatedAt,
    healthSince: state.lastToolAt ?? state.startedAt,
    lastToolAt: state.lastToolAt,
  }
}

/**
 * The freshest proof of a live hook pipeline, per SURFACE.
 *
 * State files are keyed on `cwd + workspaceID`, not on Session. So a Session
 * that works across two directories - which is ordinary for an agent moving
 * between repositories - accumulates a SECOND record, and that record starts
 * empty: `completedTools` 0 and no `lastToolAt`. The watcher then floors on its
 * own start time, counts every root completion in the shared session log since,
 * and badges a Session whose hooks are arriving perfectly well into the sibling
 * record.
 *
 * Measured live: one Session holding two records - the first with 132
 * completions and a `lastToolAt` seconds old, the second with none at all -
 * reporting 44 stalled completions. Both badged Sessions were the busiest ones
 * on screen, which is precisely the wrong signal - a health check that cries
 * wolf on active work is worse than none.
 *
 * The fix takes the newest `lastToolAt` across every record sharing a surface.
 * A surface is the unit the badge is PUBLISHED for - one owner row, one badge -
 * so it is also the right unit to judge. Only `lastToolAt` is shared, never the
 * `startedAt` fallback: a sibling's start time says nothing about tool flow.
 */
export function surfaceHealthFloor(targets: readonly WatchTarget[]): Map<string, number> {
  const floors = new Map<string, number>()
  for (const target of targets) {
    if (target.lastToolAt === undefined) continue
    const seen = floors.get(target.surfaceID)
    if (seen === undefined || target.lastToolAt > seen) {
      floors.set(target.surfaceID, target.lastToolAt)
    }
  }
  return floors
}

/** What the watcher remembers between ticks, per Session. */
export interface WatchMemo {
  logMtimeMs: number
  encoded: string
  nextExpiryAt: number | undefined
}

/**
 * Whether a target needs recomputing this tick.
 *
 * `detectAttention` parses the WHOLE event log, and a busy Session's log runs to
 * tens of thousands of lines, so recomputing every target every tick would burn
 * real CPU forever. The log's mtime is the exact gate: a prompt appearing IS an
 * appended event, and answering it appends another. While the operator stares
 * at an unanswered prompt nothing is appended and nothing needs recomputing,
 * because the answer cannot change until the log does.
 */
export function needsRecompute(
  logPath: string,
  memo: WatchMemo | undefined,
  now: number = Date.now(),
): number | null {
  let mtimeMs: number
  try {
    mtimeMs = statSync(logPath).mtimeMs
  } catch {
    return null
  }
  if (
    memo &&
    memo.logMtimeMs === mtimeMs &&
    (memo.nextExpiryAt === undefined || now < memo.nextExpiryAt)
  ) {
    return null
  }
  return mtimeMs
}

/** Read every state file the hook runtime has written. */
export async function readWatchTargets(dir: string = stateDir()): Promise<WatchTarget[]> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }
  const out: WatchTarget[] = []
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue
    try {
      const state = JSON.parse(await readFile(join(dir, entry), "utf8")) as RuntimeState
      const target = toWatchTarget(entry, state)
      if (target) out.push(target)
    } catch {
      /* a half-written or malformed state file is not worth a crash */
    }
  }
  return out
}

export interface WatchDeps {
  readDescription(workspaceID: string): Promise<string | undefined>
  setDescription(workspaceID: string, description: string): Promise<void>
  now(): number
  /** How long a finished subagent is retained (#56). The watcher reads config
   *  once at start-up, so this arrives as a dep rather than being re-read here. */
  retainFinishedMs?: number
  /** The deepest generation to publish (#43). Re-read every tick, like
   *  retention, because the watcher is the publisher for an idle Session. */
  maxDepth?: number
  /**
   * When THIS watcher started, and the floor under every health judgement.
   *
   * A watcher cannot attest to hooks that were supposed to fire before it
   * existed. That sounds like pedantry until an upgrade: a state file written
   * by an older build has no `lastToolAt`, so the floor falls back to
   * `startedAt`, and a Session that has been running for two days is judged on
   * two days of completions it was never going to be able to explain.
   * Measured on exactly that upgrade - a live, perfectly healthy Session
   * reported 634.
   *
   * Taking the later of the two floors fixes it in both directions. A stale
   * state file starts counting from now, so a genuinely broken pipeline still
   * accumulates and still badges; a healthy one simply starts at zero.
   *
   * Optional, and absent means no floor, because the tests supply their own
   * fixture time. Production must pass it.
   */
  startedAt?: number
}

/**
 * One pass over every known Session.
 *
 * Returns the surfaces whose published block actually changed, which is what the
 * tests assert against and what keeps the watcher quiet: cmux is only called
 * when the encoding differs from what this watcher last published.
 */
export async function watchTick(
  targets: readonly WatchTarget[],
  memos: Map<string, WatchMemo>,
  deps: WatchDeps,
): Promise<string[]> {
  const changed: string[] = []
  // Computed once per tick, across ALL targets, because a Session's proof of
  // life may sit in a sibling record written under a different directory.
  const siblingFloors = surfaceHealthFloor(targets)

  for (const target of targets) {
    const logPath = resolveSessionLog(target.cwd, target.sessionId, target.transcriptPath)
    if (!logPath) continue

    const memo = memos.get(target.key)
    const now = deps.now()
    const mtimeMs = needsRecompute(logPath, memo, now)
    if (mtimeMs === null) continue

    // The health check belongs HERE and nowhere else. A hook cannot report that
    // hooks have stopped arriving; the watcher is the only part of Maestro
    // still running when they have. See `countStalledCompletions`.
    //
    // A Session with no floor to measure from reports healthy rather than
    // guessing: this signal is only worth having if it is never noise.
    const floors = [target.healthSince, siblingFloors.get(target.surfaceID), deps.startedAt].filter(
      (v) => v !== undefined,
    )
    const since = floors.length > 0 ? Math.max(...floors) : undefined
    const completions = since === undefined ? 0 : countStalledCompletions(logPath, since)
    const stalled = completions >= STALLED_COMPLETIONS ? completions : 0

    const tree = summarize(
      target.cwd,
      undefined,
      target.surfaceID,
      new Set(target.dismissed),
      target.sessionId,
      target.transcriptPath,
      now,
      stalled,
      deps.retainFinishedMs,
      deps.maxDepth,
    )
    // `summarize` returns null only when it could not compute at all. Leaving
    // the description alone is right then - the same fail-open the hook uses.
    if (!tree) continue

    if (memo && memo.encoded === tree.encoded) {
      memos.set(target.key, {
        logMtimeMs: mtimeMs,
        encoded: tree.encoded,
        nextExpiryAt: tree.nextExpiryAt,
      })
      continue
    }

    try {
      const published = (await deps.readDescription(target.workspaceID)) ?? ""
      const merged = mergeOwnedRows(published, target.surfaceID, tree.encoded)
      if (merged !== published) {
        await deps.setDescription(target.workspaceID, merged)
        changed.push(target.surfaceID)
      }
      memos.set(target.key, {
        logMtimeMs: mtimeMs,
        encoded: tree.encoded,
        nextExpiryAt: tree.nextExpiryAt,
      })
    } catch {
      /* never let one workspace's failure stop the others */
    }
  }

  return changed
}

/**
 * Whether the watcher has any reason to keep running.
 *
 * It must not become immortal. When every Session it knows about has gone quiet
 * for longer than the idle window, there is nothing left to watch and the
 * process exits; the next `sessionStart` hook starts a fresh one.
 */
export function shouldKeepRunning(
  targets: readonly WatchTarget[],
  now: number,
  idleMs: number,
): boolean {
  if (targets.length === 0) return false
  return targets.some((t) => now - t.updatedAt < idleMs)
}

/** The attention a tick derived, exposed for logging and tests. */
export function attentionOf(tree: { attention: Attention | undefined } | null): string {
  return tree?.attention?.kind ?? "none"
}
