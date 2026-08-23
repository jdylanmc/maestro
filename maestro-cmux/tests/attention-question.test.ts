import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { type TestContext, test } from "node:test"
import { detectAttention } from "../src/tree.js"

// An outstanding elicitation is a blocking state, and it IS derivable.
//
// detectAttention was written on the assumption that only `permission` could be
// derived from the log, and that an elicitation had to arrive through a hook.
// That assumption was wrong, and it cost a real miss: a Session sat visibly
// blocked on "Copilot needs information" for minutes with no ASK badge, because
// the hook that would have set the stored flag never ran.
//
// The derivation is exact rather than heuristic: an open elicitation is a
// `tool.execution_start` with toolName `ask_user` whose `toolCallId` never
// receives a `tool.execution_complete`. Measured on the live blocked session:
// 51 ask_user calls, 50 completed, exactly 1 outstanding - the one the operator
// was actually waiting on. The 50 closed calls are the built-in negative
// control, and the state cleared the moment the question was answered.

const ASK = "ask_user"

function event(type: string, data: Record<string, unknown>, timestamp: string): string {
  return `${JSON.stringify({ type, agentId: null, data, timestamp })}\n`
}

function log(t: TestContext, lines: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "maestro-attn-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const path = join(dir, "events.jsonl")
  writeFileSync(path, lines.join(""))
  return path
}

test("an unanswered elicitation is reported as a question", (t: TestContext) => {
  const path = log(t, [
    event("tool.execution_start", { toolCallId: "c1", toolName: ASK }, "2026-08-23T00:13:51.709Z"),
  ])
  const attention = detectAttention(path)
  assert.equal(attention?.kind, "question", "an open ask_user must raise attention")
  assert.equal(attention?.since, Date.parse("2026-08-23T00:13:51.709Z"))
})

test("an answered elicitation raises nothing", (t: TestContext) => {
  const path = log(t, [
    event("tool.execution_start", { toolCallId: "c1", toolName: ASK }, "2026-08-23T00:13:51.709Z"),
    event("tool.execution_complete", { toolCallId: "c1" }, "2026-08-23T00:15:02.000Z"),
  ])
  assert.equal(detectAttention(path), undefined, "an answered question must clear")
})

test("only the unanswered elicitation counts among many answered ones", (t: TestContext) => {
  const lines: string[] = []
  for (let i = 0; i < 50; i++) {
    lines.push(
      event(
        "tool.execution_start",
        { toolCallId: `c${i}`, toolName: ASK },
        "2026-08-20T11:42:36.443Z",
      ),
    )
    lines.push(
      event("tool.execution_complete", { toolCallId: `c${i}` }, "2026-08-20T11:43:00.000Z"),
    )
  }
  lines.push(
    event(
      "tool.execution_start",
      { toolCallId: "live", toolName: ASK },
      "2026-08-23T00:13:51.709Z",
    ),
  )
  const attention = detectAttention(log(t, lines))
  assert.equal(attention?.kind, "question")
  assert.equal(
    attention?.since,
    Date.parse("2026-08-23T00:13:51.709Z"),
    "the outstanding call, not a closed one, sets the wait time",
  )
})

test("the oldest unanswered elicitation is the one reported", (t: TestContext) => {
  const path = log(t, [
    event("tool.execution_start", { toolCallId: "old", toolName: ASK }, "2026-08-23T00:10:00.000Z"),
    event("tool.execution_start", { toolCallId: "new", toolName: ASK }, "2026-08-23T00:13:51.709Z"),
  ])
  assert.equal(detectAttention(path)?.since, Date.parse("2026-08-23T00:10:00.000Z"))
})

test("an ordinary open tool call is not an elicitation", (t: TestContext) => {
  const path = log(t, [
    event(
      "tool.execution_start",
      { toolCallId: "c1", toolName: "bash" },
      "2026-08-23T00:13:51.709Z",
    ),
  ])
  assert.equal(detectAttention(path), undefined, "a long-running bash is not a blocked Session")
})

test("an outstanding permission outranks an outstanding question", (t: TestContext) => {
  const path = log(t, [
    event("tool.execution_start", { toolCallId: "c1", toolName: ASK }, "2026-08-23T00:10:00.000Z"),
    event(
      "tool.execution_start",
      { toolCallId: "c2", toolName: "bash" },
      "2026-08-23T00:12:00.000Z",
    ),
    event(
      "permission.requested",
      { requestId: "r1", permissionRequest: { toolCallId: "c2" } },
      "2026-08-23T00:12:01.000Z",
    ),
  ])
  const attention = detectAttention(path)
  assert.equal(attention?.kind, "permission", "a hard block outranks a question")
  assert.equal(attention?.label, "Approve bash")
})

test("the question label never carries the question text", (t: TestContext) => {
  const secret = "Should I push the token ghp_examplenotreal to production?"
  const path = log(t, [
    event(
      "tool.execution_start",
      { toolCallId: "c1", toolName: ASK, arguments: { message: secret } },
      "2026-08-23T00:13:51.709Z",
    ),
  ])
  const attention = detectAttention(path)
  assert.equal(attention?.kind, "question")
  assert.ok(
    !attention?.label.includes("token") && !attention?.label.includes("ghp_"),
    "elicitation arguments must never reach a publishable label",
  )
})
