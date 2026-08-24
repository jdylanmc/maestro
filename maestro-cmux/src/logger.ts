import { appendFileSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { HookLogger, LogLevel } from "./types.js"

/**
 * The ceiling on the diagnostic log, and how much of it a trim keeps.
 *
 * Measured: this file reached 17 MB while Copilot's changed hook payloads were
 * rejected 18,864 times over two days (issue #63). It is append-only, written
 * from a hook that must never fail, and read by nobody until something has
 * already gone wrong - so it grows without bound precisely when it is being
 * written fastest.
 *
 * The TAIL is what a trim keeps, not the head. The first occurrence of a fault
 * is the more interesting record historically, but the tail is what says
 * whether the fault is still happening, and that is the question an operator
 * asks first.
 */
const MAX_LOG_BYTES = 1024 * 1024
const KEEP_LOG_BYTES = 256 * 1024

function logPath(): string {
  return join(process.env.TMPDIR ?? tmpdir(), "maestro-cmux.log")
}

/**
 * Trim the diagnostic log back to its tail once it exceeds the ceiling.
 *
 * Rewrite in place rather than rotating to a sibling file: a rotation leaves a
 * second unbounded artefact behind, and this file exists only for the minutes
 * after someone notices a fault.
 *
 * Silent on every failure, like everything else on the hook path.
 */
function trimIfOversized(path: string): void {
  try {
    if (statSync(path).size <= MAX_LOG_BYTES) return
    const text = readFileSync(path, "utf8")
    const tail = text.slice(-KEEP_LOG_BYTES)
    const start = tail.indexOf("\n")
    writeFileSync(
      path,
      `${new Date().toISOString()} log trimmed to last ${KEEP_LOG_BYTES} bytes\n${
        start === -1 ? tail : tail.slice(start + 1)
      }`,
    )
  } catch {
    // Deliberately empty. A logger that can fail can deny a tool call.
  }
}

/**
 * Write a diagnostic line to a file, never to stdout or stderr.
 *
 * A Copilot CLI hook that emits anything on stdout or stderr is reported as
 * `hook errored`, and Copilot then denies the tool call. That holds even when
 * the hook exits zero, which is what made the first version of this fork still
 * break every session it was installed into: it exited 0 and kept writing the
 * error to stderr.
 *
 * The reference is the herdr integration hook already on this machine, which
 * guards every step with `|| exit 0` and is completely silent.
 *
 * This never throws. A logger that can fail is a logger that can deny a tool
 * call.
 */
export function writeDiagnostic(line: string): void {
  try {
    const path = logPath()
    trimIfOversized(path)
    appendFileSync(path, `${new Date().toISOString()} ${line}\n`)
  } catch {
    // Deliberately empty. There is nowhere safe left to report this.
  }
}

export function createLogger(debugEnabled: boolean): HookLogger {
  return {
    async log(level: LogLevel, message: string, extra?: Record<string, unknown>) {
      if (!debugEnabled) {
        return
      }
      const details = extra ? ` ${JSON.stringify(extra)}` : ""
      writeDiagnostic(`${level}: ${message}${details}`)
    },
  }
}
