import assert from "node:assert/strict"
import test from "node:test"
import { parseHookInput } from "../src/runtime/events.js"

/**
 * Payload drift, taken from the diagnostic log rather than from imagination.
 *
 * This is the failure this fork was created to prevent, and it happened to the
 * fork. Copilot CLI changed two payload shapes and Maestro's parser rejected
 * every affected hook:
 *
 *   13,589  postToolUse input.toolArgs must be a string
 *           (present keys: sessionId, timestamp, cwd, toolName, toolArgs, toolResult)
 *           from 2026-08-22T00:38:51Z
 *
 *    5,275  notification input.notificationType must be a string
 *           (present keys: sessionId, timestamp, cwd, message, title,
 *            hook_event_name, notification_type)
 *           from 2026-08-22T20:02:06Z
 *
 * `hook_event_name` beside `notification_type` says this is a snake_case
 * migration in progress, not one field's quirk - so the fix is a tolerant
 * lookup, not two special cases.
 *
 * Maestro failed OPEN throughout: `hook-runner` forces exit 0, so not one tool
 * call was denied. But it published nothing for two days, and a stale badge on
 * a Session that has already been answered is exactly the "plausible rather
 * than empty" failure this repository keeps writing down and then shipping.
 *
 * The upstream suite was fully green while upstream was broken, for the same
 * reason: it only ever exercised the payload the author assumed. These tests
 * use the observed shapes verbatim.
 */

// --- the two observed breakages ---------------------------------------------

test("postToolUse: toolArgs as an OBJECT is accepted (observed 13,589 times)", () => {
  const raw = JSON.stringify({
    sessionId: "s1",
    timestamp: 1787600000000,
    cwd: "/tmp",
    toolName: "bash",
    toolArgs: { command: "ls", description: "list files" },
    toolResult: { resultType: "success", textResultForLlm: "a\nb" },
  })

  const event = parseHookInput("postToolUse", raw, true)
  assert.equal(event.type, "tool.post")
  if (event.type !== "tool.post") return
  assert.equal(event.toolName, "bash")
  assert.equal(event.resultType, "success")
  assert.equal(event.summary, "bash: list files", "object args must still be readable")
})

test("postToolUse: toolArgs as a JSON STRING still works", () => {
  const raw = JSON.stringify({
    sessionId: "s1",
    timestamp: 1787600000000,
    cwd: "/tmp",
    toolName: "bash",
    toolArgs: JSON.stringify({ description: "list files" }),
  })

  const event = parseHookInput("postToolUse", raw, true)
  assert.equal(event.type === "tool.post" && event.summary, "bash: list files")
})

test("notification: notification_type is read (observed 5,275 times)", () => {
  const raw = JSON.stringify({
    sessionId: "s1",
    timestamp: 1787600000000,
    cwd: "/tmp",
    message: "Allow bash to run `rm -rf /`?",
    title: "Permission needed",
    hook_event_name: "notification",
    notification_type: "permission_prompt",
  })

  const event = parseHookInput("notification", raw)
  assert.equal(event.type, "notification")
  if (event.type !== "notification") return
  assert.equal(event.notificationType, "permission_prompt")
  assert.equal(event.title, "Permission needed")
})

test("notification: the original camelCase spelling still works", () => {
  const raw = JSON.stringify({
    timestamp: 1787600000000,
    cwd: "/tmp",
    notificationType: "elicitation_dialog",
    title: "Information requested",
  })

  const event = parseHookInput("notification", raw)
  assert.equal(event.type === "notification" && event.notificationType, "elicitation_dialog")
})

// --- the general rule, so the next rename is not another outage --------------

test("every hook reads its fields in either casing", () => {
  const cases: Array<[Parameters<typeof parseHookInput>[0], Record<string, unknown>]> = [
    ["sessionStart", { timestamp: 1, cwd: "/tmp", source: "new", initial_prompt: "hello" }],
    ["sessionEnd", { timestamp: 1, cwd: "/tmp", reason: "complete" }],
    ["userPromptSubmitted", { timestamp: 1, cwd: "/tmp", prompt: "hi" }],
    ["postToolUse", { timestamp: 1, cwd: "/tmp", tool_name: "bash", tool_args: { a: 1 } }],
    ["errorOccurred", { timestamp: 1, cwd: "/tmp", error: { message: "boom" } }],
    ["notification", { timestamp: 1, cwd: "/tmp", notification_type: "permission_prompt" }],
    ["agentStop", { timestamp: 1, cwd: "/tmp", stop_reason: "end_turn" }],
  ]

  for (const [hook, payload] of cases) {
    assert.doesNotThrow(
      () => parseHookInput(hook, JSON.stringify(payload)),
      `${hook} must accept snake_case`,
    )
  }
})

test("an initial prompt in snake_case still starts the session thinking", () => {
  const event = parseHookInput(
    "sessionStart",
    JSON.stringify({ timestamp: 1, cwd: "/tmp", source: "new", initial_prompt: "hello" }),
    true,
  )
  assert.equal(event.type === "session.start" && event.initialPrompt, "hello")
})

// --- do not over-correct ----------------------------------------------------

test("a genuinely missing required field still throws, with the present keys", () => {
  // Tolerance is not the same as accepting anything. A payload with no tool name
  // in EITHER casing carries nothing to render, and the diagnostic has to name
  // what did arrive - that message is how this outage was eventually found.
  assert.throws(
    () => parseHookInput("postToolUse", JSON.stringify({ timestamp: 1, cwd: "/tmp" })),
    /toolName must be a string \(present keys: timestamp, cwd\)/,
  )
})

test("an unrecognised resultType degrades to success rather than losing the payload", () => {
  const raw = JSON.stringify({
    timestamp: 1,
    cwd: "/tmp",
    toolName: "bash",
    toolArgs: {},
    toolResult: { resultType: "some_future_value" },
  })

  const event = parseHookInput("postToolUse", raw)
  assert.equal(event.type === "tool.post" && event.resultType, "success")
})
