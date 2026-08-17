# WezTerm - Architecture Reference

**Evidence:** `fe3006aefcdc4c22924e7bce966b2c430dade4f1` (2026-08-12). `CODEC_VERSION = 45`. Analysis date: 2026-08-17.

Tags: **[V]** verified · **[I]** interpreted · **[U]** unknown.

## Scope

Repository-depth map of binaries, process and pseudoterminal boundaries, mux core, graphical user interface, client/server protocol, terminal parsing/rendering, domains, workspaces, notifications, Lua configuration, persistence, and tests.

Excluded: font shaping, detailed operating-system window backends, bidirectional-text internals, packaging, and exhaustive Lua API documentation.

## Observed Vocabulary

- **Mux:** process-global registry of panes, tabs, windows, domains, clients, and workspaces.
- **Domain:** spawn/attach authority for a set of terminal resources.
- **Pane:** terminal surface backed by a pseudoterminal or remote identifier.
- **Tab:** binary tree of panes and split geometry.
- **Window:** ordered tabs associated with a workspace.
- **Workspace:** named grouping of windows.
- **TermWindow:** operating-system window rendering one mux window.
- **MuxNotification:** internal 18-variant event fan-out.
- **PDU:** protocol data unit crossing the wire.
- **Overlay:** graphical user-interface-local synthetic pane.
- **Alert:** terminal-originated event.
- **gui-sock:** per-process graphical user-interface socket.
- **InputSerial:** predictive-echo reconciliation stamp.

## Architecture at a Glance

```text
wezterm CLI --exec--> wezterm-gui
     |                     |
     | typed PDU           +-- GuiFrontEnd -> TermWindow -> OS window/GPU
     |                     |
     +--------------> process-local Mux
                              |
                              +-- Domain -> PTY -> child process
                              +-- MuxNotification -> GUI
                              +-- gui-sock listener

wezterm CLI --typed PDU--> wezterm-mux-server
                                  |
                                  +-- headless Mux -> Domain -> PTY

GUI Mux --ClientDomain/PDU--> remote/headless Mux
Lua configuration ----------> Mux, GUI, and window layers
```

## Runnable Units and Process Boundaries

`Makefile` builds four binaries:

- **`wezterm`:** command-line front door; executes `wezterm-gui` for graphical verbs.
- **`wezterm-gui`:** graphical user interface, mux host, and local socket server.
- **`wezterm-mux-server`:** headless mux daemon; fork-and-reexec avoids corrupting async-runtime global state.
- **`strip-ansi-escapes`:** stream utility.

Important boundaries:

1. `wezterm` to `wezterm-gui` through process execution.
2. Graphical process acting as mux server.
3. Client/server protocol over Unix sockets, Transport Layer Security, or Secure Shell.
4. Mux to pseudoterminal to child process.
5. Graphical user interface to operating-system window and graphics processor.
6. `wezterm cli proxy` bridging standard input/output to a socket.

Runtime threads include the Lua-owning main thread, graphical event loop, per-pane reader/parser pairs, listener threads, and reconnecting client threads.

## Modules and Responsibilities

| Crate | Responsibility | Called by | Depends on |
|---|---|---|---|
| `wezterm-gui` | `TermWindow`, frontend, renderer, overlays | Binary entry | `mux`, `window`, client, config |
| `wezterm` | CLI verbs and graphical delegation | Binary entry | Client, codec, config |
| `wezterm-mux-server` | Daemonization and listeners | Binary entry | Mux, server implementation, config |
| `mux` | Mux, domain, pane, tab, window, pseudoterminal pipeline | GUI, server, client | Terminal, PTY, config, Lua |
| `codec` | Protocol data units, framing, version | Client, server, GUI | Mux, config, terminal types |
| `wezterm-client` | Client, remote domains, discovery | GUI, CLI, server | Codec, mux, config |
| `wezterm-mux-server-impl` | Session handling, dispatch, listeners, public-key infrastructure | GUI, daemon | Mux, codec |
| `config` | Configuration handles, Lua context, events, directories | Most higher layers | Lua |
| `window` | Window abstraction and operating-system backends | GUI | Config and renderers |
| `term`, `termwiz`, `pty` | Terminal model, escape parsing, pseudoterminal | Mux, GUI | Lower-level libraries |

## Foundational Versus Replaceable

**Foundational [V]:**

- `portable-pty`, `termwiz`, and `wezterm-term` are published, configuration-independent crates checked separately.
- Mux identity and global ownership.
- Protocol data units and exact codec versioning.
- Configuration and Lua as cross-cutting infrastructure.

**Less substitutable [V]:**

- `config`, `mux`, `codec`, and `wezterm-gui` are unpublished and structurally coupled.
- `codec` embeds mux and configuration types, producing exact-version coupling.
- `window` advertises a cross-platform abstraction but still depends on application configuration and key assignments.

**Replaceable seams [I]:**

- `Domain` implementations;
- operating-system window backends;
- graphical renderer;
- connection transport;
- published terminal and pseudoterminal libraries;
- Lua-defined execution domains.

## Main Execution and Data Flow

### Graphical Startup

The graphical path bootstraps environment handling, registers Lua modules, initializes configuration, and creates the initial local domain and global mux.

It then creates the frontend, starts asynchronous graphical setup, binds `gui-sock-<pid>`, emits `gui-startup`, attaches the domain, creates the first tab, emits `gui-attached`, and enters the graphical event loop.

### Instance Coalescing

A new graphical invocation discovers a published socket using window class. Before reuse, it verifies protocol compatibility, executable path, and configuration-file path.

If all match, the new process sends `SpawnV2` to the existing graphical process and exits. Flags such as `--always-new-process`, `--position`, or explicit configuration can force a separate process.

### Spawn to Pseudoterminal to Pane

```text
Domain::spawn -> spawn_pane -> openpty -> spawn child
              -> Terminal::new -> LocalPane -> Mux::add_pane
```

Adding a pane installs clipboard and download handlers, starts reader/parser threads, and emits `PaneAdded`. Spawn failure still creates a pane and writes the error into its terminal stream.

### Terminal Output to Rendering

A blocking reader sends pseudoterminal bytes through a one-mebibyte socket pair to a parser thread. The parser batches actions and deliberately waits for a configured coalescing interval to combine output from inefficient terminal applications.

Synchronized-output escape handling can hold and flush updates explicitly. Parsed actions mutate terminal state and emit pane-output notifications. `TermWindow` invalidates and repaints.

Graphics allocation degrades rather than failing immediately:

```text
clear atlas -> grow atlas -> scale images 2x/4x/8x -> disable images
```

### Client/Server Synchronization

Server dispatch multiplexes readable data, writable data, and mux notifications. Sequence numbers and range sets calculate per-pane render deltas.

Only 11 of 18 mux notifications cross the wire. Pane-added, window lifecycle, active-workspace, download, and empty-state events remain local. Remote clients therefore receive a reduced projection.

Clients may predict local echo when latency crosses the configured threshold, reconciling through `InputSerial`. Reconnection backs off from one to ten seconds.

### Configuration and Lua

Configuration resolution follows:

```text
--config-file -> WEZTERM_CONFIG_FILE -> portable location
              -> XDG location -> ~/.wezterm.lua
```

Lua is thread-local to the main thread; off-thread access panics. Module loading is wrapped so every required file enters the watch list.

Event handlers run in order and stop when one returns `false`. Observed events include `mux-startup`, `gui-startup`, `gui-attached`, `window-config-reloaded`, and `update-status`.

## Callers, Consumers, Integrations, and Persistence

Four major `MuxNotification` consumers exist:

- **`GuiFrontEnd`:** workspace reconciliation, notifications, clipboard, downloads.
- **`TermWindow`:** per-window filtering.
- **Server dispatch:** notification-to-protocol conversion.
- **`ClientDomain`:** mirrors remote changes, including title-loop suppression.

Integrations include Secure Shell, Transport Layer Security, Windows Subsystem for Linux, execution domains, serial devices, tmux control mode, SSH-agent proxying, desktop notifications, URL opening, clipboard, downloads, and Git-based Lua plugins.

Persistence includes runtime sockets and public-key material, emoji frecency, downloaded plugins, and blob leases.

**[I] No session-state serialization was found.** Session durability equals mux-process lifetime.

## External Desktop-Shell Seams

Descriptive integration surfaces relevant to a surrounding desktop shell:

1. Launch flags for class, workspace, domain, position, tabs, attachment, and process isolation.
2. Window class as both graphical identity and socket-publication key.
3. Explicit reuse-versus-new-process gate.
4. Nineteen CLI verbs, roughly 35 typed remote calls, and JSON output.
5. Socket targeting through environment, published class socket, or configured Unix domain.
6. `cli proxy` standard-stream bridge.
7. Startup events and default graphical startup arguments.
8. Runtime Lua control through mux and window APIs.
9. Lua-defined `ExecDomain`.
10. Live socket discovery ordered by process age.
11. Window events including drag-and-drop.

Notably absent are external rendering hooks, overlay remote procedure calls, and session snapshot/restore. The external surface is command-rich but comparatively event-poor.

## Test Seams

- `TestTerm` provides a headless terminal harness and stub configuration.
- Terminal suites cover control characters, escape sequences, images, and selections.
- Trait seams such as `Domain`, `Pane`, `Clipboard`, `PtySystem`, and `WindowOps` permit substitutes **[I]**.
- Unit tests cover pane behavior, geometry, shape caching, and quick selection.
- Secure Shell integration tests use a real server.
- Bidirectional-text tests use conformance fixtures.
- `cargo nextest run` is the main suite.
- Separate checks enforce lower-layer independence.
- NixOS virtual machines exercise GNOME and Plasma desktops.

**[U]** No cross-process codec integration test was found.

## Constraints and Risks

- Protocol compatibility requires exact `CODEC_VERSION`.
- Graphical-process reuse requires matching executable and configuration paths.
- The mux is a process-global singleton.
- Lua and mux notifications have main-thread affinity.
- Each pane uses two threads and a one-mebibyte socket pair.
- Output coalescing deliberately adds latency.
- Unsafe runtime-directory permissions fail startup.
- The async runtime makes in-process forking unsafe.
- Notification asymmetry forces polling for some remote state.
- Per-connection notification channels appear unbounded **[I]**.
- Lua is vendored into every mux-linking process.
- `window` depends on application configuration.
- `WEZTERM_UNIX_SOCKET` overrides all other targeting.
- Multiplexing documentation describes the feature as young and rapidly evolving.

## Intent Versus Implementation

**Aligned [V]:**

- terminal core is window-system agnostic;
- configuration may be evaluated repeatedly;
- protocol structures are explicitly mutable and versioned.

**Stale documentation [V]:** contributor documentation references a top-level `src/` directory that no longer exists.

**Simplification [V]:** documentation describes a domain as a distinct set of windows and tabs, while implementation models domains as spawn/attach authorities associated per pane. One window may therefore contain tabs backed by multiple domains.

**Boundary gap [V]:** the `window` crate's cross-platform description is weakened by its dependency on application configuration.

## Unknowns

- differences between the pinned revision and later `main`;
- blob-lease lifecycle and garbage collection;
- unread portions of spawn/split handlers;
- remote pane-list reconciliation;
- render-atlas lifecycle;
- operating-system backend divergence;
- codec integration coverage;
- reconnect behavior without a graphical client;
- whether `window` configuration coupling is load-bearing;
- real-world output-coalescing cost.

## Recommended Reading Order

1. `Makefile`
2. `wezterm/src/main.rs`
3. `wezterm-gui/src/main.rs`
4. `mux/src/lib.rs`
5. `mux/src/domain.rs`
6. `codec/src/lib.rs`
7. Server dispatch
8. Client discovery and connection
9. Graphical frontend
10. `TermWindow`
11. Lua configuration
12. Core crate manifests

## Pinned Evidence Index

| Evidence | Proves |
|---|---|
| [`mux/src/lib.rs:57-116`](https://github.com/wezterm/wezterm/blob/fe3006aefcdc4c22924e7bce966b2c430dade4f1/mux/src/lib.rs#L57-L116) | Mux ownership and notification vocabulary |
| [`mux/src/lib.rs:142-372`](https://github.com/wezterm/wezterm/blob/fe3006aefcdc4c22924e7bce966b2c430dade4f1/mux/src/lib.rs#L142-L372) | Reader/parser pipeline and output coalescing |
| [`mux/src/domain.rs:50-199`](https://github.com/wezterm/wezterm/blob/fe3006aefcdc4c22924e7bce966b2c430dade4f1/mux/src/domain.rs#L50-L199) | Domain extension contract |
| [`wezterm-gui/src/main.rs:495-649`](https://github.com/wezterm/wezterm/blob/fe3006aefcdc4c22924e7bce966b2c430dade4f1/wezterm-gui/src/main.rs#L495-L649) | Instance coalescing |
| [`dispatch.rs:39-213`](https://github.com/wezterm/wezterm/blob/fe3006aefcdc4c22924e7bce966b2c430dade4f1/wezterm-mux-server-impl/src/dispatch.rs#L39-L213) | Notification-to-protocol asymmetry |
| [`discovery.rs:250-398`](https://github.com/wezterm/wezterm/blob/fe3006aefcdc4c22924e7bce966b2c430dade4f1/wezterm-client/src/discovery.rs#L250-L398) | Graphical socket publication and discovery |
| [`codec/src/lib.rs:441-505`](https://github.com/wezterm/wezterm/blob/fe3006aefcdc4c22924e7bce966b2c430dade4f1/codec/src/lib.rs#L441-L505) | Protocol version and message table |
| [`term/Cargo.toml:1-48`](https://github.com/wezterm/wezterm/blob/fe3006aefcdc4c22924e7bce966b2c430dade4f1/term/Cargo.toml#L1-L48) | Published, configuration-free terminal core |

**Status:** approved architecture reference; no secrets reproduced.
