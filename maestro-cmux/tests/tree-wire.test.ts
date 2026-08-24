import { strict as assert } from "node:assert"
import { test } from "node:test"

import { encodeTree, FIELD_NONE, ROW_SEP, type Subagent } from "../src/tree.js"

/**
 * The sidebar interpreter cannot split on a newline. `split(separator: "\n")`
 * does not interpret the escape and returns the whole string as one element;
 * `whereSeparator: { $0.isNewline }` renders nothing at all. Either way a
 * published tree collapses to a single row, and `cmux sidebar validate` still
 * reports OK - the failure is completely silent.
 *
 * So the wire format is single-line by contract, and these tests hold that
 * contract rather than trusting it.
 */

function subs(list: Array<Partial<Subagent> & { name: string }>): Map<string, Subagent> {
  const m = new Map<string, Subagent>()
  list.forEach((s, i) => {
    m.set(`a${i}`, {
      name: s.name,
      kind: s.kind ?? "",
      status: s.status ?? "ok",
      parent: s.parent ?? null,
      tools: s.tools ?? 0,
      doneAt: s.doneAt,
      model: s.model,
      activity: s.activity,
    })
  })
  return m
}

test("encoded tree never contains a newline", () => {
  const encoded = encodeTree(subs([{ name: "alpha" }, { name: "beta", status: "run" }]))
  assert.equal(encoded.includes("\n"), false)
  assert.equal(encoded.includes("\r"), false)
})

test("a name carrying newlines cannot smuggle one into the wire format", () => {
  const encoded = encodeTree(subs([{ name: "multi\nline\r\nname" }]))
  assert.equal(encoded.includes("\n"), false)
  assert.equal(encoded.includes("\r"), false)
})

test("a name cannot smuggle in the row delimiter and forge extra rows", () => {
  const encoded = encodeTree(subs([{ name: `forged${ROW_SEP}0 x fake` }]))
  assert.equal(encoded.split(ROW_SEP).length, 1)
})

test("each row is depth, glyph, model, activity, then name", () => {
  const encoded = encodeTree(
    subs([{ name: "alpha", status: "run", model: "gpt-5.6-luna", activity: "bash" }]),
  )
  const parts = encoded.split(" ")
  assert.equal(parts[0], "0")
  assert.equal(parts[1], ">")
  assert.equal(parts[2], "gpt-5.6-luna")
  assert.equal(parts[3], "bash")
  assert.equal(parts[4], "alpha")
})

test("an unknown model or activity uses the sentinel, never an empty field", () => {
  // An empty field would collapse under the sidebar's space split and shift
  // the name into the metadata position.
  const encoded = encodeTree(subs([{ name: "alpha", status: "run" }]))
  assert.equal(encoded, `0 > ${FIELD_NONE} ${FIELD_NONE} alpha`)
})

test("a model or activity containing spaces cannot shift the name field", () => {
  const encoded = encodeTree(
    subs([{ name: "alpha", status: "run", model: "some model", activity: "a b" }]),
  )
  const parts = encoded.split(" ")
  assert.equal(parts.length, 5)
  assert.equal(parts[4], "alpha")
})

test("a model cannot smuggle in the row delimiter and forge extra rows", () => {
  const encoded = encodeTree(subs([{ name: "alpha", status: "run", model: `x${ROW_SEP}0 x fake` }]))
  assert.equal(encoded.split(ROW_SEP).length, 1)
})

test("a finished subagent publishes no activity", () => {
  // buildTree clears it, and encodeTree must not reintroduce one: a completed
  // agent that still claims to be running a tool is the exact class of stale
  // confidence this repository keeps getting bitten by.
  const encoded = encodeTree(subs([{ name: "alpha", status: "ok", activity: undefined }]))
  assert.equal(encoded.split(" ")[3], FIELD_NONE)
})

test("one row per subagent, delimiter separated", () => {
  const encoded = encodeTree(subs([{ name: "a" }, { name: "b" }, { name: "c" }]))
  assert.equal(encoded.split(ROW_SEP).length, 3)
})

test("status maps to the glyph the sidebar reads", () => {
  const rows = encodeTree(
    subs([
      { name: "r", status: "run" },
      { name: "o", status: "ok" },
      { name: "f", status: "fail" },
    ]),
  ).split(ROW_SEP)
  assert.equal(rows[0]?.split(" ")[1], ">")
  assert.equal(rows[1]?.split(" ")[1], "v")
  assert.equal(rows[2]?.split(" ")[1], "x")
})
