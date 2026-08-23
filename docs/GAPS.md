# Architecture gaps

A running log of limitations hit while building `maestro-cmux`, the Copilot CLI
plugin and interpreted cmux sidebar that is this repository's live surface.

## Why this file exists

`maestro-cmux` is a working reference implementation. It is deliberately built
inside the constraints of a runtime-interpreted sidebar and a fixed hook
surface, because that was the fastest route to a real, daily-driven product.

Every constraint it hit is a requirement for whatever replaces it. This file is
that requirement list, recorded at the moment of impact rather than
reconstructed later from memory.

Record a gap when the architecture prevents something we actually wanted, not
merely when something is hard. Each entry states what was wanted, what blocked
it, the measured evidence, what shipped instead, and what would close it.

Prefer measurement over suspicion. This repository already carries several
comments of the form "measured, not suspected"; a gap asserted without evidence
is a guess, and guesses have already been wrong here more than once.

## Interpreted versus compiled sidebars

cmux supports two kinds of sidebar. Most gaps below trace to this single choice.

| | Interpreted (current) | Compiled (ExtensionKit) |
| --- | --- | --- |
| Source | One SwiftUI-style file, no build step | Xcode project, signed `.appex` |
| Reload | Hot-reloads on save | Rebuild, re-sign, re-register |
| Language | A growing subset, unsupported syntax skipped silently | Real SwiftUI |
| State | No `@State` | Full SwiftUI state |
| Input controls | None | `Toggle`, `TextField`, `Slider`, `Picker` |
| Modals | None | `.sheet`, `.popover`, `NavigationStack` |
| Fonts | Built-in designs only | `.custom(...)`, any installed font |
| Data | Live cmux bindings, read-only | Filtered snapshot plus typed action channel over XPC |
| Distribution | Copy a file | Container app, App Sandbox, permission scopes, user enablement |

The interpreted route was chosen and remains correct for a reference
implementation. The compiled route is what most presentation gaps below require,
and it costs a container app, code signing, sandbox rules, and a separate
install-and-enable flow.

Authoring contract: <https://github.com/manaflow-ai/cmux/blob/main/docs/custom-sidebars.md>
Compiled SDK: <https://github.com/manaflow-ai/cmux/tree/main/Packages/macOS/CmuxExtensionKit>

---

## Presentation gaps

### G-01 - No custom fonts

**Wanted:** the Maestro title in JetBrains Mono Nerd Font, matching the terminal.
**Blocked by:** the interpreter exposes only built-in font designs. `.font(.custom(...))` is not in the supported modifier set.
**Evidence:** cmux authoring contract, Text/typography modifier list.
**Shipped:** `.font(.system(size: 18, design: .monospaced))`, the system monospaced face.
**Closes with:** a compiled sidebar, which can call `.custom(...)` directly.

### G-02 - No state, so no input controls

**Wanted:** a real preferences form inside the Maestro sidebar.
**Blocked by:** no `@State`, and therefore no `Toggle`, `TextField`, `Slider`, or `Picker`. Two-way binding does not exist; only taps that dispatch `cmux(...)` work.
**Evidence:** cmux authoring contract, "Not yet supported".
**Shipped:** a gear that opens cmux's own Settings window through the documented `settings.open` action, plus Maestro-owned preferences in `~/.config/maestro/config.json` re-read on every hook.
**Closes with:** a compiled sidebar, or a cmux-provided settings surface for extensions.

### G-03 - No modal presentation

**Wanted:** a settings modal raised from the sidebar.
**Blocked by:** `.sheet`, `.popover`, and navigation are unsupported.
**Shipped:** delegation to the host's native Settings window.
**Closes with:** a compiled sidebar.

### G-04 - Animation is capped at roughly one frame per second

**Wanted:** smooth motion to signal running work.
**Blocked by:** the sidebar re-evaluates about once a second and `clock.epoch` is in **seconds**, so anything hand-drawn recomputes at most once per tick. Only native views animate independently.
**Evidence:** measured `clock.epoch` as a ten-digit seconds value. `ProgressView()` resolves to a native `NSProgressIndicator` and animates at native framerate regardless.
**Shipped:** `ProgressView()` for running work; hand-drawn mascot motion deliberately stepped at 2 ticks per phase to absorb refresh drift.
**Closes with:** a compiled sidebar with a real animation clock.

### G-05 - No viewport height, so nothing can anchor to the bottom

**Wanted:** the settings gear pinned to the bottom-right of the sidebar.
**Blocked by:** the interpreted view is hosted as scroll content and receives an unbounded vertical proposal. `Spacer()`, `.frame(maxHeight: .infinity)`, and a root `.safeAreaInset(edge: .bottom)` all resolve against content height, not the pane.
**Evidence:** all three were implemented and observed in the live accessibility tree; each placed the control at content height rather than the window edge.
**Shipped:** a compact top toolbar instead.
**Closes with:** a compiled sidebar, or a host that proposes viewport height to interpreted views.

### G-06 - Unsupported syntax fails silently, and validation does not catch it

**Wanted:** to trust `cmux sidebar validate` before shipping a change.
**Blocked by:** the interpreter skips unsupported syntax by design and never crashes, so `validate` reports `OK` for a sidebar that renders nothing.
**Evidence:** `OK` reported on a blank pane, and on a render showing one row when 41 were published.
**Shipped:** every sidebar change is verified by reading the rendered accessibility tree, not by validation. Known silent failures are documented at the top of `sidebars/maestro.swift`.
**Closes with:** a compiled sidebar, where this is an ordinary compile error.

### G-07 - Specific constructs that silently render nothing

Measured, each after costing real debugging time:

- a **nested function call used as an argument** renders nothing, recorded when `cued(anyRunning(d), ...)` drew the mascot head but silently dropped the baton and dots;
- **arithmetic as a bare modifier argument** renders nothing, for example `.padding(.leading, depth * 9)`. Arithmetic inside a function body or a string interpolation is fine, as are ternaries. `treeIndent()` exists solely to return literal widths per depth;
- `.frame(width: 0)` **does not hide a view**. Six running subagents each rendered a supposedly zero-width red `xmark`. Branch with `if`/`else` instead;
- optional binding fields are **absent, not null**, so filtering a collection on `description != nil` yields an empty sidebar. Use `if let` inside the loop.

**Closes with:** a compiled sidebar.

### G-08 - The tree wire format must be a single line

**Wanted:** to publish the subagent tree as readable multi-line text.
**Blocked by:** the interpreter has no working way to split on a newline. `split(separator: "\n")` does not interpret the escape and returns the whole string as one element; `whereSeparator: { $0.isNewline }` renders nothing at all.
**Evidence:** 23 lines and 432 characters stored intact in the description, but unsplittable on read.
**Shipped:** one line, rows delimited by a literal `¦`, each row `<depth> <glyph> <name>`. Names are stripped of the delimiter and truncated.
**Closes with:** per-tab channels carrying structured data (issues #47, #48), or a compiled sidebar reading a real payload.

---

## Copilot runtime gaps

### G-09 - The hook surface exposes no subagent events

**Wanted:** to build the subagent tree from hooks, like every other signal.
**Blocked by:** no subagent lifecycle event exists in the Copilot CLI hook surface.
**Shipped:** the tree is reconstructed by reading the session's own durable event log at `~/.copilot/session-state/<id>/events.jsonl`, joining `subagent.started.data.toolCallId` to the spawning agent's `tool.*` event.
**Closes with:** subagent lifecycle events on the hook surface, or a supported runtime API.

### G-10 - Subagent failure is not observable

**Wanted:** to render a failed subagent distinctly.
**Blocked by:** no `subagent.failed` event exists, and `subagent.completed` carries no success flag. Its payload is `toolCallId`, `agentName`, `agentDisplayName`, `model`, `totalToolCalls`, `totalTokens`, `durationMs`.
**Evidence:** measured across 60 recent sessions - 133 `subagent.started`, 132 `subagent.completed`, **zero** `subagent.failed`.
**Shipped:** the `x` glyph exists in the wire format and sidebar but is effectively unreachable, and was only ever rendered from a hand-written fixture. A failure badge was deliberately removed from the workspace row rather than shown from fixture-only data.
**Closes with:** a failure event, or a result field on completion.

### G-11 - No permission-resolved hook, so stored attention is never cleared

**Wanted:** the ASK badge to clear the moment a permission is answered.
**Blocked by:** the `notification` hook fires for `permission_prompt`, but nothing fires when that permission resolves. `agent.stop` deliberately preserves blocking attention, so the stale value survives the end of the turn and clears only on the next `user.prompt`.
**Evidence:** root cause of the false-positive ASK badge, together with G-21 and G-23.
**Shipped:** derived attention is now authoritative for `permission` and `question`, and a Session's own `session.shutdown` retires anything it left outstanding. Stored hook attention is the fallback for `turn` only.
**Closes with:** a permission-resolved hook. The derivation covers the observable cases, but it is a reconstruction of state the runtime already knows.

### G-12 - Auto-approval is indistinguishable from a human answer

**Wanted:** to never raise ASK for a permission that policy auto-approves.
**Blocked by:** `permission.completed.result.kind` does not record how the decision was reached.
**Evidence:** one long session - `approved` 1270, `approved-for-location` 8, and no other values. Auto-approved requests do emit both `permission.requested` and a matching `permission.completed`.
**Shipped:** nothing yet; ASK can flicker for auto-approved requests between the request and its completion.
**Closes with:** an origin or decision field on the completion event.

### G-13 - No current-tool visibility

**Wanted:** to show the tool a Session is running right now.
**Blocked by:** `preToolUse` is the only hook that fires before execution, and Maestro deliberately does not register it - it is the only hook Copilot treats as able to veto a tool call, and an observer must never be able to veto the thing it observes.
**Shipped:** `postToolUse` reports the **last completed** tool, so the status pill lags execution by one tool. This is an accepted cost, not a defect.
**Closes with:** a non-vetoing start-of-tool hook.

### G-14 - Context percentage is not published

**Wanted:** per-Session model and context usage in the sidebar.
**Blocked by:** Copilot does not emit context usage as an event.
**Shipped:** nothing; tracked in issue #41. Reading it means scraping the runtime status line through `cmux read-screen`, which is why it has not been built.
**Closes with:** a context-usage event.

### G-23 - A dead Session cannot retract what it published

**Wanted:** a badge to disappear when the Session that raised it dies.
**Blocked by:** Maestro only republishes when a hook fires, and a Session that has been killed fires nothing ever again. The workspace description is a persistent field, so the last thing a Session published outlives it.
**Evidence:** two Sessions were found still advertising a blocking prompt **20.6h** and **39.6h** after death, each having logged a `permission.requested` with no completion. Derivation is now correct at read time, but a description published *before* death is only overwritten when some later Session runs a hook in that workspace.
**Shipped:** `detectAttention` retires outstanding permissions and elicitations at `session.shutdown`, applied in log order so a `session.resume` correctly reopens later ones. One live Session in the same scan carried **3** shutdowns, so a whole-file "has shutdown" test would have muted a real blocking prompt.
**Closes with:** a supervised plugin process that can observe Session death and publish on its behalf, rather than a hook that only runs while the Session is alive.

### G-24 - A blocked Session cannot raise its own badge

**Wanted:** the ASK badge to appear whenever a Session is waiting on the operator.
**Blocked by:** publishing is hook-driven, and while a Session sits blocked NO hook fires. Measured ordering is `tool.execution_start` -> `preToolUse` -> `permission.requested`, so even a tool-start hook runs before the request exists. The only hook that can catch a live block is `notification`, and it does not fire for every prompt variant.
**Evidence:** a Session blocked on an "Allow directory access" prompt showed no badge; its workspace description held the owner row and nothing else, so no attention row was ever written. Its log had an outstanding `permission.requested` at that moment, so `detectAttention` would have returned it - nothing called it. That log recorded 347 permission requests and zero `notification` events.
**Shipped:** nothing. This is the opposite failure to G-11: that badge wrongly STAYED ON, this one never turns on, and better derivation cannot fix it because derivation is never invoked.
**Closes with:** a watcher that recomputes attention on a timer rather than on a hook - the same supervised process as G-23.

### G-25 - The interpreter cannot scope rows to one publisher

**Wanted:** each Copilot Session's subagent rows rendered under its own tab.
**Blocked by:** extracting one publisher's contiguous rows needs an index span, and every construct tried to build it renders NOTHING - silently. `Array(0..<rows.count).filter { ... }.map { rows[$0] }` fails, and so does `var out: [String] = []` with `out.append(rows[j])` in a `for` loop. Single-expression filters over the whole description work, which is why the unscoped version renders.
**Evidence:** verified against the live accessibility tree, and confirmed by reverting - the old unscoped code renders rows, the scoped code renders none, on the same description. `cmux sidebar validate` reported OK throughout.
**Shipped:** the publish side is block-aware (see mergeOwnedRows), and `isOwner` correctly marks EVERY Session's tab - proven live with a second owner block. Only row scoping is missing, so co-resident Sessions currently pool their rows under the first tab instead of losing them.
**Closes with:** a compiled sidebar reading a real payload, or per-surface channels. See issue #49.

---

## Host gaps

### G-15 - One owner row per workspace

**Wanted:** two Copilot Sessions in one cmux workspace, each with its own tree.
**Blocked by:** the tree is published into the workspace **description**, which is a single field. A second Session clobbers the first.
**Evidence:** issue #49.
**Shipped:** a single `@ o <surface-id>` owner row; only the most recent publisher is marked.
**Closes with:** per-tab channels (issues #47, #48).

### G-16 - The published description is persistent

**Wanted:** stale presentation to expire on its own.
**Blocked by:** the description is overwritten, never expired. A publish that never happens leaves the previous state on screen indefinitely.
**Evidence:** completed subagents froze on screen as running (issue #36); a stale ASK badge survives for the same reason.
**Shipped:** an empty computed tree is published rather than skipped, precisely to clear stale state. A failed computation deliberately leaves the previous description intact, which is correct for fail-open but preserves staleness.
**Closes with:** a channel with defined expiry, or host-side ownership of liveness.

### G-17 - Surface type is not exposed to the sidebar

**Wanted:** to tell a Copilot Session apart from a plain terminal.
**Blocked by:** the sidebar tab binding exposes `id`, `title`, `focused`, `pinned`, `directory`, `branch`, and `ports` - no kind.
**Evidence:** issues #51 and #55.
**Shipped:** Maestro publishes its own owner row and matches on `CMUX_SURFACE_ID`. Branching on title or directory shape was rejected as heuristic identity, the same mistake as issue #33.
**Closes with:** a surface-type field on the tab binding.

### G-18 - No sidebar scale binding

**Wanted:** sidebar zoom.
**Blocked by:** no scale value is exposed to a custom sidebar.
**Evidence:** issues #42 and #55.
**Closes with:** upstream cmux support; it cannot be implemented locally.

### G-19 - The sidebar has no durable state

**Wanted:** to remember which finished subagents the operator dismissed.
**Blocked by:** an interpreted sidebar can only rewrite the workspace description; it has no storage and no clock.
**Shipped:** dismissal round-trips through the description - the plugin reads back what is published, treats a finished agent it computed but that is no longer present as dismissed, and remembers that name in runtime state. Matching is by display name, so identically named agents are ambiguous.
**Closes with:** extension-owned storage, available to a compiled sidebar.

### G-20 - Authoring a Ghostty config suppresses cmux's managed appearance

**Wanted:** to set a terminal font without disturbing cmux's own chrome theming.
**Blocked by:** cmux applies its managed default appearance only while the user's Ghostty config is unauthored. Adding directives hands appearance resolution back to Ghostty defaults plus user settings, so window chrome can lose the theme while panes keep it.
**Evidence:** adding `font-family` and `font-size` to `~/.config/ghostty/config` left panes themed and chrome un-themed. cmux's own test `nonAppearanceConfigSuppressesManagedDefaultTheme` encodes the behaviour.
**Shipped:** not a Maestro defect; recorded because it is an easy trap when configuring fonts for the sidebar. cmux writes its managed block to `~/Library/Application Support/com.cmuxterm.app/config.ghostty`.

---

## Identity gaps

### G-21 - Session resolution fails closed on a shared working directory

**Wanted:** to always read the right Session's event log.
**Blocked by:** resolution tries `transcriptPath`, then `sessionId`, then a **unique** cwd match. When several Sessions report one cwd it refuses to choose.
**Evidence:** `/Users/dylan/git/atlas` is reported by **8** sessions. Refusing is correct - the older cwd-plus-newest-mtime guess bound the wrong Session in a live measurement (issue #33) - but the consequence is that derived attention is unavailable exactly where it is most needed, and stale stored attention wins by default.
**Shipped:** fail-closed resolution.
**Closes with:** a workspace-scoped or surface-scoped session identifier from the runtime.

### G-22 - A Session renders as a plain terminal until its first publish

**Wanted:** immediate identification of a Copilot surface.
**Blocked by:** identity is established only when Maestro first publishes an owner row, which can take about a minute.
**Evidence:** issue #54.
**Closes with:** G-17, which would remove the need to publish identity at all.
