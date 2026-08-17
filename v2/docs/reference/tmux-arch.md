# tmux Architecture Reference

**Evidence:** `tmux/tmux@0f241b74472387a4698c9eb50e09f1817b5dd2e7` (2026-08-17). Source identifies the next release as 3.8 and protocol version 8.

The separately versioned tmux wiki was fetched 2026-08-17. Its exact revision is **Unknown** because no wiki commit identifier was exposed through the inspected GitHub interfaces.

## Scope and Orientation

Covers runtime roles, pseudoterminal boundaries, command dispatch, object graph, event loop, terminal input/output, control mode, configuration, persistence, extension seams, and tests.

Detailed rendering, grid, layout, format, copy-mode, and monitor internals were not fully inspected.

## Observed Vocabulary

**server** · **client** · **session** · **window** · **winlink** · **pane** · **floating/modal pane** · **active pane** · **layout** · **prefix key** · **key table** · **target** (`session:window.pane`) · **format** · **hook** · **job** · **mode** · **command queue** · **control mode**.

## Architecture at a Glance

```text
outside terminal
     | terminal settings and capabilities resolved client-side
     v
tmux client ----- Unix socket + imsg + descriptor passing -----> tmux server
  main()                                                         |
  client_main()                                                  +-- command parser
  identify terminal, env, descriptors                            +-- command queue
  send command                                                   +-- sessions/windows/panes
                                                                 +-- event loop and redraw
server writes directly to passed terminal descriptors <---------+
                                                                 +-- control-mode clients
                                                                 +-- jobs/hooks/events
                                                                      |
                                                                      v
                                                           pane child processes
                                                           one pseudoterminal each
```

## Runnable and Process Boundaries

One binary selects four runtime roles:

1. **Client**
2. **Server daemon**
3. **Pane child**
4. **Job child**

Startup validates a UTF-8 locale, obtains a pseudoterminal master, applies platform restrictions, creates option scopes, and resolves the socket through explicit path, label, inherited tmux state, or generated default.

Server startup uses a lock plus connection retry to handle the race where another client starts the server between connection and lock acquisition. It creates a socket pair before daemonization, so the initial connection exists before the server process does.

Interprocess communication uses `imsg` over Unix sockets. Every message carries `PROTOCOL_VERSION`; mismatch is fatal. Standard input and output descriptors are passed from client to server, allowing the server to operate a terminal it did not open.

## Modules and Responsibilities

| Module | Owns | Called by | Calls |
|---|---|---|---|
| `tmux.c` | Main entry, socket label, globals | Operating system | Client and options |
| `client.c` | Client role, startup lock, identification | `tmux.c` | Process, server, parser |
| `proc.c` | Process peers, imsg, loop, signals | Client and server | libevent and imsg |
| `server.c` | Bootstrap, accept/backoff, server loop | Client startup | Command queue and clients |
| `server-client.c` | Client lifecycle, keys, dispatch, redraw scheduling | Server and terminal | Queue, bindings, terminal, control |
| `cmd-parse.y`, `cmd.c` | Grammar, command registry, command lists | All command producers | Formats and arguments |
| `cmd-queue.c` | Ordered command items, execution, waits, guards | Most mutating paths | Target finding, events, control |
| `window.c`, `session.c`, `spawn.c` | Object graph and pseudoterminal spawning | Commands and resize | Input, layout, events |
| `input.c`, `screen-write.c`, `tty.c` | Terminal parser, grid mutation, byte output | Pane runtime | terminfo and libevent |
| `control.c`, `events.c`, `hooks.c`, options | Alternate presentation, events, hooks, registries | Server-wide | Parser and monitoring |

Dependency direction is mostly downward. Upward behavior uses explicit callback pointers.

## Main Execution and Data Flow

### Cold Start

`main()` enters the client path and parses arguments once to discover whether the requested command may start a server. The client connects or starts the daemon, sends terminal identity and descriptors, then submits the command.

After identification, the server selects control mode or normal terminal initialization. The first client triggers configuration loading; that client's command waits behind configuration execution.

### Key to Command

Terminal input becomes decoded keys and enters `server_client_handle_key0`.

Overlays, menus, and prompts execute immediately because the normal queue may be blocked. Other keys are queued to preserve ordering with earlier input.

The key callback handles mouse translation, paste detection, active mode tables, prefix transitions, repeat behavior, and binding lookup. Bindings insert parsed commands into the command queue.

### Command Dispatch

All command sources--arguments, configuration, bindings, hooks, and control lines--enter the same parser and queue.

Each source line receives a command group. Execution resolves declared source and target, invokes the command entry, emits completion hooks, removes the remainder of the group on error, and suspends on `CMD_RETURN_WAIT` until explicitly continued.

This queue is the universal serialization point for mutation.

### Pane Output

A pane read callback distributes output to `pipe-pane`, control clients, and the terminal parser. Consumers track independent offsets into one buffer. Backpressure disables further pseudoterminal reads until consumers catch up.

When a pane mode is active, parsed output updates the logical screen without immediately updating attached terminals.

### Redraw and Sizing

The server reconciles clients on each loop. Control clients bypass terminal redraw entirely.

Normal redraw waits behind pending terminal output and may use a short timer. One logical screen change fans out to every attached terminal client.

Window size is aggregated from eligible clients according to manual, smallest, largest, or latest policy. No single client inherently owns dimensions.

## Consumers, Integrations, and Persistence

Command producers include shell arguments, configuration files, key bindings, hooks, control lines, mouse events, and signals.

Read-only behavior is checked at admission, binding dispatch, and default-command dispatch.

Integrations include libevent, ncurses/terminfo, vendored imsg, optional utf8proc, systemd and control groups, utempter, jemalloc, and sixel.

File operations tunnel the invoking shell's descriptors through tmux protocol messages so output and errors reach the caller.

**Persistence is minimal.** Sessions survive through daemon lifetime, not serialization. On server exit, tmux kills jobs and preserves prompt history, but does not snapshot sessions, windows, panes, or running processes.

## Distinctive Mechanisms

- **Everything is a command:** default bindings and hooks hold parsed commands.
- **One mutation queue:** ordering, blocking, and per-line failure use one mechanism.
- **Control mode:** complete alternate presentation layer alongside terminal rendering.
- **Dual control queues:** preserve output ordering and prevent notifications inside guarded command blocks.
- **Options and hooks share one registry.**
- **Generation-guarded event dispatch:** listeners added during dispatch do not fire immediately; removal is deferred.
- **Client-owned terminal knowledge:** capabilities are resolved before descriptors cross to the server.
- **Many-to-many object graph:** sessions link windows through winlinks carrying session-local indexes.

## Extension Seams

Compile-time seams include the command registry, options and hook tables, default binding strings, `window_mode` callbacks, event sinks, monitoring and control subscriptions, job callbacks, overlay callbacks, file-operation callbacks, per-platform `osdep_*`, compatibility shims, and optional build features.

There is no dynamic plugin loader.

## Foundational Versus Replaceable

**Foundational:** client/server split, versioned imsg protocol, command queue, session-to-winlink-to-window-to-pane graph, scoped options tree, single-threaded libevent loop, grid/screen model, and command language.

**Replaceable behind seams:** terminal renderer (demonstrated by control mode), pane modes, individual commands, options and hooks, key bindings, event sinks, platform adapters, optional subsystems, and terminal-capability source.

## Test Seams

Approximately 140 nonparallel shell tests run under a clean environment and retain logs only on failure.

Coverage clusters include control mode, terminal parser, redraw with golden outputs, targets and parsing, hooks and events, formats and options, and pane modes.

Four libFuzzer targets cover terminal input, command parsing, formats, and styles.

Regression CI is nightly and manually triggered, not push/pull-request gated. Linux and macOS jobs enable sanitizers and utf8proc.

Runtime diagnostics include verbose logs, signal-controlled log toggling, and an attributed server-message audit.

## Constraints and Risks

- Server state lives in one process and address space.
- Protocol mismatch requires restarting the existing server.
- Oversized commands fail; oversized environment entries may be silently omitted.
- The parser has one static, non-reentrant state.
- Queue reentrancy relies on explicit no-hook state.
- Reference counting is manual.
- Backpressure degrades to lag or discard rather than blocking indefinitely.
- Mutable global state is broad.
- Compatibility shims can change semantics across platforms.
- Without `flock`, startup locking becomes only the retry heuristic.
- Regex paths are stubbed in fuzz builds.
- Socket access implies full trust; it is not a security boundary.

## Intent Versus Implementation

**Aligned:** server owns all live state; clients communicate through sockets; client names derive from terminals; windows may link into multiple sessions; prefix-key model; UTF-8 requirement; socket recovery through `SIGUSR1`.

**Divergent or stale:** release cadence differs between wiki pages; the wiki's source-sync description is superseded by `SYNCING.md`; modifier-key documentation declares itself outdated; wiki release information is behind source while some feature pages describe newer work; upstream authority is OpenBSD CVS while GitHub is a mirror plus portability layer; several wiki roadmap items remain intent only; style rules are documented but not CI-gated; regression CI does not gate ordinary merges.

## Unknowns

- Exact wiki revision.
- Complete wiki page set.
- Detailed key-decoding, redraw, grid, layout, format, monitor, and mode implementations.
- Platform compatibility and operating-system adapter internals.
- Parser lexer details.
- Runtime performance characteristics.

## Recommended Reading Order

1. Wiki "Getting Started"
2. `README`
3. `Makefile.am`
4. Public structures in `tmux.h`
5. `tmux-protocol.h`
6. `tmux.c`
7. `client.c`
8. `proc.c`
9. `server.c`
10. Session/window/pane structures
11. `cmd-queue.c`, `cmd.c`, and `cmd-parse.y`
12. Key handling and bindings
13. Pane input and terminal output
14. Spawn and configuration
15. Events, hooks, and control mode
16. Resize logic
17. Compatibility layer
18. Regression tests
19. `SYNCING.md` and wiki contribution guidance

## Pinned Evidence Index

| Evidence | Proves |
|---|---|
| [`tmux-protocol.h:23-124`](https://github.com/tmux/tmux/blob/0f241b74472387a4698c9eb50e09f1817b5dd2e7/tmux-protocol.h#L23-L124) | Protocol version and message model |
| [`client.c:104-181`](https://github.com/tmux/tmux/blob/0f241b74472387a4698c9eb50e09f1817b5dd2e7/client.c#L104-L181) | Server-start race handling |
| [`client.c:443-488`](https://github.com/tmux/tmux/blob/0f241b74472387a4698c9eb50e09f1817b5dd2e7/client.c#L443-L488) | Identification and descriptor passing |
| [`proc.c`](https://github.com/tmux/tmux/blob/0f241b74472387a4698c9eb50e09f1817b5dd2e7/proc.c) | IPC, role plumbing, version checks |
| [`server.c`](https://github.com/tmux/tmux/blob/0f241b74472387a4698c9eb50e09f1817b5dd2e7/server.c) | Bootstrap and event loop |
| [`cmd-queue.c`](https://github.com/tmux/tmux/blob/0f241b74472387a4698c9eb50e09f1817b5dd2e7/cmd-queue.c) | Universal mutation queue |
| [`server-client.c:1395-1818`](https://github.com/tmux/tmux/blob/0f241b74472387a4698c9eb50e09f1817b5dd2e7/server-client.c#L1395-L1818) | Key path and queue insertion |
| [`control.c`](https://github.com/tmux/tmux/blob/0f241b74472387a4698c9eb50e09f1817b5dd2e7/control.c) | Alternate presentation and ordering invariants |

Wiki sources fetched 2026-08-17: `Home`, `Getting Started`, `Contributing`, `FAQ`, `Clipboard`, and `Modifier Keys`. Their exact revision remains **Unknown**.

**Status:** approved architecture reference; no secrets reproduced.
