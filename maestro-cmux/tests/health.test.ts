import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { writeDiagnostic } from "../src/logger.js"
import {
  countStalledCompletions,
  encodeOwner,
  healthOf,
  mergeOwnedRows,
  ownedRows,
  ROW_SEP,
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
  assert.equal(encodeOwner(SURFACE, 7), `@ o ${SURFACE} 7`)
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
