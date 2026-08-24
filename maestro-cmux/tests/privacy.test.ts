import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { type TestContext, test } from "node:test"
import { loadConfig } from "../src/config.js"
import { parseHookInput } from "../src/runtime/events.js"
import { fileEditLogMessage, promptLogMessage, toolResultSuffix } from "../src/runtime/processor.js"
import { createRuntimeState, reduceRuntimeState } from "../src/runtime/reducer.js"
import { buildPresentationSnapshot } from "../src/runtime/renderer.js"
import { buildTree, encodeTree } from "../src/tree.js"
import type { PluginConfig } from "../src/types.js"

/**
 * The privacy boundary (#52), held at the publish sites.
 *
 * The requirement is that the DEFAULT configuration publishes only identifiers
 * the runtime names itself - tool names, agent names, counts, phases - and
 * never free text the operator or a model wrote.
 *
 * Every assertion below is paired with a NEGATIVE CONTROL that turns the
 * opt-in on and proves the sensitive value would otherwise have arrived. A
 * suite that only asserted absence could pass by publishing nothing at all, or
 * by testing a call path the plugin no longer uses.
 */

// Deliberately NOT shaped like a real credential. The repository's public-content
// gate rejects a plausible one, and the fixture does not need to be plausible to
// prove the boundary holds - only distinctive enough to find in published output.
const SECRET = "PRIVATE-FIXTURE-VALUE-DO-NOT-PUBLISH"
const NO_CONFIG = join(tmpdir(), "maestro-privacy-no-such-config.json")

function defaults(): PluginConfig {
  return loadConfig({ MAESTRO_CONFIG_PATH: NO_CONFIG })
}

function logDir(t: TestContext, lines: string[]): string {
  const root = mkdtempSync(join(process.cwd(), ".maestro-privacy-test-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const path = join(root, "events.jsonl")
  writeFileSync(path, lines.join(""))
  return path
}

// ---------------------------------------------------------------------------
// The default itself
// ---------------------------------------------------------------------------

test("publishing raw text is OFF in the shipped configuration", () => {
  assert.equal(defaults().publishRawText, false)
})

test("the opt-in is reachable from the environment and from the settings file", () => {
  assert.equal(
    loadConfig({ MAESTRO_CONFIG_PATH: NO_CONFIG, COPILOT_CMUX_PUBLISH_RAW_TEXT: "1" })
      .publishRawText,
    true,
  )

  const directory = mkdtempSync(join(tmpdir(), "maestro-privacy-config-"))
  const path = join(directory, "config.json")
  writeFileSync(path, JSON.stringify({ publishRawText: true }))
  try {
    assert.equal(loadConfig({ MAESTRO_CONFIG_PATH: path }).publishRawText, true)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// Tool arguments
// ---------------------------------------------------------------------------

test("a tool summary carries no argument text by default", () => {
  const raw = JSON.stringify({
    timestamp: 1,
    cwd: "/tmp",
    toolName: "bash",
    toolArgs: JSON.stringify({
      description: `deploy with ${SECRET}`,
      path: "/Users/someone/private/repo/src/secrets.ts",
      command: `curl -H 'Authorization: ${SECRET}'`,
    }),
  })

  const redacted = parseHookInput("postToolUse", raw, defaults().publishRawText)
  assert.equal(redacted.type === "tool.post" && redacted.summary, "bash")

  // Negative control: the same payload, opted in, does publish it.
  const verbose = parseHookInput("postToolUse", raw, true)
  assert.equal(verbose.type === "tool.post" && verbose.summary.includes(SECRET), true)
})

// ---------------------------------------------------------------------------
// Prompt text
// ---------------------------------------------------------------------------

test("prompt text never reaches runtime state, and so never reaches a progress label", () => {
  const prompt = `rotate the key ${SECRET} in prod`
  const event = {
    type: "user.prompt" as const,
    timestamp: 2,
    cwd: "/tmp/project",
    prompt,
  }
  const base = createRuntimeState("/tmp/project", "w1", 1)

  const redacted = reduceRuntimeState(base, event, "w1", false)
  assert.equal(redacted.lastPrompt, undefined)
  const label = buildPresentationSnapshot(redacted, defaults(), "project", 5).progress?.label
  assert.equal(label, "project: thinking")
  assert.equal(label?.includes(SECRET), false)

  // Negative control.
  const verbose = reduceRuntimeState(base, event, "w1", true)
  assert.equal(verbose.lastPrompt, prompt)
  assert.equal(
    buildPresentationSnapshot(verbose, defaults(), "project", 5).progress?.label?.includes(SECRET),
    true,
  )
})

test("an initial prompt still starts the session thinking without being retained", () => {
  const state = reduceRuntimeState(
    createRuntimeState("/tmp/project", "w1", 1),
    {
      type: "session.start",
      timestamp: 1,
      cwd: "/tmp/project",
      source: "new",
      initialPrompt: `fix ${SECRET}`,
    },
    "w1",
    false,
  )

  assert.equal(state.phase, "thinking", "the PRESENCE of a prompt still drives the phase")
  assert.equal(state.lastPrompt, undefined)
})

// ---------------------------------------------------------------------------
// Log lines
// ---------------------------------------------------------------------------

test("the prompt log line records the event, not the prompt", () => {
  assert.equal(promptLogMessage("project", `send ${SECRET}`, false), "project: prompt submitted")
  assert.equal(promptLogMessage("project", `send ${SECRET}`, true).includes(SECRET), true)
})

test("the file-edit log line records a count, not a path", () => {
  const path = "/Users/someone/private/repo/src/secrets.ts"
  assert.equal(
    fileEditLogMessage("project", "edit", path, 1, false),
    "project: edit - 1 file edited",
  )
  assert.equal(
    fileEditLogMessage("project", "edit", path, 3, false),
    "project: edit - 3 files edited",
  )
  assert.equal(fileEditLogMessage("project", "edit", path, 1, true), "project: edit secrets.ts")
})

test("tool result text is transcript content and is not appended by default", () => {
  assert.equal(toolResultSuffix(`token=${SECRET}`, false), "")
  assert.equal(toolResultSuffix(`token=${SECRET}`, true).includes(SECRET), true)
})

// ---------------------------------------------------------------------------
// The tree
// ---------------------------------------------------------------------------

test("the subagent tree publishes identifier fields, never free-text arguments", (t) => {
  // `name` and `agent_type` are identifier fields the caller chose as labels;
  // `description` and `query` are prose. The tree is built from the former.
  const tree = buildTree(
    logDir(t, [
      `${JSON.stringify({
        type: "tool.execution_start",
        agentId: null,
        data: {
          toolCallId: "c1",
          toolName: "task",
          arguments: {
            agent_type: "explore",
            name: "source-mapper",
            description: `look for ${SECRET}`,
            prompt: `the operator said ${SECRET}`,
          },
        },
      })}\n`,
    ]),
  )

  const encoded = encodeTree(tree)
  assert.equal(encoded.includes("source-mapper"), true)
  assert.equal(encoded.includes(SECRET), false)
  assert.equal(encoded.includes("look for"), false)
})

test("an agent's activity is a tool name, never its arguments", (t) => {
  const tree = buildTree(
    logDir(t, [
      `${JSON.stringify({
        type: "subagent.started",
        agentId: "a1",
        data: { toolCallId: "c0", agentDisplayName: "mapper", agentName: "explore" },
      })}\n`,
      `${JSON.stringify({
        type: "tool.execution_start",
        agentId: "a1",
        data: {
          toolCallId: "c1",
          toolName: "bash",
          arguments: { command: `curl ${SECRET}`, description: `use ${SECRET}` },
        },
      })}\n`,
    ]),
  )

  assert.equal(tree.get("a1")?.activity, "bash")
  assert.equal(encodeTree(tree).includes(SECRET), false)
})
