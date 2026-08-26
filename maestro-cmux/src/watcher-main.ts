#!/usr/bin/env node
import { execFile } from "node:child_process"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { loadConfig } from "./config.js"
import { writeDiagnostic } from "./logger.js"
import type { StallRecord } from "./runtime/watcher.js"
import {
  readWatchTargets,
  shouldKeepRunning,
  stateDir,
  type WatchMemo,
  watchTick,
} from "./runtime/watcher.js"

/**
 * The watcher process.
 *
 * Long-lived and deliberately dull: it re-derives attention from each Session's
 * event log on a timer and republishes only what changed. It exists because a
 * blocked Session fires no hook and so cannot raise its own ASK badge (#57).
 */

function pidPath(): string {
  return join(stateDir(), "watcher.pid")
}

/** Whether another watcher already owns this machine. */
function anotherIsRunning(): boolean {
  try {
    const pid = Number.parseInt(readFileSync(pidPath(), "utf8").trim(), 10)
    if (!Number.isFinite(pid) || pid <= 0 || pid === process.pid) return false
    // Signal 0 tests for existence without touching the process.
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function claim(): void {
  mkdirSync(stateDir(), { recursive: true })
  writeFileSync(pidPath(), `${process.pid}\n`, "utf8")
}

function release(): void {
  try {
    const pid = Number.parseInt(readFileSync(pidPath(), "utf8").trim(), 10)
    if (pid === process.pid) rmSync(pidPath(), { force: true })
  } catch {
    /* nothing to release */
  }
}

function run(binary: string, args: string[]): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(binary, args, { timeout: 4000 }, (error, stdout) => {
      resolve(error ? undefined : stdout)
    })
  })
}

async function readDescription(binary: string, workspaceID: string): Promise<string | undefined> {
  const stdout = await run(binary, ["workspace", "list", "--json"])
  if (stdout === undefined) return undefined
  try {
    const parsed = JSON.parse(stdout) as {
      workspaces?: Array<{ id?: string; description?: string | null }>
    }
    return parsed.workspaces?.find((w) => w.id === workspaceID)?.description ?? undefined
  } catch {
    return undefined
  }
}

async function main(): Promise<void> {
  const config = loadConfig()
  if (!config.watcherEnabled) return
  if (anotherIsRunning()) return

  claim()
  process.on("exit", release)
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      release()
      process.exit(0)
    })
  }

  let idleMs = config.watcherIdleMs
  let intervalMs = config.watcherIntervalMs
  const memos = new Map<string, WatchMemo>()
  // One `workspace list` per tick at most, shared by every target in it.
  const deps = {
    now: () => Date.now(),
    // This watcher cannot attest to hooks that were meant to fire before it
    // existed. See WatchDeps.startedAt - without this floor an upgrade badges
    // every long-running Session at once.
    startedAt: Date.now(),
    // Re-read every tick rather than captured at start-up. A hook reloads the
    // config on every invocation, so an operator who edits
    // ~/.config/maestro/config.json sees the change immediately there - but the
    // watcher is the publisher for a Session that is sitting idle, which is
    // exactly when a retention change is most visible. Captured once, the
    // setting would appear not to work until the watcher happened to restart.
    retainFinishedMs: config.retainFinishedMs,
    maxDepth: config.maxDepth,
    stallThresholdMs: config.stallThresholdMs,
    stallBadge: config.stallBadge,
    // Recorded on TRANSITION only, so the log stays bounded and every entry
    // means something changed. The `recovered` half is the point: it is the
    // only way to learn whether a stall is fatal or merely slow, which is the
    // question the badge is waiting on.
    onStall: (record: StallRecord) => {
      writeDiagnostic(`session-stall ${JSON.stringify(record)}`)
    },
    readDescription: (workspaceID: string) => readDescription(config.cmuxBin, workspaceID),
    setDescription: async (workspaceID: string, description: string) => {
      await run(config.cmuxBin, [
        "workspace-action",
        "--action",
        "set-description",
        "--description",
        description,
        "--workspace",
        workspaceID,
      ])
    },
  }

  for (;;) {
    // A malformed config must not take the watcher down with it: this process
    // is the only thing still publishing while a Session is blocked. Keep the
    // last good values and carry on.
    try {
      const current = loadConfig()
      // A retention change has to invalidate the memos, or it does not appear
      // to work. `needsRecompute` gates on the log's mtime, so an IDLE Session
      // is not recomputed at all - and a memo written under `never` scheduled
      // no expiry to wake for, so shortening the window would leave its rows on
      // screen indefinitely. Measured: after switching back from `never`, three
      // stale skill rows survived every subsequent tick.
      // Depth is memo-invalidating for the same reason: an idle Session is not
      // recomputed at all, so a narrowed tree would keep its deep rows.
      if (
        current.retainFinishedMs !== deps.retainFinishedMs ||
        current.maxDepth !== deps.maxDepth
      ) {
        memos.clear()
      }
      deps.retainFinishedMs = current.retainFinishedMs
      deps.maxDepth = current.maxDepth
      deps.stallThresholdMs = current.stallThresholdMs
      deps.stallBadge = current.stallBadge
      idleMs = current.watcherIdleMs
      intervalMs = current.watcherIntervalMs
    } catch {
      /* keep the previous configuration */
    }

    const targets = await readWatchTargets()
    if (!shouldKeepRunning(targets, Date.now(), idleMs)) break

    // Drop memos for Sessions that no longer have a state file, so the map
    // cannot grow without bound over a long-lived watcher.
    const known = new Set(targets.map((t) => t.key))
    for (const key of memos.keys()) if (!known.has(key)) memos.delete(key)

    await watchTick(targets, memos, deps)
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  release()
}

main().catch((error: unknown) => {
  // Same contract as the hooks: fail silently, never noisily. A broken watcher
  // must degrade Maestro to its previous hook-only behaviour, not break it.
  writeDiagnostic(`watcher failed: ${String(error)}`)
  release()
  process.exit(0)
})
