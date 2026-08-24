import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { writeDiagnostic } from "../src/logger.js"
import {
  countStalledCompletions,
  detectSessionActivity,
  detectSessionModel,
  encodeOwner,
  healthOf,
  mergeOwnedRows,
  ownedRows,
  ROW_SEP,
  resolveWorktree,
  STALLED_COMPLETIONS,
  splitOwnedBlocks,
} from "../src/tree.js"

// Issue #63. Maestro published almost nothing for two days because Copilot CLI
// changed two hook payload shapes; every affected hook threw, was caught, and
// exited 0. Fail-open held - no tool call was ever denied - and that is exactly
// why nothing noticed. The sidebar kept rendering the last plausible tree.
//
// The signal has to distinguish "nothing to say" from "cannot hear", and those
// two are byte-identical to a heartbeat. What separates them is that a hook
// which LANDS always stamps `updatedAt`, and a `tool.execution_complete` is the
// event a `postToolUse` hook is supposed to follow. Completions piling up with
// `updatedAt` frozen is a state no idle Session can reach, because an idle
// Session runs no tools.

const SURFACE = "4AF7FB2F-9FE2-4592-B309-036B054587D3"
const OTHER = "352F9F8E-CF62-49CB-ACB6-6E0097AD1F1B"

function withLog(lines: unknown[], run: (path: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "maestro-health-"))
  const path = join(dir, "events.jsonl")
  writeFileSync(path, `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`)
  try {
    run(path)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function completion(iso: string): unknown {
  return { type: "tool.execution_complete", timestamp: iso, data: { toolCallId: iso } }
}

const T0 = Date.parse("2026-08-24T12:00:00.000Z")

// --- the detector -----------------------------------------------------------

test("completions before the last landed hook are not counted", () => {
  withLog(
    [completion("2026-08-24T11:58:00.000Z"), completion("2026-08-24T11:59:00.000Z")],
    (path) => {
      assert.equal(
        countStalledCompletions(path, T0),
        0,
        "work that preceded the last state write was published by the hook that wrote it",
      )
    },
  )
})

test("completions after the last landed hook are counted", () => {
  withLog(
    [
      completion("2026-08-24T11:59:00.000Z"),
      completion("2026-08-24T12:01:00.000Z"),
      completion("2026-08-24T12:02:00.000Z"),
      completion("2026-08-24T12:03:00.000Z"),
    ],
    (path) => {
      assert.equal(countStalledCompletions(path, T0), 3)
    },
  )
})

test("an idle Session never trips the detector", () => {
  // The failure mode a plain heartbeat cannot avoid: a Session with nothing to
  // say looks identical to a dead one. Here it stays at zero by construction,
  // because it ran no tools.
  withLog(
    [
      { type: "user.message", timestamp: "2026-08-24T13:00:00.000Z" },
      { type: "assistant.message", timestamp: "2026-08-24T13:00:01.000Z" },
    ],
    (path) => {
      assert.equal(countStalledCompletions(path, T0), 0)
    },
  )
})

test("one long-running tool call does not trip the detector", () => {
  // The failure mode a log-mtime threshold cannot avoid. A single `bash` call
  // can append nothing for many minutes; that is silence, not deafness.
  withLog([{ type: "tool.execution_start", timestamp: "2026-08-24T12:01:00.000Z" }], (path) => {
    assert.ok(
      countStalledCompletions(path, T0) < STALLED_COMPLETIONS,
      "an outstanding tool call is not evidence that hooks stopped arriving",
    )
  })
})

test("a shutdown clears the count", () => {
  // A dead Session runs no more hooks by definition. Reporting one as unhealthy
  // forever trains the operator to ignore the badge, which costs more than the
  // blindness it was meant to report.
  withLog(
    [
      completion("2026-08-24T12:01:00.000Z"),
      completion("2026-08-24T12:02:00.000Z"),
      completion("2026-08-24T12:03:00.000Z"),
      { type: "session.shutdown", timestamp: "2026-08-24T12:04:00.000Z" },
    ],
    (path) => {
      assert.equal(countStalledCompletions(path, T0), 0)
    },
  )
})

test("an unreadable log reports health, not illness", () => {
  assert.equal(
    countStalledCompletions(join(tmpdir(), "maestro-health-absent", "nope.jsonl"), T0),
    0,
    "ignorance must not be published as a fault - that is the same lie in reverse",
  )
})

test("malformed lines are skipped rather than fatal", () => {
  const dir = mkdtempSync(join(tmpdir(), "maestro-health-"))
  const path = join(dir, "events.jsonl")
  writeFileSync(
    path,
    `not json\n${JSON.stringify(completion("2026-08-24T12:01:00.000Z"))}\n{"type":\n`,
  )
  try {
    assert.equal(countStalledCompletions(path, T0), 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// --- the wire ---------------------------------------------------------------

test("a healthy owner row is byte-identical to before the health field existed", () => {
  assert.equal(encodeOwner(SURFACE), `@ o ${SURFACE}`)
  assert.equal(encodeOwner(SURFACE, 0), `@ o ${SURFACE}`)
})

test("an unhealthy owner row appends the count as field 3", () => {
  // The tail is all-or-nothing: the fields after it are positional, so a health
  // count means the worktree and model slots are emitted as sentinels rather
  // than omitted.
  assert.equal(encodeOwner(SURFACE, 7), `@ o ${SURFACE} 7 - - -`)
})

test("block ownership is keyed on the surface alone", () => {
  // The health field is POSITIONAL and appended last. That is only safe because
  // a surface ID cannot contain a space, so field 2 stays recoverable without
  // knowing the field count - and every reader, here and in the sidebar, takes
  // it by index.
  const published = [encodeOwner(SURFACE, 4), "0 > alpha", encodeOwner(OTHER), "0 > beta"].join(
    ROW_SEP,
  )
  const blocks = splitOwnedBlocks(published)
  assert.deepEqual(
    blocks.map((b) => b.owner),
    [SURFACE, OTHER],
    "a health field must not become part of the surface identity",
  )
  assert.equal(ownedRows(published, SURFACE), [encodeOwner(SURFACE, 4), "0 > alpha"].join(ROW_SEP))
})

test("a Session recovering its hooks drops the field without touching co-residents", () => {
  const sick = [encodeOwner(SURFACE, 4), "0 > alpha", encodeOwner(OTHER), "0 > beta"].join(ROW_SEP)
  const well = mergeOwnedRows(sick, SURFACE, [encodeOwner(SURFACE), "0 > alpha"].join(ROW_SEP))
  assert.equal(
    well,
    [encodeOwner(SURFACE), "0 > alpha", encodeOwner(OTHER), "0 > beta"].join(ROW_SEP),
  )
})

// --- the log ----------------------------------------------------------------

test("the diagnostic log is bounded", () => {
  // Measured at 17 MB while 18,864 rejected payloads were written over two days.
  // It is append-only, written from a hook that must never fail, and read by
  // nobody until something has already gone wrong - so it grows fastest exactly
  // when it matters least that it is complete.
  const dir = mkdtempSync(join(tmpdir(), "maestro-log-"))
  const previous = process.env.TMPDIR
  process.env.TMPDIR = dir
  const path = join(dir, "maestro-cmux.log")
  try {
    writeFileSync(path, `${"x".repeat(2 * 1024 * 1024)}\n`)
    writeDiagnostic("postToolUse input.toolArgs must be a string")
    const size = statSync(path).size
    assert.ok(size < 1024 * 1024, `expected a trimmed log, got ${size} bytes`)
    const text = readFileSync(path, "utf8")
    assert.ok(
      text.includes("postToolUse input.toolArgs must be a string"),
      "the line that triggered the trim must survive it",
    )
    assert.ok(text.includes("log trimmed"), "a trim must say so, or the gap looks like data loss")
  } finally {
    if (previous === undefined) delete process.env.TMPDIR
    else process.env.TMPDIR = previous
    rmSync(dir, { recursive: true, force: true })
  }
})

test("writing a diagnostic to an unwritable path never throws", () => {
  const previous = process.env.TMPDIR
  process.env.TMPDIR = join(tmpdir(), "maestro-absent", "deeper")
  try {
    assert.doesNotThrow(() => writeDiagnostic("a logger that can fail can deny a tool call"))
  } finally {
    if (previous === undefined) delete process.env.TMPDIR
    else process.env.TMPDIR = previous
  }
})

// --- carrying the signal past the hooks that still work ---------------------

test("the health field survives being read back off the wire", () => {
  const published = [encodeOwner(SURFACE, 10), "0 > alpha", encodeOwner(OTHER)].join(ROW_SEP)
  assert.equal(healthOf(published, SURFACE), 10)
  assert.equal(healthOf(published, OTHER), 0, "a healthy row has no field to read")
  assert.equal(healthOf("", SURFACE), 0, "an unknown Session is not a sick one")
})

test("a malformed health field reads as healthy", () => {
  // Two builds can disagree about the wire for as long as a skew lasts. That
  // may degrade a badge; it must not invent one.
  assert.equal(healthOf(`@ o ${SURFACE} maybe`, SURFACE), 0)
  assert.equal(healthOf(`@ o ${SURFACE} -1`, SURFACE), 0)
})

// --- what the Session itself is: model, worktree and current activity -------

test("a Session in a normal checkout still encodes exactly as before", () => {
  assert.equal(
    encodeOwner(SURFACE, 0, { worktree: undefined, model: undefined, activity: undefined }),
    `@ o ${SURFACE}`,
  )
})

test("the owner row carries the Session's worktree and model", () => {
  // Both fields are POSITIONAL, so when any one is present all three are
  // emitted. A field that sometimes disappears would shift the ones after it,
  // and every reader here and in the sidebar takes them by index.
  assert.equal(
    encodeOwner(SURFACE, 0, { worktree: "as-wt-19", model: "claude-opus-5", activity: undefined }),
    `@ o ${SURFACE} - as-wt-19 claude-opus-5 -`,
  )
  assert.equal(
    encodeOwner(SURFACE, 4, { worktree: undefined, model: "gpt-5.6-luna", activity: undefined }),
    `@ o ${SURFACE} 4 - gpt-5.6-luna -`,
  )
})

test("session facts do not disturb block ownership or the health field", () => {
  const published = [
    encodeOwner(SURFACE, 4, { worktree: "as-wt-19", model: "claude-opus-5", activity: undefined }),
    "0 > alpha",
    encodeOwner(OTHER, 0, { worktree: undefined, model: undefined, activity: undefined }),
  ].join(ROW_SEP)
  assert.deepEqual(
    splitOwnedBlocks(published).map((b) => b.owner),
    [SURFACE, OTHER],
  )
  assert.equal(healthOf(published, SURFACE), 4)
  assert.equal(healthOf(published, OTHER), 0)
})

test("a healthy Session with facts reads as healthy, not as a fault", () => {
  // The health field is the `-` sentinel here, not absent. `healthOf` must not
  // read a sentinel as a number.
  const published = encodeOwner(SURFACE, 0, {
    worktree: "as-wt-19",
    model: "gpt-5.6-luna",
    activity: undefined,
  })
  assert.equal(healthOf(published, SURFACE), 0)
})

test("a long worktree name cannot widen the sidebar", () => {
  // Measured: a `.fixedSize()` Text makes its whole row incompressible, and one
  // long value shifts every row off its left edge. The fix is to bound the
  // field at the source. Real names on this machine run to 54 characters:
  // "squadron-maestro-1-20260823T130422Z-5a58e8-47-attempt-1".
  const row = encodeOwner(SURFACE, 0, {
    worktree: "squadron-maestro-1-20260823T130422Z-5a58e8-47-attempt-1",
    model: undefined,
    activity: undefined,
  })
  const worktree = row.split(" ")[4] ?? ""
  assert.equal(worktree.length, 20)
})

test("a worktree name with spaces cannot break the field split", () => {
  const row = encodeOwner(SURFACE, 0, { worktree: "two words", model: "a b", activity: undefined })
  assert.equal(row.split(" ").length, 7, "every field must stay a single token")
})

test("the Session model is the last ROOT event that names one", () => {
  // `agentId` is what makes "root" decidable: a subagent's events carry one,
  // the Session's do not. Without that filter this reports whichever subagent
  // ran most recently, which is precisely the wrong answer.
  withLog(
    [
      { type: "assistant.message", timestamp: "2026-08-24T12:00:00Z", data: { model: "gpt-5.4" } },
      {
        type: "tool.execution_start",
        agentId: "sub-1",
        timestamp: "2026-08-24T12:01:00Z",
        data: { model: "claude-haiku-4.5" },
      },
      {
        type: "assistant.message",
        timestamp: "2026-08-24T12:02:00Z",
        data: { model: "gpt-5.6-luna" },
      },
    ],
    (path) => {
      assert.equal(detectSessionModel(path), "gpt-5.6-luna")
    },
  )
})

test("an explicit model change is honoured", () => {
  // Measured live: `session.model_change` switched gpt-5.6-sol to claude-opus-5
  // mid-session. A stored value would have been stale until some hook happened
  // to refresh it, which is the same reason attention is derived and not stored.
  withLog(
    [
      {
        type: "assistant.message",
        timestamp: "2026-08-24T12:00:00Z",
        data: { model: "gpt-5.6-sol" },
      },
      {
        type: "session.model_change",
        timestamp: "2026-08-24T12:01:00Z",
        data: { previousModel: "gpt-5.6-sol", newModel: "claude-opus-5" },
      },
    ],
    (path) => {
      assert.equal(detectSessionModel(path), "claude-opus-5")
    },
  )
})

test("a log with no model at all reports none", () => {
  withLog([{ type: "user.message", timestamp: "2026-08-24T12:00:00Z" }], (path) => {
    assert.equal(detectSessionModel(path), undefined)
  })
})

test("an unreadable log reports no model rather than throwing", () => {
  assert.equal(detectSessionModel(join(tmpdir(), "maestro-absent", "nope.jsonl")), undefined)
})

// --- the Session's own current activity --------------------------------------

test("the Session activity is its most recent uncompleted ROOT tool call", () => {
  withLog(
    [
      {
        type: "tool.execution_start",
        timestamp: "2026-08-24T12:00:00Z",
        data: { toolCallId: "a", toolName: "grep" },
      },
      {
        type: "tool.execution_complete",
        timestamp: "2026-08-24T12:00:01Z",
        data: { toolCallId: "a" },
      },
      {
        type: "tool.execution_start",
        timestamp: "2026-08-24T12:00:02Z",
        data: { toolCallId: "b", toolName: "bash" },
      },
    ],
    (path) => {
      assert.equal(detectSessionActivity(path), "bash")
    },
  )
})

test("a subagent's tool call is never reported as the Session's", () => {
  // Same filter that makes the model decidable. Without it the row the operator
  // is talking to shows whatever a subagent happens to be doing.
  withLog(
    [
      {
        type: "tool.execution_start",
        agentId: "sub-1",
        timestamp: "2026-08-24T12:00:00Z",
        data: { toolCallId: "s", toolName: "view" },
      },
    ],
    (path) => {
      assert.equal(detectSessionActivity(path), undefined)
    },
  )
})

test("the end of a turn clears an abandoned root tool call", () => {
  // Measured, and the reason this rule exists at all: across three logs, 6,832
  // root starts produced 6,830 completions. Both strays were backgrounded
  // `bash` calls sitting 6,000 and 10,000 events from the end of the log, so
  // "last surviving open call" alone pins a dead tool to an idle Session
  // forever. `assistant.turn_end` appeared between a start and its completion
  // ZERO times across 6,831 matched pairs, which makes it safe to clear on.
  withLog(
    [
      {
        type: "tool.execution_start",
        timestamp: "2026-08-24T12:00:00Z",
        data: { toolCallId: "orphan", toolName: "bash" },
      },
      { type: "assistant.turn_end", timestamp: "2026-08-24T12:00:05Z" },
      { type: "user.message", timestamp: "2026-08-24T12:05:00Z" },
    ],
    (path) => {
      assert.equal(detectSessionActivity(path), undefined)
    },
  )
})

test("an idle Session reports no activity, and encodes as it always did", () => {
  withLog([{ type: "assistant.turn_end", timestamp: "2026-08-24T12:00:00Z" }], (path) => {
    assert.equal(detectSessionActivity(path), undefined)
  })
  assert.equal(
    encodeOwner(SURFACE, 0, { worktree: undefined, model: undefined, activity: undefined }),
    `@ o ${SURFACE}`,
  )
})

test("the activity field is bounded and space-free", () => {
  const row = encodeOwner(SURFACE, 0, {
    worktree: undefined,
    model: undefined,
    activity: "a tool with a very long name indeed",
  })
  const activity = row.split(" ")[6] ?? ""
  assert.equal(activity.length, 14)
  assert.equal(row.split(" ").length, 7)
})

test("an unreadable log reports no activity rather than throwing", () => {
  assert.equal(detectSessionActivity(join(tmpdir(), "maestro-absent", "nope.jsonl")), undefined)
})

// --- worktree detection ------------------------------------------------------

test("a linked worktree is identified by name", () => {
  // Git's on-disk contract: in a linked worktree `.git` is a FILE reading
  // `gitdir: <main>/.git/worktrees/<name>`. Reading it avoids spawning `git
  // rev-parse` on the hook path, where Maestro must never be the reason a
  // session stalls. Verified against live worktrees of three repositories.
  const dir = mkdtempSync(join(tmpdir(), "maestro-wt-"))
  try {
    writeFileSync(
      join(dir, ".git"),
      "gitdir: /Users/x/git/atlas/.git/worktrees/atlas-rev-balerion\n",
    )
    assert.equal(resolveWorktree(dir), "atlas-rev-balerion")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("a main working tree is not a worktree", () => {
  const dir = mkdtempSync(join(tmpdir(), "maestro-wt-"))
  try {
    mkdirSync(join(dir, ".git"))
    assert.equal(resolveWorktree(dir), undefined)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("a subdirectory of a worktree resolves to the same worktree", () => {
  // A Session's cwd is often below the worktree root.
  const dir = mkdtempSync(join(tmpdir(), "maestro-wt-"))
  try {
    writeFileSync(join(dir, ".git"), "gitdir: /Users/x/git/agent-skills/.git/worktrees/as-wt-19")
    const nested = join(dir, "src", "runtime")
    mkdirSync(nested, { recursive: true })
    assert.equal(resolveWorktree(nested), "as-wt-19")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("a directory outside any repository is not a worktree", () => {
  const dir = mkdtempSync(join(tmpdir(), "maestro-wt-"))
  try {
    assert.equal(resolveWorktree(dir), undefined)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("a malformed gitdir pointer is not guessed at", () => {
  const dir = mkdtempSync(join(tmpdir(), "maestro-wt-"))
  try {
    writeFileSync(join(dir, ".git"), "gitdir: /Users/x/git/atlas/.git")
    assert.equal(resolveWorktree(dir), undefined, "a submodule pointer is not a worktree")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
