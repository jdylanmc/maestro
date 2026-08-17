# Neovim - Architecture Reference

**Evidence:** `a4aa0417cf5553f8c154d5f6c92ab90a677542a3` (2026-08-17). Read-only and descriptive.

Tags: **[V]** verified · **[I]** interpreted · **[U]** unknown.

## Scope and Orientation

Covers process boundaries, entry points, dependency direction, event loop, editor state, Lua, remote procedure calls, user-interface/plugin seams, persistence, and tests.

Excluded: exhaustive module inventory, Tree-sitter, Language Server Protocol, diagnostics, spelling, regular expressions, and vendored sources.

## Observed Vocabulary

- **`main_loop`:** one libuv loop.
- **MultiQueue:** `events`, `fast_events`, and `thread_events`.
- **`VimState` / `state_enter`:** editor mode-machine abstraction.
- **`K_EVENT`:** asynchronous event represented as a pseudo-key.
- **Editor event:** autocommand.
- **UI event:** remote `redraw` event.
- **`RemoteUI`:** attached user-interface client.
- **api-fast:** request executed inline in the event loop.
- **textlock:** guard against unsafe mutation during callbacks.
- **shada:** persistent registers, marks, history, and old files.
- **memline:** text-storage structure.
- **extmark/marktree:** durable positional metadata.
- **`vim._core`:** compiled-in, main-thread-only Lua module.

## Architecture at a Glance

```text
Process A: built-in terminal UI
terminal -> tui.c -> ui_client.c
                    |
                    +-- MessagePack RPC over stdio ---------+
                                                            v
Process B: editor server
channel -> unpacker -> generated API dispatch
                         | fast inline / slow queued
                         v
state_enter -> normal / insert / command-line state
     |                         ^
     v                         |
buffers · memline · windows · Ex commands
     |                         ^
     +-- LuaJIT -> vim.api ----+
     +-- shada / session / undo persistence
     +-- drawscreen -> grid -> UI fan-out -> RPC clients
```

External graphical interfaces, plugins, jobs, and tests use the same RPC/API boundary.

## Runnable Units and Process Boundaries

Neovim builds one main binary with two runtime roles **[V]**.

On a terminal, `main()` decides to use the built-in interface, spawns another `nvim` process with `--embed`, and enters `ui_client_run()`. The built-in terminal interface is therefore an ordinary remote-procedure-call client using the same `nvim_ui_attach` contract as third-party graphical clients.

`tui.c` explicitly states that it runs in the user-interface process, not the editor server. Server-side interface functions abort or assert if called from the client role.

Editor state remains single-threaded. Background threads schedule fast or deferred work onto the main libuv loop.

Build targets include `nvim`, an interface library used to assemble the binary, and `nlua0` for source generators. Runtime modes include terminal interface, embedded server, headless, listening server, remote client, Lua script, Ex mode, recovery, API inspection, and Lua-module development.

## Modules and Responsibilities

| Module | Called by | Calls or owns |
|---|---|---|
| `main.c` | Operating-system entry | Initialization, role split, server, editor loop, shutdown |
| `event/loop.c` | Startup and blocking waits | libuv and MultiQueue |
| `state.c` | Normal, insert, command-line, terminal modes | Input, redraw, interface flush |
| `normal.c` | Main editor entry | Normal-command dispatch and operators |
| `ex_docmd.c` | Command line, source, API | Ex parsing and handlers |
| `msgpack_rpc/channel.c` | Channels and UI client | Unpacker, packer, generated handlers |
| `api/*` | RPC, Lua, internal C | Editor core through generated dispatch |
| `lua/executor.c` | Startup and evaluation bridges | `vim.api`, libuv bindings, `vim._core` |
| `ui.c`, `api/ui.c` | Drawing, messages, editor state | Attached-interface fan-out and RPC encoding |
| Decoration/buffer-update providers | Redraw and text mutation | Lua callbacks and event channels |

## Main Execution and Data Flow

### Startup [V]

`main.c` initializes events, autocommands, signals, channels, terminal support, and user-interface state. Early initialization creates evaluator state, normal commands, runtime paths, the first window, and initial options.

After command-line scanning and Lua initialization, execution splits into client or server role. The server allocates grids, optionally waits for a remote interface, initializes Lua defaults, executes startup commands, loads configuration and plugins, restores shada, emits startup events, and enters `normal_enter()`, which does not return normally.

### Input Dispatch [V]

`state_enter` repeatedly runs the state's check callback and then chooses input by priority:

1. pending mapped/typeahead input;
2. queued asynchronous events, represented as `K_EVENT`;
3. otherwise redraw, flush, and block for input.

The chosen key or pseudo-key passes to the active state's execute callback. Break checks poll the same event loop and are frequency-throttled.

### Remote Procedure Call Dispatch [V]

Incoming MessagePack is parsed and routed through generated handlers. Fast handlers run inline in the libuv loop; slow handlers enqueue onto channel events. `nvim_get_mode` uses before-blocking events, and resize uses a dedicated one-shot event strategy.

The public API contract and dispatch guards are generated at build time.

### User-Interface Fan-Out [V]

Editor drawing becomes generated `ui_call_*` functions, which fan out to up to 16 attached `RemoteUI` instances. Remote interfaces encode updates and write them over RPC.

`ui_flush()` coalesces cursor, mode, mouse, command-line, and message changes. Some updates wait until `textlock` clears. The effective screen size degrades to the smallest attached interface.

On the client side, `redraw` uses a specialized state machine that decodes grid cells directly into buffers, avoiding large numbers of intermediate objects. The generic grid-line handler intentionally aborts if reached.

### Lua and Editor State [V]

Lua initialization constructs `vim` with API access, scheduling, function calls, RPC request/notification, user-interface attachment, `vim._core`, and standard libraries.

The package loader inserts Neovim runtime-module resolution into Lua's loader chain.

Core editor state remains in global current-window/current-buffer structures. Visual, Select, and operator-pending modes are derived rather than separately authoritative. Text is stored through memline. Extmarks and marktree own durable positions. Redraw is coalesced state propagation, not immediate painting.

### Shutdown [V]

Shutdown executes deferred handlers, buffer/window unload events, `VimLeavePre`, shada persistence, and `VimLeave`.

The client drains terminal output; the server closes memline state. Event teardown gives libuv a bounded close budget and logs a possible loop hang. Crash preservation guards against re-entry.

## Callers, Consumers, Integrations, and Persistence

Consumers include the built-in terminal interface, third-party graphical interfaces, embedded and listening API clients, Lua plugins, Vimscript, child jobs, and test processes.

Graphical clients identify themselves, interpret cursor metadata, encode extended key chords, handle clickable URLs, and process restart requests.

Important extension seams have different failure semantics:

- decoration providers receive an error budget and can become permanently disabled;
- buffer-update Lua callbacks detach themselves by returning truthy;
- dead RPC channels are pruned incrementally;
- deferred autocommands re-resolve buffers by handle;
- runtime plugins load automatically or through `:packadd`;
- `vim.ui_attach` provides in-process interface events;
- `$VIMRUNTIME` and `--luamod-dev` alter runtime loading.

Persistence includes shada, Vimscript-based session files, context, swap/memfile state, and undo files.

## Test Seams

Three test layers exist **[V]**:

1. **Unit tests:** LuaJIT foreign-function-interface access to a shared test library; selected fixtures compile into the binary under `UNIT_TESTING`.
2. **Functional tests:** drive a fresh Neovim process entirely over RPC; screen assertions wait for expected state.
3. **Legacy tests:** older Vim-compatible test directory.

The harness runs multiple specifications through one Lua process while restoring globals, loaded modules, and environment state between files.

Closures can transfer between instances only when both processes use the same build and trust boundary.

## Constraints and Risks

### Verified Constraints

- The public RPC API must not break.
- Public functions require an API-version marker or generation fails.
- Internal `nvim__*` functions are marked unstable.
- api-fast handlers cannot reach full break-check behavior.
- The libuv loop cannot be re-entered.
- Editor state is single-threaded.
- Startup time is a design goal.
- At most 16 interfaces may attach.
- Selected inherited C modules remain Vim-maintained.
- Deprecation uses a three-release ladder.
- New functionality is generally preferred in Lua.

### Foundational

libuv event loop, MessagePack RPC and object model, generated API pipeline, `state_enter`, single-threaded editor state, memline, and marktree.

### Replaceable or Demonstrably Swappable

Built-in terminal user interface, terminal capability library, optional WebAssembly support, LuaJIT versus standard Lua, bundled dependencies through pinned or local sources, runtime tree, and CMake versus Zig build descriptions.

### Risks

- Non-`EXITFREE` shutdown paths intentionally leave some allocations.
- Fast events skipped in editor modes can lose redraws.
- `wait_return` may overwrite the process exit value.
- Some window extmarks lack a removal signal.
- State-machine nesting is documented as inconsistent.

## Intent Versus Implementation

- **User-interface events should become editor events:** two systems still exist; `aucmd_defer` is preferred while direct autocommand application remains widespread.
- **shada as sole persistence authority:** marked as a long-term vision; context, sessions, swap, and undo remain separate stores.
- **Lua-first development:** real but incomplete.
- **`require('nvim.foo')` namespace:** newer guidance coexists with shipped counterexamples.
- **Uniform state callbacks:** some modes still lack dedicated `state_enter` implementations.
- **Normal-state top-level flag:** source comments acknowledge that its semantics are inaccurate.

## Unknowns

- Zig build parity with CMake.
- Generated artifact contents.
- Complete per-function fast/allocation metadata.
- Multicursor implementation details.
- Insert, command-line, and terminal state callbacks.
- Interface compositor internals.
- Windows pseudoterminal paths.
- Provider-host protocol.

## Recommended Reading Order

1. `runtime/doc/dev_arch.txt`
2. `runtime/doc/dev.txt`
3. `src/nvim/state.c`
4. `src/nvim/main.c`
5. `src/nvim/normal.c`
6. `src/nvim/event/loop.c`
7. `src/nvim/msgpack_rpc/channel.c`
8. `src/gen/gen_api_dispatch.lua`
9. `src/nvim/ui.c` and `src/nvim/api/ui.c`
10. `src/nvim/ui_client.c` and `src/nvim/tui/tui.c`
11. `src/nvim/lua/executor.c`
12. Decoration and buffer-update providers
13. `src/nvim/drawscreen.c`
14. Root build configuration

## Pinned Evidence Index

| Evidence | Proves |
|---|---|
| [`dev_arch.txt:279-536`](https://github.com/neovim/neovim/blob/a4aa0417cf5553f8c154d5f6c92ab90a677542a3/runtime/doc/dev_arch.txt#L279-L536) | Event loop and lifecycle |
| [`main.c:252-370`](https://github.com/neovim/neovim/blob/a4aa0417cf5553f8c154d5f6c92ab90a677542a3/src/nvim/main.c#L252-L370) | Bootstrap and client/server role split |
| [`main.c:705-880`](https://github.com/neovim/neovim/blob/a4aa0417cf5553f8c154d5f6c92ab90a677542a3/src/nvim/main.c#L705-L880) | Shutdown |
| [`state.c`](https://github.com/neovim/neovim/blob/a4aa0417cf5553f8c154d5f6c92ab90a677542a3/src/nvim/state.c) | State machine and derived mode |
| [`channel.c:312-385`](https://github.com/neovim/neovim/blob/a4aa0417cf5553f8c154d5f6c92ab90a677542a3/src/nvim/msgpack_rpc/channel.c#L312-L385) | Fast/deferred dispatch |
| [`gen_api_dispatch.lua:225-255`](https://github.com/neovim/neovim/blob/a4aa0417cf5553f8c154d5f6c92ab90a677542a3/src/gen/gen_api_dispatch.lua#L225-L255) | API version contract |
| [`ui.c:540-606`](https://github.com/neovim/neovim/blob/a4aa0417cf5553f8c154d5f6c92ab90a677542a3/src/nvim/ui.c#L540-L606) | User-interface flushing and fan-out |
| [`dev_test.txt:27-110`](https://github.com/neovim/neovim/blob/a4aa0417cf5553f8c154d5f6c92ab90a677542a3/runtime/doc/dev_test.txt#L27-L110) | Test architecture |

**Status:** approved architecture reference; no secrets reproduced.
