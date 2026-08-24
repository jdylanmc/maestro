import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { buildTree, encodeTree, ROW_SEP } from "../src/tree.js"

// Issue #59. Skill invocations were invisible in the tree, and the ticket left
// two things unmeasured: which recorded event distinguishes a user-invoked
// skill from an agent-invoked one, and whether a skill should nest under the
// invoking agent or sit as a sibling.
//
// Both are answered by the log. Measured across every session log on disk:
// 1,107 `skill.invoked` events, of which 1,024 carry a `trigger` - 833
// `agent-invoked`, 191 `user-invoked` - and 83 carry none at all. The event's
// `agentId` names the invoking subagent, which settles the nesting question
// without inventing a rule.

function withLog(lines: unknown[], run: (path: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "maestro-skill-"))
  const path = join(dir, "events.jsonl")
  writeFileSync(path, `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`)
  try {
    run(path)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function skill(name: string, trigger: string | undefined, agentId: string | null = null): unknown {
  return {
    type: "skill.invoked",
    agentId,
    // A skill row is a point event and ages out on the same retention clock as
    // finished work (#56), so a fixture timestamp must be recent or the row is
    // correctly retired before it can be asserted on.
    timestamp: new Date().toISOString(),
    data: {
      name,
      trigger,
      // Everything below is present in the real payload and must never reach
      // the wire. `content` is the FULL skill markdown.
      path: "/Users/someone/git/private-repo/.github/skills/x/SKILL.md",
      description: "free text the privacy boundary does not publish",
      content: "---\nname: x\ndescription: the entire skill body\n---\nSECRET",
    },
  }
}

test("a skill invocation produces a row", () => {
  withLog([skill("backlog-triage", "user-invoked")], (path) => {
    const encoded = encodeTree(buildTree(path))
    assert.match(encoded, /backlog-triage/)
  })
})

test("user- and agent-invoked skills carry different glyphs", () => {
  withLog(
    [skill("backlog-triage", "user-invoked"), skill("wiki-search", "agent-invoked")],
    (path) => {
      const rows = encodeTree(buildTree(path)).split(ROW_SEP)
      const user = rows.find((r) => r.includes("backlog-triage")) ?? ""
      const agent = rows.find((r) => r.includes("wiki-search")) ?? ""
      assert.equal(user.split(" ")[1], "u")
      assert.equal(agent.split(" ")[1], "a")
      assert.notEqual(user.split(" ")[1], agent.split(" ")[1])
    },
  )
})

test("a skill with no recorded trigger is not guessed at", () => {
  // 83 of 1,107 measured events carry no trigger. #59 asks for the distinction
  // to be DERIVED, and defaulting those to either colour would be a guess made
  // 83 times.
  withLog([skill("mystery", undefined)], (path) => {
    const row = encodeTree(buildTree(path)).split(ROW_SEP)[0] ?? ""
    assert.equal(row.split(" ")[1], "s")
  })
})

test("a skill nests under the subagent that invoked it", () => {
  withLog(
    [
      { type: "tool.execution_start", data: { toolCallId: "c1", toolName: "task" } },
      {
        type: "subagent.started",
        agentId: "sub-1",
        data: { toolCallId: "c1", agentDisplayName: "researcher", agentName: "explore" },
      },
      skill("wiki-search", "agent-invoked", "sub-1"),
    ],
    (path) => {
      const rows = encodeTree(buildTree(path)).split(ROW_SEP)
      const parent = rows.findIndex((r) => r.includes("researcher"))
      const child = rows.findIndex((r) => r.includes("wiki-search"))
      assert.ok(parent >= 0 && child >= 0)
      assert.equal(child, parent + 1, "a skill must follow the agent that invoked it")
      assert.equal((rows[child] ?? "").split(" ")[0], "1", "and be recorded as its child")
    },
  )
})

test("a skill whose invoking agent is unknown falls back to the root", () => {
  // The subagent may have aged out. The invocation still happened, so dropping
  // the row would lose a fact; re-parenting to the root keeps it visible.
  withLog([skill("wiki-search", "agent-invoked", "sub-missing")], (path) => {
    const row = encodeTree(buildTree(path)).split(ROW_SEP)[0] ?? ""
    assert.equal(row.split(" ")[0], "0")
  })
})

test("skill rows never publish the skill body, description, or path", () => {
  // `data.content` is the entire skill markdown. This is the same boundary as
  // #52 and the reason only `name` is read.
  withLog([skill("backlog-triage", "user-invoked")], (path) => {
    const encoded = encodeTree(buildTree(path))
    assert.doesNotMatch(encoded, /SECRET/)
    assert.doesNotMatch(encoded, /free text/)
    assert.doesNotMatch(encoded, /private-repo/)
    assert.doesNotMatch(encoded, /SKILL\.md/)
  })
})

test("a log with no skill invocation is byte-identical to before", () => {
  // The regression guard the ticket asks for: existing rows unchanged.
  withLog(
    [
      { type: "tool.execution_start", data: { toolCallId: "c1", toolName: "task" } },
      {
        type: "subagent.started",
        agentId: "sub-1",
        data: { toolCallId: "c1", agentDisplayName: "researcher", agentName: "explore" },
      },
    ],
    (path) => {
      assert.equal(encodeTree(buildTree(path)), "0 > - - researcher")
    },
  )
})

test("the same skill invoked twice under different agents yields two rows", () => {
  withLog(
    [
      { type: "tool.execution_start", data: { toolCallId: "c1", toolName: "task" } },
      {
        type: "subagent.started",
        agentId: "sub-1",
        data: { toolCallId: "c1", agentDisplayName: "alpha", agentName: "explore" },
      },
      { type: "tool.execution_start", data: { toolCallId: "c2", toolName: "task" } },
      {
        type: "subagent.started",
        agentId: "sub-2",
        data: { toolCallId: "c2", agentDisplayName: "beta", agentName: "explore" },
      },
      skill("wiki-search", "agent-invoked", "sub-1"),
      skill("wiki-search", "agent-invoked", "sub-2"),
    ],
    (path) => {
      const rows = encodeTree(buildTree(path)).split(ROW_SEP)
      assert.equal(rows.filter((r) => r.includes("wiki-search")).length, 2)
    },
  )
})
