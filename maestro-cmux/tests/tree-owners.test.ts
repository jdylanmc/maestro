import assert from "node:assert/strict"
import { test } from "node:test"
import {
  encodeOwner,
  mergeOwnedRows,
  ownedRows,
  pruneOwnedBlocks,
  ROW_SEP,
  splitOwnedBlocks,
} from "../src/tree.js"

// Two Copilot Sessions can share one cmux workspace, but the description they
// publish into is a single field. Each Session used to rewrite the WHOLE field,
// so whichever published last won: the other Session's owner row disappeared,
// its tab fell back to rendering as a plain terminal, and its subagent tree went
// with it (issue #49).
//
// The fix needs no new wire format. The `@ o <surface>` owner row already names
// a Session, so it is promoted to a block delimiter and each Session rewrites
// only its own block.

const A = "4AF7FB2F-9FE2-4592-B309-036B054587D3"
const B = "352F9F8E-CF62-49CB-ACB6-6E0097AD1F1B"

function rows(...parts: string[]): string {
  return parts.join(ROW_SEP)
}

const treeA = rows(encodeOwner(A), "0 > alpha", "1 v beta")
const treeB = rows(encodeOwner(B), "0 > gamma")

// --- the regression guard: one Session must encode exactly as before ---------

test("a single Session's description is unchanged by merging", () => {
  assert.equal(
    mergeOwnedRows("", A, treeA),
    treeA,
    "a first publish into an empty field must be byte-identical to the old behaviour",
  )
  assert.equal(mergeOwnedRows(treeA, A, treeA), treeA, "republishing the same tree is a no-op")
})

// --- the fix ----------------------------------------------------------------

test("a second Session appends its block instead of clobbering the first", () => {
  const merged = mergeOwnedRows(treeA, B, treeB)
  assert.equal(merged, rows(treeA, treeB))
  assert.equal(ownedRows(merged, A), treeA, "the first Session's rows must survive")
  assert.equal(ownedRows(merged, B), treeB)
})

test("updating one block leaves the other untouched", () => {
  const both = rows(treeA, treeB)
  const updatedA = rows(encodeOwner(A), "0 > alpha", "1 > beta", "0 x delta")
  const merged = mergeOwnedRows(both, A, updatedA)

  assert.equal(ownedRows(merged, A), updatedA, "this Session's block must be replaced wholesale")
  assert.equal(ownedRows(merged, B), treeB, "the co-resident Session must be left alone")
})

test("block order is stable, so tabs do not reshuffle", () => {
  const both = rows(treeA, treeB)
  const merged = mergeOwnedRows(both, A, rows(encodeOwner(A), "0 > alpha"))
  const owners = splitOwnedBlocks(merged).map((b) => b.owner)
  assert.deepEqual(owners, [A, B], "an updated block must stay in place, not move to the end")
})

// --- Session end ------------------------------------------------------------

test("a Session end removes only its own block", () => {
  const both = rows(treeA, treeB)
  const merged = mergeOwnedRows(both, A, "")

  assert.equal(merged, treeB, "ending one Session must not clear the co-resident Session")
  assert.equal(ownedRows(merged, A), "")
})

test("the last Session ending clears the field", () => {
  assert.equal(
    mergeOwnedRows(treeA, A, ""),
    "",
    "with nothing else published the field must go empty, so the tab reverts to a terminal",
  )
})

test("ending a Session that never published changes nothing", () => {
  assert.equal(mergeOwnedRows(treeB, A, ""), treeB)
})

// --- unattributable rows ----------------------------------------------------

test("rows published before any owner row are dropped", () => {
  // Only an older build could produce these. Nothing can ever clear them,
  // because no Session claims them - so one publish cleans up after an upgrade.
  const legacy = rows("0 > orphan", "1 v stray")
  assert.equal(mergeOwnedRows(legacy, A, treeA), treeA)
})

test("splitting ignores empty rows rather than inventing blocks", () => {
  assert.deepEqual(splitOwnedBlocks(""), [])
  assert.deepEqual(
    splitOwnedBlocks(`${ROW_SEP}${ROW_SEP}`),
    [],
    "a field of separators must not produce a block",
  )
})

test("ownedRows returns nothing for a Session with no block", () => {
  assert.equal(ownedRows(treeA, B), "")
  assert.equal(ownedRows("", A), "")
})

// --- pruning dead Sessions --------------------------------------------------

test("a block whose surface is gone is pruned", () => {
  // Per-block merging means a KILLED Session's block is never removed by its
  // own end hook, and no live Session will touch it. The old whole-field
  // overwrite cleaned that up by destroying everything.
  const both = rows(treeA, treeB)
  assert.equal(pruneOwnedBlocks(both, [B]), treeB)
  assert.equal(pruneOwnedBlocks(both, [A, B]), both, "live blocks must survive")
})

test("an unavailable surface list prunes nothing", () => {
  // "I could not enumerate the surfaces" must never be read as "no surfaces
  // exist" and wipe every live tree.
  const both = rows(treeA, treeB)
  assert.equal(pruneOwnedBlocks(both, []), both)
})
