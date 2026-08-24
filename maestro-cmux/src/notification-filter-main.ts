#!/usr/bin/env node
import { writeDiagnostic } from "./logger.js"
import { main } from "./notification-filter.js"

/**
 * Entry point for the notification filter (#64).
 *
 * Split from the logic so the decision is testable without spawning a process.
 *
 * The catch answers `{}` and exits 0, matching every other Maestro entry point:
 * a hook that emits nothing useful is a cosmetic failure, while a hook that
 * errors is reported by Copilot as a failed hook.
 */
main().catch((error: unknown) => {
  writeDiagnostic(`notification filter failed: ${String(error)}`)
  process.stdout.write("{}")
  process.exit(0)
})
