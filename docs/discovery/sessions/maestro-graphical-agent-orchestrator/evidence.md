# Evidence - Maestro Graphical Agent Orchestrator

## Issue tracker

- Issue #1 defines the destination: select and validate a daily-driver macOS graphical Agent orchestrator.
- Issue #12 defines core product requirements and explicitly defers workflow branching, direct Squad Mate chat, pause/resume/reprioritize/direct prompting, skill management, in-app editing, and comparative adoption criteria.
- Issue #18 defines the shared cross-platform MVP shell and live behavior contract.
- Issue #25 makes durable-platform selection downstream of working prototype comparisons.
- Issue #26 and #28 establish that WezTerm can support a no-fork v1.1 shell, but needs a Maestro-owned terminal user interface pane for the interactive sidebar and independent persistence for agent state.
- Issue #9 validates Copilot Session persistence and restart behavior, including dangling in-flight work that Maestro must project as interrupted.
- Issue #11 validates live structured sub-agent observability and targeted cancellation, while requiring Maestro-owned normalization, recursive edge derivation, and persistent registry state.
- Cycle c-0001 settled Electron as the first full proving route, with bounded parallel feasibility probes for the other routes.

## Repository references

- `README.md` positions the root for a visible-fleet orchestration architecture and preserves `proto-v1/` as the original runnable launcher.
- `proto-v1/README.md` proves the current implementation is a WezTerm + Herdr launcher with optional executable adapters, not the target visible-fleet architecture.
- `v2/docs/reference/firstmate-arch.md` and `v2/docs/reference/herdr-arch.md` provide source-verified orchestration and terminal-state mechanisms, but are descriptive references rather than settled Maestro design.
- `v2/docs/reference/superset-arch.md`, `wezterm-arch.md`, `tmux-arch.md`, `neovim-arch.md`, `lazyvim-arch.md`, and `orbit-arch.md` are comparative architecture evidence.

## Limitations

- No durable discovery package existed before this session.
- No tracker contract exists under `docs/agents/`, so this session is currently `markdown-only` and cannot publish tracker work through the discovery workflow.
- Platform-specific working MVPs for Electron, Tauri/Rust, native macOS, and WezTerm remain unbuilt or unresolved.

## Prototype Evidence

### c-0003 - Electron route boundary probe

- Approval: `Approve prototype n-0000`.
- Isolation: `.discovery-prototypes/maestro-graphical-agent-orchestrator/n-0000-c-0003/`.
- Result: the disposable Node-backed Electron-boundary probe passed a minimal
  main/preload/renderer shell, structured delegated Squad Mate lifecycle,
  durable Session transcript and Workspace state, restart reconciliation of
  in-flight work to `interrupted`, and targeted cancellation through the
  renderer-facing API.
- Validation command: `npm run probe` in the isolated prototype directory.
- Limitation: no Electron executable or dependency was available, so the
  probe did not launch a real desktop BrowserWindow or validate packaging.
- Cleanup: the exact isolation directory was removed and verified absent.

### c-0005 - Toolchain survey (read-only)

Every competing route's toolchain is already installed on this machine except
Electron's package: `cargo` and `rustc` (v3 Tauri/Rust), `swift` and
`xcodebuild` (v4 native macOS), `wezterm` (v1.1), and Node v24.13.0 with npm
11.6.2 (v2 Electron runtime, no `electron` package). Electron is the only route
of the four requiring a fresh external download, which weakens the c-0001
assumption that it was the cheapest first route. No prototype source exists for
the v2, v3, or v4 routes; `v2/` contains documentation only.

### c-0005 - Observed defect in the v1.1 WezTerm build

The user reports repeated macOS permission prompts - "The app Maestro would like
access to files and folders on `<location>`" - appearing after a reboot with
nothing knowingly running, at a time when only the WezTerm version existed. This
indicates the v1.1 route left something resident that survived both application
close and a reboot and continued requesting file access. It is direct evidence
against any route that spawns detached or externally-owned processes, and the
strongest recorded argument for a single supervising process that owns its
children's lifecycle outright. The defect class is demonstrated, not
hypothetical, in this repository.

### c-0005 - User wireframe

A hand-drawn "MAESTRO APP" layout supplied by the user: a left column with a
collapsible `SESSIONS / WORKTREES` panel above a collapsible
`AGENT SWARM SQUAD VIEW`; a collapsible `DIRECTORY STRUCTURE` column supporting
open/close folder and showing git information inline; and an expandable
`MAIN CONTEXT WINDOW` holding Session chat, Sub-agent logs, and file views, with
Visual Studio Code-style tabs and splits. The user added that selecting a
Session re-scopes every other panel. This is the source for the interface
requirements recorded in `requirements.md`.

### c-0005 - Firstmate architecture reference

`v2/docs/reference/firstmate-arch.md`, 215 lines, pinned to commit `bdae21ed`,
read because the user named it as the model. Transferable mechanisms: a primary
harness holding a home lock, with a lock-refused session degrading to read-only,
which is an enforcement mechanism for the 1:1 Session/Primary Agent binding; a
`crewmate` defined as a task agent with a backend endpoint and a worktree,
structurally analogous to a Sub-agent; liveness classified from process-group,
executable-name, and inventory evidence into alive, dead, or `ambiguous`; a
closed control-plane verb set of `interrupt`, `exit`, and `relaunch` with
verified postconditions and teardown deliberately excluded; deterministic
current-state projection with fixed precedence and explicitly no heuristics; a
durable wake queue separating actionable from absorbable signals; and teardown
gated on landed-work proof, so uncommitted work is never treated as landed.

Limitation: firstmate is a Bash-and-Markdown distribution with no compiled
application and no graphical surface. It is a source of orchestration and
state-discipline mechanisms, not of interface design, and its nautical
vocabulary is deliberately not adopted.

### c-0005 - Prototype not run

The Electron probe proposed in c-0005 was presented three times and never
received the exact approval string, so nothing was built and no isolation
directory was created. The user redirected to domain-language work instead.
