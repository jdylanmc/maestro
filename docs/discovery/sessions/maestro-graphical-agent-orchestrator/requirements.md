# Requirements - Maestro Observability Plugin

The orchestration and multi-route requirements published before c-0025 are
historical. Their full wording remains in immutable cycle checkpoints. This file
is the current specification after the user settled Maestro's scope as an
observability plugin and [`CONTEXT.md`](../../../../CONTEXT.md) retired `Fleet`.

## Confirmed requirements

### Product scope

- Maestro makes work delegated by a Copilot **Session** visible inside cmux, the
  Host Application the operator already uses.
- Maestro observes; it does not enforce worktree isolation, own process
  lifetime, persist `Parked` or `Interrupted` intent, sweep processes, provide a
  command surface, or ship as a standalone application.
- macOS is the supported platform.
- cmux-native behavior is preferred. Maestro extends only where cmux cannot
  bridge the required gap. The subagent tree remains Maestro's unique addition.

### Runtime evidence

- Read events from the Session's `events.jsonl`, never `session.db`.
- Reconstruct parentage by joining
  `subagent.started.data.toolCallId` to the spawning agent's `tool.*` event
  `agentId`. Never use event `parentId`, which is chronological.
- Use `agentId` as subagent identity.
- Render a bounded tree projection: publish at most 60 rows, clamp displayed
  depth to 6, and show at most 10 rows for the owning surface. This favors
  breadth and keeps the sidebar bounded; it does not preserve arbitrary depth.
- Update the tree live while the Session runs and reconstruct it from durable
  events when revisited.
- Distinguish running from completed subagents. Live events expose no failed
  state: across 60 measured sessions, 133 `subagent.started` and 132
  `subagent.completed` events carried no failure signal. The implementation
  nevertheless retains a fixture-only `fail` status, `x` wire glyph, and red
  `xmark` rendering. **Unimplemented requirement:** remove that unreachable
  failure representation, as decided in c-0030.
- Retain a finished subagent briefly rather than deleting it on completion, and
  sort running work above finished work within each sibling group.
- Derive **Attention from the event log**, never from a stored flag: a
  `permission.requested` with no `permission.completed` sharing its `requestId`.
  A hook fires only to trigger a recompute; the log is the truth.
- Read the Session's context percentage, model, and effort from the runtime's
  own status line via `cmux read-screen`. Never synthesise a percentage from
  hardcoded context-window sizes.
- **Unimplemented privacy requirement:** do not publish secrets, prompts, tool
  arguments, transcript content, or machine-specific paths. The current runtime
  violates this boundary: it derives a tool summary from the argument
  `description`, or from the basename of the argument `path`, and publishes that
  summary in cmux status/progress and logs, all enabled by default. It also
  publishes a summarized prompt in thinking progress and logs by default, and
  may append summarized tool-result text to a log entry. A direct `path`
  argument is reduced to its basename, but arbitrary `description` and result
  text receive no path or secret scrubbing. Full command text and transcript
  content are not published by these paths.

### cmux presentation

- Render the hierarchy cmux exposes: workspace -> terminal -> Session ->
  subagent tree.
- Selection controls expansion; completed subagents collapse behind a count.
- A running row uses a **native `ProgressView`**, which resolves to an AppKit
  `AXBusyIndicator` and animates at native framerate. Everything hand-drawn is
  capped at **1 fps**: `clock.epoch` is seconds, and the sidebar re-renders about
  once a second, so a value recomputed per tick cannot be smooth. There is no
  `withAnimation`, `.animation`, `.transition`, or `symbolEffect`.
- Subagents render nested under the Copilot surface that produced them, matched
  by the `CMUX_SURFACE_ID` the plugin publishes against the sidebar's `t.id`.
  Never infer the owning surface from a title suffix.
- **Unimplemented attention requirement:** the yellow badge should mirror the
  blocking runtime state and persist until that state clears. Today a derived
  permission remains open until its matching `permission.completed`, while the
  reducer clears stored attention on `user.prompt` or `tool.post`; the sidebar
  also lets a click remove the published attention row. There is no generic
  "work resumed" transition, and a later hook may republish an outstanding
  derived permission.
- Follow cmux's custom-sidebar subset. Unsupported SwiftUI syntax fails
  silently, so visual verification is required; `cmux sidebar validate` is not
  sufficient.
- Use semantic colors and SF Symbols. The project raster icon is unavailable in
  custom sidebars.
- Status and progress use their proven per-tab visual channels. Log is retained
  and queryable but is not assumed to render on the workspace card.

### Hook safety

- Every Maestro hook is fail-open and exits zero on malformed or unexpected
  input. An observer must never veto the tool call it observes.
- **`preToolUse` is not registered.** c-0030 executed the c-0029 decision. The
  blast radius is every tool call in every live Session; the benefit was a badge
  clearing a few seconds sooner. Deriving Attention from the log removed the
  only reason to keep it.
- Register `notification` and `agentStop`. `notification.notificationType`
  discriminates a blocking `permission_prompt` or `elicitation_dialog` from
  `agent_idle` and the `shell_*` completions, which are not Attention.
  `agentStop` reports `end_turn`. Both are required because a Session **blocked
  on the operator runs no tools**, so no tool hook fires while the state that
  most needs reporting is true.
- `hooks.json` is **generated by `install.sh`**, which is the single source of
  truth for the hook list. Editing `hooks.json` by hand is silently discarded at
  the next install.
- Never publish `skill.invoked.data.content`; it is the full skill markdown.
  Never publish a permission prompt's `message` or `fullCommandText`; it is the
  full command line.
- Honor `CMUX_COPILOT_HOOKS_DISABLED=1`, which is cmux's own documented switch,
  and provide `MAESTRO_DISABLED=1` so this plugin can be silenced without also
  disabling cmux's native Copilot integration.
- Keep coding-agent integration optional and local configuration outside the
  repository.

## Current constraints and exclusions

- The c-0026 single-line `¦` workspace-description format is transitional and
  must be removed only when the replacement preserves every required visible
  tree field.
- Custom-sidebar rendering has no `@State`, `VSplitView`, `GeometryReader`,
  `TextField`, or reliable zero-width hiding. `HSplitView` is available. Do not
  retry measured non-rendering constructs.
- Workspace rename input, a custom raster mark, and an expandable completed-task
  disclosure are unavailable in the sidebar language and are not requirements.
- cmux restore and hook-session storage are upstream capabilities. Maestro may
  consume them only to the extent their measured behavior is correct.

## Unresolved requirements

- Resolve the correct Session without choosing the newest log for a shared
  working directory.
- Replace the transitional workspace description with proven per-tab channels
  or another representation that preserves parentage, state, and activity.
- Determine how the Session task list is presented when `log` is retained but
  not workspace-card content.
- Decide whether Maestro needs a dedicated visible mark. c-0030 removed the
  separate sidebar title row and its `point.3.connected.trianglepath.dotted`
  symbol, but every workspace row still renders the generic `folder.fill`
  symbol beside its workspace title.
- Decide what a still-blocked badge should do for a Session that **dies while
  blocked**. It never resumes, so nothing clears it. Accepted unknown; manual
  dismissal is the current exit.
- Replace status-line scraping for context percentage if Copilot ever publishes
  the figure as an event. The parse depends on the status line being in the
  visible viewport and on a tier string that already varies (`1M`, `1.1M`).
- Establish a reliable live Session state. c-0029 observed cmux's
  `runtimeStatus` and `agentLifecycle` as `idle` throughout a ten-second active
  tool call. **c-0030 made this non-blocking**: Maestro derives its own state
  from the Copilot event log and no longer needs cmux's native lifecycle.
- Explain or canonicalize cmux hook-store duplication before using it for
  identity. c-0029 observed 31 records while one process/transcript accumulated
  many identities.
- Re-measure session restore after the generated `-C` argument defect is fixed.
- Verify uninstall after Copilot migrated cmux hooks from `config.json` to
  `settings.json`.
