# ccmux — Architecture Reference

**Evidence:** `skzv/ccmux@f1f73ea7975219de0697e84a9ca88fb5882309d0` (main, analyzed 2026-08-21). No versioned release tag was current at analysis time; the project ships directly on `main` with a Homebrew tap at `skzv/tap/ccmux`. Status badge on README reads **alpha**. Analyzed read-only.

Tags: **[V]** verified in source · **[I]** interpreted from documentation or structure · **[U]** unknown / not determinable.

---

## Scope and Orientation

ccmux is a terminal multiplexer dashboard for AI coding agent sessions, written in Go using the Charm stack (Bubble Tea, Lipgloss, Bubbles, Huh, Glamour). Its explicit design principle, stated in the README's [Design principles](https://github.com/skzv/ccmux/blob/f1f73ea/README.md#design-principles) section, is: "One source of truth: tmux. ccmux is a view; tmux is the database." The tool does not spawn or own agent processes. It observes existing tmux sessions, classifies each session's state by screen-scraping the pane content and reading OSC window titles, notifies the user when an agent is waiting for input, and provides a cross-device lens over all sessions simultaneously via Tailscale and Mosh. A companion daemon (`ccmuxd`) runs as a launchd (macOS) or systemd (Linux) user service and holds the sleep-prevention lock and the polling loop.

The project is a single-author work (Alexander "Sasha" Kuznetsov, `me@skz.dev`) started May 2026, with 29 stars and 2 forks at analysis time. It is alpha-stage software, self-described as "an ambitious MVP." This document is a descriptive record of the architecture as read in source. It does not propose adoption, redesign, or integration.

Files not fetched during this analysis: individual screen implementations under `internal/tui/`, the full `cmd/ccmux/` CLI entry point, `internal/conversations/`, `internal/claudeusage/`, `internal/e2e/`, and `cmd/ccmux-mcp/`. Claims derived from those paths are marked `[I]` or `[U]`.

---

## Name Disambiguation: ccmux vs. cmux

**These are unrelated projects.** `manaflow-ai/cmux` is a Swift/macOS native Ghostty-based terminal application with vertical tabs and macOS notifications for AI agents — 26,317 stars, created January 2026. `skzv/ccmux` is a Go TUI daemon built on top of standard tmux — 29 stars, created May 2026. The names are a collision, not a fork or inspiration relationship. The "cc" prefix in ccmux referred originally to Claude Code; the "c" prefix in cmux is unrelated. No evidence of any shared code, shared architecture, or mutual acknowledgment was found in either repository. Do not conflate them.

---

## Observed Vocabulary [V]

Defined from `CLAUDE.md` (SHA `f1f73ea`) and `README.md`, `docs/02_Architecture/00_System_Design.md`, and source packages, unless noted.

**project** — any non-hidden directory one level under the configured projects root (`~/Projects` by default); discovered by `project.Discover()` without requiring a marker file (`internal/project/project.go:¶package-doc`). A project is not a git concept — it is a filesystem directory. **session** — one tmux session, named `c-<sanitized-basename>` by convention; the managed unit inside tmux. Projects and sessions are 1:1 when a session is running; a project with no session is still a project. **ccmuxd** — the background daemon; polls tmux state, classifies agent states, rings the terminal bell on needs-input transitions, holds the sleep-prevention lock, and serves the IPC protocol over a Unix socket and (optionally) a Tailscale-bound HTTP listener. **ccmux** — the foreground binary; launches the Bubble Tea TUI or accepts CLI subcommands; stateless beyond `~/.config/ccmux/`. **needs\_input** — a session state classification: the agent's input prompt is visible AND the pane has been quiet for at least `idle_seconds_for_needs_input` (default 3 seconds). **active** — the agent is producing output. **idle** — output has stopped but no prompt frame is detected. **error** — a shell prompt is detected where an agent prompt was expected (the agent crashed). **agent** — a coding-agent CLI running inside a tmux session: Claude Code, Codex, Antigravity, Cursor, pi, Grok, or one of ~eight second-wave additions. **project agent** — the agent stored in `<project>/.ccmux/agent`, a plain text sidecar file written at project creation and updated by the TUI's `a` keybinding. **agentdetect** — the declarative TOML-rule engine that classifies pane state; lives in `internal/agentdetect/`. **rule file** — a `.toml` file embedded in the binary at build time, one per agent, under `internal/agentdetect/rules/`; defines region-scoped, priority-ordered match conditions. **MCP server** — `cmd/ccmux-mcp`; a Model Context Protocol server (JSON-RPC 2.0 over stdio) that exposes ccmux session and project data to agents themselves. **seen** — the per-session "reviewed" flag: false when a state transition happens while no client is attached; set true when a tmux client attaches. This is the closest analogue to Maestro's Attention concept. **caffeinate** — macOS sleep-prevention process held by ccmuxd while any session is active; `sleeplock.Manager` wraps three escalation modes (`safe`, `dangerous`, `very_dangerous`). **tailnet** — a Tailscale VPN network; ccmuxd optionally binds its HTTP API to the tailnet IP for remote clients.

---

## Vocabulary Mapping to Maestro [V/I]

| ccmux term | ccmux meaning | Nearest Maestro term | Relationship |
|---|---|---|---|
| **project** | A filesystem directory; the organizational unit | Fleet | Near-miss. A project maps loosely to a Fleet, but carries none of Fleet's lifecycle semantics. No worktree, no branch, no session identity — just a directory and a per-project agent preference. |
| **session** | One tmux session holding one agent process | Session | Near-miss. ccmux sessions are tmux sessions — they survive daemon restarts and application quit by design. Maestro Sessions are Copilot-managed and must not outlive the application. |
| **needs\_input** | Observed state: agent prompt visible + pane quiet | Attention | Strong analogue. Both are derived from observed evidence, not stored state. ccmux detects via screen-scrape; Maestro detects via `permission.requested` event. |
| **seen** | Boolean: user has viewed the session since its last state transition | Attention (acknowledged variant) | Partial overlap. ccmux `seen=false` ≈ Maestro unacknowledged Attention. Neither persists this as a durable state. |
| **active / idle / error** | Observed liveness states, re-derived each poll | Alive / Dead / Ambiguous (Liveness) | Strong structural analogue. Both systems treat liveness as observed evidence, not persisted fact. |
| **ccmuxd** | Long-lived background daemon | — (no equivalent) | Fundamental divergence. Maestro's defining constraint is that no process outlives the application. ccmuxd is explicitly designed to outlive any TUI invocation and is registered as a launchd/systemd service. |
| **project agent** (`<project>/.ccmux/agent`) | Per-project agent choice, durable on disk | — | No Maestro equivalent. Maestro's Session binds to exactly one Copilot instance; there is no per-worktree agent selector. |
| **agent** (CLI) | Coding-agent CLI launched in a tmux session | Session (agent process) | Divergence in ownership model. ccmux's agent is a process ccmux did not spawn and does not own. Maestro owns its agent processes and is responsible for their lifecycle. |
| **rule file** (TOML) | Declarative pane-content and OSC-title matcher per agent | — | No Maestro equivalent. Maestro does not currently model agent-internal state via screen-scraping. |

---

## Architecture at a Glance [V]

```text
  LAPTOP (client + local)                 MINI (local + server)
  ┌──────────────────────────┐           ┌──────────────────────────────────┐
  │  ccmux TUI (Bubble Tea)  │──http ───►│  ccmuxd HTTP (tailnet 7474)      │
  │  ├─ local sessions ◄unix─┤ tailnet   │  ├─ sessions (mini-foo, active)  │
  │  │    laptop-bar          │──────────►│  ├─ sessions (mini-cas, 🔔)      │
  │  │    laptop-baz          │           │  └─ caffeinate while active      │
  │  └─ remote: mini         │           │                                  │
  │       mini-foo            │           │  ccmuxd Unix socket              │
  │       mini-cas 🔔         │           │  (~/.local/state/ccmux/ccmuxd.  │
  └──────────────────────────┘           │   sock)                          │
                                         └─────────────┬────────────────────┘
                                                        │ Mosh (over Tailscale)
                                               ┌────────┴───────────┐
                                               │  iPhone             │
                                               │  (Moshi app / Blink)│
                                               │  → tmux attach      │
                                               └────────────────────┘

  Per host:
  ┌──────────────────────────────────────────────────────────────────┐
  │  tmux server (user's existing tmux, not managed by ccmux)       │
  │  c-proj-foo  [claude, active]                                   │
  │  c-proj-bar  [codex, needs_input 🔔]                            │
  │  c-proj-baz  [cursor, idle]                                     │
  └──────────────────────────────────────────────────────────────────┘
           ▲                         ▲
  tmux list-sessions              capture-pane
  tmux has-session                display-message #{pane_title}
  tmux new-session -d             send-keys / kill-session
```

---

## What ccmux Is For [V]

ccmux solves the ergonomic problem of running several AI coding agents simultaneously across multiple machines without a shared dashboard. A developer running five Claude Code sessions across three projects, resuming from a phone at night, and picking up on a laptop the next morning would otherwise need to: remember tmux session names, type `claude --resume <hash>`, ssh into the right machine, and `tmux attach -t <name>`. ccmux replaces all of that with a single TUI that lists every session on every device, color-coded by what each agent is doing. Attach is one keypress; resume uses the stored conversation history. The cross-device component runs over Tailscale with Mosh for connection resilience. The target user is a developer running multiple concurrent AI coding agents who wants a unified control surface reachable from any device including a phone.

---

## Unit of Work [V]

The unit of work is a **project**, but this is a weaker concept than a Fleet. A project is any directory discovered under `~/Projects` (configurable in `config.toml`). The project struct (`internal/project/project.go`) carries: a name (directory basename), a path, boolean flags for `.git`, `CLAUDE.md`, `AGENTS.md`, and `docs/` presence, a last-modified timestamp, and an `Agent` field read from `<project>/.ccmux/agent`. There is no bundle of: worktree, branch, session identity, or lifecycle state. Two projects can share a git checkout — ccmux has no opinion about this.

The project maps to at most one tmux session at a time, named `c-<sanitized-basename>` via `tmux.SessionNameForPath()` (`internal/tmux/tmux.go:SessionNameForPath`). Sessions are discovered by polling `tmux list-sessions`; the project and session layers are joined by matching session path to project path. A project with no running session is still fully navigable in the Projects tab, and its past conversations appear in the Conversations tab.

There is no persistent Fleet-equivalent object: the combination of (directory + running tmux session + agent process) is the effective unit, but no single data structure binds them durably. ccmuxd's `tracked` map (`cmd/ccmuxd/main.go:tracked`) holds per-session polling state in memory, including `promptCount`, `state`, `lastChange`, and `seen`. This map is ephemeral — it is rebuilt from live `tmux list-sessions` output on every daemon start.

---

## Relationship to tmux [V]

ccmux wraps tmux entirely. Every tmux interaction passes through `internal/tmux/tmux.go`. The explicit architectural rule in `CLAUDE.md` states: "All session operations (`new`, `attach`, `kill`, `list`, `capture-pane`) go through here. No direct shell-outs from the TUI layer." The package is a thin facade over the tmux CLI with no direct socket access.

**Commands used, by call site:**

| Command | Usage |
|---|---|
| `tmux list-sessions -F <format>` | `tmux.List()` — enumerates sessions each poll tick; format string is `#{session_name}\t#{session_created}\t...#{session_path}` |
| `tmux has-session -t =<name>` | `tmux.Has()` — existence check with exact-match target |
| `tmux new-session -d -s <name> -c <dir> <cmd>` | `tmux.New()` — creates a detached session running the agent CLI |
| `tmux capture-pane -p -t =<name>: [-S -<N>]` | `tmux.CapturePane()` — reads visible pane content; primary state-detection input |
| `tmux display-message -p -t =<name>: #{pane_title}` | `tmux.PaneTitle()` — reads OSC-set window title; high-priority state-detection signal |
| `tmux send-keys -t =<name>: <keys>` | `tmux.SendKeys()` — sends key sequences |
| `tmux send-keys -t =<name>: -l <text>` | `tmux.SendText()` — sends literal text without key-name interpretation |
| `tmux kill-session -t =<name>` | `tmux.Kill()` — terminates a session |
| `tmux rename-session -t =<name> <new>` | `tmux.Rename()` — renames a session |
| `tmux list-clients -t <name> -F #{client_tty}` | `tmux.RingBell()` — enumerates attached TTYs for BEL injection |
| `tmux attach-session [-d] -t <name>` | `tmux.Attach()` / `tmux.AttachCmd()` — foreground attach via `syscall.Exec` |
| `tmux switch-client -t <name>` | `tmux.SwitchClientCmd()` — used when ccmux is itself inside a tmux session |

All targets use the exact-match prefix `=<name>` to prevent tmux's prefix and glob fallback from silently mis-targeting another session (`internal/tmux/tmux.go:exactSession`, `exactPane`). An early-discovered bug where `has-session -t c-foo` would match `c-foo-app` is fixed by this convention.

**What ccmux reads back from tmux.** The primary read surface is `capture-pane -p` (pane body) and `display-message #{pane_title}` (OSC title). ccmux does not read tmux events, does not use tmux's `pipe-pane`, and does not hook tmux's plugin system. Everything is synchronous polling on a configurable interval (default 2 seconds).

ccmux does **not** start its own tmux server. It attaches to the user's existing tmux via the default socket (`$TMUX_TMPDIR` / `/tmp/tmux-<uid>/default`). The `LC_ALL=C.UTF-8` injection in `internal/tmux/tmux.go:command` is a documented workaround for a tmux behaviour: without a locale set, tmux running under launchd's minimal environment falls back to the C locale and replaces non-printable bytes with `_`, corrupting the `capture-pane` output that the state classifier depends on.

---

## Isolation Model [V]

**None enforced by ccmux.** Projects are plain directories. ccmux imposes no worktree isolation, no container boundary, no branch enforcement. Two projects can share a git checkout and ccmux will not detect or prevent this. The per-project agent sidecar (`<project>/.ccmux/agent`) records only the agent preference, not any checkout identity.

The only isolation that exists is the isolation tmux provides: each session runs in its own PTY with its own process group. Agent processes in different sessions cannot directly observe each other's terminal output, but there is no filesystem or git isolation. One Claude Code session can read or write files belonging to another project's checkout without any ccmux-level gate.

This is not a deliberate tradeoff — isolation simply is not part of ccmux's problem statement. ccmux is a session manager, not a project scaffolder or workspace enforcer.

---

## Process and Lifecycle Ownership [V]

**This is the most important architectural fact for Maestro.** ccmux's design is the explicit inverse of Maestro's lifecycle-ownership requirement.

**Agent processes are not owned by ccmux.** When a new session is created via `tmux.New()` (`internal/tmux/tmux.go:New`), ccmux calls `tmux new-session -d`, which creates a detached tmux session. The agent CLI (e.g. `claude --continue || claude || zsh || bash || sh` for Claude, per `internal/agent/claude.go:LaunchCmd`) runs as a child of the tmux server, not as a child of ccmuxd or ccmux. From the moment `tmux new-session` returns, the agent is owned by tmux.

**What survives a ccmuxd shutdown.** When ccmuxd receives SIGINT or SIGTERM, it runs a 2-second graceful HTTP shutdown and exits (`cmd/ccmuxd/main.go:238-248`). The `defer srv.sleeper.Stop()` reverts any `caffeinate` or `pmset` sleep-prevention state. Nothing terminates the tmux sessions or the agent processes inside them. Every agent process continues running. The tmux server continues running. This is by design: the README's "the loop" scenario explicitly describes a session that has been running since morning with "the daemon held a `caffeinate` lock and Claude kept thinking" while the laptop's lid was closed. tmux persistence is the product's core value proposition.

**The daemon is a launchd/systemd user service.** ccmuxd installs itself via `ccmux daemon install`, which writes a launchd plist on macOS or a systemd user unit on Linux. `KeepAlive = SuccessfulExit` is set in the plist, so launchd respawns ccmuxd on crash or non-zero exit. If ccmuxd is killed with SIGKILL, launchd restores it within launchd's respawn throttle (approximately 10 seconds). The daemon is explicitly persistent and is designed to be.

**The "rogue daemon" bug (already encountered and fixed).** The code comment at `cmd/ccmuxd/main.go:154-170` documents a class of bug that was found in the wild: two ccmuxd instances could both start within ~1 second of each other (e.g. during a restart), both successfully bind, and one would operate as a "rogue" with no socket — unreachable for `ccmux daemon stop` but still running its poll loop and accumulating heap. The fix is a `flock`-guarded bind sequence with a dial probe (`waitForSocketHandoff`, `acquireBindLock`) before removing the old socket. The fix is specifically to detect and yield to a live peer; it does not terminate the peer. The comment reads: "the result is the 'rogue daemon' we found in the wild."

**No process-group tracking.** ccmuxd does not record PID, PGID, or process group of agent processes. It cannot enumerate them. There is no equivalent to Maestro's "verified by zero surviving processes on quit" check. Verification that agents are truly stopped would require shelling out to `ps` and filtering by tmux session ancestry — no such mechanism exists.

**Parked/Interrupted distinction.** There is no equivalent. A session that a user intentionally stopped (`x` → kill) is indistinguishable in ccmuxd state from a session that crashed. Both cases result in the session disappearing from `tmux list-sessions`; both produce a `killed` event. If the user kills a session and relaunches ccmux, there is no record of whether the stop was deliberate.

---

## Agent Support and State Detection [V]

**Agents supported.** At the time of analysis, 15 agents are registered in `internal/agent/agent.go`:

| Constant | Binary | Notes |
|---|---|---|
| `IDClaude` | `claude` | Default; the origin agent. Full heuristic + TOML rules + Claude-specific title rules. |
| `IDCodex` | `codex` | OpenAI Codex CLI |
| `IDAntigravity` | `agy` [I from display name "Antigravity CLI"] | Google's agent |
| `IDCursor` | `cursor` | |
| `IDPi` | `pi` | |
| `IDGrok` | `grok` | xAI |
| `IDOpenCode` | `opencode` | |
| `IDKimi` | `kimi` | |
| `IDDroid` | `droid` | |
| `IDCopilot` | `copilot` | GitHub Copilot |
| `IDQoder` | `qoder` | |
| `IDKilo` | `kilo` | |
| `IDHermes` | `hermes` | |
| `IDAmp` | `amp` | |
| `IDKiro` | `kiro` | |

A TOML rule file exists for each of these except Copilot and OpenCode [V: `internal/agentdetect/rules/` directory listing]. All interact with the agent as a subprocess inside a tmux session: ccmux launches the agent CLI and from that point on treats it as an opaque process to be observed, not controlled. There is no SDK integration, no structured API, no log file parsing. State detection is entirely via terminal screen-scraping and OSC title reading.

**The "cc" in ccmux.** The README and CLAUDE.md both confirm: "cc" originally stood for Claude Code. The project has since expanded to 15 agents but has not changed its name.

**State detection pipeline.** The classification pipeline runs once per session per poll tick (default 2 seconds):

1. `tmux capture-pane -p -t =<name>: -S -60` — captures last 60 lines of pane content. Source: `cmd/ccmuxd/poll.go:Phase2`.
2. `tmux display-message -p -t =<name>: #{pane_title}` — reads the OSC 2 title the agent CLI set. Source: `internal/tmux/tmux.go:PaneTitle`.
3. Both are passed to `agent.ClassifyState()`, which routes to `ClassifyWithTitle()` if the agent implements `TitleAwareAgent` (an optional interface), otherwise falls back to `Classify()` (body-only). Source: `internal/agent/engine.go:engineClassify`.
4. `agentdetect.ClassifyAgent()` evaluates the embedded TOML rules for the agent. Rules are pre-compiled regexes, loaded once at startup via `go:embed`, evaluated in priority order. Source: `internal/agentdetect/agentdetect.go:Evaluate`, `internal/agentdetect/loader.go`.
5. If no rule matches (`MatchedRuleID == ""`), a time-based fallback applies: pane empty → Unknown; pane quiet ≥ idle threshold → NeedsInput; otherwise → Active. Claude additionally falls back to the legacy `internal/claude/classify.go` heuristic (a refined version of the box-drawing frame detector).

**Claude detection rules in detail** (`internal/agentdetect/rules/claude.toml`):

- `title_spinner_working` (priority 1100, region `osc_title`): regex `^[\x{2800}-\x{28FF}]` — any braille block character leading the title means the agent is working. This is the most reliable signal.
- `claude_prompt_frame` (priority 900, region `last_line`, `require_idle = true`): detects Claude's rounded box-drawing prompt frame: at least one of `╭╮╰╯` AND one of `│`, `─`, `>`, or a second distinct rounded corner. The `require_idle` flag gates this as `needs_input` only once the pane has been quiet for the idle threshold. Without this gate, a partial frame redraw mid-output would fire a spurious bell.
- `claude_shell_prompt` (priority 800, region `last_line`): regex `[\$#%]\s*$` with a negative lookahead for box-drawing characters → `error` state (the agent process exited, dropping back to a shell).

**Codex detection rules** (`internal/agentdetect/rules/codex.toml`): OSC title `Action Required` → blocked; body `press enter to confirm` / `enter to submit` / `allow command?` in bottom 3 lines → blocked; `>` or `❯` alone on last line → idle.

The code comment in `internal/agentdetect/agentdetect.go:¶package-doc` explicitly frames this as "production-grade agent supervisor" behaviour: "The shape this engine encodes mirrors what production-grade agent supervisors converge on." The design rationale for the TOML rule system is also explained there: prior to Phase 3, each agent had hardcoded Go heuristics; only Claude was well-tuned; every other agent fell back to "pane went quiet → needs_input," producing spurious bells.

---

## Multi-Agent Model [V]

ccmux runs multiple agents in parallel, one per tmux session. The dashboard shows all sessions simultaneously with state color-coding. There is no notion of subagents, nested delegation, or agent-to-agent communication. Each session is fully independent; agents have no knowledge of each other through ccmux.

Per-project agent assignment is sticky: stored in `<project>/.ccmux/agent`, set at project creation and switchable via the `a` keybind in the Projects tab. The dashboard rows for non-Claude agents display a small `[codex]`, `[antigravity]`, `[cursor]` tag. The poll loop reads the agent sidecar on every tick and updates the classifier accordingly — if a user switches an agent mid-session, the classification heuristic updates on the next tick without requiring a restart.

The MCP server (`cmd/ccmux-mcp`) introduces a second multi-agent dimension: agents can see and act on ccmux sessions via MCP tools (`list_sessions`, `read_pane`, `spawn_session` [opt-in], `send_keys` [opt-in]). This means one agent session could instruct ccmux to spawn and monitor other agent sessions — an ad-hoc agentic orchestration pattern. The spec document at `docs/01_Specs/04_MCP_Server.md` was not fetched; this capability is described but its practical limits are **[U]**.

---

## UI Architecture [V]

The UI is a TUI (terminal user interface) built on Charm's Bubble Tea framework — an Elm-architecture (Model/Update/View) Go framework for terminal applications. There is no web UI, no native macOS UI, and no Electron layer. The binary communicates with ccmuxd over a Unix socket using a JSON-over-HTTP protocol; the TUI is a client of that protocol.

**Screens:** Dashboard (sessions + devices + usage), Sessions (focused session list), Projects (project browser with conversations), Notes (per-project markdown tree), Setup/Doctor (health check wizard), Settings (config editor), Agents (agent install status and config), Claude (Claude-specific config). Screens are navigated by number keys (`1`–`7`) or `←`/`→`.

**Selection model.** Selecting a session in the Sessions screen or Dashboard re-scopes all other panels: Notes switches to that project's markdown tree, Conversations switches to that agent's past threads, the usage panel scopes to that agent's quota. This is the same selection-re-scopes-everything model that Maestro uses in its three-column layout. Source: design described in CLAUDE.md's architecture summary and README.

**Narrow-terminal layout.** When the terminal width is below approximately 120 columns, ccmux collapses to a single-column layout with reduced detail, designed for phone-width terminals. Source: README `📱 Mobile setup` section.

**Attach mechanism.** Pressing Enter on a session in the TUI executes `syscall.Exec(tmuxBin, ["tmux", "attach-session", "-t", name], ...)` — replacing the ccmux process with tmux, not forking it. On return (Ctrl-b d to detach), the ccmux process resumes. If ccmux is itself running inside a tmux session, it uses `switch-client` instead to avoid a nested-tmux error. Source: `internal/tmux/tmux.go:Attach`, `SwitchClientCmd`.

**Cross-device clipboard.** ccmuxd sets `tmux set -s set-clipboard on` at startup, enabling OSC 52 clipboard forwarding. Text selected inside a remote tmux pane lands on the local machine's clipboard in terminals that support OSC 52 writes (iTerm2, Ghostty, WezTerm, Alacritty, kitty; explicitly not Terminal.app). Source: `cmd/ccmuxd/main.go:¶clipboard.EnableTmuxClipboard`.

---

## State and Persistence [V]

| Path | Content | Durable? |
|---|---|---|
| `~/.config/ccmux/config.toml` | User preferences: projects root, theme, idle thresholds, daemon ports | Yes |
| `~/.local/share/ccmux/ccmux.db` | SQLite: session history, prompt counts, snapshot index | Yes |
| `~/.local/share/ccmux/snapshots/<id>/` | Snapshot archives: tmux scrollback + agent transcript copies | Yes |
| `~/.local/state/ccmux/ccmuxd.sock` | Daemon Unix socket (runtime only) | No (runtime) |
| `~/.local/state/ccmux/ccmuxd.log` | Daemon log, rotated | Yes (log) |
| `~/.local/state/ccmux/ccmuxd.pid` | Daemon PID file | No (runtime) |
| `<project>/.ccmux/agent` | Per-project agent sidecar (plain text) | Yes |

**What is and is not persisted as liveness.** Session liveness states (`active`, `idle`, `needs_input`, `error`) are **not persisted**. They are derived fresh from `tmux capture-pane` and `display-message #{pane_title}` on every 2-second poll tick. The `tracked` map in ccmuxd is in-memory only and is rebuilt from live `tmux list-sessions` output on every daemon start. This is the same design principle as Maestro's Liveness: observed evidence, recomputed each launch, never persisted. Source: `cmd/ccmuxd/poll.go:pollOnce Phase 1`.

**What is persisted as history.** SQLite stores session history and per-session `promptCount` — a lifetime counter of how many times each session transitioned to `needs_input`. This is a usage metric, not a lifecycle state. Source: `docs/02_Architecture/00_System_Design.md:¶Persistence`.

**The `seen` flag.** The per-session `seen` boolean (`cmd/ccmuxd/main.go:tracked.seen`) tracks whether the user has viewed a session since its last notable state transition. It is set false on a state-change while no client is attached; set true when a tmux client attaches. This flag is in-memory, not persisted to SQLite. It is exposed over the daemon protocol as `SessionState.Seen`, and the TUI uses it to render "unreviewed" indicators. Source: `cmd/ccmuxd/poll.go:decideAttention`.

---

## Permissions and the Needs-Input Signal [V]

ccmux does not mediate agent permission requests. It does not intercept or proxy the agent's interaction with the user. The agent's permission prompt appears inside the tmux pane — the same terminal the user would see if they were attached directly — and ccmux's role is only to **detect** that a prompt is present and notify the user.

**Detection mechanism.** The `decideAttention()` function in `cmd/ccmuxd/poll.go` is the decision point. On each poll tick, after state classification:

```
if next == StateNeedsInput && prev != StateNeedsInput {
    d.IncPromptCount = true
    d.RingBell = true
}
if next != prev {
    d.EmitStateEvent = true
    if next == StateNeedsInput { d.StateEventKind = "needs_input" }
    if !attached { d.NewSeen = false; d.SendPush = true }
}
```

A bell is triggered on **every** fresh transition to `needs_input`, whether or not the user is attached. Delivery self-limits: `tmux.RingBell()` writes the BEL byte only to the TTYs of clients actually attached to that specific session, so an unattached session's bell fires but reaches nobody. (A prior implementation gated the ring on `!attached`, which — as the code comment notes — made the ring condition and the delivery set mutually exclusive: the bell never reached anyone who was watching.)

**Notification delivery channels:**
1. **Terminal BEL** — `tmux list-clients -t <session> -F #{client_tty}` enumerates attached TTYs; `writeBellToTTY()` writes `\a` directly to the tty device. Source: `internal/tmux/tmux.go:RingBell`.
2. **Moshi push (APNs/FCM)** — if the device is paired via `ccmux moshi-setup`, Claude Code hooks (`permission_requested`, `task_complete`) feed into `moshi-hook`, which sends categorized iOS push notifications. This path uses Claude Code's own hooks system and is Claude-specific. Other agents receive only the terminal BEL in v0.1. Source: README `📱 Mobile setup`, code in `internal/moshi/`.
3. **SSE event stream** — `GET /v1/events` is a Server-Sent Events stream of `SessionEvent` objects including `needs_input` events. Remote TUI clients consume this to update their dashboards without polling.

**False-positive suppression.** The `require_idle = true` flag on the `claude_prompt_frame` rule (`internal/agentdetect/rules/claude.toml`) implements the key false-positive gate: a `needs_input` classification from a body match is only believed once the pane has also been idle (no new output) for at least the configured idle threshold (default 3 seconds). Without this gate, a single `capture-pane` call that catches a partial box-drawing frame mid-render triggers a spurious bell. This is the `RequireIdle` field in `agentdetect.Result`, honored by `engineClassify` in `internal/agent/engine.go`.

There is no concept of a notification being "acknowledged" beyond the `seen` flag resetting to true when the user attaches to the session. There is no snooze, mute per session (roadmap item), or escalation path.

---

## What is Genuinely Novel [V/I]

**1. TOML-driven declarative detection rules.** The `internal/agentdetect/` package defines a rule engine where agent state classification is expressed as embedded TOML files, not Go code. Rules specify: a `region` (where in the pane state to look: `osc_title`, `last_line`, `bottom_non_empty_lines(N)`, `whole_recent`), a `state` (`working`, `blocked`, `idle`, `error`), a priority, and a match spec (substring `contains`, anchored `regex`, per-line `line_regex`, boolean `any`/`all`/`not` composition). Adding a new agent or sharpening a rule is a TOML edit, not a code change. The comment in `agentdetect.go:¶package-doc` explicitly says: "Rules are data, not code." This is a sound architecture for a domain where the classification surface changes frequently (agents update their UI layouts; new agents appear). Maestro currently has no equivalent; it relies on Claude Code's `permission.requested` event from the SDK, which is more reliable but narrower in scope.

**2. OSC title as a high-priority detection signal.** Agent CLIs broadcast their state via the terminal's OSC 2 title sequence (the same mechanism that sets the terminal window title). Claude Code uses braille block characters as a spinner while working, and explicit strings like "Action Required" when blocked. ccmux reads this via `tmux display-message #{pane_title}` — a tiny shell-out, orders of magnitude cheaper than `capture-pane` on large scrollback — and uses it as the highest-priority input to the classifier. The comment in `tmux.go:PaneTitle` explains: "Agent CLIs broadcast their state here far more reliably than they do in the pane body." This is exploitable by any agent-supervisor that surfaces a PTY window, and Maestro (which reads Claude Code's event stream) does not need it — but it is worth knowing about for any agent that does not emit structured events.

**3. The MCP server as meta-layer.** `cmd/ccmux-mcp` exposes ccmux session and project data to coding agents via MCP. An agent running inside ccmux can call `list_sessions`, `read_pane`, `list_projects`, `list_conversations`, and `get_usage` against its own dashboard. With `--allow-mutate`, it can also `spawn_session`, `send_keys`, and `kill_session`. This creates a loop: ccmux monitors agents; agents can monitor (and potentially orchestrate) ccmux. Whether this is a feature or a bug depends on whether you trust the agent to drive other agent sessions. Maestro has no equivalent.

**4. Sleep prevention as a first-class feature.** The three-mode `sleeplock.Manager` (`internal/sleeplock/`) is a carefully designed macOS/Linux sleep-prevention layer. `safe` mode uses `caffeinate -s` (AC-only); `dangerous` extends to battery with automatic downgrade on low battery; `very_dangerous` uses `sudo pmset` but requires passwordless sudo for the specific command, and self-reverts on daemon stop. The `very_dangerous` path explicitly notes that SIGKILL won't run defers, but the daemon's own startup calls `Stop()` (idempotent) to clear any stale state from a prior crash. This is a well-considered escalation ladder for the "laptop agent runs overnight" use case.

**5. Multi-device session continuity as a primary value proposition.** The Tailscale + Mosh + tmux stack for cross-device session resumption — specifically the "start on Mac, answer on phone, resume on laptop" loop — is well-executed at the integration layer. Tailscale provides NAT traversal; Mosh provides connection resilience over cell-to-wifi roaming and lid-close; tmux provides session persistence; ccmux provides the unified session list and one-keypress attach. No other tool in this space explicitly targets this workflow. Maestro does not solve the cross-device problem at all currently.

---

## Deliberate Product Disagreements with Maestro [V/I]

**1. Agents outlive the application, by design.** ccmux's core value is that a Claude session keeps running after the user closes their laptop. Maestro's core value is that no agent process outlives the application. These are mutually exclusive positions. ccmux does not try to solve the herdr orphan-daemon problem because that problem is not a bug in ccmux's model — it is the intended feature. Users of ccmux know and expect that closing the ccmux TUI leaves everything running.

**2. No git worktree isolation.** ccmux makes no claim about git isolation. Projects are directories, not worktrees. Two sessions can share one checkout. This is a deliberate simplicity choice: ccmux is a session manager, not a workspace manager. Maestro's worktree-per-Fleet rule emerges from wanting parallel, independent agent work on the same repository. ccmux's users are expected to manage that themselves or to run agents on separate codebases.

**3. No lifecycle states.** ccmux has no equivalent of Maestro's Parked or Interrupted states. When a session ends, it ends — there is no durable record of whether it was intentional. The Conversations tab shows past agent threads (read from Claude Code's `~/.claude/projects/` JSONL transcripts), but this is history, not lifecycle state. A user who intentionally pauses work on a project and a user whose session crashed see the same empty state.

**4. State detection is heuristic, not event-driven.** ccmux observes agent behaviour by looking at the terminal screen every 2 seconds. Maestro listens to Claude Code's structured event stream (MCP). heuristic detection has false positives and false negatives (mitigated by the rule engine and `require_idle`); event-driven detection is more reliable but requires the agent to emit events. ccmux's approach is portable across all 15 supported agents; Maestro's is Claude Code-specific but accurate.

**5. The human is not the only integration point.** The MCP server allows agents to observe and spawn other agents within ccmux. The Telegram integration (temporarily shelved, issue #166, reverted in #166) would have allowed Telegram to control sessions. Maestro's model is that the human is the only integration point by design, because cross-agent awareness at the framework level is a source of unexpected coupling.

---

## What is Fragile or Wrong [V/I]

**1. The fundamental lifecycle gap — agents never die with the application.** ccmuxd's shutdown (`cmd/ccmuxd/main.go:239-248`) is a 2-second HTTP graceful close and exit. No tmux sessions are killed. No agent processes are terminated. There is no mechanism to enumerate what is running or to verify it is stopped. If a user uninstalls ccmux but forgets to kill their sessions, every agent process continues running indefinitely inside tmux until the machine reboots. `ccmux uninstall` is careful to never touch project directories or `~/.claude/`, but it also does not kill any sessions — the README confirms this. This is the herdr class of bug: processes that silently outlive their manager, attributing macOS permission prompts to an application that no longer considers itself responsible for them.

**2. The "rogue daemon" bug, mitigated but documented.** The code comments at `cmd/ccmuxd/main.go:154-170` describe a real instance of a rogue daemon found in production: two ccmuxd processes coexisting, one serving no requests but accumulating heap from its poll loop, unreachable for `daemon stop`. The flock-guarded bind sequence is a fix for the race condition, but a SIGKILL on ccmuxd followed by an immediate restart still has a window (the `waitForSocketHandoff` 3-second window). Whether the flock file itself could become stale is **[U]**.

**3. State detection reliability across 15 agents.** The TOML rule system is well-designed, but rule files for the "second wave" agents are stubs. The code comment in `internal/agentdetect/agentdetect.go:¶package-doc` describes the prior state: "every other agent (Codex, Cursor, Pi, Grok, Antigravity) was a 'v1 best-effort stub' — pane went quiet → needs_input." The fallback for agents with no rule match remains the time-based heuristic (`legacyFallback` in `internal/agent/engine.go`), which produces spurious bells on any agent that goes quiet for the idle threshold regardless of whether a prompt is actually visible. A user with a Kimi or Kiro session will get bells on every idle period.

**4. Moshi push notifications are Claude-only.** The categorized push path (APNs/FCM via moshi-hook) plugs into Claude Code's hooks system (`permission_requested`, `task_complete`). No equivalent hook exists for Codex, Antigravity, Cursor, or any other agent. The README acknowledges: "Moshi push integration is currently Claude-only — Codex / Antigravity sessions get the audible terminal bell." For a user running multiple non-Claude agents on their phone, the notification signal degrades to a generic iOS terminal bell, which iOS terminal clients map to a notification only if they are configured to do so and the app is not in the foreground.

**5. No read deadline on `capture-pane`.** The poll loop applies a per-tick budget timeout (`context.WithTimeout`, default 10 seconds), but `capture-pane` on a session with very large scrollback (a session that has been running for hours writing to the pane) can produce a large read. The `lines` parameter to `tmux.CapturePane()` is capped at 60, which bounds the output, but the actual I/O time is not separately bounded below the budget. A wedged or slow `tmux` subprocess would consume the entire poll budget, delaying all subsequent sessions in that tick. The code comment notes: "so one wedged subprocess... costs at most one budget's worth of polling instead of stalling the loop forever." This is correct for the daemon's health, but all sessions are blocked for that budget window.

**6. SQLite corruption recovery drops all history.** The documented failure mode (System Design doc, `§Failure Modes`) for SQLite corruption is: rename the database to `.corrupt`, start fresh. Metrics history (prompt counts, usage data) is lost permanently. There is no backup or WAL-checkpoint recovery path. For a tool whose selling point includes tracking agent usage and history, this is a complete loss on corruption.

---

## Limitations of This Analysis

- **`internal/tui/` was not fetched.** The full TUI source (all screen models, the navigation router, the styles system) was not read. Claims about the selection model and layout are derived from CLAUDE.md's architecture summary, README, and the system design document.
- **`cmd/ccmux-mcp/` was not fetched.** The MCP server implementation was not read; its behaviour is described from the README and `docs/01_Specs/04_MCP_Server.md` was not fetched.
- **`docs/01_Specs/` was not fetched.** The feature catalog (`01_Feature_Catalog.md`), multi-agent spec (`02_Multi_Agent.md`), MCP spec (`04_MCP_Server.md`), and testing spec (`03_Testing_And_CI.md`) were referenced but not read.
- **Telegram integration (`internal/moshi/`, `internal/apns/`, `internal/fcm/`)** was not read in detail. The pairing flow and push notification delivery are described from CLAUDE.md and README; the implementation details are not verified.
- **`internal/conversations/`** was not read. The conversation-history and session-resume mechanism is described from README but not verified in source.
- **The project is alpha-stage.** Several features described in the README are roadmap items (v0.2, v0.3) rather than implemented features; the document distinguishes `[V]` from `[I]` but some README claims may describe planned rather than present behaviour, and the distinction was not always determinable from the source files fetched.
- **No tests were run.** The correctness of the TOML rule files against real agent output, the poll loop timing behaviour, and the sleep-prevention mode behaviour were not exercised.
