import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const runner = join(here, "..", "dist", "hook-runner.js")

function runHook(hookName: string, stdin: string) {
  return spawnSync(process.execPath, [runner, hookName], {
    input: stdin,
    encoding: "utf8",
    env: { ...process.env, CMUX_WORKSPACE_ID: "" },
  })
}

// The regression this fork exists for.
//
// Copilot CLI treats a non-zero exit from `preToolUse` as a DENIAL. Upstream
// exited 1 on any internal error, so an unrecognised payload shape denied every
// tool call in the session - bash, glob, view, and `pwd` alike. A plugin that
// only draws status pills must never be able to veto tool execution.
//
// Every case below is a payload the plugin cannot fully parse. All of them must
// still exit 0.
const unparseable: Array<[string, string]> = [
  ["empty stdin", ""],
  ["not json", "this is not json"],
  ["empty object", "{}"],
  ["wrong key name", '{"tool":"bash"}'],
  ["missing toolArgs", '{"toolName":"bash","sessionId":"x","cwd":"/tmp"}'],
  ["toolArgs is an object, not a string", '{"toolName":"bash","toolArgs":{"cmd":"ls"}}'],
  ["null payload", "null"],
  ["array payload", "[]"],
  ["unknown future field only", '{"someFutureShape":{"a":1}}'],
]

for (const [label, payload] of unparseable) {
  test(`preToolUse fails open: ${label}`, () => {
    const result = runHook("preToolUse", payload)
    assert.equal(
      result.status,
      0,
      `exit ${result.status} would DENY the tool call. stderr: ${result.stderr}`,
    )
  })
}

test("every hook fails open on an unparseable payload", () => {
  const hooks = [
    "sessionStart",
    "sessionEnd",
    "userPromptSubmitted",
    "preToolUse",
    "postToolUse",
    "errorOccurred",
  ]
  for (const hook of hooks) {
    const result = runHook(hook, '{"garbage":true}')
    assert.equal(result.status, 0, `${hook} exited ${result.status}; must be 0`)
  }
})

test("an unknown hook name still exits 0", () => {
  const result = runHook("notARealHook", "{}")
  assert.equal(result.status, 0, "an unknown hook name must not deny tool calls")
})

// Negative control.
//
// The assertions above would pass trivially if the runner exited 0 without ever
// running - for instance if the path were wrong and node failed to load it. This
// proves the runner is actually executing and actually reporting the failure it
// is being asked to survive.
test("negative control: the runner really runs and reports the error", () => {
  const result = runHook("preToolUse", '{"tool":"bash"}')
  assert.equal(result.status, 0)
  assert.match(
    result.stderr,
    /\[maestro-cmux\] error:/,
    "expected the failure to be reported on stderr; if this is empty the runner never executed and the fail-open assertions above are vacuous",
  )
})
