import assert from "node:assert/strict"
import { closeSync, mkdtempSync, openSync, rmSync, statSync, writeSync } from "node:fs"
import { join } from "node:path"
import { type TestContext, test } from "node:test"
import { buildTree, detectAttention } from "../src/tree.js"

const OLD_TAIL_BYTES = 8 * 1024 * 1024

function event(
  type: string,
  agentId: string | null,
  data: Record<string, unknown>,
  timestamp?: string,
): string {
  return `${JSON.stringify({ type, agentId, data, timestamp })}\n`
}

function largeLog(t: TestContext, prefix: string[]): string {
  const root = mkdtempSync(join(process.cwd(), ".maestro-tree-test-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const log = join(root, "events.jsonl")
  const fd = openSync(log, "w")
  try {
    for (const line of prefix) writeSync(fd, line)
    const noise = event("session.noise", null, { padding: "x".repeat(64 * 1024) })
    while (statSync(log).size <= OLD_TAIL_BYTES) writeSync(fd, noise)
  } finally {
    closeSync(fd)
  }
  return log
}

test("buildTree finds parented subagents older than the former tail window", (t) => {
  const log = largeLog(t, [
    event("tool.execution_start", null, { toolCallId: "spawn-parent" }),
    event("subagent.started", "parent-agent", {
      agentDisplayName: "parent",
      agentName: "general-purpose",
      toolCallId: "spawn-parent",
    }),
    event("tool.execution_start", "parent-agent", { toolCallId: "spawn-child" }),
    event("subagent.started", "child-agent", {
      agentDisplayName: "child",
      agentName: "explore",
      toolCallId: "spawn-child",
    }),
  ])

  const tree = buildTree(log)
  assert.equal(tree.size, 2)
  assert.equal(tree.get("parent-agent")?.parent, null)
  assert.equal(tree.get("child-agent")?.parent, "parent-agent")
})

test("detectAttention finds an unmatched permission older than the former tail window", (t) => {
  const timestamp = "2026-08-22T12:00:00.000Z"
  const log = largeLog(t, [
    event("tool.execution_start", "blocked-agent", {
      toolCallId: "blocked-tool",
      toolName: "bash",
    }),
    event(
      "permission.requested",
      "blocked-agent",
      {
        requestId: "old-request",
        permissionRequest: { toolCallId: "blocked-tool" },
      },
      timestamp,
    ),
  ])

  assert.deepEqual(detectAttention(log), {
    kind: "permission",
    label: "Approve bash",
    // This fixture's request carries no `kind`, which is the honest shape for a
    // payload the runtime did not classify.
    detail: undefined,
    since: Date.parse(timestamp),
  })
})
