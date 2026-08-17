# Herdr - Architecture Reference

**Evidence:** `herdrdev/herdr@f76d7df549e95e1699651f59916e9a38f0f58985` (master, 2026-08-13). Crate `herdr` 0.8.0. Analyzed read-only 2026-08-17.

Tags: **[V]** verified · **[I]** interpreted · **[U]** unknown.

## Scope and Orientation

Descriptive record of runnable units, boundaries, ownership, flows, seams, and constraints. No redesign or adoption guidance. Rendering detail, complete keybinding tables, benchmarks, and website content are excluded.

## Observed Vocabulary [V]

**Workspace** (`w<N>`, owns tabs) · **Tab** (`w<N>:t<M>`, a layout) · **Pane** (`w<N>:p<M>`, viewport onto a terminal) · **Terminal** (`TerminalState` durable state plus `TerminalRuntime` live state) · **Agent** (21 recognized process kinds) · **Agent state** (`Idle`, `Working`, `Blocked`, `Unknown`) · **Agent status** (adds projected `Done`) · **Session** · **Server/client** · **Foreground client** · **Hook authority** · **Manifest** · **Plugin** · **Integration** · **Live handoff** · **Metadata token** · **Agent view**.

## Architecture at a Glance

```text
herdr client                    CLI / plugin / agent hook
     | private binary socket              | public NDJSON API
     v                                    v
+-------------------- detached herdr server --------------------+
| HeadlessServer loop -> App + AppState -> TerminalRuntimeRegistry |
|          |                    |                   |             |
|          +-- render/events ---+                   +-- PTY ------+-- shell/agent
|          +-- snapshots/plugins/history -> disk                  |
+---------------------------------------------------------------+
     | live handoff: token + Unix file-descriptor transfer
     v
replacement server (--handoff-import)
```

Remote attach tunnels the same protocol rather than creating another model.

## Runnable Units and Process Boundaries [V]

One Rust crate produces one binary whose role is selected by arguments:

- auto-detected launch: probe, spawn daemon, attach;
- detached `server`;
- `server --handoff-import`;
- thin `client`;
- `--no-session` monolithic mode;
- `--remote` and `remote-client-bridge`;
- `terminal attach|observe|control`;
- 16 command-line groups;
- updater.

Five principal boundaries exist:

1. **Client/server:** private binary socket, exact protocol-version gate, framed size caps.
2. **Automation/server:** public newline-delimited JSON API, thread per connection, request cap.
3. **Server/pane:** pseudoterminal using vendored `portable-pty` and `libghostty-vt`.
4. **Old/new server:** handoff token plus file-descriptor transfer.
5. **Server/plugin or hook:** spawned processes receive `HERDR_*` environment values and call the public API.

Nonbinary units include a marketplace worker, Astro documentation site, vendored native cores, packaging, and multi-platform CI.

## Modules and Responsibilities [V]

| Module | Owns | Called by | Calls |
|---|---|---|---|
| `main.rs` | Role selection and monolithic host setup | Operating system | CLI, auto-detect, server, client, app |
| `cli/*` | Parsing, output, exit codes | `main` | API client, session, config |
| `server/autodetect.rs` | Launch decision, daemon spawn, readiness | `main`, remote path | IPC, status API, platform, client |
| `server/headless.rs` | Server loop, clients, foreground arbitration, rendering, handoff | `main`, tests | App, transport, render stream, handoff |
| `api/*` | Listener, schema, events, subscriptions, waits, status | Server, CLI | App through channels |
| `app/*` | App wiring, pure state, API handling, input, plugins | Server, monolithic mode | Workspace, terminal, detection, persistence |
| `terminal/*` | Terminal identity, agent arbitration, live registry | App, server | Pane runtime, detection, resume |
| `pane*`, `pty/*`, `ghostty/*` | Pseudoterminal runtime, parser, detection task | Terminal runtime | Platform and detection |
| `detect/*` | Agent taxonomy, manifests, remote rules | Pane, app, terminal | Platform and config |
| `persist/*`, `config/*`, `platform/*` | Snapshots, registry, configuration, operating-system behavior | App, server, client | Serialization and OS libraries |

No `CODEOWNERS` file was found **[U]**. `AGENTS.md` declares state/runtime separation, pure rendering, isolated platform code, decoupled detection, and a guardrail against shared behavior that only works through the private socket.

## Main Execution and Data Flow [V]

### Startup and Attach

Arguments select session and remote behavior before command-line ownership is claimed. Auto-detection probes the client socket and validates the running server's protocol through the public status API before attempting the private binary handshake.

If no compatible server exists, Herdr spawns a detached daemon, seeds startup working-directory state, clears inherited socket overrides, and polls readiness for up to 15 seconds. The server loads configuration, starts the API, restores its snapshot, seeds a workspace, runs plugin startup hooks, then accepts the binary `Hello`/`Welcome` handshake.

### Server Loop

Each iteration:

1. reaps commands and checks shutdown;
2. drains render signals and internal events;
3. expires metadata;
4. drains API requests and classifies rendering impact;
5. accepts and services clients;
6. runs scheduled and deferred work;
7. selects full, retained-graphics, retained-pseudoterminal, or hidden rendering;
8. otherwise waits on events, deadlines, or render notification.

Session state is persisted on exit.

### Discovery and Addressing

Socket selection follows:

```text
--session -> HERDR_SOCKET_PATH -> legacy client variable -> session directory
```

The default session lives in the configuration directory; named sessions live under `sessions/<name>`. `session list` discovers session directories and probes their sockets.

The public API uses request identifiers, method names, and parameters across approximately 92 methods in 15 namespaces, with an in-binary JSON Schema.

### Pane and Agent Visibility

`PaneState` holds only attachment and presentation facts. Durable terminal facts live in `TerminalState`; live pseudoterminals live in a registry outside `AppState`.

A task polls foreground process groups, jobs, agent hints, and screen text approximately every 300 ms. Agent naming layers are:

```text
detected kind -> agent_name -> manual_label -> terminal title
```

Agent status is projected: unseen idle becomes `Done`. Attention rolls up in the order `Blocked > Done > Working > seen Idle > Unknown`.

Hidden panes continue parsing terminal output, but presentation fan-out occurs only when a visible app client or direct terminal client needs it. `agent.view.set` creates server-side filtered and sorted projections.

### State Authority, Plugins, and Persistence

Live integration reports outrank screen detection while their process remains alive. When authority ends, manifest-driven detection resumes. Detection rules layer bundled, remote, and local manifests and can reload without rebuilding.

Plugins are process-based packages described by `herdr-plugin.toml`. They contribute actions, events, panes, and link handlers under bounded output, concurrency, and logging limits.

Persistence uses atomic temporary-file replacement for:

- `session.json`, snapshot version 3;
- optional `session-history.json`;
- `plugins.json`.

A snapshot from a newer unsupported version is ignored wholesale.

### Errors and Handoff

The API returns typed code/message errors. App timeouts become `server_unavailable`. Startup distinguishes stale from live sockets and guards protocol-mismatch reporting.

Live handoff transfers durable state and Unix file descriptors to a replacement server with bounded replay data. Failure rolls back to the original process.

## Callers, Integrations, and Persistence [V]

Inbound callers include terminal user-interface clients, command-line commands, coding agents running inside panes, integration hooks, plugins, event subscribers, and replacement servers.

Outbound integrations include `herdr.dev` update and detection manifests, SSH, Git, agent command-line tools, host notifications, clipboard, and sound.

Pane processes receive `HERDR_ENV`, socket and binary paths, workspace/tab/pane identifiers, and allow-listed plugin variables. Built-in integrations are separately versioned assets installed into each agent's own configuration directory. Hooks report state through `pane.report_agent*`.

## Distinctive Mechanisms [V]

- stable public API probes compatibility before private protocol use;
- two asymmetric control planes;
- exact protocol-version matching;
- durable state separated from live runtime;
- hook authority layered over heuristic detection;
- detection rules represented as data;
- `Done` represented as a projection, not stored state;
- visibility-gated rendering;
- one foreground client controls shared presentation state;
- two render encodings;
- unchanged protocol tunneled for remote attachment;
- live handoff through pseudoterminal file descriptors;
- explicit restoration ladder;
- bounded declarative layouts;
- sequenced time-to-live metadata;
- first-class subscriptions and waits;
- public identifiers decoupled from internal identifiers;
- input leases;
- nested-Herdr refusal;
- architectural boundaries tested automatically.

## Extension Seams [V]

Public API methods, event subscriptions and waits, hook reporting, layered detection manifests, process-based plugins, plugin distribution, integration assets, `herdr --skill`, layout export/apply, terminal attachment modes, graphics streaming, live-reloaded configuration, client keybinding profiles, and the pane environment contract.

## Foundational Versus Replaceable [I]

**Foundational:** workspace/tab/pane identity, `TerminalState` and `TerminalId`, agent-state arbitration, API namespaces and event kinds, wire protocol and version gate, session addressing, snapshot schema, and `AppState` purity.

**Replaceable:** terminal-emulation core, pseudoterminal backend, render encoding, terminal user-interface renderer, platform implementation, IPC substrate, detection rules, notification/sound/clipboard delivery, update channel, and remote transport.

**Peripheral:** marketplace worker, documentation site, packaging, and independently versioned integration assets.

## Test Seams [V]

- `AppState::test_new()` and `Workspace::test_new()` provide pseudoterminal-free construction.
- `assert_invariants_for_test()` checks identity invariants.
- Protocol tests cover framing and version compatibility.
- Socket tests cover precedence and stale/live distinctions.
- Auto-detection tests cover daemon environment and session leadership.
- `tests/server_headless.rs` exercises both sockets, startup, ping, cleanup, disconnect survival, and duplicate starts.
- Cross-process suites cover detach/reattach, multiple clients, live handoff, and client mode.
- Twelve suites exercise command-line surfaces.
- A Python architecture test protects the user-interface hot path.
- `just test` and `just check` include maintenance-script verification.

## Constraints and Risks [V]

- Protocol compatibility requires exact equality.
- Unsupported future snapshots fail closed.
- Exactly one foreground client drives shared state.
- Hidden panes parse but cannot trigger presentation work.
- The server remains headless; clients perform local sound, notifications, and input-source switching.
- Live handoff does not preserve in-flight requests, waits, or streams.
- Native resume depends on current official integrations.
- Pane history is disabled by default and stores raw terminal escapes when enabled.
- File-descriptor handoff is Unix-only.
- Builds require a specific Zig version and reversible vendor patches.
- Plugin execution is capped.
- Agent detection remains heuristic and remotely updateable.

`server/headless.rs` contains roughly 5,200 lines and 80 methods, making it the largest coordination surface **[I]**.

## Intent Versus Implementation

**Aligned [V]:** always-running server with thin clients; state/runtime separation; decoupled detection; isolated platform code; agent-native control; one binary.

**Implementation superset [V]:** documentation lists five statuses, while `Done` exists only as an API projection of unseen-idle.

**Migration in progress [V]:** `TerminalState` still documents one-to-one pane-backed pseudoterminals, and `TerminalRuntime` delegates to `PaneRuntime`, while repository guidance prohibits deepening server/user-interface coupling.

**Unknown [U]:** exhaustive render-purity conformance.

## Unknowns [U]

- per-directory ownership;
- complete request and response shapes for every API method;
- snapshot migration history;
- Windows ConPTY and Windows Management Instrumentation runtime behavior;
- remaining remote-attachment behavior;
- graphics internals;
- release workflow topology;
- whether server-loop concentration is intentional staging.

## Recommended Reading Order

1. `README.md` and concepts documentation
2. `AGENTS.md:26-79`
3. `src/main.rs:511-606`
4. `src/server/autodetect.rs`
5. Socket paths and sessions
6. `src/protocol/wire.rs`
7. Public API modules
8. `src/server/headless.rs`
9. `src/app/`
10. `src/terminal/`
11. `src/detect/` and one manifest
12. `src/persist/`
13. Plugins and integrations
14. `tests/server_headless.rs` and `justfile`

## Pinned Evidence Index

| Evidence | Proves |
|---|---|
| [`src/main.rs:511-606`](https://github.com/herdrdev/herdr/blob/f76d7df549e95e1699651f59916e9a38f0f58985/src/main.rs#L511-L606) | Runtime-role selection |
| [`src/server/autodetect.rs:150-306`](https://github.com/herdrdev/herdr/blob/f76d7df549e95e1699651f59916e9a38f0f58985/src/server/autodetect.rs#L150-L306) | Compatibility probe, daemon spawn, attachment |
| [`src/protocol/wire.rs:16-66`](https://github.com/herdrdev/herdr/blob/f76d7df549e95e1699651f59916e9a38f0f58985/src/protocol/wire.rs#L16-L66) | Frame caps and encodings |
| [`src/protocol/wire.rs:986-1021`](https://github.com/herdrdev/herdr/blob/f76d7df549e95e1699651f59916e9a38f0f58985/src/protocol/wire.rs#L986-L1021) | Exact protocol-version gate |
| [`src/server/headless.rs:544-904`](https://github.com/herdrdev/herdr/blob/f76d7df549e95e1699651f59916e9a38f0f58985/src/server/headless.rs#L544-L904) | Server loop |
| [`src/server/headless.rs:4058-4090`](https://github.com/herdrdev/herdr/blob/f76d7df549e95e1699651f59916e9a38f0f58985/src/server/headless.rs#L4058-L4090) | Visibility-gated rendering |
| [`src/api/server.rs:59-135`](https://github.com/herdrdev/herdr/blob/f76d7df549e95e1699651f59916e9a38f0f58985/src/api/server.rs#L59-L135) | Public API transport |
| [`src/terminal/state.rs:1-151`](https://github.com/herdrdev/herdr/blob/f76d7df549e95e1699651f59916e9a38f0f58985/src/terminal/state.rs#L1-L151) | State arbitration |
| [`src/app/api_helpers.rs:99-110`](https://github.com/herdrdev/herdr/blob/f76d7df549e95e1699651f59916e9a38f0f58985/src/app/api_helpers.rs#L99-L110) | `Done` projection |
| [`src/detect/manifest.rs:49-112`](https://github.com/herdrdev/herdr/blob/f76d7df549e95e1699651f59916e9a38f0f58985/src/detect/manifest.rs#L49-L112) | Detection as data |
| [`src/persist/snapshot.rs:12-140`](https://github.com/herdrdev/herdr/blob/f76d7df549e95e1699651f59916e9a38f0f58985/src/persist/snapshot.rs#L12-L140) | Snapshot persistence |
| [`src/app/api/plugins/runtime.rs:11-78`](https://github.com/herdrdev/herdr/blob/f76d7df549e95e1699651f59916e9a38f0f58985/src/app/api/plugins/runtime.rs#L11-L78) | Plugin execution caps |

**Status:** approved architecture reference; read-only and descriptive.
