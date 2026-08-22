import assert from "node:assert/strict"
import test from "node:test"
import {
  createRuntimeState,
  describeCurrentTool,
  reduceRuntimeState,
} from "../src/runtime/reducer.js"
import { buildPresentationSnapshot } from "../src/runtime/renderer.js"

const config = {
  cmuxBin: "cmux",
  statusKey: "copilot",
  transport: "auto",
  progressEnabled: true,
  keepDoneStatus: true,
  logPrompts: true,
  logToolCalls: true,
  logSessionLifecycle: true,
  notifyOnSessionEnd: true,
  notifyOnErrors: true,
  logFileEdits: true,
  debug: false,
}

test("runtime state tracks prompt, tool completion, and end of session", () => {
  let state = createRuntimeState("/tmp/project", "workspace-1", 1)

  state = reduceRuntimeState(
    state,
    {
      type: "session.start",
      timestamp: 1,
      cwd: "/tmp/project",
      source: "new",
      initialPrompt: "Fix the bug",
    },
    "workspace-1",
  )
  assert.equal(state.phase, "thinking")

  // There is no tool.pre any more. postToolUse is the only per-tool evidence,
  // so it has to carry the "working" signal the start hook used to carry.
  state = reduceRuntimeState(
    state,
    {
      type: "tool.post",
      timestamp: 3,
      cwd: "/tmp/project",
      toolName: "bash",
      summary: "bash: Run tests",
      parsedToolArgs: undefined,
      resultType: "success",
      resultText: undefined,
    },
    "workspace-1",
  )
  assert.equal(state.phase, "working")
  assert.equal(describeCurrentTool(state), "bash: Run tests")
  assert.equal(state.toolInvocations, 1)
  assert.equal(state.completedTools, 1)

  state = reduceRuntimeState(
    state,
    {
      type: "session.end",
      timestamp: 4,
      cwd: "/tmp/project",
      reason: "complete",
    },
    "workspace-1",
  )
  assert.equal(state.phase, "done")

  const snapshot = buildPresentationSnapshot(state, config, "project", 4)
  assert.equal(snapshot.status?.text, "done")
  assert.equal(snapshot.progress, undefined)
})

// Without preToolUse there is no in-flight count to fall back to, so the only
// thing that can return a session to idle mid-run is the end of the turn. If
// tool.post went back to idle, an actively working session would flicker idle
// between every single tool.
test("a finished tool keeps the session working; agentStop is what ends it", () => {
  let state = createRuntimeState("/tmp/project", "workspace-1", 1)

  for (const [timestamp, toolName] of [
    [2, "bash"],
    [3, "grep"],
  ] as const) {
    state = reduceRuntimeState(
      state,
      {
        type: "tool.post",
        timestamp,
        cwd: "/tmp/project",
        toolName,
        summary: `${toolName}: work`,
        parsedToolArgs: undefined,
        resultType: "success",
        resultText: undefined,
      },
      "workspace-1",
    )
    assert.equal(state.phase, "working")
  }

  assert.equal(state.toolInvocations, 2)

  state = reduceRuntimeState(
    state,
    { type: "agent.stop", timestamp: 4, cwd: "/tmp/project", stopReason: "end_turn" },
    "workspace-1",
  )
  assert.equal(state.phase, "idle")
  assert.equal(state.attention?.kind, "turn")
})

// The progress bar reads toolInvocations. preToolUse used to increment it, so
// moving the count to tool.post is what keeps the bar advancing at all.
test("toolInvocations advances even though nothing reports a tool starting", () => {
  let state = createRuntimeState("/tmp/project", "workspace-1", 1)
  assert.equal(state.toolInvocations, 0)

  state = reduceRuntimeState(
    state,
    {
      type: "tool.post",
      timestamp: 2,
      cwd: "/tmp/project",
      toolName: "view",
      summary: "view a.ts",
      parsedToolArgs: undefined,
      resultType: "success",
      resultText: undefined,
    },
    "workspace-1",
  )
  assert.equal(state.toolInvocations, 1)
})

test("reducer tracks file edits from edit tool", () => {
  let state = createRuntimeState("/tmp/project", "workspace-1", 1)

  state = reduceRuntimeState(
    state,
    {
      type: "tool.post",
      timestamp: 2,
      cwd: "/tmp/project",
      toolName: "edit",
      summary: "edit foo.ts",
      parsedToolArgs: { path: "/tmp/foo.ts" },
      resultType: "success",
      resultText: undefined,
    },
    "workspace-1",
  )

  assert.equal(state.filesEdited, 1)
  assert.equal(state.lastEditedFile, "/tmp/foo.ts")
})

test("renderer shows the last tool while the session is working", () => {
  const state = {
    version: 1,
    cwd: "/tmp/project",
    workspaceID: "workspace-1",
    updatedAt: 10,
    startedAt: 1,
    phase: "working",
    toolInvocations: 2,
    completedTools: 1,
    lastToolName: "bash",
    lastToolSummary: "bash: Run tests",
  }

  const snapshot = buildPresentationSnapshot(state, config, "project", 10)
  assert.equal(snapshot.status?.text, "working: bash: Run tests")
  assert.equal(snapshot.status?.icon, "terminal")
  assert.ok(snapshot.progress)
  assert.match(snapshot.progress.label, /^project:/)
})
