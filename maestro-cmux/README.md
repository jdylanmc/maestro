# maestro-cmux

A GitHub Copilot CLI plugin that reports Copilot session activity to the
surrounding [cmux](https://www.cmux.dev/) workspace: status pills, a progress
bar, sidebar log entries, and desktop notifications.

## Provenance

Forked from [Attamusc/copilot-cmux](https://github.com/Attamusc/copilot-cmux)
at commit `32e3708`, MIT licensed, © 2026 Sean Dunn. The upstream `LICENSE` is
retained unchanged. Upstream did the hard part - the hook wiring, the socket
transport with command-line fallback, the file-locked state store, and the
phase state machine are all theirs, and they are good.

It is vendored here rather than depended on because this plugin sits in the
critical path of every tool call, and an unmaintained dependency in that
position is a liability. See below.

## Why this fork exists

**Upstream fails closed, and it took a live session down.**

Copilot CLI treats a non-zero exit from a `preToolUse` hook as a **denial**.
Upstream's hook runner set `process.exitCode = 1` on any internal error,
including a payload it simply did not recognise. Observed against Copilot CLI
**1.0.81-5**, whose `preToolUse` payload no longer matches what upstream's
parser requires:

```text
Denied by preToolUse hook from "copilot-cmux" (hook errored)
```

Every tool call in the session was refused - `bash`, `glob`, `view`, and a bare
`pwd`. The session could not read its own disk. Nothing was wrong with the
user's configuration or permissions; a decoration plugin had become a veto.

Reproduced directly, same payload, upstream against this fork:

```console
$ echo '{"toolName":"bash","sessionId":"x","cwd":"/tmp"}' \
    | node dist/hook-runner.js preToolUse
upstream  -> exit 1   # tool DENIED
this fork -> exit 0   # tool ALLOWED, error still on stderr
```

### The rule this fork enforces

> **An observer must never be able to veto the thing it observes.**

This plugin draws status pills. It has no authority over whether a tool may run.
`hook-runner.ts` therefore always exits 0, reports the failure on stderr, and
lets Copilot proceed. A bug in this plugin stays a cosmetic bug.

That is enforced by `tests/fail-open.test.ts`, which asserts a zero exit for
empty input, malformed JSON, an empty object, wrong key names, a missing field,
a field of the wrong type, `null`, an array, and an unrecognised future shape -
across every hook, plus an unknown hook name. It ships with a **negative
control** that fails if the runner never actually executed, so the suite cannot
pass vacuously.

Upstream's 68 tests all still pass. They were never wrong; they only ever
exercised the payload shape upstream assumed, which is exactly why a fully green
suite did not prevent this.

## Install

```sh
npm install && npm run build
copilot plugin install ./
copilot plugin list
```

Requires the GitHub Copilot CLI, cmux on `PATH`, a cmux-managed workspace so
`CMUX_WORKSPACE_ID` is set, and Node.js 20+. Outside cmux the plugin no-ops.

Plugins bind at session start, so **a running session keeps a plugin it loaded
even after an uninstall.** Restart the session to pick up a change; `--continue`
preserves its history.

## Configuration

Environment variables, unchanged from upstream:

| Variable | Default | Description |
| --- | --- | --- |
| `COPILOT_CMUX_BIN` | `cmux` | Override the `cmux` executable path. |
| `COPILOT_CMUX_STATUS_KEY` | `copilot` | Sidebar status key namespace. |
| `COPILOT_CMUX_TRANSPORT` | `auto` | `auto`, `socket`, or `cli`. |
| `COPILOT_CMUX_PROGRESS` | `true` | Show progress while thinking or working. |
| `COPILOT_CMUX_KEEP_DONE_STATUS` | `true` | Keep the final `done` pill visible. |
| `COPILOT_CMUX_LOG_PROMPTS` | `true` | Log prompt submissions. |
| `COPILOT_CMUX_LOG_TOOLS` | `true` | Log tool start and completion. |
| `COPILOT_CMUX_LOG_SESSION_LIFECYCLE` | `true` | Log session start and end. |
| `COPILOT_CMUX_NOTIFY_SESSION_END` | `true` | Notify on successful completion. |
| `COPILOT_CMUX_NOTIFY_ERRORS` | `true` | Notify on error. |
| `COPILOT_CMUX_LOG_FILE_EDITS` | `true` | Log file edit and create events. |
| `COPILOT_CMUX_DEBUG` | `false` | Verbose diagnostics on stderr. |

## Scope

Inherited from upstream and unchanged: session start and end, prompt
submission, pre- and post-tool execution, and error reporting.

**Not covered:** subagent lifecycle, permission or question overlays, and todo
progress. The Copilot CLI hook surface exposes no subagent events at all, so a
subagent tree cannot be built from hooks. Maestro reconstructs it from the
session event log instead, by joining `subagent.started.data.toolCallId` to the
`agentId` on the spawning agent's own `tool.*` event. That is Maestro's job, not
this plugin's.

## Development

```sh
npm run build
npm test        # 80 tests: 68 upstream, 12 fail-open
npm run check   # lint + test
```

Rebuild and reinstall after changes so Copilot refreshes its cached copy.
