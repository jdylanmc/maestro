import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { buildTree, encodeTree, ROW_SEP, summarize } from "../src/tree.js"

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
