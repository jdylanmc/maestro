import assert from "node:assert/strict"
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { type TestContext, test } from "node:test"
import {
  needsRecompute,
  shouldKeepRunning,
  toWatchTarget,
  type WatchMemo,
  type WatchTarget,
  watchTick,
} from "../src/runtime/watcher.js"
import { RETAIN_MS } from "../src/tree.js"
import type { RuntimeState } from "../src/types.js"

// A blocked Session fires no hook, so it cannot raise its own ASK badge.
//
// Measured: a Session sat blocked on an "Allow directory access" prompt with no
// badge at all. Its workspace description held the owner row and nothing else,
// so no attention row was ever written - while its log carried an outstanding
// `permission.requested` the whole time. `detectAttention` would have returned
// it; nothing called it (issue #57).
//
// The watcher is that caller. These tests cover the decisions it makes, not the
// derivation itself, which is already covered by the attention tests.

const SURFACE = "4AF7FB2F-9FE2-4592-B309-036B054587D3"
const WORKSPACE = "7AF8CFE2-B64E-4743-9E71-80CE464D2A3B"

function state(overrides: Partial<RuntimeState> = {}): RuntimeState {
  return {
    version: 1,
    cwd: "/tmp/watch-fixture",
    workspaceID: WORKSPACE,
    updatedAt: 1000,
    startedAt: undefined,
    source: undefined,
    phase: "idle",
    lastPrompt: undefined,
    toolInvocations: 0,
    completedTools: 0,
    lastToolAt: undefined,
    lastToolName: undefined,
    lastToolSummary: undefined,
    lastResultType: undefined,
    filesEdited: 0,
    lastEditedFile: undefined,
    lastError: undefined,
    lastSessionEndReason: undefined,
    attention: undefined,
    surfaceID: SURFACE,
    sessionId: undefined,
    transcriptPath: undefined,
    dismissed: [],
    ...overrides,
  }
}

// --- what is watchable at all -----------------------------------------------

test("a Session without a surface is not watchable", () => {
  // Without a surface the watcher would have to overwrite the whole
  // description, clobbering every co-resident Session (#49).
  assert.equal(toWatchTarget("k", state({ surfaceID: undefined })), null)
})

test("a Session without a workspace is not watchable", () => {
  assert.equal(toWatchTarget("k", state({ workspaceID: undefined })), null)
})

test("a fully identified Session is watchable", () => {
  const target = toWatchTarget("k", state({ sessionId: "s-1" }))
  assert.equal(target?.surfaceID, SURFACE)
  assert.equal(target?.workspaceID, WORKSPACE)
  assert.equal(target?.sessionId, "s-1")
})

// --- the mtime gate ---------------------------------------------------------

test("an unchanged log is not recomputed", (t: TestContext) => {
  // detectAttention parses the WHOLE log, and a busy Session's log runs to tens
  // of thousands of lines. Recomputing every tick would burn CPU forever.
  const dir = mkdtempSync(join(tmpdir(), "maestro-watch-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const path = join(dir, "events.jsonl")
  writeFileSync(path, "{}\n")

  const first = needsRecompute(path, undefined)
  assert.ok(first !== null, "a log never seen before must be recomputed")

  const memo: WatchMemo = { logMtimeMs: first, encoded: "", nextExpiryAt: undefined }
  assert.equal(needsRecompute(path, memo), null, "an unchanged log must be skipped")
})

test("a changed log is recomputed", (t: TestContext) => {
  const dir = mkdtempSync(join(tmpdir(), "maestro-watch-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const path = join(dir, "events.jsonl")
  writeFileSync(path, "{}\n")
  const first = needsRecompute(path, undefined) as number

  const later = new Date(Date.now() + 5000)
  utimesSync(path, later, later)

  const memo: WatchMemo = { logMtimeMs: first, encoded: "", nextExpiryAt: undefined }
  assert.ok(needsRecompute(path, memo) !== null, "an appended log must be recomputed")
})

test("an expired retention deadline recomputes an unchanged log", (t: TestContext) => {
  const dir = mkdtempSync(join(tmpdir(), "maestro-watch-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const path = join(dir, "events.jsonl")
  writeFileSync(path, "{}\n")
  const mtime = needsRecompute(path, undefined) as number
  const memo: WatchMemo = { logMtimeMs: mtime, encoded: "", nextExpiryAt: 2_000 }

  assert.equal(needsRecompute(path, memo, 1_999), null)
  assert.equal(needsRecompute(path, memo, 2_000), mtime)
})

test("a missing log is skipped rather than throwing", () => {
  assert.equal(needsRecompute("/nope/does/not/exist.jsonl", undefined), null)
})

// --- publishing -------------------------------------------------------------

function target(overrides: Partial<WatchTarget> = {}): WatchTarget {
  return {
    key: "k",
    cwd: "/tmp/watch-fixture",
    workspaceID: WORKSPACE,
    surfaceID: SURFACE,
    sessionId: undefined,
    transcriptPath: undefined,
    dismissed: [],
    updatedAt: 1000,
    healthSince: 1000,
    ...overrides,
  }
}

function log(t: TestContext, lines: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "maestro-watch-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const path = join(dir, "events.jsonl")
  writeFileSync(path, lines.join(""))
  return path
}

function event(
  type: string,
  data: Record<string, unknown>,
  timestamp: string,
  agentId: string | null = null,
): string {
  return `${JSON.stringify({ type, agentId, data, timestamp })}\n`
}

test("an outstanding permission is published without any hook firing", async (t: TestContext) => {
  const transcriptPath = log(t, [
    event(
      "tool.execution_start",
      { toolCallId: "c1", toolName: "bash" },
      "2026-08-23T18:00:00.000Z",
    ),
    event(
      "permission.requested",
      { requestId: "r1", permissionRequest: { toolCallId: "c1" } },
      "2026-08-23T18:00:01.000Z",
    ),
  ])

  const writes: Array<{ workspaceID: string; description: string }> = []
  const changed = await watchTick([target({ transcriptPath })], new Map(), {
    now: () => 2000,
    readDescription: async () => `@ o ${SURFACE}`,
    setDescription: async (workspaceID, description) => {
      writes.push({ workspaceID, description })
    },
  })

  assert.deepEqual(changed, [SURFACE])
  assert.equal(writes.length, 1)
  assert.match(
    writes[0]?.description ?? "",
    /! p (-|shell) Approve bash/,
    "the badge must be published",
  )
  assert.equal(writes[0]?.workspaceID, WORKSPACE)
})

test("a co-resident Session's block is preserved", async (t: TestContext) => {
  const other = "352F9F8E-CF62-49CB-ACB6-6E0097AD1F1B"
  const transcriptPath = log(t, [
    event(
      "permission.requested",
      { requestId: "r1", permissionRequest: {} },
      "2026-08-23T18:00:01.000Z",
    ),
  ])

  const writes: string[] = []
  await watchTick([target({ transcriptPath })], new Map(), {
    now: () => 2000,
    readDescription: async () => `@ o ${other}\u00a60 > their-agent\u00a6@ o ${SURFACE}`,
    setDescription: async (_w, description) => {
      writes.push(description)
    },
  })

  assert.match(writes[0] ?? "", /their-agent/, "the watcher must not clobber another Session")
})

test("an unchanged encoding is not republished", async (t: TestContext) => {
  const transcriptPath = log(t, [
    event(
      "permission.requested",
      { requestId: "r1", permissionRequest: {} },
      "2026-08-23T18:00:01.000Z",
    ),
  ])

  const memos = new Map<string, WatchMemo>()
  const deps = {
    now: () => 2000,
    readDescription: async () => "",
    setDescription: async () => {},
  }

  const first = await watchTick([target({ transcriptPath })], memos, deps)
  assert.equal(first.length, 1, "the first tick publishes")

  // Touch the log so the mtime gate opens, without changing what it derives.
  const later = new Date(Date.now() + 5000)
  utimesSync(transcriptPath, later, later)

  const second = await watchTick([target({ transcriptPath })], memos, deps)
  assert.deepEqual(second, [], "an unchanged derivation must not be republished")
})

test("a resolved permission clears the badge", async (t: TestContext) => {
  const transcriptPath = log(t, [
    event(
      "permission.requested",
      { requestId: "r1", permissionRequest: {} },
      "2026-08-23T18:00:01.000Z",
    ),
    event("permission.completed", { requestId: "r1" }, "2026-08-23T18:00:09.000Z"),
  ])

  const writes: string[] = []
  await watchTick([target({ transcriptPath })], new Map(), {
    now: () => 2000,
    readDescription: async () => `@ o ${SURFACE}\u00a6! p - Approve bash`,
    setDescription: async (_w, description) => {
      writes.push(description)
    },
  })

  assert.equal(writes.length, 1)
  assert.doesNotMatch(writes[0] ?? "", /! p /, "an answered prompt must clear")
})

test("a completed subagent is removed when its retention deadline passes", async (t) => {
  const completedAt = Date.parse("2026-08-24T12:00:00.000Z")
  const transcriptPath = log(t, [
    event(
      "tool.execution_start",
      { toolCallId: "spawn-1", toolName: "task", arguments: { name: "short-lived" } },
      "2026-08-24T11:59:50.000Z",
    ),
    event(
      "subagent.started",
      {
        toolCallId: "spawn-1",
        agentDisplayName: "short-lived",
        agentName: "task",
      },
      "2026-08-24T11:59:51.000Z",
      "agent-1",
    ),
    event(
      "subagent.completed",
      { toolCallId: "spawn-1", totalToolCalls: 1 },
      "2026-08-24T12:00:00.000Z",
      "agent-1",
    ),
  ])

  let now = completedAt + 1
  let published = `@ o ${SURFACE}`
  const memos = new Map<string, WatchMemo>()
  const deps = {
    now: () => now,
    readDescription: async () => published,
    setDescription: async (_workspaceID: string, description: string) => {
      published = description
    },
  }

  await watchTick([target({ transcriptPath })], memos, deps)
  assert.match(published, /short-lived/)

  now = completedAt + RETAIN_MS
  await watchTick([target({ transcriptPath })], memos, deps)
  assert.doesNotMatch(published, /short-lived/)
})

test("a cmux failure never escapes the tick", async (t: TestContext) => {
  const transcriptPath = log(t, [
    event(
      "permission.requested",
      { requestId: "r1", permissionRequest: {} },
      "2026-08-23T18:00:01.000Z",
    ),
  ])

  const changed = await watchTick([target({ transcriptPath })], new Map(), {
    now: () => 2000,
    readDescription: async () => {
      throw new Error("cmux is gone")
    },
    setDescription: async () => {},
  })

  assert.deepEqual(changed, [], "a failing workspace must be skipped, not thrown")
})

// --- lifecycle --------------------------------------------------------------

test("the watcher exits when nothing is left to watch", () => {
  assert.equal(shouldKeepRunning([], 5000, 1000), false)
})

test("the watcher exits once every Session has gone quiet", () => {
  // It must not become immortal; the next sessionStart hook starts a fresh one.
  assert.equal(shouldKeepRunning([target({ updatedAt: 1000 })], 9000, 1000), false)
  assert.equal(shouldKeepRunning([target({ updatedAt: 8500 })], 9000, 1000), true)
})

// --- the health signal (issue #63) ------------------------------------------

// `target()` fixes `healthSince` at 1000, which is 1970 in epoch milliseconds,
// so every event below is "after the last landed postToolUse" by construction.

test("the watcher reports a Session whose hooks have stopped landing", async (t: TestContext) => {
  // Copilot changed two hook payload shapes; every affected hook threw, was
  // caught, and exited 0. Fail-open held and Maestro went blind for two days.
  // The watcher is the only part of Maestro still running when that happens, so
  // it is the only thing that can say so.
  const transcriptPath = log(t, [
    event("tool.execution_complete", { toolCallId: "c1" }, "2026-08-23T18:00:01.000Z"),
    event("tool.execution_complete", { toolCallId: "c2" }, "2026-08-23T18:00:02.000Z"),
    event("tool.execution_complete", { toolCallId: "c3" }, "2026-08-23T18:00:03.000Z"),
  ])

  const writes: string[] = []
  await watchTick([target({ transcriptPath })], new Map(), {
    now: () => 2000,
    readDescription: async () => `@ o ${SURFACE}`,
    setDescription: async (_w, description) => {
      writes.push(description)
    },
  })

  assert.match(
    writes[0] ?? "",
    new RegExp(`@ o ${SURFACE} 3`),
    "three completions with no state write is a publisher that is not landing",
  )
})

test("two completions are a race, not a fault", async (t: TestContext) => {
  // A completion can land between the tool finishing and its `postToolUse` hook
  // writing state; they are separate processes. Only a run of them is evidence.
  const transcriptPath = log(t, [
    event("tool.execution_complete", { toolCallId: "c1" }, "2026-08-23T18:00:01.000Z"),
    event("tool.execution_complete", { toolCallId: "c2" }, "2026-08-23T18:00:02.000Z"),
  ])

  const writes: string[] = []
  await watchTick([target({ transcriptPath })], new Map(), {
    now: () => 2000,
    readDescription: async () => "",
    setDescription: async (_w, description) => {
      writes.push(description)
    },
  })

  assert.equal(writes.length, 1)
  assert.equal(writes[0], `@ o ${SURFACE}`, "a healthy owner row carries no health field")
})

test("a Session whose hooks all still land is not badged", async (t: TestContext) => {
  // The measured failure of the first design. `updatedAt` is stamped by EVERY
  // hook, and during the real outage the hooks that still parsed kept stamping
  // it - so a detector reading it saw a healthy Session throughout. Only a
  // per-hook timestamp isolates the pipeline that broke.
  const transcriptPath = log(t, [
    event("tool.execution_complete", { toolCallId: "c1" }, "2026-08-23T18:00:01.000Z"),
    event("tool.execution_complete", { toolCallId: "c2" }, "2026-08-23T18:00:02.000Z"),
    event("tool.execution_complete", { toolCallId: "c3" }, "2026-08-23T18:00:03.000Z"),
  ])

  const writes: string[] = []
  await watchTick(
    [target({ transcriptPath, healthSince: Date.parse("2026-08-23T18:00:04.000Z") })],
    new Map(),
    {
      now: () => 2000,
      readDescription: async () => "",
      setDescription: async (_w, description) => {
        writes.push(description)
      },
    },
  )

  assert.equal(writes[0], `@ o ${SURFACE}`, "a landed postToolUse clears the evidence behind it")
})

test("a subagent's tool calls do not badge the parent", async (t: TestContext) => {
  // A subagent's completions appear in the PARENT's log - measured, 11,983
  // completions of which only 1,809 were root. Counting them would badge every
  // long subagent run as a fault, which is the noise that kills a health
  // signal outright.
  const transcriptPath = log(t, [
    event("tool.execution_complete", { toolCallId: "c1" }, "2026-08-23T18:00:01.000Z", "sub-1"),
    event("tool.execution_complete", { toolCallId: "c2" }, "2026-08-23T18:00:02.000Z", "sub-1"),
    event("tool.execution_complete", { toolCallId: "c3" }, "2026-08-23T18:00:03.000Z", "sub-1"),
    event("tool.execution_complete", { toolCallId: "c4" }, "2026-08-23T18:00:04.000Z", "sub-1"),
  ])

  const writes: string[] = []
  await watchTick([target({ transcriptPath })], new Map(), {
    now: () => 2000,
    readDescription: async () => "",
    setDescription: async (_w, description) => {
      writes.push(description)
    },
  })

  assert.equal(writes[0], `@ o ${SURFACE}`)
})

test("a Session with no landed hook and no start time reports healthy", async (t: TestContext) => {
  // A resumed Session opens with a log full of old completions. Without a
  // floor to measure from, every one of them reads as evidence of failure and
  // the badge fires on a Session that is working perfectly.
  const transcriptPath = log(t, [
    event("tool.execution_complete", { toolCallId: "c1" }, "2026-08-23T18:00:01.000Z"),
    event("tool.execution_complete", { toolCallId: "c2" }, "2026-08-23T18:00:02.000Z"),
    event("tool.execution_complete", { toolCallId: "c3" }, "2026-08-23T18:00:03.000Z"),
  ])

  const writes: string[] = []
  await watchTick([target({ transcriptPath, healthSince: undefined })], new Map(), {
    now: () => 2000,
    readDescription: async () => "",
    setDescription: async (_w, description) => {
      writes.push(description)
    },
  })

  assert.equal(writes[0], `@ o ${SURFACE}`)
})

test("the health floor prefers the last landed hook over the session start", () => {
  const t1 = toWatchTarget("k", state({ startedAt: 500, lastToolAt: 900 }))
  assert.equal(t1?.healthSince, 900)
  const t2 = toWatchTarget("k", state({ startedAt: 500, lastToolAt: undefined }))
  assert.equal(t2?.healthSince, 500, "a Session that has not seen one yet measures from its start")
})

test("an upgrade does not badge every long-running Session at once", async (t: TestContext) => {
  // Measured on the real upgrade: a state file written by the previous build
  // has no `lastToolAt`, so the floor falls back to `startedAt` - and a Session
  // that had been running for 44 hours was judged on 634 completions it was
  // never going to be able to explain. A watcher cannot attest to hooks that
  // were meant to fire before it existed.
  const transcriptPath = log(t, [
    event("tool.execution_complete", { toolCallId: "c1" }, "2026-08-23T18:00:01.000Z"),
    event("tool.execution_complete", { toolCallId: "c2" }, "2026-08-23T18:00:02.000Z"),
    event("tool.execution_complete", { toolCallId: "c3" }, "2026-08-23T18:00:03.000Z"),
  ])

  const writes: string[] = []
  await watchTick([target({ transcriptPath, healthSince: 1000 })], new Map(), {
    now: () => 2000,
    startedAt: Date.parse("2026-08-23T18:00:04.000Z"),
    readDescription: async () => "",
    setDescription: async (_w, description) => {
      writes.push(description)
    },
  })

  assert.equal(writes[0], `@ o ${SURFACE}`, "history older than the observer is not evidence")
})

test("a genuinely dead pipeline still badges after the observer starts", async (t: TestContext) => {
  // The floor must not become an excuse. Completions that accrue AFTER the
  // watcher started are exactly the ones it can speak to.
  const transcriptPath = log(t, [
    event("tool.execution_complete", { toolCallId: "c0" }, "2026-08-23T17:00:00.000Z"),
    event("tool.execution_complete", { toolCallId: "c1" }, "2026-08-23T18:00:05.000Z"),
    event("tool.execution_complete", { toolCallId: "c2" }, "2026-08-23T18:00:06.000Z"),
    event("tool.execution_complete", { toolCallId: "c3" }, "2026-08-23T18:00:07.000Z"),
  ])

  const writes: string[] = []
  await watchTick([target({ transcriptPath, healthSince: 1000 })], new Map(), {
    now: () => 2000,
    startedAt: Date.parse("2026-08-23T18:00:04.000Z"),
    readDescription: async () => "",
    setDescription: async (_w, description) => {
      writes.push(description)
    },
  })

  assert.equal(writes[0], `@ o ${SURFACE} 3`)
})
