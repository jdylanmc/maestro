import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { type TestContext, test } from "node:test"
import { encodeOwner, RETAIN_MS, ROW_SEP, summarize } from "../src/tree.js"

// An empty tree is a REAL state, not silence.
//
// The subagent tree is published into the cmux workspace description, which is
// persistent: it is overwritten, never expired. So a summarize() that returns
// null when there is nothing left to show does not clear the surface - it
// leaves the LAST non-empty description frozen there, rendering subagents that
// finished hours ago as still running (#36).
//
// These tests pin the opposite: nothing-to-show summarises to an empty row set
// that the publish path writes, clearing the stale tree.

const SURFACE = "06DF8701-7CFD-428E-99D2-85F43C0EEDD2"
const NOWHERE = "/definitely/not/a/real/cwd/for/any/maestro/session"

function event(
  type: string,
  agentId: string | null,
  data: Record<string, unknown>,
  timestamp?: string,
): string {
  return `${JSON.stringify({ type, agentId, data, timestamp })}\n`
}

function log(t: TestContext, lines: string[]): string {
  const root = mkdtempSync(join(process.cwd(), ".maestro-empty-test-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const path = join(root, "events.jsonl")
  writeFileSync(path, lines.join(""))
  return path
}

test("a session with nothing to show summarises rather than returning null", () => {
  const tree = summarize(NOWHERE, undefined, undefined, new Set(), undefined, undefined)
  assert.notEqual(tree, null, "an empty tree must be published, not swallowed")
  assert.equal(tree?.encoded, "")
  assert.equal(tree?.total, 0)
  assert.equal(tree?.running, 0)
  assert.equal(tree?.failed, 0)
  assert.equal(tree?.attention, undefined)
})

test("an empty tree still names its owning surface, so the surface is cleared and not orphaned", () => {
  const tree = summarize(NOWHERE, undefined, SURFACE, new Set(), undefined, undefined)
  assert.notEqual(tree, null)
  assert.equal(tree?.encoded, encodeOwner(SURFACE))
  assert.ok(!tree?.encoded.includes(ROW_SEP), "an owner-only description carries no extra rows")
})

test("subagents that finished before RETAIN_MS clear the tree instead of freezing it", (t) => {
  const done = new Date(Date.now() - RETAIN_MS - 60_000).toISOString()
  const path = log(t, [
    event("tool.execution_start", null, { toolCallId: "spawn-auditor" }),
    event("subagent.started", "auditor", {
      agentDisplayName: "sidebar-auditor",
      agentName: "explore",
      toolCallId: "spawn-auditor",
    }),
    event("subagent.completed", "auditor", { totalToolCalls: 3 }, done),
  ])

  const tree = summarize(NOWHERE, undefined, SURFACE, new Set(), undefined, path)
  assert.notEqual(tree, null)
  assert.equal(tree?.running, 0)
  assert.ok(
    !tree?.encoded.includes("sidebar-auditor"),
    "an aged-out subagent must not remain in the published description",
  )
  assert.equal(
    tree?.encoded,
    encodeOwner(SURFACE),
    "an aged-out tree encodes to the owner row alone, with no empty trailing row",
  )
})

test("a live subagent is still published, so clearing never eats real work", (t) => {
  const path = log(t, [
    event("tool.execution_start", null, { toolCallId: "spawn-mapper" }),
    event("subagent.started", "mapper", {
      agentDisplayName: "source-mapper",
      agentName: "explore",
      toolCallId: "spawn-mapper",
    }),
  ])

  const tree = summarize(NOWHERE, undefined, SURFACE, new Set(), undefined, path)
  assert.equal(tree?.running, 1)
  assert.ok(tree?.encoded.includes("source-mapper"))
})
