/**
 * Filter cmux's Copilot notification hook down to the notifications that
 * actually block the operator.
 *
 * ## Why this exists
 *
 * cmux registers its own Copilot hooks in `~/.copilot/settings.json`,
 * independently of Maestro. Its `Notification` hook reduces to:
 *
 *     "$cmux_cli" hooks copilot stop
 *
 * run for EVERY Copilot notification, with no reference to the type. Measured
 * types in one session: `permission_prompt` (135), `agent_idle` (7),
 * `elicitation_dialog` (2), `shell_completed` (1),
 * `shell_detached_completed` (1). So a subagent going quiet is delivered to
 * cmux as a "stop" and raises a push notification, which is issue #64.
 *
 * Maestro already draws this line - `attentionKindForNotification` treats only
 * `permission_prompt` and `elicitation_dialog` as attention - so the same rule
 * is applied here rather than a second, divergent one.
 *
 * ## The safety rule, inverted
 *
 * Everywhere else in Maestro, failing safe means doing NOTHING. Here it means
 * the opposite: this process stands between the runtime and a notification the
 * operator may be waiting on, so **any** uncertainty forwards.
 *
 * Unreadable stdin, malformed JSON, a renamed field, a missing cmux binary, an
 * unrecognised type - all forward. The worst outcome of a bug in this file is
 * the noise the operator has today; the worst outcome of the opposite default
 * is a permission prompt that never announces itself.
 *
 * That also means this file cannot be tested by asserting silence alone. See
 * `tests/notification-filter.test.ts`, where every suppression case is paired
 * with a forwarding case.
 */

import { spawn } from "node:child_process"

/**
 * The types that BLOCK the operator. Kept explicit so this file and
 * `attentionKindForNotification` can be asserted to agree: the badge and the
 * notification must not disagree about what "blocked" means.
 */
export const BLOCKING_NOTIFICATIONS = new Set(["permission_prompt", "elicitation_dialog"])

/**
 * The types measured NOT to block, and the only ones ever suppressed.
 *
 * This is a deny-list, not an allow-list, and that asymmetry is the whole
 * safety argument. Suppressing "everything not known to block" would mean a new
 * blocking type Copilot introduces arrives silently — a missed permission
 * prompt, reported by nothing. Suppressing "only what is known to be noise"
 * means a new type is merely noisy, which costs one string in this set to fix.
 *
 * Measured in one session: `agent_idle` (7) — a subagent going quiet, which the
 * tree already shows — `shell_completed` (1) and `shell_detached_completed` (1),
 * both completions the operator did not ask to be told about.
 */
export const QUIET_NOTIFICATIONS = new Set([
  "agent_idle",
  "shell_completed",
  "shell_detached_completed",
])

/**
 * Whether a raw hook payload should reach cmux.
 *
 * Returns true — forward — for anything it cannot confidently classify as
 * known noise. `notification_type` and `notificationType` are both read: the
 * runtime renamed this field once already, and that rename cost two days of
 * silent breakage elsewhere in this plugin.
 */
export function shouldForward(rawInput: string): boolean {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawInput || "{}")
  } catch {
    return true
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return true

  const object = parsed as Record<string, unknown>
  const type = object.notificationType ?? object.notification_type
  if (typeof type !== "string" || !type) return true

  return !QUIET_NOTIFICATIONS.has(type)
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ""
    const done = (): void => resolve(data)
    // A hook that never resolves would hold the notification open. Copilot
    // applies its own timeout, but relying on someone else's is how a
    // decoration process becomes a stall.
    const timer = setTimeout(done, 2000)
    timer.unref?.()
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (chunk) => {
      data += chunk
    })
    process.stdin.on("end", () => {
      clearTimeout(timer)
      done()
    })
    process.stdin.on("error", () => {
      clearTimeout(timer)
      done()
    })
  })
}

/** Hand the payload to cmux exactly as its own hook would have. */
function forward(rawInput: string, env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve) => {
    const binary = env.CMUX_BUNDLED_CLI_PATH?.trim() || "cmux"
    const socket = env.CMUX_SOCKET_PATH?.trim()
    const args = socket
      ? ["--socket", socket, "hooks", "copilot", "stop"]
      : ["hooks", "copilot", "stop"]

    try {
      const child = spawn(binary, args, { stdio: ["pipe", "ignore", "ignore"] })
      child.on("error", () => resolve())
      child.on("close", () => resolve())
      child.stdin.on("error", () => resolve())
      child.stdin.end(rawInput)
    } catch {
      resolve()
    }
  })
}

export async function main(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  // Copilot reads a hook's stdout. cmux's own hook answers `{}` on every path,
  // so this one does too - including when it suppresses.
  const reply = (): void => {
    process.stdout.write("{}")
  }

  try {
    if (env.CMUX_COPILOT_HOOKS_DISABLED === "1" || !env.CMUX_SURFACE_ID) {
      reply()
      return
    }

    const rawInput = await readStdin()
    if (shouldForward(rawInput)) {
      await forward(rawInput, env)
    }
  } catch {
    /* never fail the hook */
  }
  reply()
}
