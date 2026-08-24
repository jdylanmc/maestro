import assert from "node:assert/strict"
import test from "node:test"
import { treeDescriptionForEvent } from "../src/runtime/processor.js"
import type { TreeSummary } from "../src/tree.js"

const tree: TreeSummary = {
  total: 0,
  running: 0,
  failed: 0,
  attention: undefined,
  encoded: "@ o surface-1",
  nextExpiryAt: undefined,
}

test("session end clears the owner marker so the surface returns to a terminal", () => {
  assert.equal(treeDescriptionForEvent("session.end", tree), "")
})

test("active Session events continue publishing the owner marker", () => {
  assert.equal(treeDescriptionForEvent("agent.stop", tree), "@ o surface-1")
})

test("failed active tree computation preserves the published description", () => {
  assert.equal(treeDescriptionForEvent("tool.post", null), undefined)
})
