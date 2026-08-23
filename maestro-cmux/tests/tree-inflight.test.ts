import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { type TestContext, test } from "node:test"
import { buildTree, encodeTree } from "../src/tree.js"

/**
 * The in-flight blind window.
 *
 * A delegation emits `tool.execution_start` first and `subagent.started`
 * later - measured 3.170s to 110.887s apart across 35 delegations, and over
 * ten minutes in a batched case. Rendering only the latter leaves the tree
 * empty while the operator is waiting on real work.
 *
 * These tests hold both halves of the fix: the placeholder appears, and it
 * does NOT survive alongside the subagent it stood in for.
 */

function event(
  type: string,
  agentId: string | null,
  data: Record<string, unknown>,
  timestamp?: string,
): string {
  return `${JSON.stringify({ type, agentId, data, timestamp })}\n`
}

function log(t: TestContext, lines: string[]): string {
  const root = mkdtempSync(join(process.cwd(), ".maestro-inflight-test-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const path = join(root, "events.jsonl")
  writeFileSync(path, lines.join(""))
  return path
}

test("a delegation renders as running from tool.execution_start alone", (t) => {
  const tree = buildTree(
    log(t, [
      event("tool.execution_start", null, {
        toolCallId: "call_spawn",
        toolName: "task",
        arguments: { agent_type: "explore", name: "source-mapper" },
      }),
    ]),
  )

  assert.equal(tree.size, 1)
  const [row] = [...tree.values()]
  assert.equal(row?.name, "source-mapper")
  assert.equal(row?.kind, "explore")
  assert.equal(row?.status, "run")
  assert.equal(row?.parent, null)
  assert.equal(encodeTree(tree), "0 > source-mapper")
})

test("execution_subagent spawns render too, named by their description", (t) => {
  const tree = buildTree(
    log(t, [
      event("tool.execution_start", null, {
        toolCallId: "call_exec",
        toolName: "execution_subagent",
        arguments: { description: "Run the test suite", query: "npm test" },
      }),
    ]),
  )

  assert.equal(tree.size, 1)
  assert.equal([...tree.values()][0]?.name, "Run the test suite")
})

test("the real subagent replaces its placeholder rather than doubling it", (t) => {
  const tree = buildTree(
    log(t, [
      event("tool.execution_start", null, {
        toolCallId: "call_spawn",
        toolName: "task",
        arguments: { agent_type: "explore", name: "source-mapper" },
      }),
      event("subagent.started", "agent-1", {
        toolCallId: "call_spawn",
        agentDisplayName: "Explore Agent",
        agentName: "explore",
      }),
    ]),
  )

  assert.equal(tree.size, 1)
  assert.equal(tree.get("agent-1")?.name, "Explore Agent")
  assert.equal(tree.get("agent-1")?.status, "run")
  assert.equal(encodeTree(tree), "0 > Explore Agent")
})

test("a finished subagent is not resurrected as an in-flight placeholder", (t) => {
  const tree = buildTree(
    log(t, [
      event("tool.execution_start", null, {
        toolCallId: "call_spawn",
        toolName: "task",
        arguments: { agent_type: "explore", name: "source-mapper" },
      }),
      event("subagent.started", "agent-1", {
        toolCallId: "call_spawn",
        agentDisplayName: "Explore Agent",
        agentName: "explore",
      }),
      event("tool.execution_complete", null, { toolCallId: "call_spawn" }),
      event("subagent.completed", "agent-1", { totalToolCalls: 4 }),
    ]),
  )

  assert.equal(tree.size, 1)
  assert.equal(tree.get("agent-1")?.status, "ok")
})

/**
 * Measured negative finding: `tool.execution_complete` fired BEFORE
 * `subagent.started` in 5 of 35 delegations. Retiring a placeholder on the
 * tool's completion would therefore delete a row for an agent that had only
 * just come into existence, so the claim is resolved over the whole file.
 */
test("execution_complete arriving before subagent.started still yields one row", (t) => {
  const tree = buildTree(
    log(t, [
      event("tool.execution_start", null, {
        toolCallId: "call_spawn",
        toolName: "task",
        arguments: { agent_type: "explore", name: "source-mapper" },
      }),
      event("tool.execution_complete", null, { toolCallId: "call_spawn" }),
      event("subagent.started", "agent-1", {
        toolCallId: "call_spawn",
        agentDisplayName: "Explore Agent",
        agentName: "explore",
      }),
    ]),
  )

  assert.equal(tree.size, 1)
  assert.equal(tree.get("agent-1")?.status, "run")
})

/**
 * The live failure, replayed.
 *
 * A BACKGROUND delegation returns from its tool call at once, so
 * `tool.execution_complete` lands within a second while the subagent runs on
 * for minutes. Measured on the parent session's own log: four background
 * workers completed their tool call 0.7s-0.9s after starting it, and their
 * `subagent.started` events did not arrive for another 130.8s to 185.1s -
 * above the 110.887s previously thought to be the ceiling. Replaying that log
 * truncated to 23:31Z, the old reducer produced an empty tree and the operator
 * reported "not seeing the fleet"; this shape is what must render instead.
 *
 * This is the case that forbids treating `tool.execution_complete` as a
 * retirement signal: doing so would have hidden all four for their entire
 * blind window.
 */
test("a background delegation renders while only its tool call has completed", (t) => {
  const spawn = (toolCallId: string, name: string, at: string, done: string) => [
    event(
      "tool.execution_start",
      null,
      { toolCallId, toolName: "task", arguments: { agent_type: "general-purpose", name } },
      at,
    ),
    event("tool.execution_complete", null, { toolCallId, success: true }, done),
  ]
  const tree = buildTree(
    log(t, [
      ...spawn("toolu_a", "worker-31", "2026-08-22T23:28:30.372Z", "2026-08-22T23:28:31.095Z"),
      ...spawn("toolu_b", "worker-33", "2026-08-22T23:28:30.375Z", "2026-08-22T23:28:31.261Z"),
      ...spawn("toolu_c", "worker-36", "2026-08-22T23:29:24.710Z", "2026-08-22T23:29:25.358Z"),
      ...spawn("toolu_d", "worker-50", "2026-08-22T23:29:24.714Z", "2026-08-22T23:29:25.540Z"),
    ]),
  )

  assert.equal(tree.size, 4)
  assert.equal([...tree.values()].filter((s) => s.status === "run").length, 4)
  assert.equal(encodeTree(tree), "0 > worker-31¦0 > worker-33¦0 > worker-36¦0 > worker-50")
})

/**
 * `subagent.started` carries `agentDisplayName`, which is `arguments.name` from
 * the spawning tool call - measured identical across both events. So the label
 * the placeholder shows is the label the reconciled row shows, and the row does
 * not visibly rename itself when the subagent finally appears.
 */
test("the placeholder label survives reconciliation unchanged", (t) => {
  const spawn = event("tool.execution_start", null, {
    toolCallId: "toolu_a",
    toolName: "task",
    arguments: { agent_type: "general-purpose", name: "worker-31", mode: "background" },
  })
  const before = buildTree(log(t, [spawn]))
  const after = buildTree(
    log(t, [
      spawn,
      event("tool.execution_complete", null, { toolCallId: "toolu_a", success: true }),
      event("subagent.started", "c2024ded", {
        toolCallId: "toolu_a",
        agentName: "general-purpose",
        agentDisplayName: "worker-31",
      }),
    ]),
  )

  assert.equal(encodeTree(before), "0 > worker-31")
  assert.equal(encodeTree(after), "0 > worker-31")
  assert.equal(after.size, 1)
})

/**
 * The completion side is untouched. `subagent.completed` carries the same
 * `toolCallId` plus `totalToolCalls`, `totalTokens` and `durationMs`, and it
 * remains the ONLY finish signal.
 */
test("completion still lands on the reconciled row and is the only finish signal", (t) => {
  const tree = buildTree(
    log(t, [
      event("tool.execution_start", null, {
        toolCallId: "toolu_a",
        toolName: "task",
        arguments: { agent_type: "general-purpose", name: "worker-31" },
      }),
      event("tool.execution_complete", null, { toolCallId: "toolu_a", success: true }),
      event("subagent.started", "c2024ded", {
        toolCallId: "toolu_a",
        agentDisplayName: "worker-31",
        agentName: "general-purpose",
      }),
      event("subagent.completed", "c2024ded", {
        toolCallId: "toolu_a",
        agentDisplayName: "worker-31",
        totalToolCalls: 96,
        totalTokens: 412_000,
        durationMs: 2_128_147,
      }),
    ]),
  )

  assert.equal(tree.size, 1)
  const row = tree.get("c2024ded")
  assert.equal(row?.status, "ok")
  assert.equal(row?.tools, 96)
  assert.equal([...tree.values()].filter((s) => s.status === "run").length, 0)
})

test("an in-flight delegation nests under the subagent that spawned it", (t) => {
  const tree = buildTree(
    log(t, [
      event("tool.execution_start", null, {
        toolCallId: "call_parent",
        toolName: "task",
        arguments: { agent_type: "general-purpose", name: "nested-delegator" },
      }),
      event("subagent.started", "agent-parent", {
        toolCallId: "call_parent",
        agentDisplayName: "nested-delegator",
        agentName: "general-purpose",
      }),
      event("tool.execution_start", "agent-parent", {
        toolCallId: "call_child",
        toolName: "task",
        arguments: { agent_type: "explore", name: "adr-reader" },
      }),
    ]),
  )

  assert.equal(tree.size, 2)
  assert.equal(encodeTree(tree), "0 > nested-delegator¦1 > adr-reader")
})

test("an ordinary tool call is not mistaken for a delegation", (t) => {
  const tree = buildTree(
    log(t, [
      event("tool.execution_start", null, {
        toolCallId: "call_bash",
        toolName: "bash",
        arguments: { command: "ls" },
      }),
    ]),
  )

  assert.equal(tree.size, 0)
})
