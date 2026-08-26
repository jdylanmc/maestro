import { readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { readSessionLines } from "./tree.js"

/**
 * Detecting a Session that has HUNG, as distinct from one that is idle, busy,
 * or blocked on the operator.
 *
 * Reported symptom: the terminal input stops responding and the Copilot
 * interface hangs indefinitely, and the only way out is to close the window and
 * resume the session.
 *
 * This is a DIFFERENT signal from the issue #63 health badge. That one detects
 * Maestro's own hook pipeline dying - the observer going deaf. This one detects
 * the observed Session going still while it still believes it is mid-turn.
 *
 * ## Why no single signal works
 *
 * Measured across every session log on disk before designing this:
 *
 * - **"No clean shutdown" is not it.** Of 401 sessions, 37 ended without a
 *   `session.shutdown`, but 19 of those ended on `assistant.turn_end` - a
 *   window closed while idle. Perfectly normal.
 * - **Silence alone is not it.** Across 62,212 gaps between events inside an
 *   open turn: p50 0s, p90 6.2s, p99 62s, p99.9 546s, max 38,795s. Long
 *   silences are legitimate and routine.
 * - **What separates them is whether a tool is actually running.** Of the 44
 *   gaps longer than ten minutes inside an open turn, 28 had a tool in flight
 *   - a build, a sleep, an agent - and 16 had nothing running at all.
 *
 * So the rule is a CONJUNCTION, and every part is load-bearing.
 */
export interface StallVerdict {
  /** A root turn is open: `assistant.turn_start` with no matching end. */
  turnOpen: boolean
  /** Tool calls started and not completed, across the Session AND its subagents. */
  toolsInFlight: number
  /** Milliseconds since the last event of any kind. */
  silentForMs: number
  /** The type of the last event, which is what a stall report is really about. */
  lastEventType: string | undefined
  /** The pid from the session's `inuse.<pid>.lock`, if there is one. */
  pid: number | undefined
  /** Whether that pid is still a live process. */
  alive: boolean
  /**
   * What the conjunction means, split by the evidence.
   *
   * `awaiting-model` - the last event is `assistant.turn_start`, so the turn
   * began and the model has produced nothing yet. Replayed across 121 logs this
   * happened 15 times and **recovered every time**, after 12 to 100 minutes. It
   * is a slow model call, and in the event log it is indistinguishable from a
   * frozen interface (see #66: nothing marks a model request as in flight).
   * Logged, never badged.
   *
   * `stalled` - the turn had already produced something and then everything
   * stopped with nothing running. Replayed across the same 121 logs this
   * happened **zero** times, so it has no known false positives. That is what
   * earns the badge.
   */
  kind: "none" | "awaiting-model" | "stalled"
  /** The badge-worthy case only. */
  stalled: boolean
}

/**
 * How long a Session may sit mid-turn with nothing running before it is
 * suspicious.
 *
 * Ten minutes is just above the p99.9 of measured intra-turn gaps (546s), so a
 * legitimate pause reaching it is roughly a one-in-a-thousand event.
 */
export const STALL_THRESHOLD_MS = 10 * 60_000

/**
 * Events that end a turn.
 *
 * `assistant.turn_end` is the ordinary one. The rest are why a COUNTER does not
 * work: each ends the turn without it. `user.message` matters most - the
 * operator typed, so the interface was accepting input, which rules out the
 * symptom being detected.
 */
const TURN_CLOSING = new Set([
  "assistant.turn_end",
  "session.error",
  "session.shutdown",
  "session.resume",
  "abort",
  "user.message",
])

/**
 * The pid that owns a session directory.
 *
 * Copilot writes `inuse.<pid>.lock` beside the event log. The file is NOT
 * removed on exit - there are 56 stale locks on this machine - so its presence
 * proves nothing and only the pid inside it is useful.
 */
export function sessionPid(sessionDir: string): number | undefined {
  try {
    for (const entry of readdirSync(sessionDir)) {
      const match = /^inuse\.(\d+)\.lock$/.exec(entry)
      if (match?.[1]) {
        const pid = Number.parseInt(match[1], 10)
        if (Number.isFinite(pid) && pid > 0) return pid
      }
    }
  } catch {
    /* no directory, no pid */
  }
  return undefined
}

/**
 * Whether a pid is a live process.
 *
 * Signal 0 performs the permission and existence check without delivering
 * anything. It is a syscall rather than a spawn, which matters: nothing on
 * Maestro's path may be the reason a Session stalls.
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM means the process exists but belongs to someone else. Still alive.
    return (error as NodeJS.ErrnoException).code === "EPERM"
  }
}

/**
 * One pass over the log for every part of the conjunction.
 *
 * Tool calls are tracked for EVERY agent, not just the root: a Session waiting
 * on a subagent's `bash` is legitimately busy, and counting only root tools
 * would report it as hung.
 */
export function detectStall(
  logPath: string,
  now: number = Date.now(),
  thresholdMs: number = STALL_THRESHOLD_MS,
): StallVerdict {
  // "Last boundary wins" rather than a counter.
  //
  // Counting `turn_start` against `turn_end` drifts, because a turn can end
  // WITHOUT its end event: `session.error` and an aborted turn both leave the
  // counter stuck open forever. Replayed against history, that drift was the
  // single largest source of false positives - two of the three longest
  // "stalls" were a Session sitting idle overnight with a counter that never
  // came back down.
  //
  // A `user.message` is the strongest close of all: the operator typed, so the
  // interface was accepting input, which is the exact opposite of the symptom.
  let turnOpenNow = false
  let lastEventAt: number | undefined
  let lastEventType: string | undefined
  const openTools = new Set<string>()

  try {
    for (const line of readSessionLines(logPath)) {
      if (!line) continue
      let e: {
        type?: string
        agentId?: string | null
        timestamp?: string
        data?: Record<string, unknown>
      }
      try {
        e = JSON.parse(line)
      } catch {
        continue
      }
      const type = e.type
      if (!type) continue
      const at = Date.parse(e.timestamp ?? "")
      if (Number.isFinite(at)) {
        lastEventAt = at
        lastEventType = type
      }
      const tc = e.data?.toolCallId as string | undefined
      if (type === "tool.execution_start" && tc) openTools.add(tc)
      else if (type === "tool.execution_complete" && tc) openTools.delete(tc)
      // Only the ROOT agent's events bound a turn: a subagent runs inside one.
      if (e.agentId) continue
      if (type === "assistant.turn_start") turnOpenNow = true
      else if (TURN_CLOSING.has(type)) turnOpenNow = false
    }
  } catch {
    // An unreadable log is ignorance, not a stall. Reporting a fault that
    // cannot be demonstrated is the same lie as missing one.
    return {
      turnOpen: false,
      toolsInFlight: 0,
      silentForMs: 0,
      lastEventType: undefined,
      pid: undefined,
      alive: false,
      kind: "none",
      stalled: false,
    }
  }

  const pid = sessionPid(dirname(logPath))
  const alive = pid !== undefined && isProcessAlive(pid)
  const silentForMs = lastEventAt === undefined ? 0 : Math.max(0, now - lastEventAt)
  const turnOpen = turnOpenNow
  const quiet = alive && turnOpen && openTools.size === 0 && silentForMs >= thresholdMs
  const kind: StallVerdict["kind"] = !quiet
    ? "none"
    : lastEventType === "assistant.turn_start"
      ? "awaiting-model"
      : "stalled"

  return {
    turnOpen,
    toolsInFlight: openTools.size,
    silentForMs,
    lastEventType,
    pid,
    alive,
    kind,
    // Every clause earns its place:
    //   alive        - a dead pid is a closed window, not a hang
    //   turnOpen     - an idle Session is silent on purpose
    //   no tools     - a running build explains any amount of silence
    //   silence      - above the p99.9 of real intra-turn gaps
    stalled: kind === "stalled",
  }
}

/** The session directory for a log path, which is where the lock file lives. */
export function sessionDirOf(logPath: string): string {
  return dirname(logPath)
}

/** Join a session id to its log, for callers that have the id rather than a path. */
export function sessionLogFor(sessionsRoot: string, sessionId: string): string {
  return join(sessionsRoot, sessionId, "events.jsonl")
}
