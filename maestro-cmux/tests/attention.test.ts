import assert from "node:assert/strict"
import { test } from "node:test"
import { parseHookInput } from "../src/runtime/events.js"
import {
  attentionKindForNotification,
  createRuntimeState,
  reduceRuntimeState,
} from "../src/runtime/reducer.js"
import { ATTENTION_MARK, encodeAttention } from "../src/tree.js"
import type { Attention } from "../src/types.js"

const CWD = "/tmp/attention-fixture"

function state() {
  return createRuntimeState(CWD, "workspace:1", 1)
}

function notification(notificationType: string, title?: string) {
  return parseHookInput(
    "notification",
    JSON.stringify({ timestamp: 2, cwd: CWD, notificationType, title }),
  )
}

// --- which notifications are attention at all -------------------------------

test("only blocking notification types become attention", () => {
  assert.equal(attentionKindForNotification("permission_prompt"), "permission")
  assert.equal(attentionKindForNotification("elicitation_dialog"), "question")

  // Measured but deliberately NOT attention: these do not block the session.
  assert.equal(attentionKindForNotification("agent_idle"), undefined)
  assert.equal(attentionKindForNotification("shell_completed"), undefined)
  assert.equal(attentionKindForNotification("shell_detached_completed"), undefined)
})

test("an unrecognised notification type is ignored, not guessed at", () => {
  assert.equal(attentionKindForNotification("something_new_upstream"), undefined)
  const next = reduceRuntimeState(state(), notification("something_new_upstream"))
  assert.equal(next.attention, undefined)
})

// --- setting and clearing ---------------------------------------------------

test("a permission prompt raises permission attention", () => {
  const next = reduceRuntimeState(state(), notification("permission_prompt", "Permission needed"))
  assert.equal(next.attention?.kind, "permission")
  assert.equal(next.attention?.label, "Permission needed")
})

test("an elicitation raises question attention", () => {
  const next = reduceRuntimeState(
    state(),
    notification("elicitation_dialog", "Information requested"),
  )
  assert.equal(next.attention?.kind, "question")
})

test("agentStop raises the non-blocking turn attention", () => {
  const stop = parseHookInput(
    "agentStop",
    JSON.stringify({ timestamp: 3, cwd: CWD, stopReason: "end_turn" }),
  )
  const next = reduceRuntimeState(state(), stop)
  assert.equal(next.attention?.kind, "turn")
  assert.equal(next.phase, "idle")
})

test("a finished turn never masks a live blocking prompt", () => {
  const blocked = reduceRuntimeState(
    state(),
    notification("permission_prompt", "Permission needed"),
  )
  const stop = parseHookInput(
    "agentStop",
    JSON.stringify({ timestamp: 4, cwd: CWD, stopReason: "end_turn" }),
  )
  const next = reduceRuntimeState(blocked, stop)
  assert.equal(next.attention?.kind, "permission", "permission must outrank turn")
})

test("answering clears attention", () => {
  const blocked = reduceRuntimeState(state(), notification("permission_prompt"))
  assert.ok(blocked.attention)

  const prompt = parseHookInput(
    "userPromptSubmitted",
    JSON.stringify({ timestamp: 5, cwd: CWD, prompt: "go on" }),
  )
  assert.equal(reduceRuntimeState(blocked, prompt).attention, undefined)

  const tool = parseHookInput(
    "preToolUse",
    JSON.stringify({ timestamp: 5, cwd: CWD, toolName: "bash", toolArgs: "{}" }),
  )
  assert.equal(reduceRuntimeState(blocked, tool).attention, undefined)
})

// --- the wire format --------------------------------------------------------

test("an attention row is marked so the sidebar cannot read it as a subagent", () => {
  const a: Attention = { kind: "permission", label: "Permission needed", since: 1 }
  const row = encodeAttention(a)
  assert.equal(row.split(" ")[0], ATTENTION_MARK)
  assert.equal(row.split(" ")[1], "p")
  assert.equal(row, "! p Permission needed")
})

test("each attention kind has a distinct glyph, none colliding with a subagent status", () => {
  const glyphs = (["permission", "question", "turn"] as const).map(
    (kind) => encodeAttention({ kind, label: "x", since: 1 }).split(" ")[1],
  )
  assert.deepEqual(glyphs, ["p", "q", "t"])
  for (const g of glyphs) {
    assert.ok(![">", "v", "x"].includes(g ?? ""), `${g} collides with a subagent glyph`)
  }
})

test("an attention label cannot forge extra rows or smuggle a newline", () => {
  const row = encodeAttention({
    kind: "permission",
    label: "evil¦0 > forged\nagent",
    since: 1,
  })
  assert.ok(!row.includes("¦"), "row delimiter must not survive")
  assert.ok(!row.includes("\n"), "newline must not survive")
})

test("a label is truncated rather than allowed to consume the description", () => {
  const row = encodeAttention({ kind: "question", label: "q".repeat(500), since: 1 })
  assert.ok(row.length <= 48, `row was ${row.length} chars`)
})
