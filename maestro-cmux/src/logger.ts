import { appendFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { HookLogger, LogLevel } from "./types.js"

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
    appendFileSync(
      join(process.env.TMPDIR ?? tmpdir(), "maestro-cmux.log"),
      `${new Date().toISOString()} ${line}\n`,
    )
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
