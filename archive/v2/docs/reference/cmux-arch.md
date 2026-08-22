# cmux — Architecture Reference

**Evidence:** `manaflow-ai/cmux@main` (version `0.64.22`, 2026-08-03). The project ships on `main` with Sparkle auto-update and a nightly channel; no tagged release branch exists. Primary language: Swift (68.5 MB). Secondary languages: TypeScript, Rust (for `cmux-tui`), Go (for `cmuxd-remote`), Python, Shell. Analyzed read-only 2026-08-21.

Tags: **[V]** verified · **[I]** interpreted · **[U]** unknown.

---

## Scope and Orientation

cmux is a native macOS terminal multiplexer built on libghostty (the rendering core of the Ghostty terminal emulator), with a left sidebar of vertical workspace tabs and a notification and permission-approval surface layered on top. Its stated purpose is to give a single developer a manageable view of many parallel AI coding agent sessions. It does not orchestrate agents, create worktrees, or manage lifecycles; it provides a terminal and browser environment in which the user runs agents however they choose, then enriches the experience by capturing agent hook events and routing them into a notification panel and a sidebar approval surface (called Feed). This document is a descriptive record of the architecture as read in source and documentation. It does not propose adoption, redesign, or integration.

Files read: `README.md`, `CLAUDE.md`, `AGENTS.md`, `CHANGELOG.md` (first 100 lines), `TODO.md`, `PROJECTS.md` (selected), `docs/agent-hooks.md`, `docs/notifications.md`, `docs/feed.md`, `docs/events.md`, `docs/state-engine-design.md`, `docs/agent-session-tracking-spec.md`, `docs/remote-daemon-spec.md`, `docs/workspace-auto-naming.md`, `docs/workspace-groups.md`, `docs/configuration.md` (partial), `Sources/` directory listing (filtered), `Sources/AgentForkSupport.swift` (partial), `Sources/AgentHibernation/AgentHibernationLifecycleState.swift`, `Sources/AgentHibernation/AgentHibernationPanelPhase.swift`, `Sources/AgentHibernation/AgentHibernationResumePreparation.swift`, `Sources/RestorableAgentSession.swift` (partial), `Sources/CmuxLifecycleEventPublishing.swift`, `Sources/VaultAgentProcessScanner.swift` (partial), `CLI/CMUXCLI+Process.swift` (partial), `daemon/remote/README.md`. Files not read: individual Swift files in `Sources/` beyond those listed, `web/`, `ios/` source, `Packages/`, `skills/` beyond the index, `cmux-tui/`. Claims derived from unread paths are marked `[I]` or `[U]`.

---

## Observed Vocabulary [V]

Defined from `README.md`, `CLAUDE.md`, `docs/agent-hooks.md`, `docs/feed.md`, `docs/events.md`, and `docs/agent-session-tracking-spec.md` unless noted.

**workspace** — the primary organizational unit: a named entry in the sidebar, with its own set of panes, surfaces, working directory, git branch, and sidebar metadata · **surface** — one terminal, browser, markdown viewer, simulator, or other panel within a pane; each surface has a stable `surfaceId` (UUID, durable across relaunch as of commit `44dc053e`) · **pane** — a layout slot in the split grid within a workspace; holds one or more horizontal tab surfaces · **split** — a workspace layout with multiple panes, created by `Cmd+D` (right) or `Cmd+Shift+D` (down) · **workspace group** — an optional grouping of workspaces in the sidebar with a named header (the "anchor workspace") and a collapsible section; groups are cosmetic organization, not isolation · **Feed** — the right-sidebar approval surface (`Ctrl+4`); shows agent permission requests, plan-mode decisions, and question cards, with Allow/Deny/Always/Bypass controls; blocks the hook subprocess up to 120 seconds · **notification** — a sidebar badge and macOS banner triggered by OSC terminal sequences or `cmux notify` CLI; has an unread state, a jump shortcut (`Cmd+Shift+U`), and an in-app history ring · **hook** — a shell command or plugin invoked by an agent CLI at lifecycle events (turn end, tool use, stop, permission request); hooks forward events to the cmux socket via `cmux hooks feed --source <agent>` · **session** — a coding agent session, tracked by its agent-native session ID (e.g., `claude --resume <id>`); stored in `~/.cmuxterm/<agent>-hook-sessions.json`; distinct from a workspace · **cmuxd-remote** — a Go binary uploaded to a remote SSH host during `cmux ssh` bootstrap; provides PTY session persistence, proxy RPC, and a CLI relay over the reverse SSH forward · **hibernation** — the app-managed state where an idle background agent terminal has been sent `SIGTERM` and replaced with a lightweight placeholder; the session resumes when the tab is visited · **vault** — the set of detected live agent processes across all workspaces, scanned by `VaultAgentProcessScanner` using process-tree probes (`CmuxTopProcessSnapshot`) · **`CMUX_SURFACE_ID`** — a protected environment variable injected into every cmux terminal at spawn, used as the deterministic key for agent-session-to-surface binding · **workstream.jsonl** — the append-only Feed audit log at `~/.cmuxterm/workstream.jsonl`; distinct from the general event log at `~/.cmuxterm/events.jsonl`

---

## Vocabulary Mapping to Maestro [V/I]

| cmux term | cmux meaning | Nearest Maestro term | Relationship |
|---|---|---|---|
| **workspace** | A named sidebar tab with panes, surfaces, cwd, and git metadata | Fleet | **Structural near-miss, no isolation.** cmux workspace = organizational container. Maestro Fleet = isolated worktree + session unit with enforced branch ownership. |
| **session** ⚠️ | The agent-native session ID used for resume (`claude --resume <id>`) | Session | **Term collision.** cmux session = a resumable CLI session token stored on disk. Maestro Session = a live Copilot conversation with durable state. Both use the word for a resumable agent context, but Maestro's is richer and manages the process boundary. |
| **surface** | One panel (terminal, browser, etc.) within a workspace pane | — | No Maestro equivalent at this granularity. Closest: the single primary agent window that Maestro binds 1:1 to a Fleet. |
| **pane** | A layout slot in the split grid | — | Layout-only. No Maestro equivalent. |
| **workspace group** | Named collapsible grouping of workspaces in the sidebar | — | Purely cosmetic. No Maestro equivalent. |
| **Feed** | Right-sidebar approval surface; hooks block on it up to 120s | Attention surface | **Near-miss.** Feed is a structured approval panel; Maestro Attention is an observed state. cmux blocks the agent hook; Maestro surfaces an unmatched `permission.requested` event. |
| **notification** | Sidebar badge + macOS banner from OSC or `cmux notify` | Attention | **Partial.** Both signal "agent wants the human." cmux notification is transient; Maestro Attention is a durable state in the Fleet model. |
| **hibernation** | App-managed SIGTERM + resume for idle background agents | Parked/Interrupted | **False friend.** cmux hibernation is a resource optimization the app applies to a running agent; Maestro Parked/Interrupted are durable lifecycle states the human observes. |
| **hook** | Shell command injected into agent config; fires on lifecycle events | — | No Maestro equivalent. The closest thing is the `permission.requested` event consumer, but Maestro does not inject hooks into agent config files. |
| **cmuxd-remote** | Persistent Go daemon on a remote SSH host | — | No Maestro equivalent. Maestro is local-only in the current design. |
| **vault** | Live process scanner across all workspaces | Liveness | **Near-miss.** Both are computed at runtime, not persisted. cmux vault is a process-tree scan; Maestro Liveness is recomputed each launch from evidence. |
| **workstream.jsonl** | Append-only Feed audit log | — | No Maestro equivalent; closer to an event log than a state store. |

**Term collision summary.** `session` is the highest-risk collision: both systems use it for a resumable agent context, but at different abstraction levels. `notification` is a lesser collision: in cmux it is a transient display event; in Maestro it evokes the `permission.requested` event that triggers Attention.

---

## Architecture at a Glance [V/I]

```text
  macOS (local machine)
  ┌──────────────────────────────────────────────────────────────────┐
  │  cmux.app (Swift / AppKit / libghostty)                         │
  │                                                                  │
  │  ┌────────────┐  ┌─────────────────────────────────────────┐    │
  │  │  Sidebar   │  │  Workspace (selected)                   │    │
  │  │ (left)     │  │  ┌──────────────────┐ ┌──────────────┐ │    │
  │  │ workspace1 │  │  │ Pane (terminal)  │ │ Pane (split) │ │    │
  │  │ workspace2 │  │  │ ┌──────────────┐ │ │              │ │    │
  │  │ workspace3 │  │  │ │ Surface:     │ │ │  Surface:    │ │    │
  │  │ ...        │  │  │ │ GhosttyTerm  │ │ │  WKWebView   │ │    │
  │  │            │  │  │ │  (libghostty)│ │ │  (browser)   │ │    │
  │  │            │  │  │ └──────────────┘ │ └──────────────┘ │    │
  │  └──────┬─────┘  │  └──────────────────┘                  │    │
  │         │        └─────────────────────────────────────────┘    │
  │         │                                                        │
  │  ┌──────▼─────────────────────────────────────────────────┐     │
  │  │  Right Sidebar                                          │     │
  │  │  Feed panel (Ctrl+4):                                   │     │
  │  │    permission cards → Allow/Deny/Always/Bypass          │     │
  │  │    plan-mode cards  → Ultraplan/Manual/Auto             │     │
  │  │    question cards   → multi-choice Submit               │     │
  │  └──────────────────────────────────────────────────────┬─┘     │
  │                                                          │       │
  │  ┌──────────────────────────────────────────────────────┘       │
  │  │  cmux Unix socket  (~/.config/cmux/cmux.sock)                │
  │  │    v1 text API + v2 JSON-RPC                                  │
  │  │    events.stream (reconnectable JSONL stream)                 │
  │  │    feed.push / feed.permission.reply                          │
  │  └──────────────────────┬───────────────────────────────────    │
  │                          │  CMUX_SOCKET_PATH env var            │
  └──────────────────────────┼──────────────────────────────────────┘
                             │
           ┌─────────────────▼──────────────────────┐
           │  Agent CLI process (in terminal)        │
           │  e.g., claude / codex / grok / opencode │
           │  (ordinary PTY child of Ghostty)        │
           │                                         │
           │  Hook fires (per lifecycle event):      │
           │    cmux hooks feed --source claude      │
           │    → reads CMUX_SOCKET_PATH env var     │
           │    → sends feed.push to socket          │
           │    → blocks (up to 120s) for reply      │
           └─────────────────────────────────────────┘

  SSH remote host (optional)
  ┌──────────────────────────────────────────────────────────────┐
  │  cmuxd-remote (Go binary, bootstrapped by cmux ssh)         │
  │    serve --stdio --persistent --slot <slot>                  │
  │    ← SSH exec channel (stdio proxy) ←                       │
  │                                                              │
  │  Persistent PTY daemon:                                      │
  │    ~/.cmux/daemon/<version>/<slot>/  (auth, lock, log)       │
  │    /tmp/cmuxd-remote-<uid>/*.sock   (per-user Unix socket)   │
  │    PTY sessions survive workspace close + app relaunch       │
  │                                                              │
  │  CLI relay:                                                  │
  │    ssh -N -R 127.0.0.1:PORT:127.0.0.1:LOCAL_RELAY_PORT      │
  │    cmux wrapper (argv[0] busybox) → CLI relay → socket       │
  └──────────────────────────────────────────────────────────────┘

  Durable local state
  ┌───────────────────────────────────────────────────┐
  │  ~/.cmuxterm/                                     │
  │    <agent>-hook-sessions.json  (session restore)  │
  │    workstream.jsonl            (Feed audit)        │
  │    events.jsonl / events.jsonl.1 (event log)      │
  │  ~/.config/cmux/cmux.json      (user config)      │
  │  Session snapshot              (workspace layout)  │
  └───────────────────────────────────────────────────┘
```

---

## 1. What Is cmux Actually For? [V]

cmux is a native macOS terminal emulator designed for developers who run many AI coding agent sessions in parallel. Its differentiating additions over a plain terminal are: a left sidebar with vertical workspace tabs that each display the git branch, linked pull request status, working directory, listening ports, and latest notification text for that workspace; a notification system that captures OSC escape sequences (OSC 9/99/777) and `cmux notify` CLI calls from agent hook scripts and routes them to a right-side notification panel and macOS banners; a "Feed" right-sidebar panel that intercepts agent permission requests, plan-mode decisions, and multiple-choice questions from hook-integrated agents and lets the user approve or deny them without leaving the app; and an in-app WKWebView browser pane that agents can interact with programmatically. The target user is someone running Claude Code, Codex, Grok, or any of 16 supported agents across many terminal sessions simultaneously and needing to know which one wants attention and what it wants to do. cmux is explicit that it is "a primitive, not a solution" (`README.md:§The Zen of cmux`) and does not prescribe any particular agent workflow.

---

## 2. Unit of Work [V]

The organizing unit is the **workspace** — a named sidebar row that bundles a working directory, one or more pane splits, one or more surfaces per pane, and sidebar metadata (git branch, PR link, ports, notification state, agent lifecycle). Workspaces are not bound to any particular agent, session, branch, or directory. Multiple workspaces may share the same working directory. There is no concept analogous to Maestro's Fleet: no branch ownership, no worktree, no process lifecycle boundary, no enforced isolation. Workspaces can be nested into **workspace groups** (`docs/workspace-groups.md`) — named collapsible sections in the sidebar — but groups are cosmetic and impose no functional isolation either.

The nearest functional analogue to a Fleet inside cmux is the combination of a workspace + an agent session stored in `~/.cmuxterm/<agent>-hook-sessions.json`. That combination gives a workspace a resumable agent session, git metadata, and a notification history. But this is advisory state, not a structural contract: the workspace and the session are separate entities that are correlated by the hook install, not constructed together.

---

## 3. Isolation Model [V/I]

cmux imposes no isolation. It is a terminal emulator. Workspaces share whatever working directories, git checkouts, files, and processes the user puts in them. No worktrees are created or managed. No containers or devcontainers. No VMs. The only isolation that exists is what the user creates manually in their shell: if the user runs `cd` into different directories in different workspace terminals, those are simply different shell processes with different working directories, no different from any other terminal.

The `VaultAgentProcessScanner` (`Sources/VaultAgentProcessScanner.swift`) scans live processes to identify which workspace a given agent process belongs to (`cmuxScopedProcessIDsByPanelKey()` via process-tree probing), but this is read-only observation for lifecycle display, not an isolation boundary.

**Advisory vs. enforced.** Nothing in cmux prevents two workspaces from pointing at the same git checkout, running the same agent, or writing to the same files simultaneously. The documentation does not describe this as a concern because cmux explicitly does not own agent processes.

---

## 4. Process and Lifecycle Ownership [V] — The Critical Question

**How agents are spawned.** Agents run as ordinary interactive processes in Ghostty PTY sessions. The user types `claude`, `codex`, `opencode`, or any other agent CLI in a terminal surface; Ghostty launches it as a child process in the same way any shell command is launched. cmux does not spawn agents directly. The `AgentForkSupport.swift` (`Sources/AgentForkSupport.swift`) machinery handles one special case: resuming an existing agent session with `claude --resume <id>` (or the agent-specific equivalent) on app relaunch or tab hibernation wake-up. "Forking" in cmux means resuming a prior session, not creating an isolated copy.

**Attached or detached.** All agents are attached: they are children of the Ghostty PTY, which is owned by the cmux app process. When the terminal surface is closed, the PTY sends HUP to its child process group. Whether the agent exits depends on the shell and the agent's own signal handling — cmux makes no guarantee and performs no explicit cleanup. `AGENTS.md` (the developer build guide) does not describe a `SIGTERM` sweep or process-group reaping on app quit. `CLAUDE.md` describes process isolation for *development builds* (tagged builds using separate sockets and derived data paths) but not for agent process cleanup.

**On application quit.** cmux shows a confirmation dialog before quit (configurable: `always`/`dirty-only`/`never`, `docs/configuration.md`). After the user confirms, the app exits. Ghostty PTYs are closed, sending HUP to their foreground process groups. Agents that ignore HUP or are backgrounded survive as orphans. cmux does not track process groups by IDs persisted to disk, does not sweep remaining processes, and does not verify zero surviving agent processes after quit. This is a structural property of the terminal-emulator model, not a bug the project acknowledges — but it means the herdr class of bug (agents surviving app exit) is possible whenever an agent sets `nohup`, runs in a background process group, or is configured to ignore SIGHUP.

**Agent hibernation: the one explicit kill path.** Agent hibernation (`docs/agent-hooks.md:§Agent Hibernation`) is the sole deliberate process termination mechanism. When more than `maxLiveTerminals` (default 12) restorable agent terminals are live, the app sends `SIGTERM` to the agent's process group (scoped to that workspace and surface) for the oldest-idle background terminal. Before signaling, cmux samples the last lines of output and a process fingerprint, then waits a confirmation window (`confirmationSeconds`, ~60s) during which output and PID must stay unchanged — any new activity cancels the pending kill. The session resume command (`claude --resume <id>`) is queued and runs when the tab is visited again. The lifecycle states that gate hibernation are `running`, `idle`, `needsInput`, and `unknown` (`AgentHibernationLifecycleState.swift`); only `idle` permits hibernation. These states are reported exclusively through hooks — if hooks are not installed, the lifecycle is `unknown` and hibernation is not applied. Hibernation can also run under critical macOS memory pressure, independently of the live-terminal limit and the enabled setting.

**Remote daemon: the persistent process.** The remote SSH workspace path (`cmux ssh`) bootstraps a Go binary (`cmuxd-remote`) on the remote host. This binary runs as `serve --stdio --persistent --slot <slot>` through an SSH exec channel, but the `--persistent` flag means the long-lived daemon continues running in `~/.cmux/daemon/<version>/<slot>/` even after the SSH exec channel closes (`daemon/remote/README.md`). Its PTY sessions survive workspace close and app relaunch explicitly by design: "If the local surface closes, the stdio proxy disconnects and its attachment detaches, but the PTY process and bounded scrollback remain in the daemon." Cleanup requires sending an authenticated per-slot shutdown to the persistent daemon, then waiting a bounded interval for the daemon lock to release. As a passive failsafe, the daemon retires when "the observed lease disappears and both stdio connections and live PTY sessions are empty." This passive reaping has an explicit race: if the app crashes without sending the shutdown, or if the lease file is cleaned up before the daemon checks it, the daemon may persist indefinitely on the remote host. cmux mitigates this by cleaning up "orphaned relay SSH processes from previous app sessions" at next `cmux ssh` launch, but this addresses the relay process, not the PTY daemon itself. The daemon's own safety is the passive lease-disappearance check, not a positive reaping step.

**Lifecycle visibility summary.** cmux tracks agent lifecycle as `running`, `idle`, `needsInput`, or `unknown` (`AgentHibernationLifecycleState.swift`). This is reported by hooks and is ephemeral: not persisted across restarts, recomputed from hook events after launch. A secondary path (`VaultAgentProcessScanner`) scans the live process tree to detect agents that are running but have not been registered via hooks, used for the "vault" index display. Neither path persists lifecycle state to disk — liveness is observed evidence, consistent with Maestro's design intent. However, if hook delivery fails, cmux falls back to `unknown` and cannot distinguish a dead agent from one that simply has not reported in.

---

## 5. Coding Agent Support and Integration Seam [V]

**Supported agents.** `docs/agent-hooks.md` lists 16 agents: Claude Code, Codex, Grok, OpenCode, Pi, OMP, Campfire, Amp, Cursor CLI, Gemini, Kiro CLI, Rovo Dev, Copilot, CodeBuddy, Factory, Qoder, and Kimi Code. Campfire ships with a built-in cmux bridge. Claude Code is wrapped by a `cmux-claude-wrapper` that injects settings via `--settings`.

**Integration seam.** Hooks are shell commands or plugins installed into each agent's config directory by `cmux hooks setup`. They fire at lifecycle events and call `cmux hooks feed --source <agent>` (or equivalent), which connects to the cmux Unix socket and sends a `feed.push` v2 JSON-RPC frame. The hook process blocks on stdin/stdout, waiting for a `feed.permission.reply` or similar decision. The seam is agent-specific:

| Agent | Hook mechanism | Feed trigger |
|---|---|---|
| Claude Code | cmux wrapper-injected settings; `--settings` on launch | `PermissionRequest` PostToolUse |
| Codex | `~/.codex/hooks.json`; shell hook scripts | `PreToolUse` (non-blocking telemetry), app-server path for approval |
| Grok | `~/.grok/hooks/cmux-session.json` | `PreToolUse` |
| OpenCode | Plugin file `~/.config/opencode/plugins/cmux-feed.js` | Plugin event bus |
| Copilot | `~/.copilot/config.json`; hook commands | `PreToolUse`; `agentStop` for notification |
| Others | Agent-specific config files | Varies; some lifecycle-only |

Agents are driven entirely by the user in the terminal. cmux does not send prompts, control agent turns, or read output programmatically. The only automated agent action cmux takes is running the resume command (`claude --resume <id>`) on session restore or hibernation wake-up, and running a summarization pass for workspace auto-naming (`docs/workspace-auto-naming.md`). The auto-naming pass runs the agent's own CLI in headless/non-interactive mode (`claude -p`, `codex exec`, etc.) — it is not a novel agent invocation but a thin read-only query against the agent's own transcript.

**Session restore seam.** `~/.cmuxterm/<agent>-hook-sessions.json` stores per-surface session records: agent session ID, workspace ID, surface ID, cwd, PID when available, lifecycle state, and a sanitized launch command (`docs/agent-hooks.md:§What the hooks record`). On app relaunch, cmux reads this file, rebuilds each workspace, and runs the agent's resume command. The sanitizer drops prompts, credentials, and noninteractive flags. Surface ID (`CMUX_SURFACE_ID`) is the binding key and is now preserved across relaunch (`docs/agent-session-tracking-spec.md:§Identity and the binding key`, commit `44dc053e`).

---

## 6. Multi-Agent Model [V]

cmux supports many simultaneous agent sessions, one per workspace (or per split surface within a workspace). Agents are completely independent: they share no context, no state, no coordination. The user is the only integration point. Notifications from multiple agents appear in the shared notification panel, ordered chronologically; the user jumps to the most recent unread with `Cmd+Shift+U`.

**Claude Teams.** `cmux claude-teams` launches Claude Code's "teammate mode," where Claude spawns sub-agents as new pane splits in the same workspace (`README.md:§Claude Code Teams`). These appear as native split panes with sidebar metadata and notifications. cmux routes subagent completion events through the same notification system as the primary agent, but suppresses subagent turn-completion notifications by default (`automation.suppressSubagentNotifications`, on by default) to reduce noise. Whether subagents' permission requests surface in Feed depends on hook delivery, which operates at the process level — each Claude subprocess inherits `CMUX_SURFACE_ID` from the parent PTY environment, so their hooks bind to the same surface.

**No parallel-evaluate model.** cmux does not run multiple agents on the same task and compare results. Each workspace is independent. There is no mechanism for coordinating cross-workspace state.

---

## 7. UI Architecture [V]

**Stack.** Native macOS Swift/AppKit. libghostty (the library build of Ghostty) for GPU-accelerated terminal rendering. WKWebView for browser panes. SwiftUI layered on top of AppKit for panels and sidebar. The project is not Electron or Tauri. Startup is fast; memory footprint is low relative to web-based wrappers (`README.md:§Why cmux?`).

**Layout model.** Three-zone layout: left sidebar, center workspace area, optional right sidebar.

- **Left sidebar** — vertical list of workspace tabs. Each row shows: workspace name, git branch, linked PR number and status, current working directory, listening ports, agent lifecycle indicator, and latest notification text. Workspace groups appear as collapsible sections. Workspaces can be reordered by drag-and-drop, pinned, and grouped.
- **Center workspace area** — a pane-split grid (`bonsplit` vendor library). Each pane holds one or more horizontal tab surfaces. Surfaces can be terminal (libghostty), browser (WKWebView), markdown viewer, file preview, simulator, agent session chat view, or project panels. Splits are created with `Cmd+D` / `Cmd+Shift+D` and navigated with `Option+Cmd+arrows`.
- **Right sidebar** — the Feed panel (`Ctrl+4`). Shows permission requests, plan-mode cards, and question cards in a latest-first timeline. Also accessible as a separate Dock-style window via `cmux feed tui` (an OpenTUI terminal UI). A second right-sidebar mode exists for custom sidebars written in a subset of SwiftUI DSL.

**Selection model.** Selecting a workspace in the left sidebar rescopes the center area to that workspace's pane layout and surfaces. All panels — notifications, Feed, sidebar metadata — reflect the selected workspace's state. This is close to Maestro's model of global-selection rescoping every panel. The key difference: cmux's selection is orthogonal to agent sessions. Selecting workspace 3 rescopes the terminal and browser panels, but the notification panel is global (all workspaces' notifications appear in the same panel ordered by time) rather than workspace-scoped.

**Notification visual.** When an agent needs input, its pane gets a blue ring and its sidebar tab lights up. `Cmd+Shift+U` jumps to the most recent unread notification's workspace and surface. A macOS banner fires if the window is not focused. These signals are purely visual and transient: there is no durable "needs human" state in the model; the notification ring clears when the workspace is visited or the notification is marked read.

---

## 8. State and Persistence [V]

**Durable state** (survives app restart):

| Path | Contents | Owner |
|---|---|---|
| Session snapshot | Workspace layout, surface IDs, workspace groups, dock state | App (auto-saved) |
| `~/.cmuxterm/<agent>-hook-sessions.json` | Agent session ID → workspace/surface/cwd/lifecycle/launch command map | Hooks |
| `~/.cmuxterm/workstream.jsonl` | Append-only Feed audit log (all events, actionable and telemetry) | Feed |
| `~/.cmuxterm/events.jsonl` (rotated) | Event stream JSONL, last 16 MiB | Events |
| `~/.config/cmux/cmux.json` | User preferences | App |
| `~/.config/cmux/cmux.sock` | Unix socket (ephemeral per-run, but at a stable path) | App |
| `~/.cmux/daemon/<version>/<slot>/` | Remote daemon auth, lock, logs (per remote workspace slot) | cmuxd-remote |

**Ephemeral state** (not persisted):

- Agent lifecycle (`running`/`idle`/`needsInput`/`unknown`) — reported by hooks, held in memory
- Process identity (PID, process tree) — scanned by `VaultAgentProcessScanner` at runtime
- Notification text content — stored in the notification feed history ring (memory; bounded at 2,000 items for Feed, additional JSONL on disk for audit)
- In-memory event replay buffer (4,096 events, bounded)

**On the Liveness question.** cmux correctly treats agent liveness as observed evidence, not persisted state. `VaultAgentProcessScanner` computes vault membership each run from a live process-tree snapshot (`CmuxTopProcessSnapshot.capture`). `AgentHibernationLifecycleState` holds `running`/`idle`/`needsInput`/`unknown` in memory, derived from hooks, and is not serialized. The session restore file stores the *last reported* lifecycle value (`docs/agent-hooks.md`), but this is used for display in the restored session index, not as an authoritative liveness claim. The session-tracking spec explicitly rejects heuristic fallbacks (title matching, mtime scanning) in favor of env-token binding (`docs/agent-session-tracking-spec.md:§Principles`). This is a deliberate and correct design choice; cmux does not commit the Liveness-as-persisted-state mistake Maestro is trying to avoid.

**One risk.** The hook session store records the last lifecycle value at hook time. If an agent dies between its last hook event and the next app launch, the restored session will show `idle` (the last reported state) rather than `dead`. cmux addresses this by checking `AgentResumeLiveness` before attempting to resume (`Sources/AgentResumeLiveness.swift` — full content not read [U]). Whether that liveness check is process-based (PID existence) or session-based (agent CLI query) is not confirmed.

---

## 9. Permissions and Approvals [V]

**Feed architecture.** Feed is the complete answer to how cmux handles agent permission requests. The mechanism is described precisely in `docs/feed.md`:

```
Agent CLI → hook fires → cmux hooks feed --source <agent>
         → feed.push (v2 socket) → FeedCoordinator parks on semaphore (keyed by request_id, up to 120s)
         → WorkstreamStore records event → FeedPanelView shows card
         → (optionally) UNUserNotification with inline action buttons
         → User clicks Allow/Deny/Always/Bypass/Submit
         → feed.permission.reply / feed.question.reply delivered
         → FeedCoordinator wakes hook → hook emits decision JSON on stdout → agent proceeds
```

**Soft timeout.** The hook waits at most 120 seconds. On timeout, the bridge emits `{}` (no decision) and the agent falls through to its native TUI. This prevents indefinite blocking. `docs/feed.md:§Timeout behavior` calls this "the soft wait model." Feed is "advisory, not blocking" — the 120-second gate is a user-experience timeout, not a security boundary.

**Permission modes.** Once / Always / All tools / Bypass / Deny. For Claude Code, "Always" applies the agent's suggested persistent permission rule. "Bypass" requests `setMode: bypassPermissions` for the session. The cmux Claude wrapper launches Claude with `--allow-dangerously-skip-permissions` to make the Bypass mode functional — without that flag, Claude ignores the `bypassPermissions` request.

**"Needs your attention" concept.** cmux has an implicit attention signal: a pane gets a blue ring, its sidebar tab lights up, and the notification jump shortcut routes to it. This corresponds to any notification delivery where the workspace is not focused — agent hook completions, permission requests, errors. There is no explicit durable state called "attention" or "needs input" in the model; the notification ring and Feed card together constitute the functional equivalent. The `notification.requested` event in the event stream allows external tooling to observe this signal (`docs/events.md`).

**No mediation for non-hooked agents.** If an agent is running in a cmux terminal without hooks installed, cmux has no visibility into its permission requests. The agent's native TUI handles everything. cmux's approval system depends entirely on hook installation. `cmux hooks setup` is a voluntary user-run step, not automatic.

---

## 10. What Is Genuinely Novel or Clever [V/I]

**Feed as a blocking hook bridge.** The pattern of parking an agent hook subprocess on a semaphore while the user interacts with a sidebar approval card, then waking it with a typed decision, is clean and agent-agnostic. The 120-second soft timeout that falls through to the agent's native TUI rather than hanging the agent or returning a hard denial is a practical design that degrades gracefully. `docs/feed.md` documents this as intentional: "Feed never blocks the agent longer than 120 seconds." The mechanism is reproducible at any seam where an agent exposes hook callbacks.

**Agent hibernation as a memory management strategy.** The deliberate SIGTERM + session-resume cycle for idle background agents is a concrete answer to the question "how do you run 20 agents without running out of RAM?" The confirmation window (~60 seconds of output + PID stability check) before signaling is a safe guard that prevents killing an agent that just started a new turn. This is an opt-in feature (default: 12-terminal limit, 5-second idle window), not a default behavior, which is appropriate given the potential for data loss if a session is non-resumable.

**Surface ID durability across relaunch.** Preserving the `CMUX_SURFACE_ID` UUID verbatim across app restart so that agent-session-to-surface bindings survive relaunch is a nontrivial correctness property. The spec (`docs/agent-session-tracking-spec.md`) documents that this was not always the case (workspace IDs still regenerate on restore) and that a targeted fix was required (commit `44dc053e`). The explicit audit of all agent start paths against the surface-token inheritance chain (env injection at spawn, tty→surface mapping, process-tree fallback) is unusually rigorous for a feature of this kind.

**Notification hook pipeline.** The configurable JSON stdin/stdout hook chain for every notification event (`docs/notifications.md:§Notification Hooks`) — which can filter or transform delivery effects (desktop banner, sound, pane flash, sidebar record) before they fire — is a clean programmability seam. The `agent` context object on each hook payload (`kind`, `category`, `pending`, `isSubagent`) makes it possible to build per-agent or per-category delivery policies entirely in shell script.

**cmuxd-remote CLI relay.** The reverse SSH forward that makes `cmux` commands work on the remote host (`ssh -N -R …`) with per-session HMAC-SHA256 authentication is a practical solution to the problem of running `cmux workspace` commands from inside a remote terminal without exposing the local socket directly. This is an infrastructure-grade detail for a product that markets itself as a terminal, not an orchestration platform.

**Subagent notification suppression.** The default-on `automation.suppressSubagentNotifications` setting suppresses completion notifications from nested subagent sessions while letting the top-level agent's signals through. The `isSubagent: true` field in the notification hook context (`docs/notifications.md:§Agent-event context`) makes this filterable per-hook. This reduces notification noise in Claude Teams and similar multi-agent setups without requiring the user to configure anything.

---

## 11. Deliberate Product Disagreements with Maestro [V/I]

**Anti-prescriptive philosophy.** cmux's stated design philosophy is explicit and direct: "cmux is not prescriptive about how developers hold their tools. It's a terminal and browser with a CLI, and the rest is up to you." (`README.md:§The Zen of cmux`) "cmux is a primitive, not a solution." This is a deliberate product choice, not a gap. Maestro is prescriptive: Fleet isolation, worktree-per-Fleet, branch-per-Fleet, lifecycle state machine, and process ownership are structural rules that Maestro enforces. cmux enforces nothing — that is its value proposition to users who find orchestrators confining.

**No isolation.** cmux makes no attempt to isolate workspaces from each other. Two workspaces can share a git checkout, share a running process, and write to the same files simultaneously. From cmux's perspective this is correct: the user chose to put two agents in the same directory, and that is their business. From Maestro's perspective this is a source of conflict, merge confusion, and cross-Fleet contamination. These are not compatible views of the problem; they reflect different models of how parallel agent work should be organized.

**No lifecycle state machine.** cmux has no concept of Parked, Interrupted, Alive, Dead, or Ambiguous in its model. Agent lifecycle has four states (`running`/`idle`/`needsInput`/`unknown`), all derived from hooks at runtime, all ephemeral. There is no durable distinction between a deliberate stop and an unintentional interruption. The user manages their agents; cmux observes and notifies. Maestro's lifecycle states are durable and meaningful across restarts; cmux's are transient signals.

**No worktree or branch ownership.** cmux creates no git state. The sidebar shows the current git branch of the workspace's working directory as read-only metadata (via a background poll). It does not create branches, does not prevent two workspaces from being on the same branch, and does not track which workspace owns which branch. Maestro's worktree-per-Fleet is a hard rule because git forbids two worktrees on one branch; cmux doesn't enter the git layer at all.

**Agents are users' processes, not the app's.** cmux treats agent processes as belonging to the user, not to the app. They start when the user types a command in a terminal and end when that process exits. cmux observes them via process scanning and hook events. It does not own them, does not clean them up on exit, and does not guarantee their lifecycle. Maestro's defining requirement is process ownership: no process may outlive the application. This is the sharpest philosophical divergence between the two systems.

**Global notification panel vs. Fleet-scoped panels.** cmux's notification panel is global across all workspaces — notifications from all agents appear in one chronological list. Maestro's model is that selecting a Fleet rescopes every panel to that Fleet. These are not compatible; cmux's model is appropriate for a user who wants a unified inbox, while Maestro's is appropriate for a user who wants each Fleet to be a fully independent context.

---

## 12. What They Got Wrong, or What Is Fragile [V/I]

**Remote daemon orphan risk.** The `cmuxd-remote` persistent daemon is structurally analogous to the herdr orphan-daemon problem, scoped to remote SSH hosts. The daemon is designed to survive workspace close and app relaunch — that is its purpose — and cleanup requires an authenticated per-slot shutdown message. If the cmux app crashes without sending that message, the daemon persists. The passive failsafe (retire when the relay lease disappears and no PTY sessions or stdio connections are active) depends on the lease file being present and stable, which is not guaranteed if the relay SSH process was killed or if the host rebooted. `docs/remote-daemon-spec.md` documents that orphaned relay SSH processes from *previous app sessions* are cleaned up at next `cmux ssh` launch — but this reaps the relay, not the PTY daemon itself. The PTY daemon retires passively only when both the lease disappears and PTY sessions and stdio connections are empty. An agent session still running in the daemon keeps it alive indefinitely. On a remote host the user cannot easily inspect this state; there is no `ps`-against-recorded-pgid equivalent.

**App quit does not sweep local agent processes.** When cmux quits, agents running in Ghostty PTY sessions are not explicitly killed. The PTY close sends HUP, but agents that run with `nohup`, that are backgrounded in the shell, or that override signal handling can survive. There is no process-group recording, no post-quit verification, and no equivalent of Maestro's "zero surviving processes on quit, checked with `ps` against recorded process-group identifiers." For a terminal emulator this is an expected behavior; for a product that claims to manage parallel agent sessions, it is a gap that users who rely on session restore may encounter as stale or conflicting processes on next launch. The cmux restart path runs the session resume command (`claude --resume <id>`) without verifying whether the prior agent process is still alive.

**Workspace ID volatility as a latent correctness hazard.** `docs/agent-session-tracking-spec.md` documents that workspace IDs are regenerated on every session restore because the restore path creates new objects via standard initializers. Only surface IDs were recently special-cased to be preserved (commit `44dc053e`). Any component that keys on workspace ID across restarts is silently broken, and the spec notes that this was causing agent-session binding failures (`AgentChatSessionRegistry.refreshBindingsFromHookStore`). The fix was targeted and recent; other code paths that store or compare workspace IDs may still be affected.

**Hook-only lifecycle visibility.** If hooks are not installed for an agent, cmux has no visibility into its lifecycle: state is `unknown`, hibernation does not apply, Feed receives no events, session restore does not record a session ID, and the sidebar shows no agent indicator. `VaultAgentProcessScanner` provides a fallback by scanning the process tree, but this path is explicitly described as secondary and heuristic-prone (`docs/agent-session-tracking-spec.md:§Phase 1 audit findings` — the spec was written to *remove* heuristic fallbacks, not promote them). For Copilot specifically, the hook configuration is manual (`~/.copilot/config.json`), not automatic, and the `TODO.md` lists Codex and OpenCode integration as still incomplete despite appearing in the hooks table. There is a gap between what the hooks table documents and what `cmux hooks setup` actually installs reliably.

**Feed timeout creates a trust ambiguity for "Always."** When a user clicks "Always" on a Feed card, cmux sends `setMode: bypassPermissions` (for Claude) or applies the agent's suggested persistent permission rule. This persistent grant is stored in the agent's own config (e.g., Claude's settings), not in cmux. If a later session runs in a workspace without cmux's hook infrastructure (or outside cmux entirely), the persistent grant is still in effect. The user may not realize that "Always" in the cmux Feed wrote a permanent rule to the agent's configuration file. The semantics of "Always" are agent-native, not cmux-native; cmux is a pass-through.

**SwiftUI list boundary CPU spin.** `CLAUDE.md:§Pitfalls` documents a known risk specific to cmux's architecture: no view below a `LazyVStack`/`LazyHStack`/`List`/`ForEach` boundary may hold an observable store reference, and no function called from `body` may write state. Violating either reintroduces a 100% CPU spin loop (issue #2586). The fix pattern (`IndexSectionActions` / `SectionGapActions` / `SessionSearchFn`) exists but must be applied manually to every new component. This is a structural fragility in the SwiftUI + AppKit hybrid that requires persistent developer discipline to avoid.

---

## Modules and Responsibilities [V/I]

| Path | Role |
|---|---|
| `Sources/` | Main Swift application; AppKit + SwiftUI UI, libghostty integration, workspace/session management, notification system, Feed coordinator |
| `CLI/` | CLI commands bundled into the app binary; `CMUXCLI+*` files handle agent hooks, session management, SSH, browser automation, Feed |
| `daemon/remote/` | Go source for `cmuxd-remote`; PTY persistence, proxy RPC, CLI relay |
| `cmux-tui/` | Rust/Zig TUI variant (separate build, Linux remote target); not analyzed |
| `agent-chat/` | iOS/Mac agent session chat view source [U] |
| `cmux-browser/` | In-app browser automation ported from `vercel-labs/agent-browser` |
| `ios/` | iOS companion app (Swift); remote terminal + notification feed [U] |
| `web/` | TypeScript/Next.js web components (backend billing, cloud VM) [U] |
| `Packages/` | Swift Package Manager packages, organized by `{Shared,iOS,macOS}/<pkg>` |
| `services/iroh-relay-minter/` | Iroh relay credential minter (cloud VM connectivity) [U] |
| `docs/` | Implementation specs, design docs, living specs |
| `skills/` | Contributor rules per feature area (akin to CLAUDE.md extensions) |
| `scripts/` | Build tooling, reload scripts, fleet management, test runners |
| `tests/` and `tests_v2/` | Python e2e tests run against a debug socket; v1 and v2 API suites |
| `config/` | Default and reference configuration files [U] |
| `ghostty` (submodule) | libghostty; the terminal rendering core; built as GhosttyKit.xcframework |

---

## Architecture Summary and What This Means for Maestro [V/I]

cmux and Maestro share one structural insight — the sidebar-selected-unit rescopes the main view — and diverge on every requirement below it. cmux is a terminal emulator that layers notifications and approval routing on top; it does not own agents, does not isolate workspaces, does not maintain lifecycle state, and explicitly positions these absences as features, not gaps. Maestro is a lifecycle-ownership orchestrator; it positions process ownership and worktree isolation as hard invariants that exist precisely because of what happens when they are absent (the herdr daemon).

**For the stack evaluation.** cmux demonstrates that Swift/AppKit + libghostty is a viable and fast path for a native macOS terminal application that integrates with 16+ coding agents. Its build system, test infrastructure (Python e2e over a debug socket), and tagged-build development workflow (`scripts/reload.sh --tag <branch-slug>`) are more mature than they appear from the outside. If Maestro builds on the native macOS Swift stack, cmux's architecture is the closest prior art for the terminal rendering layer specifically.

**For the Feed mechanism.** The blocking hook bridge (hook subprocess parks on semaphore, user acts in sidebar, decision wakes the hook) is a solved problem as of cmux's implementation. Maestro's `permission.requested` → Attention → approval loop is conceptually the same interaction; cmux's implementation is a concrete reference for the approval protocol design. The 120-second soft timeout and the fallback-to-native-TUI behavior are directly applicable.

**For agent hibernation.** SIGTERM to a process group scoped to a surface, with a pre-kill output-stability confirmation window, is an appropriate mechanism for a resource management feature. Maestro's Parked state is conceptually different (deliberate human action, not automatic resource management), but the implementation mechanics (signal, wait, resume via CLI) are reusable.

**For the herdr class of bug.** cmux does not solve the local-agent orphan problem: agents in local terminal surfaces are not swept on app quit. For remote SSH workspaces, cmux has a daemon that is explicitly designed to outlive the app (by design, unlike herdr's unintentional survival), with a shutdown protocol that is correct when executed but fragile when the app crashes. Maestro's requirement — zero surviving processes on quit, verified by `ps` against recorded process-group identifiers — has no equivalent in cmux. This is the sharpest gap between the two systems' safety models.

---

## Configuration Surface — How Far Can We Get Without Forking? [V, from published documentation]

Added after the initial analysis, on the operator's observation that *"CMUX has very rich configuration"*. Sources: [`cmux.com/docs/configuration`](https://cmux.com/docs/configuration) and [`cmux.com/docs/custom-commands`](https://cmux.com/docs/custom-commands), read 2026-08-21. This section asks one question: **how much of the Maestro MVP is reachable by configuring cmux, with no fork?**

The answer is: **more than expected, and the gap that remains is exactly the reason Maestro exists.**

### What configuration already reaches

**Terminal config is Ghostty's.** cmux reads `~/.config/ghostty/config` directly. App-owned settings live in `~/.config/cmux/cmux.json`, with a published JSON schema, comments and trailing commas allowed, hot reload via `cmux reload-config`, and a **project-local `.cmux/cmux.json`** that overrides actions, commands, UI wiring, and notification hooks.

**Worktree-per-workspace is a documented example, not a workaround.** The custom-commands page ships a worked example named **"Worktree Agents"**, bound to the plus button, whose setup terminal runs:

```sh
repo=$(git rev-parse --show-toplevel); mkdir -p "$repo/../worktrees"
slug=agents-$(date +%Y%m%d-%H%M%S); dir="$repo/../worktrees/$slug"
git -C "$repo" worktree add -b "$slug" "$dir"
```

It then starts Codex and Claude in sibling panes, each waiting on a workspace-scoped state file before `cd`-ing into the new worktree. This is close to a Fleet: one workspace, one fresh worktree, one new branch, agents started inside it.

**Attention is already implemented, and better than Warp's.** Three separate notification settings map onto our predicate:

- `notifications.agentPermissionPrompt` — *"Notify when an agent (e.g. Claude Code) is blocked waiting for your permission to run a tool. **On by default, since this is the alert you must act on to unblock the agent.**"*
- `notifications.agentIdleReminder` — fires ~60s after a turn ends, and is *"suppressed while background work from the last turn is still pending, so a running build or watcher does not trigger a false waiting alert."*
- `notifications.agentTurnComplete: whenIdle` — *"suppresses the notification while the agent still has a running background task or a pending scheduled wakeup, so you are pinged once work truly drains."*

The suppression logic is a refinement we had not designed: it distinguishes *waiting for a human* from *still working*, which is the exact failure Warp shipped in issue #14730. **cmux got right, in production, the thing Warp got wrong.**

**`notifications.hooks` is a real extension point** — *"Composable shell hooks that receive notification policy JSON on stdin and return updated policy JSON on stdout"* — plus `notifications.command` for a shell command run alongside delivery. Policy can be transformed by external programs without touching Swift.

**The sidebar already displays Fleet-shaped metadata:** git branch (`sidebar.showBranch`, vertical or inline), pull-request metadata, working directory, listening ports, agent activity spinner, unread badges, per-workspace colours, and custom metadata pills. Workspace groups can be customised per-cwd with longest-match and glob keys.

**Other relevant reach:** `terminal.autoResumeAgentSessions` re-runs agent resume commands for restored sessions on reopen; `workspaceGroups`/`workspaceColors` give per-Fleet visual identity; actions can be bound to the Command Palette, the surface tab bar, and keyboard shortcuts; `confirm` gates dangerous actions; project-local actions require a per-fingerprint trust prompt on first run.

### What configuration cannot reach

Three P0 requirements are **not** expressible in `cmux.json`, and none of them is an oversight — each follows from cmux being a terminal emulator rather than a supervisor.

1. **Lifecycle ownership.** There is no setting for "terminate every agent process group on quit and verify zero survivors". `app.confirmQuit` controls a *dialog*, not a teardown. Agents that ignore `SIGHUP`, are backgrounded, or run under `nohup` survive. There is no process-group recording, no post-quit sweep, and no reap-on-launch.

   **But the machinery exists and is pointed elsewhere.** `terminal.agentHibernation` already sends `SIGTERM` to *an agent's process group*, scoped to a workspace and surface, gated on an idle-lifecycle state and a confirmation window in which output and PID must stay unchanged. cmux can already signal an agent's process group correctly — it simply does it to reclaim RAM, not to guarantee teardown. **That makes a fork or an upstream contribution substantially cheaper than building the capability from nothing.**

2. **Enforcement of isolation.** The "Worktree Agents" example is a *convention you opt into*, not an invariant. Nothing prevents two workspaces pointing at the same checkout, and cmux does not model the worktree as belonging to the workspace. Our requirement is that a Fleet has exactly one worktree, enforced.

3. **`Parked` versus `Interrupted`.** No configuration distinguishes a deliberate stop from a crash, because cmux does not persist that intent.

### What this means for Maestro

Configuration alone gets a surprisingly long way: **Fleet-shaped workspaces, worktree creation, agent startup, live git metadata in a sidebar, and a mature Attention implementation** — without writing any Swift.

What it cannot give is **process-lifetime ownership**, which is the single requirement this whole product was created to satisfy, and which no amount of `cmux.json` will express.

That sharpens the options materially. The choice is no longer *"build everything"* versus *"adopt something"*. It is:

- **Configure cmux** and accept that agents may outlive the app — rejecting our own P0.
- **Fork or upstream** the teardown path into cmux, reusing its existing process-group signalling, its Ghostty rendering, and its notification model.
- **Build on `libghostty` ourselves**, taking cmux as a proven reference for the architecture but owning lifetime from the start.

All three are now cheaper and better understood than they were before this configuration surface was read.

---

## Limitations of This Analysis

- **`Sources/` is large and mostly unread.** The directory contains hundreds of Swift files. This analysis read a filtered subset covering agent management, hibernation, lifecycle, session restore, and event publishing. AppDelegate, the main view controller hierarchy, socket command handling, and billing code were not read. Claims about lifecycle mechanics are derived from documentation and the specific files listed above.
- **`ios/` was not read.** The iOS companion app has its own architecture (state sync v2, browser streaming, Tailscale transport) documented in the CHANGELOG but not in source.
- **`cmux-tui/` was not read.** The Rust/Zig TUI variant targets Linux and is built on remote Blacksmith infrastructure; its architecture may differ significantly.
- **`web/` and cloud VM backend were not read.** The cloud VM control plane (TypeScript, Effect, Postgres) is a backend component referenced in `CLAUDE.md` and skills but not analyzed.
- **Process cleanup on app quit was not confirmed from AppDelegate source.** The claim that cmux does not sweep agent processes on quit is inferred from the absence of documented cleanup behavior and from the general terminal-emulator model, not from reading the `applicationWillTerminate` or equivalent handler.
- **`AgentResumeLiveness.swift` was not read.** Whether the session restore path does a PID or session-liveness check before launching the resume command is not confirmed.
- **Issue history was limited.** Only the 15 most-recently-updated open issues were read. Closed issues, which may contain resolved architectural decisions, were not reviewed.
- **No running instance was available.** All claims are from source and documentation. Behavioral properties (whether Feed actually blocks correctly, whether hibernation actually resumes, whether the remote daemon actually cleans up) were not verified by running the software.

---

## Pinned Evidence Index

| Source | Location / SHA | Used for |
|---|---|---|
| `README.md` | `manaflow-ai/cmux` main | Purpose, philosophy, features, UI layout |
| `CLAUDE.md` | `manaflow-ai/cmux` main | Build workflow, pitfalls, skill catalog, agent interaction model |
| `AGENTS.md` | `manaflow-ai/cmux` main | Same as CLAUDE.md (developer build guide) |
| `docs/agent-hooks.md` | main | Hook integration table, session restore mechanism, hibernation spec |
| `docs/feed.md` | main | Feed architecture, approval protocol, timeout semantics, storage |
| `docs/notifications.md` | main | Notification system, hook pipeline, OSC sources, CLI |
| `docs/events.md` | main | Event stream protocol, event catalog, privacy model |
| `docs/agent-session-tracking-spec.md` | main | Surface ID durability, binding key design, heuristic audit |
| `docs/remote-daemon-spec.md` | main | cmuxd-remote architecture, PTY persistence, cleanup protocol |
| `docs/workspace-auto-naming.md` | main | Auto-naming mechanism, headless agent invocation |
| `docs/workspace-groups.md` | main | Group concept, anchor workspace, CLI |
| `docs/configuration.md` | main | Config schema (partial) |
| `daemon/remote/README.md` | main | cmuxd-remote commands, RPC methods, slot file layout |
| `Sources/AgentHibernation/AgentHibernationLifecycleState.swift` | main | Lifecycle state enum, hibernation gate (`allowsHibernation`) |
| `Sources/AgentHibernation/AgentHibernationPanelPhase.swift` | main | Hibernation phase state machine |
| `Sources/AgentHibernation/AgentHibernationResumePreparation.swift` | main | Resume outcome enum |
| `Sources/AgentForkSupport.swift` (partial) | main | Session resume/fork probe, agent CLI invocation |
| `Sources/CmuxLifecycleEventPublishing.swift` | main | Event publishing from workspace/surface/pane model |
| `Sources/VaultAgentProcessScanner.swift` (partial) | main | Process-tree scan for live agent detection |
| `CHANGELOG.md` (first 100 lines) | v0.64.22 | Confirmed surface ID preserve fix, hibernation memory pressure path |
| `TODO.md` | main | Confirmed Codex/OpenCode integration gaps |
| `gh repo view manaflow-ai/cmux` | 2026-08-21 | Stars (26,317), languages, topics, description |
| Open issues (15 most recent) | 2026-08-21 | Confirmed issue #8736 (Herdr shim), #10045 (native Herdr integration) |
