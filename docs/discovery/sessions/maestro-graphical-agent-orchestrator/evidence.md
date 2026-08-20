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

### c-0007 - Git worktree concurrency, verified by experiment

Run in `/tmp` scratch repositories by a read-only research subagent.

- Concurrent git operations in one worktree fail on lock files with explicit
  errors: `fatal: Unable to create '.../index.lock': File exists`,
  `fatal: cannot lock ref 'HEAD'`, `error: could not lock config file`, and the
  equivalent for `packed-refs.lock`.
- **Two worktrees cannot check out the same branch.**
  `fatal: '<branch>' is already used by worktree at '<path>'`. A hard git
  constraint, so worktree-per-unit implies branch-per-unit.
- **The stash is shared across worktrees**, not isolated. A stash created in one
  worktree is visible from the repository root.
- Per-worktree state is `HEAD`, `index`, `ORIG_HEAD`, and logs under
  `.git/worktrees/<name>/`. The object store and most refs are shared.

Local repository findings:

- `v2/docs/reference/firstmate-arch.md:17-19,46-48` gives each `crewmate` an
  endpoint and a worktree, but never states unit-to-worktree cardinality.
- **No worktree management code exists** in `proto-v1/`, `scripts/`, or `bin/`,
  although `README.md:3-7` states that Maestro launches workers in "isolated
  worktrees". The README documents a capability the code does not implement.
- `v2/docs/reference/orbit-arch.md:13-17` - Orbit isolates agents by Copilot
  session but **not** by worktree: "all Agents use the configured workspace and
  can act concurrently in it", and it "does not create a worktree".
- `v2/docs/reference/superset-arch.md:19-21` - Superset defines a workspace as
  "an isolated Git worktree", with per-worktree port allocation.

Two endorsed references sit on opposite sides of the isolation question.

Costs of worktree-per-unit, medium confidence: duplicated `node_modules` and
build artifacts, `.env` and untracked files that do not carry over, per-worktree
port allocation, and editor indexing and dev servers that must be re-pointed.

### c-0007 - ship-with-squadron as a visualization target

`.github/skills/ship-with-squadron/` read as a specification, not run. It
requires an installed `/handoff` entry point, which does not exist at
`.github/skills/handoff`, and it requires an approved implementation backlog,
which does not exist either.

- **Fixed three-tier topology:** Primary, one Coordinator, up to six Workers.
  Typed roles with different authority and a known depth, contradicting the
  working assumption of an arbitrarily deep homogeneous tree.
- **Nineteen ticket states**, from `BLOCKED` through `MERGED`, `TIMED_OUT`,
  `SUPERSEDED`, `HUMAN_DECISION_REQUIRED`, and `EXTERNAL_BLOCKER`.
- **Independent confirmation of the two-axis lifecycle decision.** Ticket state
  is durable in a ledger; worker health is `ACTIVE`, `AT_RISK`, `TIMED_OUT`, or
  `TERMINAL`, derived from heartbeat freshness; Coordinator health is a third
  classification. A separately authored package reached the same separation on
  different evidence.
- **`AT_RISK` operationalizes the unnamed Attention concept:** stale heartbeat,
  or under 15 minutes to a milestone with an unresolved blocker.
- **Durable state outside the worktree.** The ledger lives at
  `<git-common-dir>/ship-with-squadron/<run-id>/` as `ledger.json`, append-only
  `events.jsonl`, `handoffs/`, and `snapshots/`, written atomically by
  temporary-file rename with a reread and schema check. `git rev-parse
  --git-common-dir` is chosen so state is shared across worktrees rather than
  trapped in one.
- Recovery rebuilds from the append-only event log plus live provider state.
- Concurrency limit is six, against the ceiling of 8 recorded in c-0005.
- The one-minute executive report specifies both what to show and what **not**
  to show: no logs, no code detail, no full review findings, no speculative
  completion percentages.

### c-0007 - Copilot CLI domain vocabulary

From the installed binary `/Users/dylan/.copilot-cli/1.0.80/copilot`, from
`~/.copilot/`, and from event logs across 40 local sessions.

**Sessions can be named, and a recorded decision is falsified.** The binary
exposes `-n, --name <name>`, `/rename` to rename or auto-generate a name from
the conversation, and `--resume[=value]` resolving by session ID, task ID, ID
prefix, **or name**, matched exactly and case-insensitively. Issue #5's recorded
decision that "Maestro owns naming" is wrong. Maestro should set the runtime's
name, which also means a Maestro-named unit remains addressable outside Maestro.

**Event vocabulary observed:** `session.start`, `session.shutdown`,
`session.resume`, `session.error`, `session.warning`, `session.info`,
`session.mode_changed`, `session.model_change`, `session.plan_changed`,
`session.permissions_changed`, `session.context_changed`,
`session.compaction_start`, `session.compaction_complete`,
`session.binary_asset`, `assistant.turn_start`, `assistant.turn_end`,
`assistant.message`, `user.message`, `system.message`, `system.notification`,
`tool.execution_start`, `tool.execution_complete`, `external_tool.requested`,
`external_tool.completed`, `permission.requested`, `permission.completed`,
`hook.start`, `hook.end`, `skill.invoked`, `subagent.started`,
`subagent.completed`, `abort`.

`subagent.completed` exists, so terminal subagent events are available to the
roll-up and cancellation requirements.

**Collisions with our vocabulary, in severity order:**

1. `Agent` - Copilot means a selectable persona or configuration; we meant a
   running actor.
2. `Workspace` - Copilot owns it through per-session `workspace.yaml` and
   `~/.copilot/workspaces/`; Visual Studio Code owns it too.
3. `Sub-agent` - Copilot spells it `subagent`.
4. `Task` - a first-class resumable unit; `/tasks` manages "tasks (subagents and
   shell commands)". We had no term.
5. `Fleet` - `/fleet` enables "fleet mode for parallel subagent execution". The
   user's spontaneous word is already the runtime's term.

**Terms Copilot owns that we have no row for:** `turn`, `checkpoint`, `plan`,
`skill`, `tool`, `MCP`, `mode`, `compaction`, `rewind`, `hook`. Session state
also carries an `inbox_entries` table with sender, recipient session, unread,
and read-at columns, implying inter-session messaging no cycle has considered.

### c-0008 - Domain confirmation published

`/domain-mapping` ran the c-0007 handoff and wrote two artifacts, committed as
`6158b48`:

- `CONTEXT.md` at the repository root, the single-context glossary named by
  `docs/agents/domain.md`, holding 11 confirmed terms grouped as units of work,
  participants, condition, and place.
- `docs/adr/0001-adopt-fleet-as-the-structural-unit.md`, the repository's first
  Architecture Decision Record.

Two c-0007 definitions failed the skill's stress test and were corrected before
confirmation. A Fleet no longer requires a Worktree, because making it
constitutive contradicted the settled strong-default-not-a-rule requirement.
`Task` and `subagent` are nested rather than equivalent, because `/tasks`
manages "tasks (subagents and shell commands)", so a shell-command Task is not a
tree node.

Two decisions were assessed against the Architecture Decision Record gate and
**rejected** for failing it: worktree-per-Fleet, which is reversible per Fleet
by design and so is not costly to reverse; and the fully-generic display model,
which is additive to reverse.

### c-0008 - Tracker reconciled to remote

`tracker-mode` moved from `markdown-only` to `remote` under the exact approval
string, and the GitHub tracker was reconciled through the `/discovery` contract.

The map body was rewritten in confirmed vocabulary with every prior decision
entry preserved. Correcting comments were added to #5, #6, #12, #14, and #17.
Two titles containing retired vocabulary were changed.

**A structural defect was found and fixed.** The v3 and v4 branches had **no
dependency edges at all**, so their prototype tickets sat on the unblocked
frontier ahead of their own research. #25, which asks which of four working MVPs
should become the durable implementation, was also unblocked while none of the
four exists.

Frontier before: 9 tickets. Frontier after: #27, #22, #21, #13, plus the map and
two specifications. Only the v2 branch had been wired correctly.

### c-0009 - Prototype: supervisor teardown, measured

Disposable prototype run under approval in
`.discovery-prototypes/maestro-graphical-agent-orchestrator/n-0000-c-0009/`,
since removed. Ground truth measured with `ps` against a unique process marker,
not through any handle the supervisor held.

Two spawn strategies against three teardown scenarios, each spawning
three-level trees mirroring the c-0006 failure shape:

| Scenario | `detached` | Distinct process groups | Survivors | Verdict |
| --- | --- | --- | --- | --- |
| A1 graceful quit | `false` | 1 | 6 | FAIL |
| A2 SIGKILL, no reaper | `false` | 1 | 6 | FAIL |
| B1 graceful quit | `true` | 2 | 0 | PASS |
| B2 SIGKILL, no reaper | `true` | 2 | 6 | FAIL, expected |
| B3 SIGKILL then reap-on-launch | `true` | 2 | 0 | PASS |

**This falsifies the c-0006 requirement that Maestro spawn agents
non-detached.** That requirement came from research, not experiment. With
`detached: false` the child is not a process-group leader, so it shares the
supervisor's group and `process.kill(-pid)` returns `ESRCH`: there is no group
at that address to signal. Teardown cannot be addressed at all, and every
descendant survived even a graceful quit.

`detached: true` is **required**. It gives each Fleet its own process group,
which is what makes complete, targeted teardown of a three-level tree possible
with a single signal - and targeted per-Fleet cancellation possible at all.

The correct statement of the c-0006 lesson is narrower than what was recorded:
detachment *without* durable ownership and a reaper causes orphans. B2 and B3
are the same scenario differing only by the reaper, and they differ by six
surviving processes.

### c-0009 - Prototype: Electron lifecycle confirmation

Electron installed inside the isolation path in **8 seconds**, contradicting the
c-0001 and c-0005 premise that the Electron download was a meaningful cost or a
reason to sequence routes.

Live run against Electron's real main process and lifecycle:

- `BrowserWindow` created and rendered a three-column layout at 1200x700.
- Three Fleets started as three distinct process groups, nine processes total.
- `before-quit` tore down all three groups; `will-quit` verified **0 survivors**.
- Reap-on-launch executed first and correctly found nothing on a clean start.
- Zero stray processes after the run.

Limitations: the trees were synthetic `sh` and `sleep` processes rather than
live Copilot sessions, which may install their own signal handlers; packaging
was not tested, only the development-run lifecycle; and macOS Force Quit was
simulated with `SIGKILL`, which is the signal it sends, rather than triggered
through the operating system interface.

## c-0010 - Runtime evidence measured, and two research claims falsified

Four bounded read-only subagents researched Attention signals, subagent tree
depth, worktree cost, and the messaging surface. Their reports were treated as
untrusted. The two claims that would have changed the architecture were
re-measured in the parent loop, and **both failed**.

### The subagent tree is not what `parentId` suggests

The `tree-depth` agent reported `parentId` as the child-to-parent link and a
maximum nesting depth of 16. Measured directly against the largest local
session, `57300d77-3904-439d-8ee9-acdbafe47543` (41,928 events, 132 subagents):

| Property | Measurement |
| --- | --- |
| Distinct `parentId` values | 41,927 across 41,928 events |
| `parentId` values resolving to an event id | 41,927 |
| `parentId` values resolving to an `agentId` | **0** |

`parentId` is a linear event-chain pointer. Two `subagent.started` events
emitted consecutively in the same parallel batch are *siblings*, yet one carries
the other's id as its parent. The depth-16 figure is an artifact of that chain.

Reconstructing instead by joining `subagent.started.data.toolCallId` to the
`agentId` on the spawning agent's `tool.*` event, the same session gives:

| Real depth | Subagents |
| --- | --- |
| 0 (root-spawned) | 51 |
| 1 | 72 |
| 2 | 9 |

**Real maximum depth is 2.** Nesting exists but is shallow, and one agent
spawned 72 of the 132, so breadth dominates depth. Separately confirmed: the 132
`agentId` values on `subagent.started` are exactly the 132 appearing on other
events, so `agentId` is a sound identity for attributing any event to its agent.

The near-miss is the point. A tree built on `parentId` would have rendered
without error, looked convincing, and been fiction.

### The messaging table is used, and it is not a peer channel

The `inbox-surface` agent found `inbox_entries` empty in sampled databases and
concluded the surface was inert. Scanning **all 674** local session databases
found **27 rows**, so the sample was too small and the "unused" reading was
wrong.

The corrected data strengthens the agent's conclusion rather than reversing it.
Every one of the 27 senders is a `background-agent` or `sidekick-agent`
reporting to its owning session; none is a peer session. `inbox_entries` is the
**intra-Fleet** subagent reporting channel, and there is no inter-Fleet channel
to inherit. All 27 rows also carry `unread = 1`, so the flag is never cleared in
persisted state and cannot mean "the human has seen this."

### Accepted without re-measurement

- **Attention.** An unmatched `permission.requested` is the only signal that
  directly encodes a human block. The agent reported honestly that it could find
  no *unresolved* instance locally, so the predicate is sound in shape but
  unproven in the blocking case. `assistant.turn_end` means the assistant
  yielded, not that a human is needed.
- **Worktree cost.** ~2.6 MiB and ~50 ms per worktree of a clean checkout, with
  the object store shared and unchanged. Git is not the constraint; duplicated
  untracked and build state is. File descriptor limits are far from binding.

Limitations: depth and breadth are measured from one machine's session history,
which reflects how this operator works and is not a bound on what Copilot can
produce. The Attention predicate remains unproven against a genuinely blocked
session. Worktree cost was measured against a small repository, not the target
monorepo.

## c-0011 - Decomposition, route sequencing, and the acceptance slice

No new measurement was taken this cycle. The evidence recorded here is structural and decisional.

### The tree was degenerate, and that was hiding work

After ten completed cycles the session tree still contained exactly **one node**. Every open question - packaging
lifecycle, live Copilot signal handling, the Attention predicate, the worktree ceiling, and the status of three
unexplored routes - was held inside `n-0000`'s prose. The consequence was concrete rather than cosmetic:

- nothing below map tier could ever be promoted, because there was nothing below map tier;
- no question could carry its own priority, maturity, or dependency, so "what is left" had to be re-derived from prose
  every cycle;
- the fog scan had a single row and therefore could not discriminate, which made the deterministic selection rules
  inert - rule 6 was the only rule that could ever fire.

The step 11 instruction to "add newly visible fog as new nodes rather than hiding it inside an existing one" had been
under-applied for the whole session. Recorded here because the failure was invisible from inside any single cycle:
each cycle individually looked productive, and the checkpoints are accurate. Only the cumulative shape shows it.

### The anchor drifted behind durable state, not ahead of it

Issue #1's `updatedAt` had moved past the recorded `anchor-revision`, which normally signals that the anchor moved
underneath settled understanding. Reading the body showed the opposite: its "Isolation" section still records
worktree-per-Fleet as "reinforced but not enforced" and still requires that "A Fleet must know that other Fleets may
be working concurrently." **Both were reversed by confirmed decisions in c-0010.**

This is a distinct failure mode from anchor revision and is classified separately. Durable discovery state is *ahead*
of the anchor, so nothing is invalidated - but the anchor is the first thing every cycle reads, and an anchor that
contradicts confirmed state will eventually be read as authority by a cycle that has forgotten why it is stale. It is
recorded as a tracker divergence on n-0000 and needs `/discovery` to reconcile; this loop's `execute` may not run a
tracker command.

### Route scope: the loop recommended reduction and was overruled

The loop recommended driving Electron alone to a complete MVP and reducing v1.1, v3, and v4 to bounded feasibility
probes, on the argument that the MVP contract exists to select an implementation rather than to ship four. The user
rejected it: all four routes go to completion, one at a time, followed by a comparative evaluation.

Recorded as an overruled recommendation rather than as a decision, because the loop's argument was not refuted - it
was outranked. The cost the loop identified is real and unmitigated: four complete MVPs is roughly four times the work
and three are discarded. What the user's answer buys is a genuine side-by-side and a defensible final selection, and
the user owns that tradeoff. If schedule pressure later forces a reversal, this entry is the reason to revisit rather
than a reason to have decided differently now.

### The sequencing is structurally enforced, not merely documented

"One at a time" is encoded as a `depends-on` chain n-0003 -> n-0004 -> n-0005 -> n-0006, not as a note. This has a
measurable consequence through the priority-maturity invariant: n-0003 enters at maturity `researched`, which is
exactly at the invariant's floor, so the P1 nodes depending on it generate **no** priority debt and the table stays
empty. If n-0003 is ever weakened below `researched`, both n-0004 and n-0007 immediately become debt rows and the loop
is required to stop deepening them until Electron recovers. The sequencing therefore defends itself.

### Limitations

- Nothing here is a measurement. The one measurable question this cycle touched - the 8-Fleet ceiling under mandatory
  worktrees - was explicitly accepted as unknown, because no target repository exists to measure against.
- The Acceptance Slice is asserted to add no new scope on the grounds that every step restates a confirmed
  requirement. That mapping was done by reading, not by tooling, and has not been independently checked.
- Two of the slice's steps have never been observed working anywhere: step 5 depends on the Attention predicate, which
  has never been seen firing, and step 6's restart path has been proven only for teardown (c-0009), not for
  reconciliation on relaunch.

## c-0012 - Packaging measured, and the Attention predicate finally fired

Two approved prototypes ran and were cleaned up. Both measured **external
ground truth** - `ps` against recorded process-group identifiers, and
`events.jsonl` joined by `requestId` - rather than asking the program under test
whether it had succeeded. That discipline is what makes the two falsifications
below trustworthy.

### Prototype 1 - packaging preserves supervision (n-0003)

`electron-builder --dir`, Electron 33.4.11, unsigned (`identity: null`), bundle
`com.jdylanmc.maestro.proto.n0003c0012`, launched through LaunchServices with
`open -a`.

| Scenario | Teardown | Fleet processes | Survivors |
| --- | --- | --- | --- |
| P1 packaged graceful quit | `before-quit` group `SIGTERM`, verify, escalate | 9 | **0** |
| P2 packaged Force-Quit simulation | none | 9 | **9** |
| P3 packaged relaunch, reap-on-launch | reaper on `whenReady` | 9 recorded | **0** |

The three packaged scenarios reproduce c-0009's B1, B2, and B3 exactly. The
supervision design is not an artifact of the development lifecycle.

**The packaged application's own parent process identifier is 1.** It is a child
of `launchd`, which is the identical reparenting shape that made v1.0's detached
`herdr server` dangerous in c-0006 - and it is harmless here. The application is
its own process-group leader, each detached Fleet receives a distinct group, and
`process.kill(-pgid)` addresses it exactly as under a development run. The
c-0006 defect was never reparenting; it was **unowned** reparented processes.
This sharpens the requirement rather than adding one.

`app.setPath('userData', ...)` called before `whenReady` redirected every
Electron-authored write into the isolation path, so a packaged build does not
force durable state into `~/Library/Application Support`.

Build cost: `npm install` of Electron plus electron-builder took 1 minute, the
Electron binary downloaded in 7.06 s, and packaging to `.app` took under a
minute.

Limitations: synthetic `sh`/`sleep` Fleet trees, unchanged from c-0009; unsigned
with no hardened runtime, so a notarized build is untested; Force Quit was
simulated with `SIGKILL`, the signal macOS sends, rather than triggered through
the operating system interface; the `--dir` target only, no DMG or zip. macOS
LaunchServices retains a registration record for the deleted bundle - operating
system metadata, not a file the prototype authored.

### Prototype 2 - the Attention predicate, measured on live Sessions (n-0002)

Real `copilot` 1.0.80 Sessions driven interactively through an `expect`
pseudo-terminal.

**It fires, and it clears.** Session `225cda11`:

| Event | Timestamp | requestId | Result |
| --- | --- | --- | --- |
| `permission.requested` | 23:45:08.603Z | `c4b94311-...` | - |
| `permission.completed` | 23:45:09.728Z | `c4b94311-...` | `{"kind": "approved"}` |

**A sustained unmatched request was observed on a genuinely blocked Session.**
Session `c8f382bc`, request `dd7f6347-...` raised at 23:46:59.608Z and left
unanswered: sampled twice about 25 seconds apart, `requested 1 / completed 0 /
UNMATCHED 1` both times. This is the first observation anywhere in this project
of the predicate the c-0010 research proposed. It was called sound in shape but
unproven in the blocking case; it is now proven in the blocking case.

Three implementation facts fell out of it:

- the join key is `data.requestId`, not `toolCallId` - the request carries
  `data.permissionRequest.toolCallId` as a separate field;
- `permission.completed.data.result.kind` discriminates the outcome, so a human
  approval and a policy denial are distinguishable rather than merely paired;
- events live in `events.jsonl`, **not** in `session.db`, which holds only
  `inbox_entries`, `todos`, and `todo_deps`.

**Non-interactive invocation can never surface Attention.** Without
`--allow-all-tools`, a `-p` run completes the request immediately as
`denied-no-approval-rule-and-could-not-request-from-user` - measured in session
`0e840075` as 1 requested, 1 completed, 0 unmatched. A Fleet driven that way
never blocks and never raises Attention, so acceptance-slice step 5 is
unreachable through it. The integration mode is therefore a requirement-level
constraint, and `copilot --acp` - the Agent Client Protocol server the binary
already exposes - is the seam to evaluate first. This became n-0008.

**A live Copilot Session does not tear down like a synthetic tree.** The blocked
Session held **eight processes in one process group**: `copilot`, two `npm exec`
wrappers, an `agency mcp kusto` server and its native child, two Node Model
Context Protocol servers, and `OsgWikiMcp` - the same binary that raised the
orphan permission prompt in c-0006.

| t after `SIGTERM` to the group | Survivors |
| --- | --- |
| before | 8 |
| +0.5 s | 6 |
| +1.0 s | 6 |
| +1.5 s through +3.0 s | **5, stalled** |
| after `SIGKILL` escalation | **0** |

c-0009's synthetic trees reached zero on `SIGTERM` alone. The real runtime does
not. **The synthetic result overstated how well graceful teardown works**, and
escalation is the load-bearing step rather than a safety net. Total elapsed
teardown 4.35 seconds.

`copilot` also **self-assigns its own process group**: spawned from `expect`
with no detach flag it still appeared with `pgid == pid`, distinct from its
parent's group, with every Model Context Protocol server inheriting it. A
supervisor gets a clean per-Session boundary for free, but must still record the
group durably, because a group it does not record is a group it cannot reap.

Limitations: the identity of the five `SIGTERM` survivors was not captured, only
the count, so the c-0006 wrapper-process explanation is inferred rather than
shown; four pseudo-terminal attempts were needed before the terminal user
interface accepted input, because `setsid` does not exist on macOS and an
`expect` script that `sleep`s rather than draining the pseudo-terminal stalls the
child - evidence about pseudo-terminal driving, not about the runtime; one
Session shape on one machine with this operator's Model Context Protocol server
set, where a Session with no such servers would tear down more easily; and
teardown was measured against a Session blocked on a permission request, a
plausible worst case but only one case.

### The recorded state digest was not the digest the schema specifies

The `state-digest` written by every cycle up to c-0011 reproduces exactly as the
normalized per-file digest of `discovery.md` **alone**, not as the five-line
manifest digest defined in the session-state schema. `domain-model.md`,
`requirements.md`, and `evidence.md` were never inputs to it, so drift in any of
those three would not have been detected.

This is a loop bookkeeping defect, not third-party drift: the entry comparison
still reproduced bit for bit under the previous convention, both root digests
matched, and the working tree was clean at the c-0011 commit. c-0012 computes and
records the specification-conformant manifest digest, so c-0013's entry
comparison is against a corrected value and must not read the change as drift.

### Limitations of this cycle

- Nothing was measured about the acceptance slice's steps 2 and 4, which are
  visual, and nothing was measured about restart reconciliation - only teardown.
- Both prototypes ran on one machine, one macOS version, one Electron version,
  and one Copilot version.
- The Q4 verification-seam decision was taken by the loop with the user absent,
  under the standing `delegated-to-loop` policy. It is the only decision in this
  cycle not made in a live user turn.

## c-0013 - The ACP seam, probed

One approved prototype, run in
`.discovery-prototypes/maestro-graphical-agent-orchestrator/n-0008-c-0013/` and
cleaned up: a minimal Node JSON-RPC-over-stdio client speaking to
`copilot --acp`. Selected by rule 2 - **the first cycle in which priority debt
has ever driven selection**.

### The protocol works, and it is richer than the event log

`initialize` -> `session/new` -> `session/prompt` completed with
`stopReason: end_turn`. The agent advertises
`agentCapabilities {loadSession: true, sessionCapabilities: {close, list},
promptCapabilities: {image, embeddedContext}}` and reports itself as Copilot
`1.0.81-5` - a different build than the invoking binary, 1.0.80.

Streaming arrives as `session/update` notifications:

| Update | Carries |
| --- | --- |
| `agent_message_chunk` | streamed assistant text |
| `tool_call` | `toolCallId`, `title`, `kind`, `status: pending`, `rawInput` |
| `tool_call_update` | `status: completed`, `content`, `rawOutput` |
| `available_commands_update`, `usage_update`, `config_option_update` | session metadata |

`tool_call` and `tool_call_update` are exactly the per-node Activity line the
interface requirements ask for, delivered as structured data rather than scraped
text.

### It never asks permission

No `session/request_permission` arrived, and the ACP sessions' `events.jsonl`
recorded **zero** permission events - `tool.execution_start` straight to
`tool.execution_complete`, with the shell command executed and the file created.

Run twice, once declaring `clientCapabilities {fs, terminal}` and once declaring
`{}`; identical. **Control:** the c-0012 pseudo-terminal session ran with the
same environment, same working directory, and same binary and **did** prompt,
and `env` carries no `COPILOT_ALLOW_ALL`. The difference is the mode.

This is a negative result, so it is evidence of absence only for this build and
this invocation. The Agent Client Protocol itself defines
`session/request_permission`; this implementation did not send it.

### It will not name a session, but it will list and resume them

`session/new` accepted a `name` parameter and ignored it: the created session's
`workspace.yaml` shows `user_named:` empty. That file does carry `cwd`,
`git_root`, `branch`, and `client_name: github/acp`.

`session/list` returned 50 sessions with `sessionId`, `cwd`, `title`, and
`updatedAt`. Pseudo-terminal sessions show their `-n` name as the title; ACP
sessions show an auto-derived title.

`session/load` resumed a prior session **with history intact** - asked what
command it had been given, the resumed session answered "You asked me to run
`touch blocked.txt`." Restart reconciliation therefore has a working mechanism,
which no cycle had demonstrated before.

### The decision, and why the recommendation was dropped

The loop recommended that Maestro own the permission boundary by denying
sensitive tools at the process level and exposing gated equivalents through its
own Model Context Protocol server. The user delegated the decision and supplied
the context that killed it: "I usually run in yolo mode with many permissions."

A mediation layer sized for a user who lives behind permission prompts would
have been built to service a slice step rather than a user, and it would have
contradicted the confirmed decision that Maestro reads only generic runtime
evidence. It was dropped. Attention is derived from what the seam provides -
`session.error`, `abort`, and the tool-call status stream - with unmatched
`permission.requested` retained wherever a mode surfaces it, and ACP permission
support recorded as an upstream dependency with a re-test trigger on every CLI
upgrade.

Two confirmed requirements were changed by this, both under delegation rather
than user confirmation, and both flagged revisitable: acceptance-slice step 5
now reads "a state that requires the human" rather than naming the permission
signal, and the runtime-naming requirement narrows to binding by `sessionId`
with a Maestro-owned display name.

### Limitations

- No subagent was spawned, so `subagent.started` was never exercised through
  ACP. The subagent tree's live path is confirmed only for the shared
  `events.jsonl`.
- One CLI build, and the ACP server reported a different version than the
  invoking binary, so the permission behavior may not be stable across releases.
- The probe answered a permission-free path only; nothing was measured about
  what an ACP client should render while a tool call is `pending`.

## c-0014 - The seam was reversed by a question about firstmate

### How the cycle started

The user asked how firstmate handles permissions. Firstmate's answer is that it
does not: the brief's "mode and yolo contract" is validated at spawn, the
control plane is three verbs - `interrupt`, `exit`, `relaunch` - with teardown
permanently excluded, and human involvement arrives through the wake queue's
actionable/absorbable split rather than through approval prompts. The only
authority gate is the home lock, and a lock-refused session degrades to
read-only, which is session authority rather than tool permission.

Answering it required reading the neighbouring reference, and
`v2/docs/reference/orbit-arch.md` documents an Electron application that
receives permission requests from the **Copilot SDK**, auto-approves configured
read-only operations, renders permission cards, resolves them through
`answerRequest()`, and times an unanswered request out into a denial.

c-0013 had settled the integration seam one cycle earlier after probing exactly
two of three seams. The third was the one that answers the question.

### Reinterpretation weakened the node the same cycle it was settled

n-0008 took a `weakened` verdict: maturity `researched` -> `vague`. The ACP
measurements were untouched - what failed was the inference built on an
incomplete seam survey. The weakening reopened three priority-debt rows, which
is precisely what forced the re-examination instead of letting the decision be
inherited.

### The SDK ships inside the platform package

`@github/copilot` on npm is a loader. The SDK is at
`node_modules/@github/copilot-<platform>/copilot-sdk/`, with full TypeScript
declarations. c-0013 never looked there.

| Surface | Declaration |
| --- | --- |
| `CopilotClient` over stdio, TCP, or in-process FFI | `client.d.ts`, `RuntimeConnection` |
| `SessionConfig.onPermissionRequest?: PermissionHandler` | `types.d.ts:1872` |
| Pull model when the handler is omitted | `types.d.ts:1869-1871` |
| `permissions.pendingRequests()` | `generated/rpc.d.ts:9189-9193` |
| `permissions.handlePendingPermissionRequest({requestId, result})` | `rpc.d.ts:19439` |
| `permissions.setApproveAll(...)` | `rpc.d.ts:19453` |
| `approveAll` helper | `index.js:8758` - `() => ({ kind: "approve-once" })` |
| Per-tool `skipPermission`; `permissionDecision: allow \| deny \| ask` | `types.d.ts:467-495`, `972` |
| `listSessions()`, `resumeSession(sessionId, config)` | `client.d.ts:226,321` |

**The Attention predicate turned out to be the runtime's own contract.** The
generated schema documents `pendingRequests` as returning "the set of
`permission.requested` events that have not yet been followed by a matching
`permission.completed` event." That is the sentence c-0010 derived, c-0012
measured, and c-0013 believed was unavailable - and there is a first-class RPC
that returns it, so Maestro never needs to reconstruct it from the event log.

The decision union is far richer than a boolean: approve-once,
approve-for-session, approve-for-location, approve-permanently, reject,
user-not-available, denied-by-rules, denied-interactively-by-user,
denied-by-content-exclusion-policy, denied-by-permission-request-hook. The
user's stated habit - running with broad permissions - is `setApproveAll`, a
toggle, rather than an architectural position.

### What was verified live, and what stopped

`new CopilotClient()`, `start()`, and `createSession()` succeeded, returning
session `4dec7e07-b0d7-454c-8ee0-99f617d8e484`. `sendAndWait` then failed:
**"You have exceeded your monthly quota."** `listModels()` returned only `auto`,
so there was no cheaper fallback.

**The permission callback was never observed firing.** That is recorded as an
accepted unknown with a re-test trigger on quota reset, and the user accepted
settling the seam on documentary evidence in the meantime.

### What this cost, and what it bought

c-0013's ACP decision produced two changes to user-confirmed requirements. One
is now withdrawn: acceptance-slice step 5 reverts to "Fleet A hits a permission
request", the wording the user confirmed, because the SDK can surface one. The
other stands narrowed: no session-name field was found in `SessionConfig`, so a
Fleet is still bound by `sessionId` with a Maestro-owned display name, pending a
check for a rename over RPC.

The lesson is not that c-0013 was careless - its measurements were sound and are
still cited. It is that a seam **survey** was treated as complete when it had
covered the two seams the loop happened to know about, and a user question about
an unrelated system exposed the third. Nothing in the cycle protocol catches
that; only the reinterpretation step did, one cycle later.

### Limitations

- The permission behaviour is established from declarations shipped with the
  binary and from a second application's independent implementation, not from
  observation.
- The bundled SDK reports itself as `@github/copilot-sdk@1.0.9-preview.2` inside
  a CLI of a different version, so the surface may move between releases.
- No check was made for a session rename over RPC, and no subagent was spawned,
  so the SDK's typed-event path for `subagent.started` is unconfirmed.
