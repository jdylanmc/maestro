#!/usr/bin/env node
import { writeDiagnostic } from "./logger.js"
import { processHook } from "./runtime/processor.js"
import type { HookName } from "./types.js"

const HOOK_NAMES = new Set<HookName>([
  "sessionStart",
  "sessionEnd",
  "userPromptSubmitted",
  "postToolUse",
  "errorOccurred",
  "notification",
  "agentStop",
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
  // Fail SILENTLY and OPEN, always.
  //
  // Two properties are required, and having only the first is what made this
  // fork necessary twice:
  //
  //   1. Exit zero. Copilot treats a non-zero exit from a tool-gating hook as
  //      a denial, so upstream's `exitCode = 1` denied every tool call in a
  //      session whenever it met a payload shape it did not recognise. Maestro
  //      no longer registers `preToolUse` at all, which removes the authority
  //      rather than merely declining to use it - but this guard stays, since
  //      an errored hook is reported however it is registered.
  //
  //   2. Emit nothing on stdout or stderr. Exiting zero is NOT sufficient:
  //      Copilot reports `hook errored` and denies the call for a hook that
  //      writes diagnostics, so the first fix here - exit 0, keep the stderr
  //      message - still broke every session it was installed into.
  //
  // This plugin draws status pills. It has no authority over whether a tool
  // may run, and it must never be able to veto one.
  writeDiagnostic(error instanceof Error ? (error.stack ?? error.message) : String(error))
  process.exitCode = 0
})
