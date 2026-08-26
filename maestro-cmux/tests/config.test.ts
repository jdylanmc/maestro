import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { loadConfig } from "../src/config.js"
import { MAX_WIRE_DEPTH, RETAIN_MS, RETENTION_CHOICES } from "../src/tree.js"

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
    "retainFinished",
    "maxDepth",
    "attentionOnTurn",
    "markUnreadOnAttention",
    "stallThresholdMs",
    "stallBadge",
    "logPrompts",
    "logToolCalls",
    "logSessionLifecycle",
    "logFileEdits",
    "debug",
  ]
  assert.deepEqual(Object.keys(example).sort(), [...expected].sort())
})

// --- finished-subagent retention (#56) ---------------------------------------

test("retention defaults to today's behaviour, not to the ticket's number", () => {
  // Issue #56 describes the current window as "15 minutes" and asks for a `15m`
  // default, while also requiring the published description stay identical for
  // the same event log. Both cannot hold: RETAIN_MS is 15 SECONDS. Behaviour
  // preservation is the criterion that can be tested, and the one an operator
  // who never touches this setting would notice, so it wins.
  const config = loadConfig({
    MAESTRO_CONFIG_PATH: join(tmpdir(), "maestro-config-does-not-exist.json"),
  } as NodeJS.ProcessEnv)
  assert.equal(config.retainFinishedMs, RETAIN_MS)
  assert.equal(RETAIN_MS, 15_000, "if this changes, the default above changes with it")
})

test("every offered retention window resolves", () => {
  const dir = mkdtempSync(join(tmpdir(), "maestro-config-"))
  const path = join(dir, "config.json")
  try {
    for (const [choice, expected] of Object.entries(RETENTION_CHOICES)) {
      writeFileSync(path, JSON.stringify({ retainFinished: choice }))
      const config = loadConfig({ MAESTRO_CONFIG_PATH: path } as NodeJS.ProcessEnv)
      assert.equal(config.retainFinishedMs, expected, `retainFinished: ${choice}`)
    }
    assert.deepEqual(Object.keys(RETENTION_CHOICES), [
      "5s",
      "15s",
      "1m",
      "5m",
      "15m",
      "1h",
      "never",
    ])
    assert.equal(RETENTION_CHOICES.never, Number.POSITIVE_INFINITY)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("an unrecognised retention window is reported, not silently defaulted", () => {
  // An operator who typed "30min" and saw the default would conclude the
  // setting does nothing.
  const dir = mkdtempSync(join(tmpdir(), "maestro-config-"))
  const path = join(dir, "config.json")
  writeFileSync(path, JSON.stringify({ retainFinished: "30min" }))
  try {
    assert.throws(
      () => loadConfig({ MAESTRO_CONFIG_PATH: path } as NodeJS.ProcessEnv),
      /retainFinished/,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("the environment overrides the retention window and falls back quietly", () => {
  const dir = mkdtempSync(join(tmpdir(), "maestro-config-"))
  const path = join(dir, "config.json")
  writeFileSync(path, JSON.stringify({ retainFinished: "1h" }))
  try {
    const overridden = loadConfig({
      MAESTRO_CONFIG_PATH: path,
      MAESTRO_RETAIN_FINISHED: "5s",
    } as NodeJS.ProcessEnv)
    assert.equal(overridden.retainFinishedMs, 5_000)

    // An ambient variable may be set by something the operator did not write,
    // so this path falls back to the file value rather than throwing.
    const nonsense = loadConfig({
      MAESTRO_CONFIG_PATH: path,
      MAESTRO_RETAIN_FINISHED: "banana",
    } as NodeJS.ProcessEnv)
    assert.equal(nonsense.retainFinishedMs, RETENTION_CHOICES["1h"])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// --- #43 candidates that turned out NOT to need sidebar persistence ----------
//
// The ticket splits settings into "plugin settings are easy" and "sidebar
// settings are hard", the latter blocked on a persistence channel that does not
// exist. That split is not quite the right one. A setting that changes WHAT THE
// PLUGIN PUBLISHES needs no sidebar state at all: the sidebar renders whatever
// arrives, so the plugin can simply publish less. Three of the ticket's own
// candidates fall on that side.

function withConfigFile(contents: unknown, run: (path: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "maestro-config-"))
  const path = join(directory, "config.json")
  writeFileSync(path, JSON.stringify(contents))
  try {
    run(path)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test("the three new settings default to today's behaviour", () => {
  // An operator who never opens the file must see no change at all.
  const config = loadConfig({
    MAESTRO_CONFIG_PATH: join(tmpdir(), "maestro-config-does-not-exist.json"),
  })
  assert.equal(config.maxDepth, MAX_WIRE_DEPTH)
  assert.equal(config.attentionOnTurn, true)
  assert.equal(config.markUnreadOnAttention, true)
})

test("the three new settings are file-settable and environment-overridable", () => {
  withConfigFile({ maxDepth: 2, attentionOnTurn: false, markUnreadOnAttention: false }, (path) => {
    const fromFile = loadConfig({ MAESTRO_CONFIG_PATH: path })
    assert.equal(fromFile.maxDepth, 2)
    assert.equal(fromFile.attentionOnTurn, false)
    assert.equal(fromFile.markUnreadOnAttention, false)

    const overridden = loadConfig({
      MAESTRO_CONFIG_PATH: path,
      MAESTRO_MAX_DEPTH: "4",
      MAESTRO_ATTENTION_ON_TURN: "true",
      MAESTRO_MARK_UNREAD: "yes",
    })
    assert.equal(overridden.maxDepth, 4)
    assert.equal(overridden.attentionOnTurn, true)
    assert.equal(overridden.markUnreadOnAttention, true)
  })
})

test("an out-of-range depth in the FILE is rejected loudly", () => {
  // Same rule as the intervals and the retention window: a config file is a
  // deliberate statement, so a value that was quietly ignored would leave the
  // operator believing a setting had taken effect.
  for (const bad of [0, -1, 7, 2.5, "3"]) {
    withConfigFile({ maxDepth: bad }, (path) => {
      assert.throws(
        () => loadConfig({ MAESTRO_CONFIG_PATH: path }),
        /maxDepth/,
        `maxDepth ${JSON.stringify(bad)} must be rejected`,
      )
    })
  }
})

test("an out-of-range depth in the ENVIRONMENT falls back silently", () => {
  // An ambient variable may be set by something the operator did not write, so
  // this path fails open - the same asymmetry the intervals already use.
  const config = loadConfig({
    MAESTRO_CONFIG_PATH: join(tmpdir(), "maestro-config-does-not-exist.json"),
    MAESTRO_MAX_DEPTH: "99",
  })
  assert.equal(config.maxDepth, MAX_WIRE_DEPTH)
})
