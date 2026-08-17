# Superset (superset-sh) - Architecture Reference

**Repository:** `superset-sh/superset`, an agentic integrated development environment for orchestrating coding agents. It is unrelated to Apache Superset.

**Evidence:** `3842b447f6c2a96ef54fdb51c784c5fc4149e224` (2026-08-17).

Tags: **[V]** verified · **[I]** interpreted · **[U]** unknown.

## Scope and Orientation

Superset is a Bun and Turborepo TypeScript monorepo containing an Electron desktop application, local host service, pseudoterminal daemon, command-line interface, cloud services, web/mobile clients, relay infrastructure, shared packages, and agent integration tooling.

Repository guidance establishes a self-hosting premise: contributors and agents should orchestrate work through Superset's own CLI rather than manually creating Git worktrees.

macOS is primary. Local development uses Postgres, Neon proxy, Electric, Redis, Caddy, and per-worktree port allocation.

## Observed Vocabulary

- **workspace:** isolated Git worktree, not an editor workspace.
- **project:** cloned repository and worktree base directory.
- **workspace type:** `main`, `worktree`, or `session`.
- **host service:** per-organization local server.
- **host manifest:** process identifier, endpoint, token, and routing record.
- **terminal session:** durable pseudoterminal-backed execution.
- **terminal agent binding:** relationship between an agent lifecycle and terminal.
- **agent definition/preset/config:** launch and capability configuration.
- **lifecycle hooks:** `SessionStart`, `UserPromptSubmit`, `Stop`, `SessionEnd`, `Detached`, `PostToolUse`.
- **pane:** desktop presentation unit.
- **pty-daemon:** process owning pseudoterminals across app restarts.
- **relay:** remote-host routing layer.
- **automation/task/board:** higher-level orchestration concepts.
- **resume candidate:** unexpectedly ended agent eligible for resumption.

## Architecture at a Glance

```text
Electron desktop: main | preload | renderer panes
  +-- host-service coordinator --spawns one per organization----+
  +-- browser bridge: loopback HTTP/WebSocket + CDP             |
  +-- agent setup: ~/.superset hooks, wrappers, global configs  |
  +-- desktop SQLite: settings and panes                        v
                                                     host-service (Hono)
CLI `superset` --manifest or relay--------------->  +-- tRPC routers
                                                     +-- terminal/events/chat/browser routes
                                                     +-- host SQLite
                                                     +-- EventBus/GitWatcher/PR runtime
                                                     +-- pty-daemon -> PTYs -> coding-agent CLIs
                                                               ^
                                                      lifecycle hooks

Cloud: API · web · relay · Electric proxy · Postgres
```

## Runnable and Deployable Units

- **Electron desktop:** single-instance application with `superset://` deep links.
- **Host service:** Hono child process per organization, bound to loopback and monitored through the parent process.
- **pty-daemon:** owns pseudoterminals so sessions survive desktop restarts.
- **terminal-host:** legacy terminal implementation still present.
- **CLI:** bundled `superset` shim installed by the desktop application.
- **Cloud services:** API, web, marketing, docs, admin, relay variants, Electric proxy, streams, and Discord triage.
- **Mobile:** Expo application.
- **Development stack:** `bun run dev` starts API, web, desktop, Electric proxy, and Caddy.
- **Release:** desktop, host service, and CLI share a version.

## Modules and Responsibilities

| Module | Owns | Called by | Calls |
|---|---|---|---|
| Desktop `main/index.ts` | App lifecycle, protocols, setup, coordinator | Electron | Coordinator, bridge, local DB, agent setup |
| Host-service coordinator | Spawn/reconcile/stop per organization | Desktop main, auth events | Host-service child, health polling |
| Host-service `app.ts` | Composition root, routes, events, runtimes, tRPC context | Host entry, tests | DB, Git, terminals, chat |
| Host tRPC routers | Workspace, terminal, agents, browser, and other domains | Renderer, CLI, relay | Stores, terminal, GitHub |
| Host terminal modules | PTY sessions, environment, reaping, adoption | Agent and terminal routers | pty-daemon client |
| Terminal-agent store | Bindings, lifecycle, end/resume semantics | Router, hook receiver | Host SQLite |
| Shared agent packages | Catalog, prompts, launch/model arguments | Host, desktop, CLI | Agent command lines |
| Agent setup | Hooks, wrappers, global configuration merging | Desktop main | User-home configuration |
| CLI | Commands and local/remote host routing | Humans, agents, automation | Host tRPC/WebSocket, cloud API |
| Database packages | Cloud, desktop, and host stores | API, desktop, host service | Drizzle and SQLite/Postgres |

## Main Execution and Data Flow

### Desktop Boot and Host Ownership [V]

Desktop startup acquires a single-instance lock, registers protocols, reconciles daemon sessions, and starts the browser bridge before spawning host services.

The coordinator reconciles one host service per organization. Authentication changes increment a generation and immediately stop old services.

Each host service writes a manifest containing its process identifier, endpoint, authentication token, and organization. A new process yields to a healthy holder and periodically reclaims ownership when necessary, keeping CLI routing pointed at a live instance.

### Workspace Lifecycle [V]

A workspace is a host-SQLite row backed by a worktree path, branch, type, project, upstream references, task, and archival state.

A partial unique index enforces one main workspace per project. Session workspaces may be standalone managed directories.

Startup sweeps backfill projects, reconcile main workspaces, and repair archived workspace state. These sweeps are skipped in sandbox mode to avoid inventing rows.

### Agent Launch [V]

`agents.run` resolves a host agent configuration by instance or preset, validates model, effort, and resume capabilities, then builds the launch command.

Prompts travel through positional arguments or a standard-input heredoc. Environment overlays and attachment blocks are added before creating a terminal session with the command as `initialCommand`.

The built-in catalog contains approximately 15 terminal agents, including Claude, Codex, Gemini, OpenCode, Copilot, Grok, Cursor Agent, and others. Identity-only agents can be recognized but not launched.

### Agent Visibility and Resume State [V]

Terminal environments include terminal/workspace identifiers, Superset home, and a lifecycle-hook URL.

Hook events enter `TerminalAgentStore.recordEvent`, which upserts bindings and distinguishes:

- **Detached:** the agent ended itself; not resumable.
- **exit/error:** terminal died unexpectedly; becomes a resume candidate.

A 30-second straggler window prevents late events from deleting session identity.

`terminalAgents.getOrCreate` reuses a live binding or starts a terminal and waits up to ten seconds for the first hook. On timeout, it disposes the orphan pseudoterminal. An explicit status-clear operation handles wedged indicators.

### Machine-Global Hook Installation [V]

Every desktop boot writes Superset hooks and command wrappers under `~/.superset`, then merges hook registrations into each supported agent's global configuration.

Runtime scoping is intended through a `SUPERSET_HOME_DIR` guard. `HOOKS_INVESTIGATION.md` records that several integrations were never migrated to the guard, so their hooks can fire in unrelated terminals. No uninstall cleanup removes those registrations.

### CLI and Remote Routing [V]

`resolveHostTarget` requires an explicit host identifier.

- **Local host:** read the manifest and validate the process.
- **Remote host:** build a relay routing key and use relay tRPC/WebSocket endpoints.

Host streaming routes use pre-shared-key authentication through a header or query token.

The `superset browser` command controls guest web contents inside browser panes through the loopback bridge and raw Chrome DevTools Protocol, not the application shell.

## Callers, Consumers, Integrations, and Persistence

**Consumers:** desktop renderer panes, CLI users, coding agents, automations, mobile/web clients, and remote relay clients.

**Integrations:** GitHub through Octokit and `gh`, provider OAuth and API keys, Sentry, PostHog, Electric synchronization, Neon Postgres, coding-agent command lines, and Chrome DevTools Protocol.

Three stores have distinct ownership:

1. **Cloud Postgres:** shared cloud entities and migrations.
2. **Desktop SQLite:** settings, disabled hooks, and pane state.
3. **Host SQLite:** operational source of truth for workspaces, terminals, bindings, agent configurations, and pull requests.

`terminal_sessions.disposeRequestedAt` persists intent to terminate so the reaper can retry failed kills.

## Test Seams

Tests are colocated `*.test.ts` files using Bun. Real terminal behaviors use `*.node-test.ts`.

Terminal tests cover pseudoterminal adoption, sequence catch-up, daemon stall retry, and shell-readiness learning.

Architectural tests enforce boundaries:

- `no-electron-coupling.test.ts` prevents host-service imports of Electron.
- Main-loop and daemon-loop tests prevent blocking operations.
- `createApp` exposes explicit test-only overrides for database, API, GitHub, shell execution, and chat services.

## Distinctive Mechanisms

- Worktree is the primary workspace abstraction.
- Desktop owns lifecycle while host service owns orchestration state.
- Host manifests form the CLI's local routing table.
- Pseudoterminals survive desktop restarts through a separate daemon.
- Agent visibility is reconstructed from lifecycle hooks and durable bindings.
- Agent endings distinguish deliberate detach from resumable failure.
- Machine-global setup adapts multiple agent CLIs into one lifecycle protocol.
- Local and remote hosts share the same typed API surface.
- Browser panes expose a separate automation bridge.
- The repository dogfoods its own orchestration CLI.

## Foundational Versus Replaceable

**Foundational [I]:**

- worktree-as-workspace model;
- per-organization host service;
- host-local operational SQLite;
- terminal/pseudoterminal contract;
- lifecycle-hook-to-binding state machine;
- typed tRPC host surface.

**Replaceable or extensible [V]:**

- `host_agent_configs` and custom agent identifiers;
- provider authentication, credentials, and host-auth injection;
- agent commands and skills;
- per-agent wrapper/setup modules;
- relay implementation;
- browser/CDP automation;
- cloud synchronization services.

## Constraints and Risks

### Constraints [V]

- Development uses fixed ports derived from one base, allowing only one desktop development stack across worktrees.
- CLI testing against development must use the development CLI wrapper because desktop and cloud authentication organizations differ.
- Streaming connections do not stop cleanly with ordinary server close; shutdown force-closes them after a grace period.
- Host services are loopback-bound and routed through manifests or relay.
- Desktop, host service, and CLI share release versions.

### Risks [V]

- Machine-global hook registrations have incomplete runtime guards.
- Many agents launch with permission-bypass flags.
- The lifecycle-hook endpoint is intentionally unauthenticated.
- Sandbox mode forwards provider API keys into terminal environments.
- Legacy and replacement terminal/hook systems coexist.
- Native dependencies still assume Electron resolution despite the host-service decoupling goal.

## Intent Versus Implementation

**Intent:** the host service is independently deployable and Electron-free. A source-scanning architecture test enforces this boundary.

**Implementation:** native dependencies still assume Electron packaging behavior, and legacy terminal-host/Electron hook paths coexist with the newer daemon/host-service paths.

`chat-v3`, `relay2`, and cloud sandbox behavior remain in-flight.

## Unknowns

- Cloud API, relay variants, and stream ownership were not deeply read.
- The concrete worktree-creation and setup-script chain was not located.
- Automation/task scheduling internals were not inspected.
- Pane and renderer state machines were not inspected.
- GitHub code search was unavailable; claims rely on direct file reads.

## Recommended Reading Order

1. `AGENTS.md`
2. `DEVELOPMENT.md`
3. `docs/agent-tooling.md`
4. Desktop main entry
5. Host-service coordinator
6. Host-service composition root
7. Host database schema
8. Host tRPC router
9. Agent router
10. Terminal-agent store
11. Terminal environment contract
12. Built-in agent catalog
13. CLI host-target resolution
14. `HOOKS_INVESTIGATION.md`

## Pinned Evidence Index

| Evidence | Proves |
|---|---|
| [`AGENTS.md`](https://github.com/superset-sh/superset/blob/3842b447f6c2a96ef54fdb51c784c5fc4149e224/AGENTS.md) | Monorepo thesis, workspace definition, CLI-first orchestration |
| [`host-service/app.ts`](https://github.com/superset-sh/superset/blob/3842b447f6c2a96ef54fdb51c784c5fc4149e224/packages/host-service/src/app.ts) | Composition root, startup sweeps, routes, tRPC context |
| [`desktop host-service entry`](https://github.com/superset-sh/superset/blob/3842b447f6c2a96ef54fdb51c784c5fc4149e224/apps/desktop/src/main/host-service/index.ts) | Child lifecycle, watchdog, manifest ownership |
| [`host DB schema`](https://github.com/superset-sh/superset/blob/3842b447f6c2a96ef54fdb51c784c5fc4149e224/packages/host-service/src/db/schema.ts) | Workspaces, terminals, bindings, projects, agent configurations |
| [`agents router`](https://github.com/superset-sh/superset/blob/3842b447f6c2a96ef54fdb51c784c5fc4149e224/packages/host-service/src/trpc/router/agents/agents.ts) | Agent command construction and terminal launch |
| [`terminal-agent store`](https://github.com/superset-sh/superset/blob/3842b447f6c2a96ef54fdb51c784c5fc4149e224/packages/host-service/src/terminal-agents/store.ts) | Binding lifecycle and resume semantics |
| [`terminal environment`](https://github.com/superset-sh/superset/blob/3842b447f6c2a96ef54fdb51c784c5fc4149e224/packages/host-service/src/terminal/env.ts) | Terminal identity and hook contract |
| [`HOOKS_INVESTIGATION.md`](https://github.com/superset-sh/superset/blob/3842b447f6c2a96ef54fdb51c784c5fc4149e224/HOOKS_INVESTIGATION.md) | Machine-global hook-registration risk |

**Status:** approved architecture reference; no secrets reproduced.
