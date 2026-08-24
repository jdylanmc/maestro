import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
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

// --- file coverage (#43) -----------------------------------------------------

test("every plugin boolean can be set from the config file", () => {
  // #43's first complaint is that settings are split across two mechanisms.
  // The file half now covers every boolean, so an operator never has to edit a
  // shell profile to change behaviour that persists.
  const dir = mkdtempSync(join(tmpdir(), "maestro-config-"))
  const path = join(dir, "config.json")
  writeFileSync(
    path,
    JSON.stringify({
      logPrompts: false,
      logToolCalls: false,
      logSessionLifecycle: false,
      logFileEdits: false,
      debug: true,
      watcherIntervalMs: 5000,
      watcherIdleMs: 600000,
    }),
  )
  try {
    const config = loadConfig({ MAESTRO_CONFIG_PATH: path } as NodeJS.ProcessEnv)
    assert.equal(config.logPrompts, false)
    assert.equal(config.logToolCalls, false)
    assert.equal(config.logSessionLifecycle, false)
    assert.equal(config.logFileEdits, false)
    assert.equal(config.debug, true)
    assert.equal(config.watcherIntervalMs, 5000)
    assert.equal(config.watcherIdleMs, 600000)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("an environment variable still overrides the file", () => {
  const dir = mkdtempSync(join(tmpdir(), "maestro-config-"))
  const path = join(dir, "config.json")
  writeFileSync(path, JSON.stringify({ debug: true, watcherIntervalMs: 5000 }))
  try {
    const config = loadConfig({
      MAESTRO_CONFIG_PATH: path,
      COPILOT_CMUX_DEBUG: "0",
      MAESTRO_WATCHER_INTERVAL_MS: "9000",
    } as NodeJS.ProcessEnv)
    assert.equal(config.debug, false, "the file is the default, not the authority")
    assert.equal(config.watcherIntervalMs, 9000)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("a bad interval in the file is reported rather than ignored", () => {
  // The environment path falls back silently, because an ambient variable may
  // be set by something the operator did not write. A config file is a
  // deliberate statement, and silently ignoring one would leave the operator
  // believing a setting had taken effect.
  const dir = mkdtempSync(join(tmpdir(), "maestro-config-"))
  const path = join(dir, "config.json")
  writeFileSync(path, JSON.stringify({ watcherIntervalMs: 10 }))
  try {
    assert.throws(
      () => loadConfig({ MAESTRO_CONFIG_PATH: path } as NodeJS.ProcessEnv),
      /watcherIntervalMs/,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("the shipped example lists every file-settable key", () => {
  // An example that drifts behind the code is how a config surface becomes
  // folklore.
  const example = JSON.parse(
    readFileSync(join(import.meta.dirname, "..", "config.example.json"), "utf8"),
  ) as Record<string, unknown>
  const expected = [
    "progressEnabled",
    "keepDoneStatus",
    "notifyOnSessionEnd",
    "notifyOnErrors",
    "watcherEnabled",
    "watcherIntervalMs",
    "watcherIdleMs",
    "publishRawText",
    "logPrompts",
    "logToolCalls",
    "logSessionLifecycle",
    "logFileEdits",
    "debug",
  ]
  assert.deepEqual(Object.keys(example).sort(), [...expected].sort())
})
