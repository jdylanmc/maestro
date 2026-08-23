import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { type TestContext, test } from "node:test"
import { detectAttention } from "../src/tree.js"

// A Session that has shut down is not waiting on anybody.
//
// The false ASK badge. detectAttention treated "a permission.requested with no
// permission.completed" as outstanding with no liveness bound, so a Session
// KILLED while a prompt was open left that request outstanding forever. Derived
// attention outranks the stored flag and the published description is
// persistent, so the badge stuck with nothing alive left to clear it.
//
// Measured over 167 recent Sessions: two were still reporting a blocking prompt
// 20.6h and 39.6h after death - "Approve bash" and "Approve run_factory". The
// 20.6h Session logged exactly 1 permission.requested, 0 completed, and then
// went quiet. The live Session in the same scan paired 1319/1319 and its single
// outstanding request was real, which is the negative control.
//
// `session.shutdown` is the marker: 189 occurrences across the corpus, and the
// last event of an ended Session. `session.end` is never emitted at all.

const ASK = "ask_user"

function event(type: string, data: Record<string, unknown>, timestamp: string): string {
  return `${JSON.stringify({ type, agentId: null, data, timestamp })}\n`
}

function log(t: TestContext, lines: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "maestro-shutdown-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const path = join(dir, "events.jsonl")
  writeFileSync(path, lines.join(""))
  return path
}

function requested(requestId: string, toolCallId: string, timestamp: string): string {
  return event("permission.requested", { requestId, permissionRequest: { toolCallId } }, timestamp)
}

// --- the negative control: without shutdown, nothing changes -----------------

test("an outstanding permission on a live Session still raises attention", (t: TestContext) => {
  const path = log(t, [
    event(
      "tool.execution_start",
      { toolCallId: "c1", toolName: "bash" },
      "2026-08-22T20:36:25.000Z",
    ),
    requested("r1", "c1", "2026-08-22T20:36:25.703Z"),
  ])
  assert.equal(
    detectAttention(path)?.kind,
    "permission",
    "a live Session blocked on a prompt must still be reported",
  )
})

// --- the fix ----------------------------------------------------------------

test("a permission abandoned by shutdown raises nothing", (t: TestContext) => {
  const path = log(t, [
    event(
      "tool.execution_start",
      { toolCallId: "c1", toolName: "bash" },
      "2026-08-22T20:36:25.000Z",
    ),
    requested("r1", "c1", "2026-08-22T20:36:25.703Z"),
    event("session.shutdown", {}, "2026-08-22T20:44:34.303Z"),
  ])
  assert.equal(detectAttention(path), undefined, "a dead Session must not report a blocking prompt")
})

test("an elicitation abandoned by shutdown raises nothing", (t: TestContext) => {
  const path = log(t, [
    event("tool.execution_start", { toolCallId: "c1", toolName: ASK }, "2026-08-22T20:36:25.000Z"),
    event("session.shutdown", {}, "2026-08-22T20:44:34.303Z"),
  ])
  assert.equal(detectAttention(path), undefined, "a dead Session must not report an open question")
})

test("shutdown clears every outstanding request, not just the newest", (t: TestContext) => {
  const path = log(t, [
    requested("r1", "c1", "2026-08-22T01:41:52.300Z"),
    requested("r2", "c2", "2026-08-22T01:42:10.000Z"),
    event("tool.execution_start", { toolCallId: "c3", toolName: ASK }, "2026-08-22T01:42:30.000Z"),
    event("session.shutdown", {}, "2026-08-22T01:43:02.787Z"),
  ])
  assert.equal(detectAttention(path), undefined)
})

// --- ordering: resume reopens ----------------------------------------------

test("a permission raised AFTER a resume is outstanding again", (t: TestContext) => {
  // Shutdown is applied in order, not as a whole-file test, because
  // `session.resume` appends to the same log. A prompt raised after the resume
  // is genuinely blocking and must survive the earlier shutdown.
  const path = log(t, [
    requested("r1", "c1", "2026-08-22T20:36:25.703Z"),
    event("session.shutdown", {}, "2026-08-22T20:44:34.303Z"),
    event("session.resume", {}, "2026-08-23T09:00:00.000Z"),
    event(
      "tool.execution_start",
      { toolCallId: "c9", toolName: "bash" },
      "2026-08-23T09:01:00.000Z",
    ),
    requested("r9", "c9", "2026-08-23T09:01:01.000Z"),
  ])
  const attention = detectAttention(path)
  assert.equal(attention?.kind, "permission", "a post-resume prompt must be reported")
  assert.equal(
    attention?.since,
    Date.parse("2026-08-23T09:01:01.000Z"),
    "the pre-shutdown request must not resurface as the oldest outstanding one",
  )
})

test("a resolved post-resume permission clears again", (t: TestContext) => {
  const path = log(t, [
    requested("r1", "c1", "2026-08-22T20:36:25.703Z"),
    event("session.shutdown", {}, "2026-08-22T20:44:34.303Z"),
    requested("r9", "c9", "2026-08-23T09:01:01.000Z"),
    event("permission.completed", { requestId: "r9" }, "2026-08-23T09:01:30.000Z"),
  ])
  assert.equal(detectAttention(path), undefined)
})
