import assert from "node:assert/strict"
import test from "node:test"
import { treeDescriptionForEvent, wouldEraseWithIgnorance } from "../src/runtime/processor.js"
import type { TreeSummary } from "../src/tree.js"

const tree: TreeSummary = {
  total: 0,
  running: 0,
  failed: 0,
  attention: undefined,
  encoded: "@ o surface-1",
  nextExpiryAt: undefined,
  resolved: true,
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

// ---------------------------------------------------------------------------
// Do not erase a real tree with ignorance
//
// Measured live: a Session flipped between four subagent rows and none every
// few seconds. The watcher was stopped for the experiment, so hooks alone were
// fighting each other. `resolveSessionLog` fails closed when handed an identity
// that does not resolve to a file — and `agentStop`'s `sessionId` is documented
// as NOT being the session-state directory name — so those hooks summarised to
// an empty tree, which encodes to the owner row alone and wipes the rows
// `postToolUse` had just published.
// ---------------------------------------------------------------------------

function summary(over: Partial<TreeSummary>): TreeSummary {
  return {
    total: 0,
    running: 0,
    failed: 0,
    attention: undefined,
    encoded: "",
    nextExpiryAt: undefined,
    resolved: true,
    ...over,
  }
}

test("an unresolved summary must not clear rows another publisher wrote", () => {
  const block = "@ o SURFACE¦0 > gpt-5.5 - smaug-155¦1 > gpt-5.6-sol - reviewer"
  assert.equal(wouldEraseWithIgnorance(summary({ resolved: false }), block), true)
})

test("an unresolved summary may still write its owner row when nothing is at stake", () => {
  // A Session with no tree yet still has to identify itself as a Copilot
  // surface, or its tab renders as a plain terminal (#54).
  assert.equal(wouldEraseWithIgnorance(summary({ resolved: false }), "@ o SURFACE"), false)
  assert.equal(wouldEraseWithIgnorance(summary({ resolved: false }), ""), false)
})

test("a RESOLVED summary may clear rows, because that is real news", () => {
  // This is the #36 behaviour and must survive: a Session whose subagents have
  // all finished summarises to an empty tree, and publishing it is what stops
  // completed agents rendering as running forever.
  const block = "@ o SURFACE¦0 > gpt-5.5 - smaug-155"
  assert.equal(wouldEraseWithIgnorance(summary({ resolved: true }), block), false)
})

test("a failed computation is not treated as ignorance to guard against", () => {
  // null means summarize could not run at all; the caller already publishes
  // nothing in that case.
  assert.equal(wouldEraseWithIgnorance(null, "@ o SURFACE¦0 > gpt-5.5 - smaug-155"), false)
})

test("an attention row IS worth protecting", () => {
  // This test previously asserted the opposite, on the reasoning that an owner
  // row and an attention row are "both re-derivable on the next publish".
  // Measured live, that premise is false: attention is derived FROM THE LOG, so
  // a publisher that could not read the log cannot re-derive it either. It just
  // erases it, and the next unresolved publisher does the same.
  //
  // Observed on a working Session for 30 seconds: its published row alternated
  // every few seconds between the full form with a permission badge and a bare
  // owner row with neither, so the sidebar showed it idle half the time. The
  // Session's own stored state said `working` throughout.
  assert.equal(
    wouldEraseWithIgnorance(summary({ resolved: false }), "@ o SURFACE¦! p shell Approve bash"),
    true,
  )
})

test("an owner row that carries facts is worth protecting", () => {
  // A bare `@ o <id>` and a full `@ o <id> - - claude-opus-5 bash` are the same
  // row to a reader that takes field 2 by index, so replacing the second with
  // the first silently drops the model, worktree, health signal and current
  // tool call - which is exactly what "looks idle while working" was.
  assert.equal(
    wouldEraseWithIgnorance(summary({ resolved: false }), "@ o SURFACE - - claude-opus-5 bash"),
    true,
  )
})

test("a bare owner row alone still has nothing to lose", () => {
  // The rule stays "only a publisher that read a log may clear rows", not
  // "an unresolved publisher may never write". A Session with no tree yet must
  // still be able to identify itself as a Copilot surface (#54).
  assert.equal(wouldEraseWithIgnorance(summary({ resolved: false }), "@ o SURFACE"), false)
})
