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
- Render arbitrary depth while optimizing for breadth.
- Update the tree live while the Session runs and reconstruct it from durable
  events when revisited.
- Distinguish running, completed, and failed subagents.
- Do not publish secrets, prompts, tool arguments, transcript content, or
  machine-specific paths.

### cmux presentation

- Render the hierarchy cmux exposes: workspace -> terminal -> Session ->
  subagent tree.
- Selection controls expansion; completed subagents collapse behind a count.
- A running row uses an animated spinner. A failed row uses a red `xmark`.
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
- Do not register `preToolUse` unless a future measured requirement cannot be
  met through a safer event. `userPromptSubmitted` is the preferred start signal
  for live work.
- Honor `CMUX_COPILOT_HOOKS_DISABLED=1` as a complete Maestro hook kill switch.
- Keep coding-agent integration optional and local configuration outside the
  repository.

## Current constraints and exclusions

- The c-0026 single-line `¦` workspace-description format is transitional and
  must be removed only when the replacement preserves every required visible
  tree field.
- Custom-sidebar rendering has no `@State`, `VSplitView`, `GeometryReader`,
  `TextField`, or reliable zero-width hiding. Do not retry measured
  non-rendering constructs.
- Workspace rename input, a custom raster mark, and an expandable completed-task
  disclosure are unavailable in the sidebar language and are not requirements.
- cmux restore and hook-session storage are upstream capabilities. Maestro may
  consume them only to the extent their measured behavior is correct.

## Unresolved requirements

- Replace tail truncation with incremental event-log reads so logs larger than
  8 MiB do not silently omit subagents.
- Resolve the correct Session without choosing the newest log for a shared
  working directory.
- Replace the transitional workspace description with proven per-tab channels
  or another representation that preserves parentage, state, and activity.
- Determine how the Session task list is presented when `log` is retained but
  not workspace-card content.
- Decide the deliberate SF Symbol for Maestro's mark.
- Establish a reliable live Session state. c-0029 observed cmux's
  `runtimeStatus` and `agentLifecycle` as `idle` throughout a ten-second active
  tool call.
- Explain or canonicalize cmux hook-store duplication before using it for
  identity. c-0029 observed 31 records while one process/transcript accumulated
  many identities.
- Re-measure session restore after the generated `-C` argument defect is fixed.
- Verify uninstall after Copilot migrated cmux hooks from `config.json` to
  `settings.json`.
