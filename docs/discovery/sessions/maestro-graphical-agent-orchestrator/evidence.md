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

### c-0006 - Orphaned process tree observed live

At 13:07:38 on 2026-08-19 a macOS dialog appeared reading "Maestro would like to
access data from other apps." The system log was queried directly with
`log show --last 30m --predicate 'subsystem == "com.apple.TCC"'`, which named
every party in the request.

The service requested was `kTCCServiceSystemPolicyAppData`, the control that
governs one application reading another application's data container. The
attribution record separates two roles. The *accessing* process was
`OsgWikiMcp`, a .NET Model Context Protocol server built from an unrelated
repository. The *responsible* process was `com.jdylanmc.maestro`, with
`responsible_path` `/Applications/Maestro.app/Contents/MacOS/wezterm-gui-bin`.

The full ancestry was then reconstructed with `ps -o pid,ppid,pgid,lstart,command`:

```text
herdr server            1642  PPID 1      /opt/homebrew/bin/herdr server
  agency copilot        1820              Aug 17 14:47
    copilot             7829              Aug 17 14:49, session 3b8da88c
      OsgWikiMcp        8279              Aug 17 14:50
```

A second identical branch ran under process group 1648, session 73be3e62.

Three facts follow, each verified rather than inferred.

**No graphical host was running.** `pgrep -fl 'wezterm-gui-bin'` returned
nothing. The application that macOS held responsible had already exited, yet its
descendants were still making permission requests.

**The processes had survived two days and at least one reboot.** They started
Aug 17 at 14:47 and were observed Aug 19 at 13:07.

**The daemon is reparented to init.** `herdr server` carried a parent process
identifier of 1, the signature of a deliberate detachment rather than an
accident of scheduling.

### c-0006 - Mechanism: inherited responsibility

macOS binds a *responsible process* at launch and every descendant inherits it
for the lifetime of that descendant, independent of whether the responsible
process is still alive. Because the launcher opens the rebranded bundle, and the
bundle identifier is `com.jdylanmc.maestro`, every process in the tree presents
itself to the permission system as Maestro forever.

Two consequences matter for the product.

The application is **accountable for permission prompts it did not issue and
cannot see**, including prompts from third-party binaries it never authored. A
user reading the dialog has no way to learn that the real requester was
`OsgWikiMcp`; the dialog names Maestro and offers only Allow or Don't Allow.

The behavior is **not reset by application exit or by reboot**, so it presents
to the user as the application misbehaving while closed.

### c-0006 - Mechanism: detached daemon

The persistence is supplied by `herdr`, an external dependency the launcher
shells out to, not by code authored in this repository. This is why the c-0005
source search found nothing and reached the wrong conclusion.

`herdr server` runs as a long-lived daemon. Copilot Sessions are its children
rather than children of the terminal pane the user perceives as owning them, so
closing the window severs only the display attachment. The Session, its
Sub-agents, and their Model Context Protocol servers continue to run, hold
memory, retain credentials, and make privileged requests.

At the moment of observation five `OsgWikiMcp` processes were resident, of which
two belonged to the orphaned Aug-17 tree.

### c-0006 - Termination behavior

The Aug-17 tree was terminated at the user's explicit instruction. The escalation
is itself evidence for the teardown design.

`SIGTERM` to the Model Context Protocol servers and to the Copilot processes
succeeded. `SIGTERM` to the two `agency copilot` wrapper processes did **not**;
both were still resident after three seconds. They exited only once their
children were gone.

A teardown implementation that sends `SIGTERM` and assumes success will
therefore leave residue. Termination must be verified against the process table
and escalated, not fired and forgotten.

The `herdr server` daemon at 1642 was deliberately left running, because live
Sessions started Aug-18 and Aug-19 were its children and killing it would have
destroyed active user work.

### c-0006 - Bearing on the requirements

This is direct evidence for the requirement recorded in c-0005 as a user
preference: "I don't want agents to persist after the app is closed." The
failure mode is not hypothetical and not future-tense. It was running on the
user's machine, in the product's own name, for two days.

It also demonstrates that adopting a process-supervision dependency silently
imports that dependency's lifetime model. `herdr` was adopted for convenience;
its detachment behavior became the product's observable behavior.
