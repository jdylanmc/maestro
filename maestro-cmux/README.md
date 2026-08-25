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
this fork -> exit 0   # tool ALLOWED, error goes to a log file
```

### The rule this fork enforces

> **An observer must never be able to veto the thing it observes.**

This plugin draws status pills. It has no authority over whether a tool may run.

**Maestro does not register `preToolUse` at all.** It is the only hook Copilot
treats as able to veto a tool call, so the authority is given up rather than
merely left unused. Start of work comes from `userPromptSubmitted`; per-tool
detail comes from `postToolUse`, one tool later, which is the whole cost.

`hook-runner.ts` additionally always exits 0 and writes **nothing** to stdout or
stderr - a diagnostic goes to a file, because Copilot reports a hook that emits
anything as errored and denies the call even when it exited zero. A bug in this
plugin stays a cosmetic bug.

### Turning it off

Either switch disables every Maestro hook completely - no parsing, no state, no
diagnostics, no publishing:

```bash
export CMUX_COPILOT_HOOKS_DISABLED=1   # cmux's own switch; also stops cmux's hooks
export MAESTRO_DISABLED=1              # stops only this plugin
```

That is enforced by `tests/fail-open.test.ts`, which asserts a zero exit for
empty input, malformed JSON, an empty object, wrong key names, a missing field,
a field of the wrong type, `null`, an array, and an unrecognised future shape -
across every hook, plus an unknown hook name. It ships with a **negative
control** that fails if the runner never actually executed, so the suite cannot
pass vacuously.

Upstream's 68 tests all still pass. They were never wrong; they only ever
exercised the payload shape upstream assumed, which is exactly why a fully green
suite did not prevent this.

### It happened to this fork too

On 2026-08-24 the same class of bug was found here, by looking at the sidebar
and noticing it was lying.

Copilot CLI changed two payload shapes, and `parseHookInput` rejected every
affected hook:

| Rejected | From | Count |
| --- | --- | --- |
| `postToolUse.toolArgs` — a JSON string became an object | Aug 22, 00:38 | 13,589 |
| `notification.notificationType` — renamed `notification_type` | Aug 22, 20:02 | 5,275 |

The fail-open rule held: `hook-runner` forces exit 0, so **not one tool call was
denied**. But Maestro published almost nothing for two days. The visible symptom
was a Session showing `ASK` while it was demonstrably working, and another
sitting on a live permission prompt with no badge at all — a tree that was
plausible rather than empty, which is the failure mode this repository keeps
writing down and then shipping anyway.

Two things changed as a result:

- Field lookup tries camelCase and then the snake_case spelling of the same
  name. `hook_event_name` arriving beside `notification_type` says this is a
  migration in progress, not one field's quirk, so the fix is a general rule
  rather than two special cases.
- Optional detail no longer costs the whole payload. Unparseable `toolArgs`
  yields `undefined` and an unrecognised `resultType` degrades to `success`,
  because the tool name alone is enough to render and rejecting the payload
  loses the publish entirely.

`tests/payload-drift.test.ts` holds both observed shapes verbatim, and asserts
every hook reads its fields in either casing. A genuinely missing field still
throws with the present keys listed — that diagnostic is how this was found.

**Fail-open is necessary and was not sufficient.** A plugin that cannot break
the session can still go blind, and a blind observer that keeps drawing is worse
than one that stops.

### Saying so, next time

The two days are the ticket, not the parse bug. A dead publisher and an idle one
looked identical, so Maestro now measures the difference and publishes it: a
Session badges an orange warning when tool calls keep completing and no
`postToolUse` hook lands behind them.

Three cheaper detectors were built and each was measured to fail:

| Detector | Why it does not work |
| --- | --- |
| A heartbeat | "Nothing to say" and "gone deaf" are byte-identical on the wire |
| Log mtime | One long `bash` call appends nothing for minutes |
| Time since any hook | Every hook stamps it, and during the outage the hooks that still parsed kept stamping it — this one sat at zero through a deliberately broken parser |

What works is a per-hook timestamp. `lastToolAt` moves only when a `postToolUse`
lands, so completions accumulating past it isolate that one pipeline. Three in a
row is the threshold; one is a race between the tool finishing and its hook.

Two rules keep it honest rather than noisy:

- **Only the watcher may derive it.** A hook cannot report the absence of hooks.
  Every other hook carries the field forward untouched instead of recomputing it
  as zero — without that, `agentStop` erased the finding within a second, which
  is exactly the dynamic that kept the stale tree looking alive.
- **The watcher may not judge history older than itself.** After an upgrade a
  state file has no `lastToolAt` yet; measured, a perfectly healthy 44-hour
  Session reported 634. Health is measured from the later of the last landed
  hook and the watcher's own start.

Verified by breaking `parseToolArgs` on a live machine and watching the badge
appear on three Sessions and then clear, not only by unit test. The diagnostic
log is also bounded now — it had reached 17 MB.

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

The installer creates `~/.config/maestro/config.json` with a small set of
presentation preferences:

```json
{
  "progressEnabled": true,
  "keepDoneStatus": true,
  "notifyOnSessionEnd": true,
  "notifyOnErrors": true,
  "watcherEnabled": true,
  "watcherIntervalMs": 2000,
  "watcherIdleMs": 1800000,
  "publishRawText": false,
  "retainFinished": "15s",
  "logPrompts": true,
  "logToolCalls": true,
  "logSessionLifecycle": true,
  "logFileEdits": true,
  "debug": false
}
```

That is every setting the file accepts, and `config.example.json` is asserted
against the list so it cannot drift. Three settings are deliberately absent:
`cmuxBin`, `statusKey`, and `transport` select how to reach cmux at all, so a
bad value in a file read by every hook would silence the plugin everywhere with
the file itself as the only way back. They stay environment-only, where a
mistake is scoped to one session.

A malformed interval in the file is **reported**, not ignored — unlike the
environment path, which falls back silently. An ambient variable may be set by
something you did not write; a config file is a deliberate statement, and a
value quietly discarded would leave you believing a setting had taken effect.

Each hook invocation reloads this file, so changes apply to the next event
without reinstalling the plugin. The gear in the Maestro sidebar's compact top
toolbar opens cmux's native Custom Sidebars settings pane, and right-clicking
the header offers the same plus the notification actions cmux exposes.

Environment variables override the file-backed values:

| Variable | Default | Description |
| --- | --- | --- |
| `MAESTRO_CONFIG_PATH` | `~/.config/maestro/config.json` | Override the Maestro settings file path. |
| `COPILOT_CMUX_BIN` | `cmux` | Override the `cmux` executable path. |
| `COPILOT_CMUX_STATUS_KEY` | `copilot` | Sidebar status key namespace. |
| `COPILOT_CMUX_TRANSPORT` | `auto` | `auto`, `socket`, or `cli`. |
| `MAESTRO_WATCHER` | `true` | Run the attention watcher (see below). |
| `MAESTRO_WATCHER_INTERVAL_MS` | `2000` | How often the watcher re-derives attention. |
| `MAESTRO_WATCHER_IDLE_MS` | `1800000` | How long the watcher runs with every Session quiet. |
| `COPILOT_CMUX_PROGRESS` | `true` | Show progress while thinking or working. |
| `COPILOT_CMUX_KEEP_DONE_STATUS` | `true` | Keep the final `done` pill visible. |
| `COPILOT_CMUX_LOG_PROMPTS` | `true` | Log prompt submissions. |
| `COPILOT_CMUX_LOG_TOOLS` | `true` | Log tool start and completion. |
| `COPILOT_CMUX_LOG_SESSION_LIFECYCLE` | `true` | Log session start and end. |
| `COPILOT_CMUX_NOTIFY_SESSION_END` | `true` | Notify on successful completion. |
| `COPILOT_CMUX_NOTIFY_ERRORS` | `true` | Notify on error. |
| `COPILOT_CMUX_LOG_FILE_EDITS` | `true` | Log file edit and create events. |
| `COPILOT_CMUX_PUBLISH_RAW_TEXT` | `false` | Publish prompt, argument, and result text. See Privacy. |
| `MAESTRO_RETAIN_FINISHED` | `15s` | How long a finished subagent stays on screen: `5s`, `15s`, `1m`, `5m`, `15m`, `1h`, `never`. |
| `COPILOT_CMUX_DEBUG` | `false` | Verbose diagnostics on stderr. |

## Quieting push notifications

**The noise is not Maestro's.** cmux registers its own Copilot hooks in
`~/.copilot/settings.json`, independently of this plugin, and its `Notification`
hook runs `cmux hooks copilot stop` for **every** Copilot notification with no
reference to the type. Measured types in one session:

| `notificationType` | count | blocks the operator? |
| --- | --- | --- |
| `permission_prompt` | 135 | yes |
| `agent_idle` | 7 | no — a subagent going quiet |
| `elicitation_dialog` | 2 | yes |
| `shell_completed` | 1 | no |
| `shell_detached_completed` | 1 | no |

So every subagent going idle raises a push notification (#64).

```sh
./quiet-notifications.sh install    # forward only blocking prompts
./quiet-notifications.sh status     # which hook is in place
./quiet-notifications.sh restore    # put cmux's own hook back, exactly
```

It backs up `settings.json`, stores cmux's original hook verbatim so `restore`
is exact rather than reconstructed, and touches no other hook. It is **opt-in**;
`install.sh` never runs it, because it edits a file this repository does not own.

The filter fails **open**, and open here means *forwarding*. Elsewhere in
Maestro the safe direction is to do nothing; this hook sits between the runtime
and a prompt you may be waiting on, so a missing Node, a disabled plugin, a
crashed filter, malformed input, or an unrecognised notification type all
forward. Only the three measured non-blocking types are ever suppressed — a new
blocking type Copilot adds will be noisy rather than silent, which is the
direction that can be fixed by adding one string.

Two things worth knowing:

- `CMUX_COPILOT_HOOKS_DISABLED=1` also silences the noise, but it disables every
  Maestro hook too — you would lose the tree. This script exists so those are
  not the same choice.
- If cmux rewrites its hook block on upgrade, the override is silently replaced
  and the noise returns. Run `status` to check and `install` again to reapply.
  That is the real cost of overriding another product's configuration.

## Scope

Inherited from upstream and unchanged: session start and end, prompt
submission, pre- and post-tool execution, and error reporting.

**Not covered:** subagent lifecycle, permission or question overlays, and todo
progress. The Copilot CLI hook surface exposes no subagent events at all, so a
subagent tree cannot be built from hooks. Maestro reconstructs it from the
session event log instead, by joining `subagent.started.data.toolCallId` to the
`agentId` on the spawning agent's own `tool.*` event. That is Maestro's job, not
this plugin's.

## The sidebar

[`sidebars/maestro.swift`](sidebars/maestro.swift) is a custom cmux sidebar
that renders the hierarchy: workspace, then surface, then subagent tree.

```sh
cmux sidebar select maestro   # activate it as the left sidebar
cmux sidebar open maestro     # or open it as a resizable pane
```

`install.sh` installs the sidebar at
`~/.config/cmux/sidebars/maestro.swift`. Its top settings gear uses cmux's
documented `settings.open` action rather than attempting an in-sidebar modal:
the interpreted sidebar runtime does not yet support `@State`, input controls,
`.sheet`, or `.popover`.

Surfaces are one line by default and expand on focus to show directory and
branch. Selection is marked by an accent stripe. Expansion needs no `@State`,
which the interpreter does not support: cmux persists workspace selection and
surface focus, and both are in the binding set.

**The interpreter fails silently, by design.** cmux's authoring contract states
that unsupported syntax is skipped and never crashes, so `cmux sidebar validate`
reporting `OK` says nothing about whether anything rendered. It has reported
`OK` on a blank pane, and on one row where 41 were published. Debugging is
bisection, not inspection, and changes are verified by reading the rendered
accessibility tree. Constructs measured to fail silently are documented at the
top of the file - read those comments before editing it.

## The attention watcher

Maestro publishes from hooks, and while a Session sits blocked **no hook
fires**. The measured ordering is `tool.execution_start` → `preToolUse` →
`permission.requested`, so even a tool-start hook runs before the request
exists. The only hook that can catch a live block is `notification`, and it does
not fire for every prompt variant — a Session blocked on "Allow directory
access" showed no badge at all while its log carried an outstanding request the
whole time.

So a small watcher process re-derives attention on a timer instead. It:

- starts from the `sessionStart` hook, detached, and holds a single-instance
  lock so only one runs per machine
- skips any Session whose event log has not changed since the last tick, because
  deriving attention parses the whole log
- publishes only its own Session's block, leaving co-resident Sessions alone
- exits once every known Session has been quiet for `MAESTRO_WATCHER_IDLE_MS`,
  so it never becomes immortal
- fails silently: with the watcher off or broken, Maestro behaves exactly as it
  did before, publishing on hooks alone

Set `MAESTRO_WATCHER=0` or `"watcherEnabled": false` to turn it off.

## How long finished work stays on screen

A finished subagent is retained briefly so the tree stays legible - look away
for ten seconds and otherwise the work is simply gone, with no way to tell
whether it succeeded or never started. `retainFinished` chooses the window:
`5s`, `15s`, `1m`, `5m`, `15m`, `1h`, or `never`.

`never` means retention alone never ages a row out. It does not disable
tap-to-dismiss, and it does not survive the description clearing that happens at
session end.

The default is **`15s`**, which is what Maestro has always done. Issue #56 asked
for `15m`, describing the existing window as fifteen minutes - it is fifteen
seconds. Since the same ticket also required that the published description stay
identical for an operator who never touches the setting, and those two cannot
both be true, the behaviour-preserving reading won and `15s` was added to the
list. Every window the ticket asked for is still available.

Retention is enforced in the plugin, not the sidebar, which has no clock to
compare timestamps against and no state with which to remember a dismissal.

**The setting is live.** Hooks reload the config on every invocation, and the
watcher re-reads it every tick, so editing `config.json` takes effect within a
tick or two with nothing to restart. A change also invalidates the watcher's
memos — without that it would appear not to work, because the watcher skips
recomputing a Session whose log has not changed, and a tree computed under
`never` scheduled no expiry to wake for. Measured: three stale rows survived
every subsequent tick until the invalidation was added.

## What each agent is, not just what it is doing

Every row says which **model** is driving it. Subagent rows have carried one
since wire v2; the Session row now does too, which had left the one agent you
are actually talking to as the only one whose model was invisible. It is read
from the event log rather than stored, because the model can change mid-session
- `session.model_change` is a real event - and a stored value is only as fresh
as the hook that would update it.

A Session also shows the **git worktree** it is working out of, when it is in
one. cmux already publishes a branch, so this would be redundant if every
worktree were on a branch. Measured on this machine, they are not: of four live
worktrees of one repository, three were on a **detached HEAD**, where the branch
says nothing and the directory name is the only thing identifying which line of
parallel work a Session belongs to.

Detection is a single file read, never a subprocess. Git's on-disk contract is
enough: in a linked worktree `.git` is a file reading
`gitdir: <main>/.git/worktrees/<name>`, and in a main working tree it is a
directory. Spawning `git rev-parse` would answer the same question and would put
a process launch on the hook path, where the whole rule is that Maestro cannot
be the reason a session stalls.

Subagents are not shown a worktree of their own. They run in their parent
Session's working directory, and the event log carries no per-subagent `cwd` at
all - so a per-row worktree would be invention rather than observation.

## Skills in the tree

A skill invocation appears as its own row, marked with a wand and coloured by
**how it started**:

| Colour | Meaning |
| --- | --- |
| Cyan | You invoked it |
| Purple | The agent chose it |
| Grey | The runtime did not record a trigger |

The distinction is derived, not guessed. `skill.invoked` carries a `trigger`
field; measured across every session log on disk, 833 events read
`agent-invoked`, 191 read `user-invoked`, and **83 carry no trigger at all** —
those get the third colour rather than being assumed to be either.

A skill nests under the subagent that invoked it, because the event's `agentId`
names that subagent. One the operator asked for sits at the root. If the
invoking agent is no longer in the tree the row falls back to the root rather
than disappearing, because the invocation still happened.

Only the skill's **name** is published. `skill.invoked.data.content` is the
entire skill markdown, `description` is free text and `path` is a machine path;
none of the three ever reaches the wire.

## Why a Session is asking

Three different states raise the yellow badge, and they are not interchangeable -
two block the Session and one does not.

| Source | Sidebar | Meaning |
| --- | --- | --- |
| A `permission.requested` with no matching `permission.completed` | An icon for the **kind** - terminal, pencil, eye, globe, puzzle, gears - beside `ASK` | Blocked on approval |
| A `tool.execution_start` for `ask_user` with no matching completion | `questionmark.bubble.fill` beside `ASK` | Blocked on a clarifying question |
| The `agentStop` hook | `checkmark.circle.fill` | The turn finished; you are next |

The permission kind is the runtime's own closed vocabulary, measured across 40
recent session logs: `shell` 1671, `write` 306, `read` 209, `url` 28, `mcp` 13,
`factory` 6. An unrecognised value falls back to the generic raised hand rather
than being published. The `intention` and `path` fields on the same request are
prose and a machine path and are never read - the kind is the most that is safe
to show, and it is the part that tells you what you are about to approve.

## Known limitations

These are measured, not suspected. The four limitations this section used to
list have all closed - the event log is read to EOF rather than as an 8 MiB
tail, a delegation renders from `tool.execution_start` instead of waiting for
the deferred `subagent.started` burst, a finished subagent is retired after 15
seconds instead of freezing on screen, and Session resolution fails closed on
an ambiguous working directory rather than guessing by newest write.

What remains:

| Limitation | Effect |
| --- | --- |
| `subagent.completed` carries no success flag | A subagent that dies without emitting `subagent.failed` is indistinguishable from one that succeeded. The event itself is real but rare (measured across every session log on disk: 2,898 `subagent.started`, 2,815 `subagent.completed`, 27 `subagent.failed` over 11 logs) and is now rendered as a failed row and a failed count |
| No event carries context-window occupancy | A subagent row shows its model but no context percentage, and none can be synthesised honestly (#41) |
| Dismissal is matched by display name | Two finished subagents with the same name dismiss together |
| The sidebar interpreter fails silently | An unsupported construct renders nothing while `cmux sidebar validate` reports `OK`; changes are verified against the rendered accessibility tree (see `docs/GAPS.md`) |

The common failure shape is worth stating plainly: **the dangerous ones render a
plausible tree rather than an empty one.** A tree that shows nothing is obviously
broken and gets fixed. A tree that is quietly incomplete gets trusted.

## Privacy

By default Maestro publishes only identifiers the runtime names itself - tool
names, subagent names, models, counts, statuses - and never free text a person
or a model wrote. Prompt text, tool-argument text such as `description` or
`command`, tool-result text, and file paths are not published in any form,
including summarised. Redaction happens where the hook payload is parsed, so
prompt text never reaches the runtime state file either.

Set `publishRawText` to `true`, or `COPILOT_CMUX_PUBLISH_RAW_TEXT=1`, to restore
the older and chattier labels. It is off in the shipped configuration.

The one deliberate exception is an error message, which is published in full up
to 96 characters: it is a runtime-authored diagnostic, and an unreadable error
is worse than a slightly leaky one.

## Development

```sh
npm run build
npm test        # 245 tests
npm run check   # lint + test
```

Rebuild and reinstall after changes so Copilot refreshes its cached copy.
A **running session keeps the plugin it loaded**, so a rebuild does not affect
it - restart the session to exercise a change. The attention watcher is a
separate long-lived process and likewise keeps its old code in memory: stop the
pid named in `$TMPDIR/maestro-cmux/watcher.pid` and restart
`dist/watcher-main.js` after changing anything under `src/runtime/watcher.ts`
or `src/tree.ts`.
