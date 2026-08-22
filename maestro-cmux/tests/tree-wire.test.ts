import { strict as assert } from "node:assert"
import { test } from "node:test"

import { ROW_SEP, encodeTree, type Subagent } from "../src/tree.js"

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

test("each row is depth, glyph, then name", () => {
  const encoded = encodeTree(subs([{ name: "alpha", status: "run" }]))
  const parts = encoded.split(" ")
  assert.equal(parts[0], "0")
  assert.equal(parts[1], ">")
  assert.equal(parts[2], "alpha")
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
