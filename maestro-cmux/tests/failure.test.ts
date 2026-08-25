import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import {
  buildTree,
  encodeTree,
  MAX_WIRE_DEPTH,
  RETAIN_MS,
  ROW_SEP,
  summarize,
} from "../src/tree.js"

// `subagent.failed` is real, and Maestro did not handle it.
//
// An earlier note in `buildTree` recorded that the event did not exist, on a
// sample of 60 sessions that happened to contain none. Re-measured across every
// session log on disk: 2,898 `subagent.started`, 2,815 `subagent.completed`,
// and 27 `subagent.failed` spread over 11 logs.
//
// While it was unhandled a failed subagent kept its `run` status forever, so
// the sidebar drew dead agents as green running dots and counted them in
// "N active". That was observed live: five subagents shown as running in one
// Session had all failed.

function withLog(lines: unknown[], run: (path: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "maestro-fail-"))
  const path = join(dir, "events.jsonl")
  writeFileSync(path, `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`)
  try {
    run(path)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function started(agentId: string, name: string, toolCallId: string): unknown {
  return {
    type: "subagent.started",
    agentId,
    timestamp: new Date().toISOString(),
    // Measured shape: the spawn event carries no `model` in 526 of 2,895 cases.
    data: { toolCallId, agentDisplayName: name, agentName: name },
  }
}

function failed(agentId: string, name: string, model?: string): unknown {
  return {
    type: "subagent.failed",
    agentId,
    timestamp: new Date().toISOString(),
    data: {
      agentDisplayName: name,
      agentName: name,
      error: "the error text, which is never published",
      durationMs: 1200,
      ...(model === undefined ? {} : { model }),
    },
  }
}

test("a failed subagent is not reported as running", () => {
  withLog([started("sub-1", "pr64-roast", "tc-1"), failed("sub-1", "pr64-roast")], (path) => {
    const rows = encodeTree(buildTree(path)).split(ROW_SEP)
    const row = rows.find((r) => r.includes("pr64-roast")) ?? ""
    assert.equal(row.split(" ")[1], "x", "a failed subagent must not carry the running glyph")
  })
})

test("a failure is counted as failed, not as active", () => {
  // The count drives "N active" in the sidebar header, so an unhandled failure
  // inflates it for the rest of the Session.
  withLog(
    [started("sub-1", "alpha", "tc-1"), failed("sub-1", "alpha"), started("sub-2", "beta", "tc-2")],
    (path) => {
      const summary = summarize(join(path, ".."), undefined, undefined, new Set(), undefined, path)
      assert.equal(summary?.failed, 1)
      assert.equal(summary?.running, 1)
    },
  )
})

test("a failure carries the model the spawn event omitted", () => {
  // 22 of the 27 measured failures carry a `model` that `subagent.started`
  // did not.
  withLog(
    [started("sub-1", "pr64-roast", "tc-1"), failed("sub-1", "pr64-roast", "gpt-5.5")],
    (path) => {
      const rows = encodeTree(buildTree(path)).split(ROW_SEP)
      const row = rows.find((r) => r.includes("pr64-roast")) ?? ""
      assert.equal(row.split(" ")[2], "gpt-5.5")
    },
  )
})

test("the failure's error text is never published", () => {
  // `error` is free text from a failing agent and may quote anything it was
  // working on. It is read for nothing and must not reach the wire.
  withLog([started("sub-1", "alpha", "tc-1"), failed("sub-1", "alpha")], (path) => {
    const encoded = encodeTree(buildTree(path))
    assert.ok(!encoded.includes("never published"))
  })
})

test("a completion is still a success", () => {
  // The two events share a branch now, so this guards the branch itself.
  withLog(
    [
      started("sub-1", "alpha", "tc-1"),
      {
        type: "subagent.completed",
        agentId: "sub-1",
        timestamp: new Date().toISOString(),
        data: { totalToolCalls: 4 },
      },
    ],
    (path) => {
      const rows = encodeTree(buildTree(path)).split(ROW_SEP)
      const row = rows.find((r) => r.includes("alpha")) ?? ""
      assert.equal(row.split(" ")[1], "v")
    },
  )
})

test("the sidebar renders a failed count from real data", () => {
  // The workspace row deliberately had NO failed badge, on the grounds that
  // failure was unobservable and a badge could only come from a fixture. That
  // premise was wrong, so the badge is back - counting the `x` glyph, which
  // only `subagent.failed` can now produce.
  const sidebar = readFileSync(join(import.meta.dirname, "../sidebars/maestro.swift"), "utf8")
  assert.match(sidebar, /countOf\(d, "x"\) > 0/)
  assert.ok(
    !/`subagent\.failed` DOES NOT EXIST/.test(sidebar),
    "the sidebar must not still claim failure is unobservable",
  )
})

test("a failed row says so in its tooltip", () => {
  // A red cross is not self-explanatory. The glyph carries the state; the
  // tooltip has to carry the meaning.
  const sidebar = readFileSync(join(import.meta.dirname, "../sidebars/maestro.swift"), "utf8")
  assert.match(sidebar, /func rowHelp\(_ status: String, _ title: String\) -> String/)
  assert.match(sidebar, /\.help\(rowHelp\(status, title\)\)/)
})

// --- #43 candidate: a configurable max tree depth ---------------------------

test("maxDepth omits deeper generations, and their descendants with them", () => {
  // Rows are OMITTED, not clamped onto the last visible depth - clamping would
  // draw a grandchild as a sibling of its own parent and misstate the shape of
  // the tree, which is the one thing this tree exists to get right.
  withLog(
    [
      started("a", "root-agent", "tc-a"),
      // child of a: its spawn call is made BY a.
      {
        type: "tool.execution_start",
        agentId: "a",
        timestamp: new Date().toISOString(),
        data: { toolCallId: "tc-b", toolName: "task", arguments: { name: "child" } },
      },
      started("b", "child-agent", "tc-b"),
      {
        type: "tool.execution_start",
        agentId: "b",
        timestamp: new Date().toISOString(),
        data: { toolCallId: "tc-c", toolName: "task", arguments: { name: "grandchild" } },
      },
      started("c", "grandchild-agent", "tc-c"),
    ],
    (path) => {
      const subs = buildTree(path)
      const all = encodeTree(subs)
      assert.match(all, /root-agent/)
      assert.match(all, /child-agent/)
      assert.match(all, /grandchild-agent/)

      const shallow = encodeTree(subs, Date.now(), new Set(), RETAIN_MS, 1)
      assert.match(shallow, /root-agent/)
      assert.ok(!shallow.includes("child-agent"), "depth 1 must be omitted")
      assert.ok(!shallow.includes("grandchild-agent"), "a descendant goes with its parent")

      const two = encodeTree(subs, Date.now(), new Set(), RETAIN_MS, 2)
      assert.match(two, /child-agent/)
      assert.ok(!two.includes("grandchild-agent"))
    },
  )
})

test("the default depth publishes the tree exactly as before", () => {
  withLog([started("a", "root-agent", "tc-a")], (path) => {
    const subs = buildTree(path)
    assert.equal(
      encodeTree(subs),
      encodeTree(subs, Date.now(), new Set(), RETAIN_MS, MAX_WIRE_DEPTH),
    )
  })
})
