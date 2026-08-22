import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const runner = join(here, "..", "dist", "hook-runner.js")
const installScript = join(here, "..", "install.sh")

/**
 * The hooks Maestro registers. `preToolUse` is NOT among them and must never
 * be: it is the only hook Copilot treats as able to veto a tool call.
 */
const REGISTERED_HOOKS = [
  "sessionStart",
  "sessionEnd",
  "userPromptSubmitted",
  "postToolUse",
  "errorOccurred",
  "notification",
  "agentStop",
]

// A private TMPDIR for the spawned runner.
//
// Both the diagnostic log and the runtime state directory live under TMPDIR,
// and the other test files spawn the same runner in parallel. Sharing the real
// TMPDIR made "the runner wrote nothing" assertions read another file's
// writes, which is a false failure and, worse, could have been a false PASS.
const sandbox = mkdtempSync(join(here, "..", ".test-tmp-"))
process.on("exit", () => rmSync(sandbox, { recursive: true, force: true }))

const diagnosticLog = join(sandbox, "maestro-cmux.log")

function diagnosticSize(): number {
  return existsSync(diagnosticLog) ? readFileSync(diagnosticLog, "utf8").length : 0
}

function runHook(hookName: string, stdin: string, extraEnv: Record<string, string>) {
  return spawnSync(process.execPath, [runner, hookName], {
    input: stdin,
    encoding: "utf8",
    env: { ...process.env, CMUX_WORKSPACE_ID: "", TMPDIR: sandbox, ...extraEnv },
  })
}

// --- part 1: preToolUse is gone ---------------------------------------------

test("install.sh does not register preToolUse", () => {
  const script = readFileSync(installScript, "utf8")
  const hookList = script.split("hooks = [")[1]?.split("]")[0] ?? ""
  assert.ok(hookList, "could not find the hook list in install.sh")
  assert.ok(
    !hookList.includes('"preToolUse"'),
    "install.sh registers preToolUse, which can veto a tool call",
  )
  for (const hook of REGISTERED_HOOKS) {
    assert.ok(hookList.includes(`"${hook}"`), `install.sh no longer registers ${hook}`)
  }
})

test("no source file registers preToolUse as a hook Maestro handles", () => {
  const runnerSource = readFileSync(join(here, "..", "src", "hook-runner.ts"), "utf8")
  const hookNames = runnerSource.split("HOOK_NAMES = new Set<HookName>([")[1]?.split("])")[0] ?? ""
  assert.ok(hookNames, "could not find HOOK_NAMES in hook-runner.ts")
  assert.ok(!hookNames.includes('"preToolUse"'), "the runner still accepts preToolUse")
})

test("preToolUse is now an unknown hook, and an unknown hook still exits 0", () => {
  const result = runHook("preToolUse", '{"toolName":"bash","toolArgs":"{}"}', {})
  assert.equal(result.status, 0, "an unrecognised hook must never deny a tool call")
  assert.equal(result.stdout, "")
  assert.equal(result.stderr, "")
})

// --- part 2: the operator kill switch ---------------------------------------

// Two switches on purpose: cmux's own documented one, which turns off Copilot
// integration wholesale, and a Maestro-only one that leaves cmux's native
// hooks running.
const KILL_SWITCHES = ["CMUX_COPILOT_HOOKS_DISABLED", "MAESTRO_DISABLED"]

for (const switchName of KILL_SWITCHES) {
  for (const hook of REGISTERED_HOOKS) {
    test(`${switchName}=1 makes ${hook} a silent no-op`, () => {
      // Diagnostics are enabled on purpose. A disabled hook must not even
      // write to its own log file - "disabled" means it did nothing, not that
      // it did the work quietly.
      const before = diagnosticSize()
      const result = runHook(
        hook,
        JSON.stringify({ timestamp: 1, cwd: process.cwd(), source: "new", prompt: "hi" }),
        { [switchName]: "1", COPILOT_CMUX_DEBUG: "1" },
      )

      assert.equal(result.status, 0, `${hook} exited ${result.status}; must be 0`)
      assert.equal(result.stdout, "", `${hook} wrote to stdout: ${result.stdout}`)
      assert.equal(result.stderr, "", `${hook} wrote to stderr: ${result.stderr}`)
      assert.equal(diagnosticSize(), before, `${hook} still did work while ${switchName} was set`)
    })
  }
}

test("the kill switch survives payloads the plugin cannot parse", () => {
  for (const payload of ["", "not json", "null", "[]", '{"garbage":true}']) {
    const result = runHook("postToolUse", payload, {
      CMUX_COPILOT_HOOKS_DISABLED: "1",
      MAESTRO_DISABLED: "1",
      COPILOT_CMUX_DEBUG: "1",
    })
    assert.equal(result.status, 0)
    assert.equal(result.stdout, "")
    assert.equal(result.stderr, "")
  }
})

test("the kill switch writes no runtime state", () => {
  const stateDir = join(sandbox, "maestro-cmux")
  const env = {
    // A workspace ID is what makes the runner consider itself managed by cmux
    // and therefore actually publish. Without it the runner no-ops for an
    // unrelated reason and this test proves nothing.
    CMUX_WORKSPACE_ID: "kill-switch-test",
    COPILOT_CMUX_DEBUG: "1",
    // There is no cmux to talk to in a test; point the client at a binary that
    // does not exist so every publish attempt fails harmlessly.
    COPILOT_CMUX_BIN: "maestro-no-such-cmux-binary",
  }
  const payload = JSON.stringify({ timestamp: 1, cwd: process.cwd(), source: "new" })

  const before = existsSync(stateDir) ? readdirSync(stateDir).length : 0
  runHook("sessionStart", payload, { ...env, CMUX_COPILOT_HOOKS_DISABLED: "1" })
  assert.equal(
    existsSync(stateDir) ? readdirSync(stateDir).length : 0,
    before,
    "the kill switch still published runtime state",
  )

  // Negative control: the same call without the switch must write, or the
  // assertion above passes for a reason that has nothing to do with the switch.
  runHook("sessionStart", payload, env)
  assert.ok(
    existsSync(stateDir) && readdirSync(stateDir).length > before,
    "the runner wrote no state even with the kill switch OFF, so the check above is vacuous",
  )
})

// Negative control.
//
// Every assertion above would pass trivially if the runner never executed at
// all - a wrong path, a missing build - because a process that cannot start
// also produces no output and writes no log. This proves the ONLY reason the
// runner went quiet was the kill switch.
test("negative control: without the kill switch the runner really runs", () => {
  const before = diagnosticSize()

  const result = runHook(
    "sessionStart",
    JSON.stringify({ timestamp: 1, cwd: process.cwd(), source: "new" }),
    { COPILOT_CMUX_DEBUG: "1" },
  )

  assert.equal(result.status, 0)
  assert.equal(result.stdout, "")
  assert.equal(result.stderr, "")
  assert.ok(
    diagnosticSize() > before,
    "the runner produced no diagnostic without the kill switch either, so every kill-switch assertion above is vacuous",
  )
})

// --- the generated shell command --------------------------------------------

test("the generated hook command carries the kill switch and stays fail-open", () => {
  const script = readFileSync(installScript, "utf8")
  // Take the guard from install.sh itself rather than reproducing it. A test
  // that retypes the string passes happily while install.sh ships something
  // else.
  const assignment = script.split("KILL_SWITCH = ")[1]?.split("\n\n")[0] ?? ""
  const guard = (assignment.match(/'([^']*)'/g) ?? []).map((part) => part.slice(1, -1)).join("")
  assert.ok(guard, "could not find the generated kill-switch guard in install.sh")
  for (const switchName of KILL_SWITCHES) {
    assert.ok(guard.includes(switchName), `the generated hook command ignores ${switchName}`)
  }
  const body = `command -v node >/dev/null 2>&1 || exit 0; node '${runner}-does-not-exist' postToolUse >/dev/null 2>&1 || exit 0`

  const envs = [{}, ...KILL_SWITCHES.map((name) => ({ [name]: "1" }))]
  for (const env of envs) {
    const result = spawnSync("bash", ["-c", guard + body], {
      input: "{}",
      encoding: "utf8",
      env: { ...process.env, ...env },
    })
    assert.equal(result.status, 0, `exit ${result.status} would DENY the tool call`)
    assert.equal(result.stdout, "")
    assert.equal(result.stderr, "")
  }
})
