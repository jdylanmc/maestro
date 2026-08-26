import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { detectStall, isProcessAlive, STALL_THRESHOLD_MS, sessionPid } from "../src/stall.js"
import { encodeOwner } from "../src/tree.js"

const SURFACE = "4AF7FB2F-9FE2-4592-B309-036B054587D3"

// Detecting a Session that has HUNG, as distinct from idle, busy, or blocked.
//
// Every clause of the conjunction came from measurement across every session
// log on disk, not from intuition:
//
//   - "no clean shutdown" is not a stall: 19 of 37 unclean endings were
//     `assistant.turn_end`, i.e. a window closed while idle;
//   - silence alone is not a stall: 62,212 intra-turn gaps ran p50 0s, p90
//     6.2s, p99 62s, p99.9 546s, max 38,795s;
//   - what separates them is whether a tool is running: of 44 gaps over ten
//     minutes inside an open turn, 28 had a tool in flight and 16 did not.

const T0 = Date.parse("2026-08-26T12:00:00.000Z")

function withSession(
  events: unknown[],
  run: (logPath: string, dir: string) => void,
  lockPid?: number,
): void {
  const root = mkdtempSync(join(tmpdir(), "maestro-stall-"))
  const dir = join(root, "session")
  mkdirSync(dir)
  const logPath = join(dir, "events.jsonl")
  writeFileSync(logPath, `${events.map((e) => JSON.stringify(e)).join("\n")}\n`)
  if (lockPid !== undefined) writeFileSync(join(dir, `inuse.${lockPid}.lock`), String(lockPid))
  try {
    run(logPath, dir)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function at(offsetMs: number): string {
  return new Date(T0 + offsetMs).toISOString()
}

const LIVE = process.pid
const DEAD = 2 ** 22 // far above any real pid on macOS

test("a Session mid-turn with nothing running and long silence is stalled", () => {
  withSession(
    [
      { type: "assistant.turn_start", timestamp: at(0) },
      { type: "assistant.message", timestamp: at(1000), data: { model: "claude-opus-5" } },
    ],
    (log) => {
      const v = detectStall(log, T0 + 20 * 60_000)
      assert.equal(v.turnOpen, true)
      assert.equal(v.toolsInFlight, 0)
      assert.equal(v.alive, true)
      assert.equal(v.stalled, true)
      assert.equal(v.lastEventType, "assistant.message")
    },
    LIVE,
  )
})

test("a long-running tool explains any amount of silence", () => {
  // 28 of the 44 measured long gaps were exactly this. Reporting them would be
  // the health badge's mistake again: crying wolf on the busiest work.
  withSession(
    [
      { type: "assistant.turn_start", timestamp: at(0) },
      {
        type: "tool.execution_start",
        timestamp: at(1000),
        data: { toolCallId: "t1", toolName: "bash" },
      },
    ],
    (log) => {
      const v = detectStall(log, T0 + 6 * 60 * 60_000)
      assert.equal(v.toolsInFlight, 1)
      assert.equal(v.stalled, false, "a tool in flight is not a stall, however long it runs")
    },
    LIVE,
  )
})

test("a SUBAGENT's tool also counts as work in flight", () => {
  // Counting only root tools would report a Session waiting on its subagents as
  // hung, which is the common squadron shape.
  withSession(
    [
      { type: "assistant.turn_start", timestamp: at(0) },
      {
        type: "tool.execution_start",
        agentId: "sub-1",
        timestamp: at(1000),
        data: { toolCallId: "t1", toolName: "bash" },
      },
    ],
    (log) => {
      const v = detectStall(log, T0 + 60 * 60_000)
      assert.equal(v.toolsInFlight, 1)
      assert.equal(v.stalled, false)
    },
    LIVE,
  )
})

test("an idle Session is silent on purpose and is never stalled", () => {
  withSession(
    [
      { type: "assistant.turn_start", timestamp: at(0) },
      { type: "assistant.turn_end", timestamp: at(1000) },
    ],
    (log) => {
      const v = detectStall(log, T0 + 24 * 60 * 60_000)
      assert.equal(v.turnOpen, false)
      assert.equal(v.stalled, false, "an ended turn is idle, not hung")
    },
    LIVE,
  )
})

test("a closed window is not a stall", () => {
  // A dead pid means the operator already dealt with it. Badging it would put a
  // warning on something that no longer exists.
  withSession(
    [{ type: "assistant.turn_start", timestamp: at(0) }],
    (log) => {
      const v = detectStall(log, T0 + 60 * 60_000)
      assert.equal(v.alive, false)
      assert.equal(v.stalled, false)
    },
    DEAD,
  )
})

test("a session with no lock file at all is not judged", () => {
  withSession([{ type: "assistant.turn_start", timestamp: at(0) }], (log) => {
    const v = detectStall(log, T0 + 60 * 60_000)
    assert.equal(v.pid, undefined)
    assert.equal(v.stalled, false)
  })
})

test("silence below the threshold is not yet a stall", () => {
  // p99 of real intra-turn gaps is 62 seconds, so short silences are ordinary.
  withSession(
    [{ type: "assistant.turn_start", timestamp: at(0) }],
    (log) => {
      assert.equal(detectStall(log, T0 + 60_000).kind, "none")
      // Last event is `assistant.turn_start`, so this is the awaiting-model
      // case: logged, never badged. Measured 15 times across 121 logs and it
      // recovered every time.
      assert.equal(detectStall(log, T0 + STALL_THRESHOLD_MS + 1).kind, "awaiting-model")
      assert.equal(detectStall(log, T0 + STALL_THRESHOLD_MS + 1).stalled, false)
    },
    LIVE,
  )
})

test("a completed tool stops explaining the silence", () => {
  withSession(
    [
      { type: "assistant.turn_start", timestamp: at(0) },
      { type: "tool.execution_start", timestamp: at(1000), data: { toolCallId: "t1" } },
      { type: "tool.execution_complete", timestamp: at(2000), data: { toolCallId: "t1" } },
    ],
    (log) => {
      const v = detectStall(log, T0 + 30 * 60_000)
      assert.equal(v.toolsInFlight, 0)
      assert.equal(v.stalled, true, "nothing is running, so the silence is unexplained")
    },
    LIVE,
  )
})

test("shutdown closes the turn even if the end event is missing", () => {
  withSession(
    [
      { type: "assistant.turn_start", timestamp: at(0) },
      { type: "session.shutdown", timestamp: at(1000) },
    ],
    (log) => {
      assert.equal(detectStall(log, T0 + 60 * 60_000).stalled, false)
    },
    LIVE,
  )
})

test("the LAST turn boundary wins, rather than a count", () => {
  // Counting drifts. Replayed against history, drift was the single largest
  // source of false positives: a `session.error` or an aborted turn ends a turn
  // WITHOUT an end event, so a counter stays open forever and a Session sitting
  // idle overnight reads as stalled.
  withSession(
    [
      { type: "assistant.turn_start", timestamp: at(0) },
      { type: "assistant.turn_start", timestamp: at(500) },
      { type: "assistant.turn_end", timestamp: at(1000) },
    ],
    (log) => {
      assert.equal(detectStall(log, T0 + 30 * 60_000).turnOpen, false)
    },
    LIVE,
  )
})

test("a turn that died without an end event is still closed", () => {
  for (const closer of ["session.error", "abort", "session.resume"]) {
    withSession(
      [
        { type: "assistant.turn_start", timestamp: at(0) },
        { type: closer, timestamp: at(1000) },
      ],
      (log) => {
        assert.equal(
          detectStall(log, T0 + 60 * 60_000).stalled,
          false,
          `${closer} must close the turn`,
        )
      },
      LIVE,
    )
  }
})

test("a typed message proves the interface was accepting input", () => {
  // The strongest possible refutation of "the UI is frozen".
  withSession(
    [
      { type: "assistant.turn_start", timestamp: at(0) },
      { type: "user.message", timestamp: at(1000) },
    ],
    (log) => {
      assert.equal(detectStall(log, T0 + 60 * 60_000).stalled, false)
    },
    LIVE,
  )
})

test("a subagent's turn events do not open the Session's turn", () => {
  withSession(
    [
      { type: "assistant.turn_start", agentId: "sub-1", timestamp: at(0) },
      { type: "assistant.message", timestamp: at(1000) },
    ],
    (log) => {
      assert.equal(detectStall(log, T0 + 30 * 60_000).turnOpen, false)
    },
    LIVE,
  )
})

test("an unreadable log reports no stall rather than throwing", () => {
  const v = detectStall(join(tmpdir(), "maestro-stall-absent", "events.jsonl"), Date.now())
  assert.equal(v.stalled, false)
  assert.equal(v.pid, undefined)
})

// --- the pid helpers ---------------------------------------------------------

test("the pid is read from the lock file name, not its presence", () => {
  // The lock is NOT removed on exit - 56 stale ones were counted on this
  // machine - so existence proves nothing and only the pid inside is useful.
  withSession(
    [{ type: "session.start", timestamp: at(0) }],
    (_log, dir) => {
      assert.equal(sessionPid(dir), 4242)
    },
    4242,
  )
})

test("a missing directory yields no pid", () => {
  assert.equal(sessionPid(join(tmpdir(), "maestro-stall-nope")), undefined)
})

test("liveness is a syscall, and this process is alive", () => {
  assert.equal(isProcessAlive(process.pid), true)
  assert.equal(isProcessAlive(DEAD), false)
})

test("a slow first token is reported but never badged", () => {
  // Replayed across 121 session logs, this exact shape - turn_start, long
  // silence, then assistant.message - occurred 15 times and RECOVERED every
  // time, after 12 to 100 minutes. In the event log it cannot be told apart
  // from a frozen interface, because nothing marks a model request as in
  // flight (#66). Badging it would cry wolf roughly once every eight sessions.
  withSession(
    [{ type: "assistant.turn_start", timestamp: at(0) }],
    (log) => {
      const v = detectStall(log, T0 + 45 * 60_000)
      assert.equal(v.kind, "awaiting-model")
      assert.equal(v.stalled, false)
    },
    LIVE,
  )
})

test("a turn that produced something and then stopped IS badged", () => {
  // Zero occurrences across the same 121 logs, so this pattern has no known
  // false positives. That is what earns the warning triangle.
  withSession(
    [
      { type: "assistant.turn_start", timestamp: at(0) },
      { type: "assistant.message", timestamp: at(1000) },
    ],
    (log) => {
      const v = detectStall(log, T0 + 45 * 60_000)
      assert.equal(v.kind, "stalled")
      assert.equal(v.stalled, true)
    },
    LIVE,
  )
})

// --- the wire ----------------------------------------------------------------

test("a stalled Session reaches the wire as owner-row field 7", () => {
  // This test exists because the first implementation computed the field and
  // never emitted it. Everything still built, every other test passed, and the
  // badge only appeared because it was verified with a hand-injected row.
  // Biome's unused-variable warning was the only thing that caught it.
  const row = encodeOwner(SURFACE, 0, {
    worktree: undefined,
    model: undefined,
    activity: undefined,
    stalledMinutes: 45,
  })
  assert.equal(row.split(" ")[7], "45")
})

test("a healthy Session still encodes exactly as before", () => {
  assert.equal(
    encodeOwner(SURFACE, 0, {
      worktree: undefined,
      model: undefined,
      activity: undefined,
      stalledMinutes: undefined,
    }),
    `@ o ${SURFACE}`,
  )
})

test("the sidebar reads the stall from field 7 and says it in words", () => {
  const sidebar = readFileSync(join(import.meta.dirname, "../sidebars/maestro.swift"), "utf8")
  assert.match(sidebar, /func stalledSessionFor\(_ d: String, _ id: String\) -> String/)
  assert.match(sidebar, /let raw = part\(hits\[0\], 7\)/)
  // A red triangle plus the WORD, distinct from the orange health triangle.
  // Two warnings that mean different things must not look identical.
  assert.match(sidebar, /Text\("stalled"\)/)
})
