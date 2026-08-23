import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { loadConfig } from "../src/config.js"

test("loadConfig parses booleans and transport overrides", () => {
  const config = loadConfig({
    MAESTRO_CONFIG_PATH: join(tmpdir(), "maestro-config-does-not-exist.json"),
    COPILOT_CMUX_BIN: "/usr/local/bin/cmux",
    COPILOT_CMUX_STATUS_KEY: "workspace-copilot",
    COPILOT_CMUX_TRANSPORT: "socket",
    COPILOT_CMUX_PROGRESS: "off",
    COPILOT_CMUX_KEEP_DONE_STATUS: "no",
    COPILOT_CMUX_LOG_PROMPTS: "0",
    COPILOT_CMUX_LOG_TOOLS: "false",
    COPILOT_CMUX_LOG_SESSION_LIFECYCLE: "yes",
    COPILOT_CMUX_NOTIFY_SESSION_END: "1",
    COPILOT_CMUX_NOTIFY_ERRORS: "true",
    COPILOT_CMUX_LOG_FILE_EDITS: "false",
    COPILOT_CMUX_DEBUG: "on",
  })

  assert.equal(config.cmuxBin, "/usr/local/bin/cmux")
  assert.equal(config.statusKey, "workspace-copilot")
  assert.equal(config.transport, "socket")
  assert.equal(config.progressEnabled, false)
  assert.equal(config.keepDoneStatus, false)
  assert.equal(config.logPrompts, false)
  assert.equal(config.logToolCalls, false)
  assert.equal(config.logSessionLifecycle, true)
  assert.equal(config.notifyOnSessionEnd, true)
  assert.equal(config.notifyOnErrors, true)
  assert.equal(config.logFileEdits, false)
  assert.equal(config.debug, true)
})

test("loadConfig reads basic presentation preferences from the Maestro settings file", () => {
  const directory = mkdtempSync(join(tmpdir(), "maestro-config-"))
  const path = join(directory, "config.json")
  writeFileSync(
    path,
    JSON.stringify({
      progressEnabled: false,
      keepDoneStatus: false,
      notifyOnSessionEnd: false,
      notifyOnErrors: false,
    }),
  )

  try {
    const config = loadConfig({ MAESTRO_CONFIG_PATH: path })
    assert.equal(config.progressEnabled, false)
    assert.equal(config.keepDoneStatus, false)
    assert.equal(config.notifyOnSessionEnd, false)
    assert.equal(config.notifyOnErrors, false)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("environment variables override Maestro settings file preferences", () => {
  const directory = mkdtempSync(join(tmpdir(), "maestro-config-"))
  const path = join(directory, "config.json")
  writeFileSync(
    path,
    JSON.stringify({
      progressEnabled: false,
      keepDoneStatus: false,
      notifyOnSessionEnd: false,
      notifyOnErrors: false,
    }),
  )

  try {
    const config = loadConfig({
      MAESTRO_CONFIG_PATH: path,
      COPILOT_CMUX_PROGRESS: "true",
      COPILOT_CMUX_KEEP_DONE_STATUS: "true",
      COPILOT_CMUX_NOTIFY_SESSION_END: "true",
      COPILOT_CMUX_NOTIFY_ERRORS: "true",
    })
    assert.equal(config.progressEnabled, true)
    assert.equal(config.keepDoneStatus, true)
    assert.equal(config.notifyOnSessionEnd, true)
    assert.equal(config.notifyOnErrors, true)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("loadConfig reports malformed Maestro settings", () => {
  const directory = mkdtempSync(join(tmpdir(), "maestro-config-"))
  const path = join(directory, "config.json")
  writeFileSync(path, JSON.stringify({ progressEnabled: "sometimes" }))

  try {
    assert.throws(
      () => loadConfig({ MAESTRO_CONFIG_PATH: path }),
      /"progressEnabled" must be a boolean/,
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
