#!/usr/bin/env node
import { processHook } from "./runtime/processor.js"
import type { HookName } from "./types.js"

const HOOK_NAMES = new Set<HookName>([
  "sessionStart",
  "sessionEnd",
  "userPromptSubmitted",
  "preToolUse",
  "postToolUse",
  "errorOccurred",
])

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = []
  for await (const chunk of process.stdin) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk))
    } else {
      chunks.push(chunk)
    }
  }
  return Buffer.concat(chunks).toString("utf8")
}

async function main(): Promise<void> {
  const hookName = process.argv[2]
  if (!hookName || !HOOK_NAMES.has(hookName as HookName)) {
    throw new Error(`Expected a Copilot hook name argument (${Array.from(HOOK_NAMES).join(", ")})`)
  }

  const rawInput = await readStdin()
  await processHook(hookName as HookName, rawInput)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  process.stderr.write(`[maestro-cmux] error: ${message}\n`)

  // Fail OPEN, always.
  //
  // This plugin is an observer: it draws status pills, progress, and logs. It
  // has no authority over whether a tool may run, and it must never be able to
  // veto one.
  //
  // Copilot CLI treats a non-zero exit from `preToolUse` as a denial, so the
  // upstream `process.exitCode = 1` here meant that ANY internal failure -
  // including a payload shape this plugin simply did not recognise - denied
  // every subsequent tool call in the session. Observed against Copilot CLI
  // 1.0.81-5: a hook parse error produced `Denied by preToolUse hook from
  // "maestro-cmux" (hook errored)` for bash, glob, view, and even `pwd`,
  // leaving the session unable to read its own disk.
  //
  // Exiting 0 keeps a decoration bug a decoration bug. The error is still
  // reported on stderr, where it is visible without being load-bearing.
  process.exitCode = 0
})
