# Warp — Architecture Reference

**Evidence basis:** `warpdotdev/warp` public repository, commit `0e075a07257a` (HEAD as of 2026-08-21). Supplemental sources: issue tracker (15,000+ issues), `specs/` design documents committed in the repository, engineering blog post "How Warp Works" (July 2021), `docs.warp.dev` where reachable, and direct source code inspection of key crates. Analysis date: 2026-08-21.

Tags: **[V]** verified in source · **[D]** documented claim, not measured · **[I]** interpreted from evidence · **[U]** unknown, not determinable.

---

## ⚠️ Openness Status — Read First

**Warp is no longer an issues-only repository.**

The `warpdotdev/warp` README states "This is an issues-only repo." **That statement is demonstrably stale.** As of the time of this analysis, the repository contains full Rust client source code across 70+ crates under `crates/`, an `app/` binary target, an `agents/` subdirectory, and a `specs/` directory holding design documents. Commits were pushed to these paths as recently as today (2026-08-21). `CONTRIBUTING.md` explicitly describes a contributor workflow involving spec PRs, code PRs, and automated review by Oz.

The README has not been updated to reflect this transition.

**What is open:** The client application (terminal UI, CLI agent integration, local control, persistence, warpui framework, Oz CLI). License: AGPL-3.0 for the client; MIT also present (dual-license, presumably for the UI framework components). **[V from LICENSE-AGPL, LICENSE-MIT, crates/ contents, commit history]**

**What remains closed:** Warp's server-side infrastructure. The `warp_multi_agent_client` crate connects to a Warp-operated backend endpoint (`endpoint_url` in `crates/warp_multi_agent_client/src/lib.rs:53-82`). The cloud isolation infrastructure (containers, Namespace, cloud agent scheduling) is server-side. The README's statement "The server portion of Warp will remain closed-source for now" appears to remain accurate for the backend. **[V for client openness; [D] for server closure posture]**

**What to do with this.** Source-level claims in this document are marked **[V]**. Claims about server behaviour, cloud agent execution, and anything not reachable from the client codebase are marked **[D]** (documented) or **[U]** (unknown).

---

## Operator Finding — Warp Cannot Host Maestro **[M: measured by the operator, 2026-08-21]**

**Warp was installed and evaluated by hand on the day this analysis was written, and uninstalled the same day.** The operator's conclusion: *"it doesn't work with copilot from what i can tell."*

This is the decisive fact about Warp for our purposes, and it outranks everything else in this document because it is **measured rather than researched**. It is consistent with the architecture described below: Warp drives its own server-side agents (the Oz orchestration path) plus whatever agent CLI a user types into a pane. There is no published integration seam through which a host application could bind a specific Copilot Session, supply its own `sessionId`, read `pendingRequests()`, or consume typed `subagent.*` events.

Maestro's entire seam is the Copilot SDK. A host with nowhere to put that seam cannot be a Maestro route, regardless of how good its terminal or its agent user interface is.

**Consequence:** Warp is retained in this reference set as **prior art only** - specifically for its multi-agent presentation, its approval user interface, and its publicly visible failure modes, which are the most valuable part of this document. It is **not** a candidate host surface, and it is not carried into the route comparison.

---

## Scope

Terminal emulator, agent UX, parallel agent execution model, approvals, process lifecycle, session persistence, local automation API, UI rendering architecture, and the implications for Maestro as a potential host surface. Excluded: internal server architecture, billing, Warp Drive (cloud sync) internals, font shaping, detailed Lua API (Warp has none), and the full Oz cloud agent backend.

---

## Observed Vocabulary **[V from source]**

Terms as used in Warp source and specs. Where a term collides with a Maestro term, the collision is noted.

- **Pane**: Terminal surface (or agent conversation surface) inside a Tab.
- **Tab**: One or more panes, associated with a window. Has a type: `Terminal`, `Agent`, `CloudAgent`, `Default`. **[V: `crates/local_control/src/protocol.rs:TabType`]**
- **Session**: Named navigation unit within a tab. `session.list`, `session.activate` exist in warpctrl catalog. ⚠️ Not a resumable agent conversation.
- **Conversation**: An agent dialogue — the durable record of one agent engagement. Persisted in the SQLite `agent_conversations` table. **[V: `crates/persistence/src/model.rs`]** This is closer to Maestro's Session than any other Warp noun.
- **Task**: A unit of agent work, persisted in `agent_tasks` table. **[V: same]**
- **Execution Profile**: A named bundle of AI autonomy permissions, including `AskUserQuestionPermission` and command-execution permissions. **[V: `specs/QUALITY-512-ask-user-question-speedbump/PRODUCT.md`]**
- **Oz**: Warp's proprietary cloud agent orchestration platform. Also used internally as the code name for the review agent that triages issues. Context-dependent.
- **CLI Agent**: A third-party coding agent (Claude Code, Codex, Gemini CLI, Kiro, etc.) running as a local subprocess in a Warp terminal tab.
- **Block**: A grouped unit of terminal output — one command plus its output. Foundational to Warp's terminal model.
- **Speedbump**: An inline permission-discovery nudge that appears inline in an agent conversation at the moment the relevant permission is first encountered. **[V: `specs/QUALITY-512-ask-user-question-speedbump/PRODUCT.md`]**
- **Warp Drive**: Warp's cloud sync service for settings and commands. ⚠️ Not a git concept.
- **warpctrl**: The local automation/scripting CLI, invoking the app binary with `--warpctrl` flag.
- **Project Rail**: The left-hand sidebar showing projects with agent status badges.
- **Orchestration**: A hierarchical agent tree where a parent agent spawns child agents via a `run_agents` tool.

**Term collisions with Maestro:**

| Maestro term | Nearest Warp term | Risk |
|---|---|---|
| **Fleet** | Project (in the rail) or Conversation | Low collision risk. Warp has no Fleet-equivalent as a first-class isolation unit. |
| **Session** | Conversation | Moderate. Warp has a low-level `session` (navigation) and a higher-level `conversation` (agent dialogue). Neither is identical to Maestro's named resumable Copilot Session. |
| **Worktree** | Not a defined noun | Warp has no worktree concept. Git worktrees appear as a user-side technique, not a framework primitive. |
| **Attention** | "Blocked" status / "Waiting-on-you" | Near-miss. Warp tracks `Blocked` state per conversation and surfaces it in the project rail. The concept exists; the surfacing is incomplete (see §5). |

---

## Architecture at a Glance **[V/I]**

```text
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Warp Desktop Application  (Rust, warpui, wgpu/Metal)               │
  │                                                                      │
  │  ┌──────────┐  ┌────────────────────────────────────────────────┐   │
  │  │  Project │  │  Window → Tabs (Terminal / Agent / CloudAgent)  │   │
  │  │  Rail    │  │                                                 │   │
  │  │ (status  │  │  Tab [Terminal]: Pane → PTY → Shell process    │   │
  │  │  badges) │  │                                                 │   │
  │  │          │  │  Tab [Agent]: Conversation UI                  │   │
  │  │          │  │      ├─ Oz (built-in): ──► Warp backend (SSE) │   │
  │  │          │  │      └─ CLI Agent tab: OSC 777 ◄──► subprocess │   │
  │  └──────────┘  └────────────────────────────────────────────────┘   │
  │                                                                      │
  │  SQLite (~/.warp/)      warpctrl (loopback HTTP :9277)              │
  │  agent_conversations    ← same-user credential broker (unix socket)  │
  │  agent_tasks            ← 84 typed, allowlisted actions              │
  │  windows, tabs, panes   ← disabled by default on public channels     │
  └──────────────────────────────────────────────────────────────────────┘
         │                              │
         │ SSE/protobuf (auth token)    │ local subprocess
         ▼                              ▼
  ┌─────────────────┐        ┌──────────────────────────┐
  │  Warp backend   │        │  CLI Agent process       │
  │  (closed)       │        │  (claude, codex, gemini) │
  │                 │        │  reads/writes filesystem  │
  │  Cloud agents:  │        │  no container             │
  │  Docker sandbox │        └──────────────────────────┘
  │  Kubernetes     │
  │  Namespace      │
  └─────────────────┘
```

---

## 1. Licensing and Openness

**Language and toolchain.** Rust throughout, confirmed by GitHub metadata and `rust-toolchain.toml`. The UI framework is a custom Rust crate (`warpui`, `warpui_core`) using wgpu for GPU-accelerated rendering. On macOS the wgpu backend targets Metal. **[V: blog post July 2021; `crates/warpui/src/rendering/mod.rs`]**

**License.** AGPL-3.0 (primary) and MIT (secondary, likely for the UI framework). Both license files exist at the repository root. AGPL means external use that offers the software as a service would require opening corresponding source — this is likely the motivating license for the client while keeping the server proprietary. **[V: LICENSE-AGPL, LICENSE-MIT in repo root]**

**What is genuinely open.** The client binary, all of `crates/`, `app/src/`, the `specs/` design documents (300+ design specs committed), and the `warp_cli` (Oz CLI). This is a substantive body of source code. Contribution workflow is active: external contributor PRs appear in recent commits. **[V: directory listing, commit history, CONTRIBUTING.md]**

**What is closed.** The backend server (agent orchestration, cloud container management, billing, Warp Drive sync, authentication service). The `warp_multi_agent_client` crate is a thin client that calls server endpoints; the server code is not in the repository. **[V: `crates/warp_multi_agent_client/src/lib.rs`]**

**Practical implication.** Source-level analysis is possible for the client, UI, local automation, persistence schema, and CLI agent integration. The cloud agent execution model, server-side isolation guarantees, and billing mechanics cannot be verified from source.

---

## 2. What Warp Is, and Who the User Is

Warp is a terminal emulator — a replacement for iTerm2 or Terminal.app — that has grown a substantial layer of AI and agent tooling on top of a GPU-accelerated, Rust-written foundation. The primary user today is a developer who wants to run AI coding agents (Claude Code, their own Oz agents) from inside their terminal without leaving a familiar shell context. Warp adds structured output (blocks), a full-featured input editor, command autocomplete, and AI command search on top of a standard PTY/shell model. The headline product pitch as of 2026 is parallel cloud-hosted agent execution ("Oz"): spin up multiple agents in isolated cloud containers that work on a repository simultaneously while the user monitors and steers from the Warp UI. The product sits at the boundary of terminal emulator and agent orchestrator, and that hybrid origin shapes every architectural decision documented below.

---

## 3. Agent Model

### 3a. Unit of agent work **[V/I]**

Warp does not have a direct equivalent of Maestro's Fleet. The nearest structural unit is a **Conversation** — a durable record of one agent dialogue persisted in SQLite. Conversations have a `parent_conversation_id` field, which is how the orchestration tree is expressed: a parent conversation spawns children, which may spawn grandchildren. **[V: `crates/persistence/src/model.rs:agent_conversations`]**

The **Tab** is the UI container for a conversation: a tab of type `CloudAgent` hosts an Oz agent conversation; a tab of type `Agent` hosts a built-in agent; a terminal tab may host a CLI agent subprocess. **[V: `crates/local_control/src/protocol.rs:TabType`]**

There is no Fleet-equivalent: no object that bundles a worktree, a session, and a subagent tree as a named isolation unit.

### 3b. Multiple parallel agents **[V/I]**

Yes, Warp supports running multiple agents in parallel. Two mechanisms exist:

1. **Multiple tabs**: The user opens multiple agent tabs simultaneously. Each tab hosts its own conversation. There is no cross-tab coordination — the user is the only integration point, exactly as in Maestro. **[V: general UI model]**

2. **Orchestration** (`run_agents` tool): A parent agent invokes the `run_agents` tool which starts child agents. These children may themselves spawn grandchildren. The orchestration tree is hierarchical and tracked server-side. **[V: `specs/code-1946-tui-multi-level-orchestration/PRODUCT.md`]**

### 3c. Isolation between parallel agents **[V/I]**

This is the sharpest comparison to Maestro's hard worktree rule, and the answer differs by execution mode:

**Cloud agents (Oz):** Isolated by container. Isolation platforms verified in source: `Docker`, `DockerSandbox`, `Kubernetes`, `Namespace`. Each cloud agent run gets a fresh container environment. Repository content is cloned or checked out into the container at run time, with optional `RepositoryHeadOverride` to specify a commit or branch. **[V: `crates/isolation_platform/src/lib.rs`, `crates/warp_cli/src/agent.rs`]** Whether each cloud child gets its own fresh clone (hard isolation) or shared mount is not determinable from the client source — it depends on the server-side orchestration, which is closed. **[U]**

**CLI agents (local):** Not isolated by Warp. A CLI agent (Claude Code, Codex) running in a terminal tab is a subprocess of the user's shell. It reads and writes the user's filesystem directly. **Warp does not create a worktree, does not create a branch, and does not scope the agent to any directory boundary.** Whether CLI agents share a checkout is entirely up to the user. The Claude Code tool's own `-w` flag creates worktrees on Claude's side, but Warp does not track these — git-aware UI features fail in that mode. **[V: issue #10134 "Warp git status and diff tracking fails in Claude Code worktree mode (-w)", closed 2026-04-29]**

Issue #15320 describes an orchestration run where children were given "independent file-disjoint tasks in its own git worktree" — worktrees used as a user practice, not as a Warp-enforced primitive. **[V: issue body]**

**Summary for Maestro comparison.** Maestro's hard worktree rule has no counterpart in Warp. For cloud agents, isolation is container-level and server-enforced, which is arguably stronger than a worktree. For local CLI agents, there is no isolation at all. The two products have made opposite bets: Maestro enforces filesystem isolation as a local invariant; Warp defers isolation to the cloud for its power-user workflow.

---

## 4. Underlying Agents and Model Seam **[V/I]**

### Built-in Oz agent (cloud)

The client sends protobuf-encoded `Request` objects to a Warp backend endpoint over HTTP with Server-Sent Events for streaming responses. Authentication via bearer token obtained from `get_or_refresh_access_token()`. The agent model (LLM) is selected server-side; the client receives `ResponseEvent` items decoded from base64 + protobuf. **[V: `crates/warp_multi_agent_client/src/lib.rs`]**

This is categorically a server-side execution model. Agent work is not done locally. The client is a thin stream consumer. This is the opposite of Maestro's strictly-local posture.

Passive (suggestion-mode) versus active requests take different endpoint URLs and ambient header policies, both confirmed in source. **[V: `is_passive_suggestion_request()` in `lib.rs:84-98`]**

### CLI agents (local)

Third-party CLI agents (Claude Code, Codex, Gemini CLI, Kiro, etc.) run as local subprocesses in Warp terminal panes. Warp communicates with them via **OSC 777 escape sequences** — a protocol Warp defines and advertises via environment variables.

The wire format is `CLIAgentNotification`, a JSON struct sent as the title of an OSC 777 sequence. Fields include: `agent`, `event`, `session_id`, `cwd`, `project`, `query`, `response`, `transcript_path`, `summary`, `tool_name`, `tool_input`, `error_type`. **[V: `crates/warp_core/src/cli_agent_protocol.rs`]**

Warp advertises its protocol version to the subprocess via `WARP_CLI_AGENT_PROTOCOL_VERSION` and its own version via `WARP_CLIENT_VERSION` environment variables. This is the integration seam: CLI agents that implement the Warp plugin (e.g., the Claude Code Warp plugin) emit these escape sequences, and Warp parses them to drive status badges, conversation capture, and the `Blocked` state.

Agents without the Warp plugin can still run in terminal tabs but produce no status badges and Warp cannot observe their lifecycle. **[V: issue #14730 body: "sessions detected by command-line matching (no plugin listener) render no status badge at all"]**

### BYOK / custom endpoints **[D from issue tracker]**

Users can supply their own API keys and custom OpenAI-compatible endpoints (issues #9303, #8351, #14833). This routes Oz agent requests through user-controlled backends. The client-side wiring for this is confirmed by settings code and issues; the server-side handling is **[U]**.

### MCP support **[V]**

`crates/mcp/` exists. `mcp_server_panes` and `mcp_environment_variables` tables exist in the persistence schema. MCP is available as a tool-integration seam. **[V: `crates/persistence/src/model.rs:mcp_server_panes`]**

---

## 5. Approvals and Permissions (Attention)

### Permission model **[V from specs]**

Warp has a multi-layer "AI Autonomy" permission system expressed as **Execution Profiles** — named bundles of permission settings. Key permission dimensions include:

- **`AskUserQuestionPermission`**: `Never` / `AskExceptInAutoApprove` / `AlwaysAsk` — controls whether the agent pauses to ask clarifying questions.
- **Command execution permissions**: Parallel structure for running shell commands. **[D: referenced in speedbump spec alongside Ask Question]**
- **File read permissions**: Similar, with a speedbump pattern. **[D: referenced in speedbump spec]**

### Speedbump pattern **[V: `specs/QUALITY-512-ask-user-question-speedbump/PRODUCT.md`]**

When an agent first uses a permission-gated tool (e.g., Ask Question), Warp shows a compact **inline footer** on the output card — at the exact moment the pause occurs. The footer contains:
- A dropdown to set the permission for the active execution profile (immediate effect).
- A link to the full AI Autonomy settings page.

The footer is **one-shot**: it appears once, regardless of whether the user interacts with it. The one-shot flag is local-only (not synced via Warp Drive). This "teach in context" pattern is consistent across file-read, command-execution, and question-asking speedbumps.

This is the most directly relevant pattern for Maestro's Attention concept. The speedbump solves the "user doesn't know the permission exists until the moment it blocks them" problem with an in-situ disclosure rather than a settings-first flow.

### Status surfacing for multiple agents **[V from issues and specs]**

Warp surfaces agent status in two places:

1. **Tab bar (horizontal or vertical)**: Agent tabs carry a status badge showing the CLI agent's brand icon with a status overlay: `InProgress`, `Done`, `Blocked`, `Error`, `Cancelled`. Vertical tabs already show this; horizontal tabs do not (issue #15362 requests adding it). **[V: issue #15362 body citing `app/src/tab.rs:L1293`]**

2. **Project rail**: The left sidebar ranks projects by status. An agent blocked on a permission prompt should turn the row yellow; after 5 minutes, red; a finished-but-unacknowledged run should show green. **[V: issue #14730 body — this is a feature proposal, not a shipping behaviour as of 2026-08-21]**

### Known bugs in attention surfacing **[V from issue tracker]**

Issue #14730 ("Triage the project rail: waiting-on-you colors and notifications that repeat until you answer") documents two structural bugs:

1. **`Blocked` state is shadowed by `InProgress`** for plain CLI-agent panes. `tab_conversation_status` checks `is_long_running()` before consulting the agent's status — a CLI agent sitting on a permission prompt is a long-running command, so `Blocked` never reaches the header. Only orchestrated Oz children propagate `Blocked` correctly. **[V: issue body citing `app/src/workspace/view.rs`]**

2. **`CLIAgentSessionStatus::Blocked` carries no timestamp**, making it impossible to distinguish "just asked" from "waiting 20 minutes." **[V: issue body]**

The proposal in that issue adds: priority ranking per project, colour-coded urgency (yellow → red by age), repeated nagging every 3 minutes for ranked projects until the user looks at the pane, and a coalescing banner. As of 2026-08-21 this is an open feature request, not shipped. **[V: issue state: open]**

**What this means for Maestro.** Warp's Attention concept exists at design level but is implemented incompletely. CLI agents (the primary user workflow) do not propagate `Blocked` reliably to the attention surface. Maestro can ship correct Attention semantics from day one by making liveness and Attention first-class at the Fleet level rather than bolting them onto tab metadata. The timestamp-on-block gap is a specific, learnable mistake.

---

## 6. Process and Lifecycle Ownership **[V/I]**

### Cloud agents survive app exit **[D/I]**

Cloud (Oz) agent runs execute in server-side containers. If Warp quits while a cloud agent is running, the agent continues on the server. The client reconnects on relaunch and resumes observing the stream. The `replay-agent-events-on-restore` spec describes this: "After Warp restarts and a previously active parent conversation is restored, the parent continues to receive lifecycle events from any children that were running at the time of the restart." **[V: `specs/replay-agent-events-on-restore/PRODUCT.md` §Startup restoration]**

This is fundamentally a different model from Maestro: Warp's lifecycle ownership for cloud agents is server-side and survives app exit.

### CLI agent (local) processes and app exit **[I from architecture]**

CLI agents run as child processes of the user's shell, which runs inside Warp's PTY. When Warp exits, the PTY closes; whether child processes survive depends on OS signal handling and the shell. There is no Warp daemon that supervises local subprocesses after Warp exits. **[I: no daemon crate found; `ExecutionMode::RemoteServerDaemon` appears to be the remote agent daemon, not a local supervisor]**

Issue #14960 ("Restore a pane's CLI agent session after restarting Warp") explicitly describes the problem: "Warp restores windows, tabs and panes across a restart, but a pane that had a CLI agent in the foreground comes back as a bare shell. The agent's conversation still exists on the agent's side — Warp just doesn't reattach to it." This is an open issue as of 2026-08-21. The issue proposes reattachment by the agent's own session identifier, not by replaying the launch command. **[V: issue #14960]**

### Background service / daemon **[V/I]**

`ExecutionMode::RemoteServerDaemon` suggests a daemon mode exists. Based on the name and the comment about inheriting PATH for MCP servers, this is the process that serves Warp's own remote TUI, not a general-purpose local supervisor. There is no evidence of a Warp process designed to outlive the user-facing application and manage local agent work. **[I]**

### Memory and resource management **[V from issues]**

Memory growth with long-running CLI agent sessions is a recurring complaint:
- Issue #13364: "11.5GB physical footprint after long-running Claude/Codex sessions; sample points to Metal glyph rendering." Filed 2026-06. Status: open, `needs-info`.
- Issue #12154: "Very high memory consumption with Warp v0.2026.05.27", duplicate-labelled.
- Issue #7892: "Extreme Memory Leak - 113GB in 33 minutes." Filed 2023, `ready-to-implement`.
- Issue #8314: "Warp uses >70GB RAM -> System crash." Filed 2024.
- Issue #15262: "Typing latency grows with uptime and tab count; every frame rebuilds the whole block-height SumTree." Filed 2026-08, `triaged`.

The Metal glyph rendering path is the primary suspect in #13364. The GPU atlas/glyph cache accumulates state proportional to output volume across a session. Running multiple heavy CLI agent sessions simultaneously (each generating thousands of output lines) compounds this. There is active remediation work in progress (issues #15403, #15377, #15278 are all memory-bound fixes landing in 2026-08). **[V: commit history and issue bodies]**

**What this means for Maestro.** Maestro's Fleet-per-worktree model naturally bounds memory growth: one Fleet, one output stream, explicit lifecycle management. The Warp pattern of holding all open tab outputs in GPU memory without bounds is a known failure mode we can avoid by design.

---

## 7. Session Persistence **[V]**

### Local SQLite database

Warp persists application state in a SQLite database (Diesel ORM) stored under `~/.warp/` (or `~/.warp-oss/`, `~/.warp-dev/` for other channels). The schema covers:

- Application state: `app`, `windows`, `tabs`, `pane_nodes`, `pane_leaves`, `pane_branches`
- Agent work: `agent_conversations`, `agent_tasks`, `ai_document_panes`, `ambient_agent_panes`
- Terminal state: `terminal_panes`, `blocks`, `commands`
- Project/workspace: `workspaces`, `workspace_metadata`, `projects`, `project_rules`
- Team/collaboration: `teams`, `team_members`, `team_settings`
- MCP: `active_mcp_servers`, `mcp_server_installations`, `mcp_environment_variables`

**[V: `crates/persistence/src/model.rs` and `schema.rs`]**

Windows, tabs, and pane layout are persisted and restored on restart. Agent conversation records are persisted. The `replay-agent-events-on-restore` spec is being implemented to restore event delivery connections to child agents across restarts, including resumption from last confirmed event (cursor-based, no replay of already-processed events). **[V: spec §Behavior, §Invariants]**

### Cloud sync (Warp Drive) **[D/I]**

Some settings sync via Warp Drive. The speedbump one-shot flag is explicitly documented as "local-only and not synced through Warp Drive" — implying that other settings do sync. Command history, themes, and workflow snippets appear to be Warp Drive candidates. **[D: speedbump spec; [U] for full sync scope]**

Warp Drive is optional to use but requires a Warp account for basic features. Whether the local database functions fully without a Warp account connection is **[U]**.

---

## 8. Control and Automation Surface **[V]**

### `warpctrl` — the local control CLI

`warpctrl` is a CLI tool that drives a running Warp application instance via a local protocol. It is packaged as a wrapper script that invokes the Warp binary with the hidden `--warpctrl` flag. **[V: `specs/warp-control-cli/README.md`]**

**Transport:** Loopback HTTP, port 9277, via an Axum server inside the Warp process. **[V: `specs/warp-control-cli/TECH.md`: "native-only loopback Axum server on fixed port 9277"]**

**Discovery:** The running Warp app publishes a JSON record in an owner-only directory (`$WARP_LOCAL_CONTROL_DISCOVERY_DIR`). Records contain the instance ID, build metadata, implemented actions, the loopback HTTP endpoint, and a path to the credential-broker socket. When scripting is disabled, records contain no endpoint or broker reference. **[V: `crates/local_control/src/discovery.rs`]**

**Authentication:** Two-stage. (1) Client connects to the Unix socket (credential broker), which verifies same-user via kernel peer credentials (UID check at OS level). (2) Broker issues a short-lived credential for one exact action, bound to the specific instance. Client presents the credential to the HTTP endpoint. The app verifies the exact granted action before dispatch. **[V: `specs/warp-control-cli/TECH.md` §Security gates]**

**Enabled/disabled:** Disabled by default on public channels (Stable, Preview, OSS). Enabled by default on internal dogfood builds. Controlled via Settings > Scripting toggle. The spec notes this explicitly: "Local control is enabled by default on internal dogfood builds and disabled by default on public channels." **[V: `specs/warp-control-cli/README.md` §End-to-end local test flow]**

**Action catalog** (all 84 verified in source): **[V: `crates/local_control/src/catalog.rs`]**

| Group | Actions |
|---|---|
| `instance` | list, inspect |
| `app` | ping, version, active, focus |
| `capability` | list, inspect |
| `window` | list, inspect, create, focus, close |
| `tab` | list, inspect, create, activate, move, close, rename, reset_name, color.set, color.clear |
| `pane` | list, inspect, split, focus, navigate, resize, maximize, unmaximize, close, rename, reset_name |
| `session` | list, inspect, activate, previous, next, reopen_closed |
| `input` | insert, replace (staging only — no submit) |
| `theme` | list, get, set, system.set, light.set, dark.set |
| `appearance` | get, font_size.{increase,decrease,reset}, zoom.{increase,decrease,reset} |
| `setting` | list, get, set, toggle |
| `keybinding` | list, get |
| `action` | list, inspect |
| `surface` | list, settings.open, command_palette.open, command_search.open, theme_picker.open, keybindings.open, warp_drive.{open,toggle}, resource_center.toggle, ai_assistant.toggle, code_review.{open,toggle}, project_explorer.open, global_search.open, conversation_list.open, left_panel.toggle, right_panel.toggle, vertical_tabs.{open,toggle}, agent_management.open |
| `file` | open |

**Notably absent**: Block actions, Auth actions, Drive actions, History actions, and `input.run`. Input staging (`input.insert`, `input.replace`) places text in the editor but cannot submit it. **[V: spec TECH.md §Security gates]**

**Comparison to WezTerm.** WezTerm exposes ~35 typed remote PDU calls plus 19 CLI verbs, all unconditionally available with no opt-in required. warpctrl exposes 84 typed actions but is disabled by default on all public channels and requires same-user credential exchange. Both have roughly comparable breadth of window/tab/pane management. warpctrl adds settings mutation, surface navigation, and file opening. WezTerm adds proxy-standard-stream bridging (`cli proxy`) and Lua runtime control. Neither can drive agent conversations programmatically.

### macOS accessibility tree **[V]**

**Warp does not expose the standard macOS accessibility tree.** The `accessibility.rs` source file states explicitly: "Because Warp uses its own rust UI framework (warpui), we don't benefit from the built-in VoiceOver integration and objc NSAccessibility APIs." **[V: `crates/warpui_core/src/accessibility.rs:1-20`]**

Warp has implemented custom VoiceOver support (announcing focused views, performed actions, and state changes via its own `AccessibilityContent` type). This custom layer enables VoiceOver to work but does not populate the standard AXUIElement hierarchy. External tools that use `AXUIElementCopyAttributeValue`, Appium, or XCUITest to drive macOS applications will find Warp's UI opaque. **[V: same file]**

**Implication for Maestro as host.** Warp cannot serve as a Maestro host via accessibility automation. The only external automation surface is `warpctrl`, which is disabled by default on public channels and requires opt-in configuration. Even then, warpctrl cannot programmatically start agent conversations, send prompts, read agent output, or observe the `Blocked` state. It is a structural automation surface (create tab, focus window, open settings) not an agent-level API. Warp is less automatable as a host than WezTerm, not more.

---

## 9. UI Architecture **[V]**

Warp renders its entire UI through a custom Rust framework (`warpui`, `warpui_core`). The rendering stack uses wgpu, with a Metal backend on macOS (confirmed in blog post and by `is_low_power_gpu_available()` calling `crate::platform::mac::is_low_power_gpu_available()`). **[V: `crates/warpui/src/rendering/mod.rs`]**

The `crates/warpui/src/rendering/wgpu/` directory contains: `mod.rs`, `renderer.rs`, `resources.rs`, `shader_types.rs`, `shaders/`, `atlas/`, `texture_with_bind_group.rs`. This confirms a full GPU pipeline: glyph atlas, shader resources, texture management. **[V: directory listing]**

On macOS with Apple Silicon and discrete GPU, Warp queries for low-power GPU availability and uses the integrated GPU when possible. **[I: `is_low_power_gpu_available()`]**

**Implications:**

1. **No native controls**: No `NSTextField`, `NSButton`, `NSTableView`. All elements are hand-drawn. The macOS menu bar and system-level integrations (drag and drop, Services) exist at the app frame level but not inside the rendered canvas.

2. **No AXUIElement tree**: As stated above. External accessibility tools cannot target individual UI elements within Warp.

3. **GPU memory accumulates with output**: The glyph atlas and rendered block history grow with terminal output. Long-lived Claude/Codex sessions with high output volume produce large physical footprints (11.5GB observed in #13364). This is an intrinsic cost of GPU-rendered unlimited history.

4. **Performance headroom**: At the cost of accessibility, Warp achieves high-throughput terminal rendering at 60fps on 4K/8K displays. This is the trade-off the founders chose explicitly. **[D: blog post]**

The execution mode `ExecutionMode::Tui` suggests a headless terminal UI (TUI) variant of Warp, confirmed by `crates/warp_tui/`. Specs for `code-1822-tui-multi-session` and `code-1946-tui-multi-level-orchestration` show active development on a TUI front-end that shares core logic with the GUI. **[V: crate directory listing and spec directory]**

---

## 10. What Is Genuinely Novel That Maestro Should Consider

### a. Orchestration drill-down bar **[V from specs/code-1946-tui-multi-level-orchestration]**

When multiple agents are running in a hierarchy, Warp presents a **single-row drill-down bar** (called the "orchestration pill bar" in the GUI; "orchestration tab bar" in the TUI). It shows one level of the tree at a time: breadcrumb chips leading back up when drilled below the root, the anchor conversation, and direct children. Selecting a child that is itself an orchestrator descends to that level. A subtree rollup badge shows how many descendants are active beneath an orchestrating child.

This is a solved UX for the problem of "I have 10 agents in a tree; where am I, and what needs me?" without any second row, tree-view panel, or modal. The design principle — **show one level at a time, navigate by selection** — is directly relevant to Maestro's Fleet list and subagent tree view.

Maestro's three-column layout with "selecting a Fleet re-scopes every panel" is conceptually parallel but applied at the Fleet level, not inside a Fleet. Whether a similar drill-down is needed inside a Fleet for subagent navigation is worth examining.

### b. Status badge taxonomy **[V: issue #15362]**

The status overlay on agent tabs has exactly five states: `InProgress`, `Done`, `Blocked`, `Error`, `Cancelled`. The issue body (`app/src/tab.rs:L1293`) confirms these are computed from `ConversationStatus`. The badge renders the CLI agent's brand icon (Claude's C, Codex's C) with the status overlay, making agent type and state visible simultaneously.

This is more information per tab than WezTerm offers, and it is the right taxonomy. Maestro's Attention concept maps cleanly: `Blocked` = Attention. `Done` = unacknowledged finish. `Error` and `Cancelled` are separate states worth distinguishing. The five-state model is a reasonable prior.

### c. Inline speedbump at the moment of pause **[V: QUALITY-512 spec]**

Rather than sending users to settings when a permission is first exercised, Warp embeds a compact permission control inline in the conversation card at the moment the agent pauses. The user sees the pause, sees the control, adjusts it, and continues — all in one location.

Maestro's Attention concept will require surfacing unmatched permission requests. The speedbump pattern solves "discovery without navigation": the permission UI appears exactly where the user's attention already is.

### d. Project-level scheduling semantics **[V: issue #14730]**

Issue #14730 proposes — and the body contains a partial implementation at a linked fork — a nag scheduler where:
- Ranked projects notify immediately and repeat every 3 minutes while blocked.
- Unranked projects debounce 60s then repeat every 15 minutes.
- Looking at the pane silences the cycle; navigating away re-arms.
- The agent leaving `Blocked` is the only terminal condition.

Even as an open issue, the design is concrete and the failure modes are well-articulated. The corollary for Maestro: **Attention should have a severity × age model, not a binary flag.** A Fleet that has been waiting 20 minutes for a permission should feel different from one that asked 10 seconds ago.

### e. `warpctrl` as a scripting API **[V]**

The design of warpctrl — allowlisted actions, exact-action credentials, disabled by default, no submit capability — is a considered trade-off between automation power and security. The catalog covers structural UI manipulation (create tab, focus window, open settings panel) without granting the ability to run arbitrary commands. Maestro will eventually need an equivalent automation surface; warpctrl's security model is worth adopting as a template.

---

## 11. Deliberate Product Disagreements

### Warp is a terminal that grew agents; Maestro is an orchestrator that hosts agents

This origin difference produces real, defensible divergences:

**Isolation posture.** Warp's primary UX is a terminal tab where a CLI agent runs as a child process. Isolation is the user's responsibility (they can use git worktrees if they choose). Maestro's hard worktree rule is a framework invariant, not a user practice. For users who forget to isolate or who run many agents simultaneously, Maestro provides a safety property Warp cannot.

**Lifecycle ownership.** Warp's answer to "what happens when the app quits?" is split: cloud agents survive (server-side), local agents do not (no daemon). This is pragmatic but produces the session-restore gap (#14960). Maestro's "no process may outlive the application" rule is stricter but avoids orphaned processes and makes lifecycle auditable. Warp's hybrid model is harder to reason about.

**Cloud by default.** Warp's headline parallel-agent feature (multiple agents working simultaneously, isolated, scalable) requires cloud execution and Warp's backend. Maestro is strictly local. These are genuinely different bets on the user's trust model: Warp bets that developers will hand their repository to a cloud service for agent execution; Maestro bets they will not (or cannot, for IP or compliance reasons).

**Agent-as-terminal-process vs. agent-as-Fleet.** In Warp, an agent is a tab — it lives and dies with the pane. In Maestro, a Fleet is a first-class durable entity with its own worktree, session, and state, independent of any display surface. Maestro's model makes it natural to have multiple UI presentations of the same Fleet (main window, notification, CLI). Warp's model makes it hard to reattach to an agent from a different window.

**TUI investment.** Warp has an active TUI front-end (`warp_tui`) that shares core logic with the desktop app. The TUI can run multi-agent orchestration, multi-session management, and is being extended to handle multi-level orchestration trees. This is a surface Maestro does not plan; the design work Warp is doing in single-row space-constrained agent hierarchies is worth watching even if the surface is different.

---

## 12. What Is Fragile, Disliked, or Contested

Synthesised from the issue tracker. Only recurring or structurally revealing complaints are cited. Trivial style issues excluded.

**Memory growth with multiple agents (structurally inherent) [V: #13364, #12154, #8314, #7892, #15262]**

The GPU glyph atlas grows proportionally to rendered output and is not bounded by Fleet lifecycle. Running 5 Claude Code sessions simultaneously, each generating thousands of output lines, produces multi-GB footprints that are not reclaimed. Samples from users show 11.5GB physical footprint and 20-40% sustained CPU on Apple Silicon. The root cause (Metal glyph rendering path accumulating per-character glyphs for the full history) is known and being fixed incrementally, but the fix requires bounding the atlas or implementing eviction. This is not yet resolved.

**CLI agent session lost on restart (user-visible today) [V: #14960]**

Windows, tabs, and pane layouts restore across restart. The CLI agent session that was running in that pane does not. The user returns to a bare shell and must manually resume the agent conversation from the agent's own history UI. For users running 3-7 simultaneous Claude sessions, this is a meaningful overhead after any restart or crash.

**Blocked state not surfaced for CLI agents (design bug) [V: #14730]**

The most important Attention signal — agent blocked on permission prompt — is silently dropped for plain CLI-agent panes because `is_long_running()` pre-empts `Blocked` in the status computation. Only orchestrated Oz children propagate `Blocked` correctly. Warp users running Claude Code in terminal tabs (the most common workflow) receive no visual indication that their agent has been waiting for them for 20 minutes.

**Child agent status stuck "Waiting" after completion [V: #15320]**

In orchestration runs, a child agent whose `succeeded` lifecycle event was delivered may still show "Waiting" in the parent's UI. A follow-up ping to the child triggers a spurious `blocked` → `in_progress` event cycle. The child reports "not blocked on anything; status was likely a stale/transient state." The underlying cause is a race between the orchestrator's UI state and the lifecycle event delivery.

**Session restore mismatch after restart [V: #15404, #11751]**

Issue #15404: "Restart restores all terminal sessions in home directory (lost persisted cwd)." Sessions restore with the cwd reset to `$HOME` rather than the persisted working directory. Issue #11751: "Restored agent sessions can show new conversation UI after restart." Separate from the CLI agent restore issue; the restored agent pane opens the wrong conversation UI state.

**warpctrl disabled on public channels [V: README.md spec]**

The only external automation surface — 84 typed actions, no agent API — is disabled by default on Stable and Preview. Users who want to automate Warp must enable it in settings. There is no programmatic API for agent conversations, reading agent output, or observing the Blocked state. This limits warpctrl's usefulness as a Maestro host-surface mechanism.

**QUALITY-1544 (remote children's children invisible) [V: cited in orchestration spec as known gap]**

When a cloud child (e.g., `gamma`) spawns its own cloud grandchild (e.g., `delta`), `delta` never materialises on the client. The orchestration drill-down bar correctly shows the tree structure, but the grandchild row is absent. This is explicitly documented as an out-of-scope gap in the multi-level orchestration spec. **[V: `specs/code-1946-tui-multi-level-orchestration/PRODUCT.md` §Non-goals #7]**

**High CPU at idle on Linux [V: #11024]**

"Warp sustains ~23% CPU at idle after upgrade on Ubuntu Linux." GPU rendering + shell integration polling at idle. Affects users running multiple terminal panes without any agent work.

---

## What This Means for Maestro — Summary

| Dimension | Warp | Maestro implication |
|---|---|---|
| Isolation | Container (cloud) or none (local CLI) | Maestro's hard worktree rule provides a stronger local guarantee than Warp offers. Do not weaken it. |
| Attention | `Blocked` state exists but surfaced incorrectly for CLI agents | Derive Attention from Fleet-level state, not tab metadata. Ship correct semantics from day one. |
| Attention UX | Speedbump inline at point of pause; proposal for severity×age nag scheduler | Both patterns are directly adoptable. The severity×age model is design-ready even if unshipped. |
| Orchestration presentation | Single-row drill-down bar; selection drives level | Relevant if Maestro presents subagent hierarchies inside a Fleet view. |
| Memory | Unbounded GPU accumulation with output volume | Bound visible output or use off-GPU storage for history. Do not hold all Fleet output in GPU memory. |
| Session restore | CLI agents not restored; cloud agents restored (server-side) | Maestro's "processes do not outlive the application" rule eliminates this split. Durable state is in Fleet; process liveness is recomputed on launch. |
| Automation surface | warpctrl (84 actions, disabled by default, no agent API) | Warp cannot be a useful Maestro host. warpctrl's security model (allowlisted actions, short-lived exact-action credentials) is worth adopting for Maestro's eventual scripting API. |
| Accessibility | No macOS AX tree | Warp cannot be driven by standard macOS automation. For Maestro's own host evaluation, WezTerm's `wezterm cli` is more automatable even without an AX tree, because it is unconditionally available. |
| Lifecycle | Cloud survives exit; local does not | Maestro's rule is simpler and more auditable. The hybrid model creates user-visible confusion (#15404, #11751, #14960). |
| GPU rendering | Custom Rust (warpui/wgpu/Metal) | Confirms the "no AX tree" finding. Warp's GPU investment buys rendering performance at the cost of accessibility and external automation. |

---

## Limitations of This Analysis

1. **Server-side behaviour is entirely inferred or undocumented.** Cloud agent isolation (whether each agent gets a true separate clone or a shared mount), container lifetime, server-side depth limits for orchestration, billing-gated feature availability, and Warp Drive sync scope are all **[U]** from the client source.

2. **Warp is under active development.** Multiple issues cited here are marked `ready-to-implement` or have active PRs. The document reflects the state of HEAD on 2026-08-21. The speedbump, project rail nag scheduler, CLI agent restore, and TUI multi-level orchestration features are all in-flight and may land within weeks.

3. **The README "issues-only" claim was not investigated historically.** The date at which Warp transitioned from an issues-only repo to a full source repo was not determined. The source may have been added recently (possibly as an AGPL relicense event). The implications of this transition (server remaining closed, AGPL terms for cloud operators) were not researched.

4. **No hands-on execution.** Process lifecycle behavior on quit (whether CLI agent children receive SIGHUP, whether they survive in the background), actual memory growth curves with multiple simultaneous agents, warpctrl behavior with scripting enabled, and exact restore fidelity were not measured. These require running the product.

5. **The warpctrl protocol version is 1 and marked provisional.** The README calls the naming "provisional" and the action catalog may change. The 84-action count and action names are from the current source and may not match any released version available to users.

6. **Oz cloud agent quality** — actual task completion rate, which models it uses by default, how it handles agent disagreement in multi-agent orchestration, and whether the isolation is actually container-per-run — cannot be evaluated from the client source. User reports in the issue tracker suggest reliability issues (stalled runs, auth failures, child status not propagating) but these are bug reports, not representative performance measurements.

7. **The `specs/` directory contains 300+ design documents** across many product areas. Only a small fraction was read. Architectural details for ambient agents, voice input, computer use, remote server, and full code review are not covered here.
