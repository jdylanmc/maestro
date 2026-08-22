# Ghostty — Host-Surface Architecture Reference

**Evidence:** `main` branch, commit sampled 2026-08-21. `TerminalRestorableState.version = 7` (minimum 5). Analysis date: 2026-08-21.

Tags: **[V]** verified in source · **[I]** inferred from structure/docs · **[U]** unknown; not determined.

## Scope

This is not a general survey of Ghostty. It is an evaluation of Ghostty as a **host surface for a graphical agent orchestrator** (Maestro), focused specifically on: external control surface, macOS accessibility, embeddability, child process lifetime, session persistence, and the automation reach of a Presentation Check comparable to the Electron baseline (11/13 assertions, 100% automation reach).

The Electron route is the reference datum. WezTerm's researched ceiling is 40–50% automation reach with no macOS accessibility tree. **The primary question is whether Ghostty changes that picture materially.**

Excluded: font shaping, GPU renderer internals, GTK/Linux platform details beyond what is needed to characterise the macOS gap, and exhaustive configuration documentation.

## Observed Vocabulary

- **Surface:** a single terminal viewport backed by a PTY and a child process. The atomic unit Ghostty exposes to automation. Corresponds to what WezTerm calls a Pane.
- **SurfaceView:** the AppKit `NSView` subclass that renders a Surface and implements the accessibility tree.
- **SplitTree:** binary tree of Surfaces within one tab.
- **apprt ("application runtime"):** compile-time-selected module that owns window management, IPC, and platform integration. macOS uses the `embedded` apprt (Zig core embedded in a Swift/AppKit host). GTK uses the `gtk` apprt. They are not the same code path.
- **libghostty (internal):** the `ghostty_*` C API used by the Swift macOS app to call into the Zig core. Explicitly not for external use.
- **libghostty-vt:** the separately packaged VT/terminal-state-machine library (`include/ghostty/vt/`). Designed for external embedders, but provides no PTY, no process spawning, no window management.
- **`+action`:** CLI subcommands invoked as `ghostty +new-window`, etc. Only the informational ones are cross-platform; control actions (`+new-window`, `+new-tab`, `+toggle-quick-terminal`) are GTK-only.

## Architecture at a Glance

```text
macOS app (Swift/AppKit)
  |
  +-- AppDelegate --------> ghostty_app_t (libghostty, Zig core)
  |
  +-- TerminalController -> SplitTree<SurfaceView>
  |        |                   |
  |        |                   +-- SurfaceView (NSView, AppKit)
  |        |                         |-- ghostty_surface_t (Zig core)
  |        |                         |-- PTY (posix fork/exec, setsid)
  |        |                         |-- Accessibility tree [V]
  |        |                         |-- AppleScript wrapper [V]
  |        |                         |-- App Intents entity [V]
  |        |
  +-- AppleScript layer (Ghostty.sdef, NSApplication+ScriptTerminal...)
  +-- App Intents layer (Shortcuts.app, NewTerminalIntent, InputIntent...)
  +-- XCUITest harness (GhosttyUITests/)
  +-- macOS NSWindowRestoration (TerminalRestorableState)

ghostty CLI (Zig)
  +-- +list-fonts, +show-config, etc.  -- cross-platform, informational only
  +-- +new-window, +new-tab            -- GTK/D-Bus only; NOT macOS
```

## 1. Control Surface / IPC

### 1a. CLI (`+` actions)

The `ghostty` binary supports subcommands invoked as `ghostty +<action>` (`src/cli/ghostty.zig`). The full list:

| Action | Platform | External control? |
|---|---|---|
| `+list-fonts` | All | Read-only info |
| `+list-keybinds` | All | Read-only info |
| `+list-themes` | All | Read-only info |
| `+list-colors` | All | Read-only info |
| `+list-actions` | All | Read-only info |
| `+show-config` | All | Read-only info |
| `+validate-config` | All | Read-only info |
| `+explain-config` | All | Read-only info |
| `+edit-config` | All | Opens editor |
| `+show-face` | All | Read-only info |
| `+crash-report` | All | Report management |
| `+ssh`, `+ssh-cache` | All | SSH utility |
| `+new-window` | **GTK only** | Creates window |
| `+new-tab` | **GTK only** | Creates tab |
| `+toggle-quick-terminal` | **GTK only** | Toggle overlay |

**[V]** The `+new-window` and `+new-tab` implementations (`src/cli/new_window.zig:` `src/cli/new_tab.zig`) call `apprt.App.performIpc(...)` and return `"+new-window is not supported on this platform."` on any non-GTK build. They route through D-Bus (`src/apprt/gtk/ipc/DBus.zig`) on GTK, which is not present in the macOS `embedded` apprt.

**[V]** There is no `ghostty cli list`, `ghostty cli get-text`, or any analogue. The CLI offers **zero enumeration, zero content-reading, and zero input-injection capability on macOS.** That entire tier of automation is simply absent from the CLI.

This is categorically different from WezTerm's `wezterm cli list` / `get-text` / `list-clients` surface. But it is not the relevant comparison: on macOS, Ghostty's control surface is AppleScript and App Intents, not the CLI.

### 1b. AppleScript (`Ghostty.sdef`)

**[V]** Ghostty ships a published, versioned AppleScript dictionary at `macos/Ghostty.sdef`. This is not a thin pass-through; it is a first-class control surface implemented in `macos/Sources/Features/AppleScript/`.

**Object hierarchy exposed:**

```
application
  ├── windows[]           -- stable UUID IDs
  │     ├── tabs[]        -- stable UUID IDs, index, selected flag
  │     │     └── terminals[]  -- stable UUID IDs
  │     └── terminals[]
  └── terminals[]         -- flat list of all surfaces across all windows
```

**Properties on `terminal`:**

| Property | Type | What it gives |
|---|---|---|
| `id` | text | Stable UUID; survives window rearrangement |
| `name` | text | Current title of the terminal |
| `working directory` | text | Current working directory of the shell process |
| `pid` | integer | PID of the foreground process |
| `tty` | text | TTY device path (e.g. `/dev/ttys016`) |

**Commands:**

| Command | Effect |
|---|---|
| `new window [with configuration ...]` | Creates window; returns `window` object |
| `new tab [in window] [with configuration ...]` | Creates tab; returns `tab` object |
| `split <terminal> direction <dir> [with configuration ...]` | Splits in 4 directions; returns new `terminal` |
| `focus <terminal>` | Brings surface to front |
| `close <terminal>` | Closes surface without confirmation dialog |
| `select tab <tab>` | Selects tab |
| `close tab <tab>` | Closes tab |
| `activate window <window>` | Brings window to front |
| `close window <window>` | Closes window |
| `input text <text> to <terminal>` | Pastes text to terminal |
| `send key <key> [action] [modifiers] to <terminal>` | Sends keyboard event |
| `send mouse button <button> [action] [modifiers] to <terminal>` | Sends mouse button event |
| `send mouse position x y [modifiers] to <terminal>` | Sends mouse position |
| `send mouse scroll x y [precision] [momentum] to <terminal>` | Sends scroll event |
| `perform action <string> on <terminal>` | Executes any Ghostty keybind action string |

**Surface configuration record** (passed to `new window`, `new tab`, `split`):

```applescript
{
    initial working directory: "/some/path",
    command: "ghostty +list-keybinds",
    initial input: "text sent on launch\n",
    font size: 14.0,
    wait after command: true,
    environment variables: {"FOO=bar", "BAZ=qux"}
}
```

**[V]** AppleScript can be disabled per config: `macos-applescript = false`. When disabled, all scripting commands return `errAEEventNotPermitted`. By default it is enabled.

**[V]** Object references are stable UUIDs. A script can hold a `terminal id "…"` reference across tab rearrangement and reuse it in subsequent statements, because `objectSpecifier` is implemented via `NSUniqueIDSpecifier` (`ScriptTerminal.swift`).

### 1c. App Intents (Shortcuts / Siri)

**[V]** Ghostty implements the macOS App Intents framework (`macos/Sources/Features/App Intents/`). These are the same mechanisms Shortcuts.app and Siri use, and they are callable from code via `INInteraction` or `AppIntents.perform()`.

**Intents:**

| Intent | Capability |
|---|---|
| `NewTerminalIntent` | Create window/tab/split (6 locations); accepts command, workingDirectory, env, parent terminal |
| `GetTerminalDetailsIntent` | Read title, workingDirectory, allContents (full screen buffer), selectedText, visibleText from a terminal |
| `InputTextIntent` | Paste text to a terminal |
| `KeyEventIntent` | Send key press/release with modifiers |
| `MouseButtonIntent` | Send mouse button event |
| `MousePosIntent` | Send mouse position |
| `MouseScrollIntent` | Send scroll event |
| `FocusTerminalIntent` | Focus a terminal |
| `CloseTerminalIntent` | Close a terminal |
| `KeybindIntent` | Execute a keybind action |
| `QuickTerminalIntent` | Toggle quick terminal |

`TerminalEntity` (the App Intents handle for a terminal) carries: UUID, title, workingDirectory, pid, tty, kind (normal / quick), and a screenshot thumbnail (`NSImage` via `ImageRenderer`).

**[V]** Permission model: The config key `macos-shortcuts` accepts `allow`, `deny`, or `ask` (default `ask`). Setting `macos-shortcuts = allow` in the Ghostty config disables all permission dialogs, making App Intent calls unconditional from any caller. This is the test-harness path.

**[V]** Background mode: `NewTerminalIntent` and `GetTerminalDetailsIntent` declare `static var supportedModes: IntentModes = .background` on macOS 26+, meaning they can execute without foregrounding the app. On earlier macOS, `static var openAppWhenRun = false` serves the same purpose.

### 1d. IPC gap vs WezTerm

WezTerm's control surface is a typed protocol over a Unix socket, driven by `wezterm cli`. This gives it roughly 35 typed remote calls covering pane enumeration, text reading, input, and URI handling.

On macOS, Ghostty has no socket-based IPC at all. Its control surface is AppleScript and App Intents. The capabilities are comparable or superior for the Maestro use case (content reading, input injection, lifecycle control), but the interfaces are different enough that no tool written for `wezterm cli` transfers.

**[V]** No pane enumeration by numeric ID, no `list-clients`, no `spawn` verb from the CLI on macOS. AppleScript/App Intents cover all of those capabilities but with a different calling convention.

## 2. macOS Accessibility

**This is the decisive dimension.** WezTerm exposes no accessibility tree on macOS. XCTest, Appium, and AppleScript element inspection all fail against WezTerm terminal content. Ghostty is the opposite.

**[V]** `Ghostty.SurfaceView` (the `NSView` subclass that renders a terminal) implements the full NSAccessibility protocol in `SurfaceView_AppKit.swift` (lines 2320–2430+):

```swift
override func isAccessibilityElement() -> Bool { return true }
override func accessibilityRole() -> NSAccessibility.Role? { return .textArea }
override func accessibilityValue() -> Any? { return cachedScreenContents.get() }
override func accessibilitySelectedText() -> String? { ... ghostty_surface_read_selection ... }
override func accessibilitySelectedTextRange() -> NSRange { ... }
override func accessibilityNumberOfCharacters() -> Int { ... }
override func accessibilityVisibleCharacterRange() -> NSRange { ... }
override func accessibilityLine(for index: Int) -> Int { ... }
override func accessibilityString(for range: NSRange) -> String? { ... }
override func accessibilityAttributedString(for range: NSRange) -> NSAttributedString? { ... }
```

**[V]** Selection changes fire `NSAccessibility.post(element: self, notification: .selectedTextChanged)` via a debounced Combine publisher, so VoiceOver and XCTest selection observers receive proper notifications.

**What XCUITest can do as a result:**

- `XCUIApplication` can launch Ghostty and find its window by title.
- `app.textAreas.firstMatch` or `app.textAreas["Terminal content area"]` resolves to the `SurfaceView` (role `.textArea`, help string `"Terminal content area"`).
- `.value` on that element returns the **full current screen buffer** (all characters in the terminal grid, not just the visible viewport).
- `.selectedText` / `.selectedTextRange` are live properties.
- Character-level range queries work via `accessibilityString(for:)`.
- Font information is available via `accessibilityAttributedString(for:)`.

**[V]** Ghostty ships its own XCUITest suite (`macos/GhosttyUITests/`) that already exercises this. `GhosttyCustomConfigCase.swift` shows the harness pattern: launch with `GHOSTTY_CONFIG_PATH` pointing to a temp config file, `GHOSTTY_USER_DEFAULTS_SUITE` for isolated defaults, and `-ApplePersistenceIgnoreState YES`. Tests such as `GhosttyTitleUITests.testTitle()` and `GhosttyCommandPaletteTests` confirm XCUITest round-trips work in practice.

**[I]** The accessibility tree exposes the terminal content as a flat string. It does not expose cell-level color/style attributes (only font, via `accessibilityAttributedString`). Pixel-level rendering assertions (color, cursor position) are not reachable via the accessibility tree and would require screenshot comparison.

**[I]** It is not confirmed whether the accessibility tree content is the full scrollback buffer or only the current screen. `cachedScreenContents` uses `GHOSTTY_POINT_SCREEN` coordinates, which in Ghostty's internal coordinate system denotes the terminal screen grid. Whether "screen" includes scrollback history depends on Ghostty's internal point tag definition, which was not fully verified here. `cachedVisibleContents` (also exposed via App Intents as `visibleText`) uses `GHOSTTY_POINT_VIEWPORT` and is definitively the visible portion only.

**Contrast with WezTerm:** WezTerm's macOS renderer is a custom GPU path with no AppKit view hierarchy in the accessibility sense. There is nothing for XCTest to attach to. Ghostty's native AppKit integration means the accessibility tree exists by construction.

## 3. Embeddability

**[V]** Two distinct embedding APIs exist. Neither is suitable for hosting Maestro as a view component inside another application.

**`libghostty` (internal, `include/ghostty.h`):**

The header states explicitly:
> "The only consumer of this API is the macOS app, and while it is fairly comprehensive, it is tailored to the needs of the macOS app and not designed for external use."

This is the API the Swift macOS app uses to call into the Zig core (`ghostty_app_t`, `ghostty_surface_t`, etc.). It owns PTY creation, the event loop, window lifecycle callbacks, and GPU rendering. It is undocumented, unversioned for external consumers, and has no stability guarantees. Using it in Maestro would mean embedding against an internal ABI that can change in any release.

**`libghostty-vt` (external, `include/ghostty/vt/`):**

A separately packaged VT/terminal-state-machine library. It is extensively documented and designed for external use. An XCFramework build is available (`zig build -Demit-lib-vt`). A Swift example lives at `example/swift-vt-xcframework/`.

However, `libghostty-vt` is **purely a VT parser and screen-state library**. It provides no PTY, no process spawning, no window management, and no rendering. It is the right library for building a custom terminal emulator from scratch, not for embedding Ghostty as a user-visible terminal.

**[V]** There is no `libghostty` embedding API suitable for hosting a full Ghostty terminal surface inside another application's view hierarchy. Ghostty can only be driven as an independent macOS application.

**Implication for Maestro:** A Ghostty route means Ghostty runs as a separate macOS application alongside Maestro, not embedded inside Maestro's window. Maestro controls it externally via AppleScript and App Intents, not via a framework call.

## 4. Process Model and Child Process Lifetime

**[V]** Ghostty spawns child processes via its own `Command.zig` (a custom fork/exec implementation, not `std.process.Child`, due to PTY constraints). The POSIX spawn path:

1. `fork()`
2. Child calls `pty.childPreExec()`:
   - Resets all signals to default handlers
   - Calls `setsid()` — creates a **new session** (the child becomes session leader)
   - Calls `ioctl(TIOCSCTTY)` — sets the PTY slave as the controlling terminal
   - Closes master and slave FDs
3. Parent records `pid` and calls `rt_post_fork` if set
4. `exec()` replaces the child with the shell

**Effect of `setsid()`:** Each shell started in a Ghostty surface is the leader of a new POSIX session. Its process group is independent of Ghostty's process group.

**Child process lifetime on app exit:**

When Ghostty exits normally (user quits, AppleScript `quit`, or OS termination):

```
AppDelegate.applicationWillTerminate
  → Swift: closeSurface() / window close cascade
  → Zig: ghostty_surface_free() → Surface.deinit()
  → Surface.deinit():
       renderer thread stop → termio.deinit()
       → Exec.deinit() → subprocess.deinit()
       → subprocess.deinit(): subprocess.stop() → pty.deinit()
       → pty.deinit(): closes PTY master FD
```

**[I]** When the PTY master FD is closed, the OS delivers `SIGHUP` to the foreground process group of the PTY session. Because the child called `setsid()` and set the PTY slave as controlling terminal, the shell and all processes in its job receive `SIGHUP` and terminate by default. This is standard POSIX PTY behavior and is the mechanism by which Ghostty can satisfy Maestro's "no process outlives the application" requirement.

**[U]** Whether `subprocess.stop()` sends an explicit `kill()` before closing the PTY, or relies solely on the SIGHUP delivered by PTY close, was not fully verified in this analysis. The ordering matters for edge cases (processes that trap SIGHUP), but for normal shell sessions the SIGHUP path is sufficient.

**[U]** Behavior on `kill -9 <ghostty-pid>` (abnormal termination). In that case the PTY master FD is closed by the OS when Ghostty's file descriptors are reclaimed, which again delivers SIGHUP to the session. However, the `applicationWillTerminate` path does not run, so any cleanup that happens there is skipped. This is the standard trade-off for all PTY-based terminals.

**Comparison with WezTerm:** Equivalent. WezTerm also uses PTY-mediated child processes with `setsid()`. Both terminals rely on PTY close → SIGHUP for child cleanup. Neither provides stronger lifetime guarantees than the other.

## 5. Session Persistence / Restore

**[V]** Ghostty implements macOS `NSWindowRestoration` via `TerminalWindowRestoration` and `TerminalRestorableState` (`macos/Sources/Features/Terminal/TerminalRestorable.swift`).

What is persisted across restarts (current version 7, minimum version 5):
- Window layout: which tabs and splits were open (`SplitTree` structure)
- Which surface had focus (`focusedSurface` UUID)
- Fullscreen mode
- Tab color
- Title override (if any)

**What is not persisted:**
- Terminal scrollback or content
- Shell history beyond what the shell itself saves (`~/.zsh_history`, etc.)
- Environment variables of the running process
- Any child process state

Restoration spawns a fresh shell in each restored surface. The layout looks the same; the processes inside are new.

**[V]** `TerminalController.restorable` is set to `false` if `base?.command != ""` — surfaces that ran a specific command (as Maestro would request via AppleScript `command:`) are **not restored**. This is intentional: restoring a window that ran `copilot agent run` into a fresh shell would be meaningless.

**[V]** The `window-save-state` config key (`always` | `whenExplicit` | `never`) controls restoration. Setting `never` disables restoration entirely.

**[V]** The quick terminal (`QuickTerminalController`) has its own restorable state (`QuickTerminalRestorableState`) covering position and screen preference but not content.

**Implication for Maestro:** Ghostty does not provide session durability in the tmux sense. It does not assist with Maestro's "liveness is observed, never persisted" principle; that is Maestro's problem to solve, not Ghostty's. Ghostty's restoration is a UI nicety only.

## 6. Configuration and Runtime Automation

**[V]** Configuration is a text file, resolved in this order: `--config-file` flag → `$GHOSTTY_CONFIG_PATH` environment variable → `~/.config/ghostty/config`.

**[V]** The `$GHOSTTY_CONFIG_PATH` variable is the test-harness path already used by `GhosttyCustomConfigCase.swift`. A Maestro harness can point each Ghostty instance to an isolated config file by setting this variable before launch.

**Runtime config changes:** Ghostty can reload config from file on signal or keybind. There is no external API to mutate config values at runtime programmatically.

**Spawning a pane in a specified working directory and with a specified command from outside the app:**

Via AppleScript:
```applescript
tell application "Ghostty"
    new window with configuration ¬
        {initial working directory: "/path/to/worktree", command: "copilot-agent"}
end tell
```

Via App Intents (Swift or `shortcuts run` CLI):
```swift
NewTerminalIntent(
    location: .window,
    command: "copilot-agent",
    workingDirectory: IntentFile(fileURL: worktreeURL)
)
```

Both paths are **[V]** verified in source and return a handle to the newly created surface.

## 7. Ghostty vs WezTerm — Direct Comparison

| Criterion | WezTerm (macOS) | Ghostty (macOS) |
|---|---|---|
| **External control surface** | `wezterm cli`: ~35 typed PDU calls over Unix socket; pane enumerate, get-text, input, spawn, URI. Rich but CLI-only. | AppleScript dictionary + App Intents: enumerate windows/tabs/surfaces, read content (full buffer + visible), send text/keys/mouse, split, focus, close, spawn with working-directory and command. No CLI on macOS. |
| **macOS accessibility tree** | **None.** Custom GPU renderer; no AppKit view accessible to XCTest, Appium, or VoiceOver. | **Full NSAccessibility implementation on SurfaceView.** Role `.textArea`, value = screen buffer, selected text, character range queries. XCUITest works. First-party UITest suite already ships in the repo. |
| **Embeddability** | No embedding API. | `libghostty` (internal, not for external use). `libghostty-vt` (VT-only, no PTY or window management). Neither is suitable for embedding as a component. |
| **Process lifetime ownership** | PTY-mediated, `setsid()`, SIGHUP on PTY close. | PTY-mediated, `setsid()` + `TIOCSCTTY`, SIGHUP on PTY close. Equivalent. |
| **Session persistence** | None. Session durability = mux process lifetime. Layout not restored. | macOS `NSWindowRestoration`: layout (split tree, focus, fullscreen) restored; content ephemeral. Surfaces with explicit commands are not restored. |
| **Programmatic spawn with directory + command** | `wezterm cli spawn --cwd /path cmd` | AppleScript `new window with configuration {initial working directory: "...", command: "..."}` or `NewTerminalIntent` |
| **Presentation Check automation reach** | **~40–50%** (researched) | **~75–85%** (estimated; see below) |
| **Automation approach** | Shell-out to `wezterm cli` | XCUITest + AppleScript/App Intents |

### Estimated Ghostty Automation Reach: ~75–85%

The Presentation Check for the Maestro terminal route would assert some subset of:

| Assertion | Mechanism | Automatable? |
|---|---|---|
| Primary agent window is open and visible | XCUITest: `app.windows.count > 0`; title via accessibility | ✅ **[V]** |
| Primary agent window title matches Fleet | AppleScript `name` of window or terminal | ✅ **[V]** |
| Terminal content contains expected agent output | XCUITest: `textArea.value` (returns full screen buffer) | ✅ **[V]** |
| Foreground process PID is agent process | AppleScript `pid` property on terminal | ✅ **[V]** |
| Working directory of terminal matches worktree | AppleScript `working directory` on terminal | ✅ **[V]** |
| Subagent tree visible (if in terminal content) | XCUITest: `textArea.value` substring match | ✅ **[I]** |
| Panel re-scoping: selecting Fleet changes terminal | XCUITest: title change or focus change detectable | ✅ **[I]** |
| Attention surfacing (text-based error/notice) | XCUITest: `textArea.value` substring match | ✅ **[I]** |
| Attention surfacing (badge or macOS notification) | `XCUITest`: accessible if using standard NSApp badging | ⚠️ Partial **[I]** |
| Input can be injected to resume agent | AppleScript `input text` / `send key`; App Intents `InputTextIntent` | ✅ **[V]** |
| Specific UI chrome (colors, cursor shape) | Screenshot pixel comparison only | ❌ Not via accessibility |
| Terminal font/style correctness | `accessibilityAttributedString` gives font, not color | ⚠️ Partial **[V]** |
| No orphan processes on quit | `ps` against recorded pids (State Oracle, not Presentation Check) | ✅ Already in Oracle |

Counting: 10 of 13 are cleanly automatable; 2 are partial; 1 is not. That is approximately **77%** by count. With effort on the partial cases (badge detection via `NSApp.badgeValue` accessible via AppleScript, font/style via `accessibilityAttributedString`), the ceiling is closer to **85%**.

**Compared to WezTerm's 40–50%:** The difference is the accessibility tree. WezTerm cannot read terminal content, check foreground process, or inject input via XCUITest because there is no accessibility surface. Ghostty's `SurfaceView` NSAccessibility implementation makes all of that automatable.

The 15–25% that remains manual in a Ghostty route is: pixel-level rendering assertions, and any Attention surface that Maestro chooses to render outside the terminal (e.g., a macOS badge or system notification, which requires separate OS-level querying).

## 8. Verdict

**Ghostty is materially better than WezTerm for hosting a Maestro route on macOS.** The difference is large enough to be decisive for the stack comparison.

The reason is singular: the macOS accessibility tree. WezTerm's absence of an accessibility tree sets a hard ceiling on Presentation Check automation at 40–50%. Ghostty's `SurfaceView` NSAccessibility implementation, its first-party XCUITest suite, and its AppleScript and App Intents control surfaces push that ceiling to approximately 75–85%. That is an additional 35 percentage points of automation reach, which translates directly to fewer manual assertions recorded against the route.

The comparison on every other axis is roughly equivalent or immaterial:

- **Process lifetime:** Both use PTY-mediated fork/exec with `setsid()` and SIGHUP-on-close. Neither has an edge.
- **Session persistence:** Both are ephemeral at the process level. Ghostty restores window layout but not content; WezTerm restores neither. Layout restoration is irrelevant to Maestro since Maestro owns Fleet layout.
- **Embeddability:** Neither can be embedded as a component. Both run as independent applications.
- **CLI richness:** WezTerm's CLI is more richly typed, but this does not matter on macOS where CLI IPC is absent in Ghostty and irrelevant to the Presentation Check.

**Conditions that would change the answer:**

1. If Maestro's Presentation Check requires pixel-level rendering assertions (screenshot diffing), both terminals are equally manual for that tier. Ghostty's accessibility tree does not provide color or cursor-position data.

2. If Maestro moves to Linux as a primary platform, WezTerm's socket-based IPC may be comparable or superior to Ghostty's GTK/D-Bus IPC for automation purposes. This analysis is macOS-only.

3. If Apple deprecates or restricts the App Intents background-mode APIs in a future macOS release, the control surface narrows. The AppleScript path is older and more stable; App Intents are newer and subject to change.

4. If the permission gate (`macos-shortcuts = ask`) is not reliably suppressed in CI environments, App Intent calls will block waiting for user input. Setting `macos-shortcuts = allow` in the test config eliminates this, but requires a Ghostty config change and thus a controlled launch environment.

---

## Limitations of This Analysis

1. **No local install measured.** The accessibility tree implementation was read in source but not exercised against a running Ghostty binary. The 75–85% automation-reach estimate is a source-derived inference, not a measured harness result. Direct measurement with `xctest` against the packaged `.app` may reveal gaps (e.g., timing issues in `cachedScreenContents` with the 500ms cache TTL, or accessibility hierarchy race conditions during surface creation).

2. **`cachedScreenContents` scope is ambiguous.** Whether `GHOSTTY_POINT_SCREEN` in Ghostty's internal coordinate system covers only the current visible screen or the full scrollback was not fully resolved. The `allContents` App Intents verb and the `accessibilityValue()` return value may be limited to the current screen grid rather than scrollback history. This affects assertion richness for long-running agents.

3. **App Intents background mode tested only in source.** Background mode (`supportedModes = .background`) is declared for macOS 26+ only. On macOS 15 (current stable), `openAppWhenRun = false` is the substitute. The interaction between these flags and Maestro's non-interactive launch environment was not tested.

4. **Process lifetime on abnormal exit was not verified.** The analysis infers SIGHUP-on-PTY-close from standard POSIX behavior; whether Ghostty explicitly sends a signal before closing the PTY, and whether it does so under crash/force-quit conditions, was not confirmed from source.

5. **AppleScript stability under concurrent access was not assessed.** If Maestro drives multiple Ghostty windows simultaneously via AppleScript, the main-thread affinity of Cocoa scripting could introduce serialization bottlenecks. This is **[U]**.

6. **`libghostty-vt` version stability is unknown.** While documented and external-facing, the XCFramework's ABI stability policy was not examined. If Maestro were to use it for any purpose, ABI breakage on Ghostty updates would be a risk.

7. **The GTK platform (Linux) was surveyed only for IPC topology.** A Linux Ghostty route would have different characteristics: D-Bus IPC instead of AppleScript, no NSAccessibility, GTK accessibility (ATK) instead. That was not evaluated.

## Recommended Reading Order

1. `macos/Ghostty.sdef` — AppleScript surface specification
2. `macos/Sources/Features/AppleScript/` — AppleScript implementation
3. `macos/Sources/Features/App Intents/` — App Intents surface
4. `macos/Sources/Ghostty/Surface View/SurfaceView_AppKit.swift` — accessibility implementation (lines 2320+)
5. `macos/GhosttyUITests/GhosttyCustomConfigCase.swift` — XCUITest harness pattern
6. `macos/GhosttyUITests/GhosttyTitleUITests.swift` — accessibility round-trip proof
7. `src/pty.zig` — PTY model and `childPreExec` (POSIX)
8. `src/Command.zig` — fork/exec with pre- and post-fork hooks
9. `src/termio/Exec.zig` — subprocess lifecycle and deinit chain
10. `macos/Sources/Features/Terminal/TerminalRestorable.swift` — session restoration
11. `src/cli/new_window.zig` — confirms GTK-only IPC
12. `include/ghostty.h` and `include/ghostty/vt/` — embedding API surface and scope

## Pinned Evidence Index

| Evidence | Proves |
|---|---|
| [`macos/Ghostty.sdef`](https://github.com/ghostty-org/ghostty/blob/main/macos/Ghostty.sdef) | Full AppleScript vocabulary: windows, tabs, terminals, 15+ commands, surface configuration record |
| [`macos/Sources/Features/AppleScript/ScriptTerminal.swift`](https://github.com/ghostty-org/ghostty/blob/main/macos/Sources/Features/AppleScript/ScriptTerminal.swift) | `pid`, `tty`, `workingDirectory` properties; `split`, `focus`, `close` commands; stable UUID specifier |
| [`macos/Sources/Features/App Intents/GetTerminalDetailsIntent.swift`](https://github.com/ghostty-org/ghostty/blob/main/macos/Sources/Features/App%20Intents/GetTerminalDetailsIntent.swift) | `allContents`, `visibleText`, `selectedText`, `title`, `workingDirectory` readable from any caller |
| [`macos/Sources/Features/App Intents/NewTerminalIntent.swift`](https://github.com/ghostty-org/ghostty/blob/main/macos/Sources/Features/App%20Intents/NewTerminalIntent.swift) | Spawn with workingDirectory, command, env, parent; background-mode flag |
| [`macos/Sources/Features/App Intents/InputIntent.swift`](https://github.com/ghostty-org/ghostty/blob/main/macos/Sources/Features/App%20Intents/InputIntent.swift) | `InputTextIntent`, `KeyEventIntent`, `MouseButtonIntent`, `MousePosIntent`, `MouseScrollIntent` |
| [`macos/Sources/Features/App Intents/IntentPermission.swift`](https://github.com/ghostty-org/ghostty/blob/main/macos/Sources/Features/App%20Intents/IntentPermission.swift) | `macos-shortcuts = allow` suppresses all permission dialogs |
| [`macos/Sources/Ghostty/Surface View/SurfaceView_AppKit.swift:2320-2430`](https://github.com/ghostty-org/ghostty/blob/main/macos/Sources/Ghostty/Surface%20View/SurfaceView_AppKit.swift) | Full NSAccessibility implementation: role, value, selectedText, range queries, attributed string |
| [`macos/GhosttyUITests/GhosttyCustomConfigCase.swift`](https://github.com/ghostty-org/ghostty/blob/main/macos/GhosttyUITests/GhosttyCustomConfigCase.swift) | XCUITest harness: `GHOSTTY_CONFIG_PATH` env injection, `-ApplePersistenceIgnoreState YES` |
| [`macos/GhosttyUITests/GhosttyTitleUITests.swift`](https://github.com/ghostty-org/ghostty/blob/main/macos/GhosttyUITests/GhosttyTitleUITests.swift) | Proves `app.windows.firstMatch.title` works against live Ghostty via XCUITest |
| [`src/pty.zig` (PosixPty.childPreExec)](https://github.com/ghostty-org/ghostty/blob/main/src/pty.zig) | `setsid()` + `TIOCSCTTY`: new session, PTY slave as controlling terminal |
| [`src/Command.zig`](https://github.com/ghostty-org/ghostty/blob/main/src/Command.zig) | POSIX fork/exec; `rt_pre_exec` hook; `pid` recorded in parent |
| [`src/termio/Exec.zig` (Subprocess.deinit)](https://github.com/ghostty-org/ghostty/blob/main/src/termio/Exec.zig) | `stop()` → `pty.deinit()` → PTY master close → SIGHUP to session |
| [`macos/Sources/Features/Terminal/TerminalRestorable.swift`](https://github.com/ghostty-org/ghostty/blob/main/macos/Sources/Features/Terminal/TerminalRestorable.swift) | `TerminalRestorableState` v7: layout restored, content not; command-surfaces excluded |
| [`src/cli/new_window.zig` (run() last lines)](https://github.com/ghostty-org/ghostty/blob/main/src/cli/new_window.zig) | `"+new-window is not supported on this platform."` — CLI IPC is GTK-only |
| [`include/ghostty.h` (preamble)](https://github.com/ghostty-org/ghostty/blob/main/include/ghostty.h) | "not designed for external use" — `libghostty` internal-only |
| [`src/apprt/embedded.zig`](https://github.com/ghostty-org/ghostty/blob/main/src/apprt/embedded.zig) | macOS uses `embedded` apprt (no GTK IPC path); Zig core is driven by Swift callbacks |
| [`macos/Sources/Features/AppleScript/AppDelegate+AppleScript.swift`](https://github.com/ghostty-org/ghostty/blob/main/macos/Sources/Features/AppleScript/AppDelegate+AppleScript.swift) | `allSurfaceViews`, `orderedTerminalControllers` — live enumeration backing AppleScript and App Intents |

**Status:** research-grade reference; not yet directly measured against a running binary. Treat all automation-reach figures as estimates until a real harness run confirms them.
