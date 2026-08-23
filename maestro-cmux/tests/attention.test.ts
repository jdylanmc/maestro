import assert from "node:assert/strict"
import { test } from "node:test"
import { parseHookInput } from "../src/runtime/events.js"
import {
  attentionKindForNotification,
  createRuntimeState,
  reduceRuntimeState,
} from "../src/runtime/reducer.js"
import { ATTENTION_MARK, encodeAttention } from "../src/tree.js"
import type { Attention } from "../src/types.js"

const CWD = "/tmp/attention-fixture"

function state() {
  return createRuntimeState(CWD, "workspace:1", 1)
}

function notification(notificationType: string, title?: string) {
  return parseHookInput(
    "notification",
    JSON.stringify({ timestamp: 2, cwd: CWD, notificationType, title }),
  )
}

// --- which notifications are attention at all -------------------------------

test("only blocking notification types become attention", () => {
  assert.equal(attentionKindForNotification("permission_prompt"), "permission")
  assert.equal(attentionKindForNotification("elicitation_dialog"), "question")

  // Measured but deliberately NOT attention: these do not block the session.
  assert.equal(attentionKindForNotification("agent_idle"), undefined)
  assert.equal(attentionKindForNotification("shell_completed"), undefined)
  assert.equal(attentionKindForNotification("shell_detached_completed"), undefined)
})

test("an unrecognised notification type is ignored, not guessed at", () => {
  assert.equal(attentionKindForNotification("something_new_upstream"), undefined)
  const next = reduceRuntimeState(state(), notification("something_new_upstream"))
  assert.equal(next.attention, undefined)
})

// --- setting and clearing ---------------------------------------------------

test("a permission prompt raises permission attention", () => {
  const next = reduceRuntimeState(state(), notification("permission_prompt", "Permission needed"))
  assert.equal(next.attention?.kind, "permission")
  assert.equal(next.attention?.label, "Permission needed")
})

test("an elicitation raises question attention", () => {
  const next = reduceRuntimeState(
    state(),
    notification("elicitation_dialog", "Information requested"),
  )
  assert.equal(next.attention?.kind, "question")
})

test("agentStop raises the non-blocking turn attention", () => {
  const stop = parseHookInput(
    "agentStop",
    JSON.stringify({ timestamp: 3, cwd: CWD, stopReason: "end_turn" }),
  )
  const next = reduceRuntimeState(state(), stop)
  assert.equal(next.attention?.kind, "turn")
  assert.equal(next.phase, "idle")
})

test("a finished turn never masks a live blocking prompt", () => {
  const blocked = reduceRuntimeState(
    state(),
    notification("permission_prompt", "Permission needed"),
  )
  const stop = parseHookInput(
    "agentStop",
    JSON.stringify({ timestamp: 4, cwd: CWD, stopReason: "end_turn" }),
  )
  const next = reduceRuntimeState(blocked, stop)
  assert.equal(next.attention?.kind, "permission", "permission must outrank turn")
})

test("answering clears attention", () => {
  const blocked = reduceRuntimeState(state(), notification("permission_prompt"))
  assert.ok(blocked.attention)

  const prompt = parseHookInput(
    "userPromptSubmitted",
    JSON.stringify({ timestamp: 5, cwd: CWD, prompt: "go on" }),
  )
  assert.equal(reduceRuntimeState(blocked, prompt).attention, undefined)

  const tool = parseHookInput(
    "postToolUse",
    JSON.stringify({ timestamp: 5, cwd: CWD, toolName: "bash", toolArgs: "{}" }),
  )
  assert.equal(reduceRuntimeState(blocked, tool).attention, undefined)
})

// --- the wire format --------------------------------------------------------

test("an attention row is marked so the sidebar cannot read it as a subagent", () => {
  const a: Attention = { kind: "permission", label: "Permission needed", since: 1 }
  const row = encodeAttention(a)
  assert.equal(row.split(" ")[0], ATTENTION_MARK)
  assert.equal(row.split(" ")[1], "p")
  assert.equal(row, "! p Permission needed")
})

test("each attention kind has a distinct glyph, none colliding with a subagent status", () => {
  const glyphs = (["permission", "question", "turn"] as const).map(
    (kind) => encodeAttention({ kind, label: "x", since: 1 }).split(" ")[1],
  )
  assert.deepEqual(glyphs, ["p", "q", "t"])
  for (const g of glyphs) {
    assert.ok(![">", "v", "x"].includes(g ?? ""), `${g} collides with a subagent glyph`)
  }
})

test("an attention label cannot forge extra rows or smuggle a newline", () => {
  const row = encodeAttention({
    kind: "permission",
    label: "evil¦0 > forged\nagent",
    since: 1,
  })
  assert.ok(!row.includes("¦"), "row delimiter must not survive")
  assert.ok(!row.includes("\n"), "newline must not survive")
})

test("a label is truncated rather than allowed to consume the description", () => {
  const row = encodeAttention({ kind: "question", label: "q".repeat(500), since: 1 })
  assert.ok(row.length <= 48, `row was ${row.length} chars`)
})

// --- ordering and retention -------------------------------------------------

import { detectDismissed, encodeTree, RETAIN_MS, ROW_SEP, type Subagent } from "../src/tree.js"

function agent(over: Partial<Subagent>): Subagent {
  return {
    name: "a",
    kind: "",
    status: "run",
    parent: null,
    tools: 0,
    doneAt: undefined,
    ...over,
  }
}

test("running subagents sort above finished ones", () => {
  const subs = new Map<string, Subagent>([
    ["1", agent({ name: "done-first", status: "ok", doneAt: Date.now() })],
    ["2", agent({ name: "still-running", status: "run" })],
  ])
  const rows = encodeTree(subs).split(ROW_SEP)
  assert.match(rows[0] ?? "", /still-running/)
  assert.match(rows[1] ?? "", /done-first/)
})

test("sorting never separates a child from its parent", () => {
  // The flat-sort bug: a finished parent sorts down, and its running child
  // would be left behind under an unrelated parent.
  const subs = new Map<string, Subagent>([
    ["p1", agent({ name: "parent-finished", status: "ok", doneAt: Date.now() })],
    ["c1", agent({ name: "child-running", status: "run", parent: "p1" })],
    ["p2", agent({ name: "parent-running", status: "run" })],
  ])
  const rows = encodeTree(subs).split(ROW_SEP)
  const at = (n: string) => rows.findIndex((r) => r.includes(n))

  // The child must immediately follow its own parent, wherever that lands.
  assert.equal(at("child-running"), at("parent-finished") + 1)
  // And it must be recorded as a child, not promoted to a root.
  assert.equal((rows[at("child-running")] ?? "").split(" ")[0], "1")
})

test("a subagent finished longer ago than RETAIN_MS is retired", () => {
  const now = Date.now()
  const subs = new Map<string, Subagent>([
    ["1", agent({ name: "recent", status: "ok", doneAt: now - 60_000 })],
    ["2", agent({ name: "ancient", status: "ok", doneAt: now - RETAIN_MS - 1 })],
  ])
  const encoded = encodeTree(subs, now)
  assert.match(encoded, /recent/)
  assert.doesNotMatch(encoded, /ancient/)
})

test("a running subagent is never retired, however old", () => {
  const now = Date.now()
  const subs = new Map<string, Subagent>([["1", agent({ name: "long-runner", status: "run" })]])
  assert.match(encodeTree(subs, now), /long-runner/)
})

// --- dismissal --------------------------------------------------------------

test("a finished agent absent from the published description counts as dismissed", () => {
  const subs = new Map<string, Subagent>([
    ["1", agent({ name: "kept", status: "ok", doneAt: Date.now() })],
    ["2", agent({ name: "clicked-away", status: "ok", doneAt: Date.now() })],
  ])
  const published = "@ o surface¦0 v kept"
  assert.deepEqual(detectDismissed(subs, published), ["clicked-away"])
})

test("a RUNNING agent absent from the description is never treated as dismissed", () => {
  // An absent running agent means a stale or truncated description, not intent.
  const subs = new Map<string, Subagent>([["1", agent({ name: "still-going", status: "run" })]])
  assert.deepEqual(detectDismissed(subs, "@ o surface"), [])
})

test("a dismissed agent stays hidden on the next publish", () => {
  const now = Date.now()
  const subs = new Map<string, Subagent>([
    ["1", agent({ name: "gone", status: "ok", doneAt: now })],
    ["2", agent({ name: "stays", status: "ok", doneAt: now })],
  ])
  const encoded = encodeTree(subs, now, new Set(["gone"]))
  assert.doesNotMatch(encoded, /gone/)
  assert.match(encoded, /stays/)
})

test("dismissing cannot hide running work", () => {
  const now = Date.now()
  const subs = new Map<string, Subagent>([["1", agent({ name: "busy", status: "run" })]])
  assert.match(encodeTree(subs, now, new Set(["busy"])), /busy/)
})

// --- session resolution (#33) ------------------------------------------------

import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs"
import { basename, join as pjoin } from "node:path"
import { parseSessionIdentity } from "../src/runtime/events.js"
import { resolveSessionLog } from "../src/tree.js"

test("every hook payload's sessionId and transcriptPath are parsed, not discarded", () => {
  const withId = parseSessionIdentity(JSON.stringify({ cwd: "/x", sessionId: "abc" }))
  assert.equal(withId.sessionId, "abc")

  const stop = parseSessionIdentity(
    JSON.stringify({ cwd: "/x", sessionId: "not-a-dir", transcriptPath: "/tmp/t.jsonl" }),
  )
  assert.equal(stop.transcriptPath, "/tmp/t.jsonl")

  // Must never throw - this runs in the same runner as a tool hook.
  assert.deepEqual(parseSessionIdentity("not json"), {
    sessionId: undefined,
    transcriptPath: undefined,
  })
})

test("transcriptPath outranks sessionId, because agentStop's sessionId is not the directory", (t) => {
  const root = mkdtempSync(pjoin(process.cwd(), ".maestro-resolve-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const log = pjoin(root, "explicit.jsonl")
  writeFileSync(log, "")
  // agentStop carries a sessionId that is NOT the session-state directory name,
  // so an implementation preferring it would resolve the wrong log.
  assert.equal(resolveSessionLog("/nowhere", "df0af405-not-a-directory", log), log)
})

test("a bad sessionId cannot escape the session-state root", () => {
  assert.equal(resolveSessionLog("/nowhere", "../../etc/passwd"), null)
  assert.equal(resolveSessionLog("/nowhere", "has space"), null)
})

test("session identity prevents cross-contamination when cwd is shared", (t) => {
  const root = mkdtempSync(pjoin(process.cwd(), ".maestro-resolve-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const cwd = "/shared/repository"
  const firstDir = mkdtempSync(pjoin(root, "session-a-"))
  const secondDir = mkdtempSync(pjoin(root, "session-b-"))
  writeFileSync(pjoin(firstDir, "workspace.yaml"), `cwd: ${cwd}\n`)
  writeFileSync(pjoin(secondDir, "workspace.yaml"), `cwd: ${cwd}\n`)
  const firstLog = pjoin(firstDir, "events.jsonl")
  const secondLog = pjoin(secondDir, "events.jsonl")
  writeFileSync(firstLog, '{"session":"a"}\n')
  writeFileSync(secondLog, '{"session":"b"}\n')
  utimesSync(firstLog, new Date(1_000), new Date(1_000))
  utimesSync(secondLog, new Date(2_000), new Date(2_000))
  const explicitLog = pjoin(root, "explicit.jsonl")
  const missingLog = pjoin(root, "missing.jsonl")
  writeFileSync(explicitLog, "")

  assert.equal(resolveSessionLog(cwd, basename(secondDir), explicitLog, root), explicitLog)
  assert.equal(resolveSessionLog(cwd, basename(firstDir), missingLog, root), firstLog)
  assert.equal(resolveSessionLog(cwd, basename(secondDir), undefined, root), secondLog)
  assert.equal(resolveSessionLog(cwd, undefined, undefined, root), null)
})

test("resolution falls back to cwd only when it identifies one session", (t) => {
  const root = mkdtempSync(pjoin(process.cwd(), ".maestro-resolve-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const cwd = "/one/session/repository"
  const sessionDir = mkdtempSync(pjoin(root, "only-session-"))
  writeFileSync(pjoin(sessionDir, "workspace.yaml"), `cwd: ${cwd}\n`)
  writeFileSync(pjoin(sessionDir, "events.jsonl"), "")

  assert.equal(
    resolveSessionLog(cwd, undefined, undefined, root),
    pjoin(sessionDir, "events.jsonl"),
  )
  assert.equal(resolveSessionLog(cwd, undefined, pjoin(root, "missing.jsonl"), root), null)
})
