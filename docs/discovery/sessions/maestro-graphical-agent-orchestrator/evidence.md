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
- `v2/docs/reference/aeon-arch.md` (added c-0018) analyses [aeonfun/aeon](https://github.com/aeonfun/aeon) at `eb86eac6`, a GitHub-Actions-hosted autonomous agent framework the user supplied as *"similar to what we're trying to achieve but not quite ... more like automation loops with fleets"*.

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

## c-0015 - The harness splits in two, and the rubric gains its first criterion

No measurement this cycle. Selection was rule 2 for the third consecutive time,
on n-0009 - the last node holding priority debt.

### The question had to be asked twice

The loop's first attempt was rejected outright: "I'm not sure I even follow what
you are asking." It had been framed in the loop's own vocabulary - state truth
versus presentation truth, route-agnostic assertion - which is precise and
useless to the person answering. Restated in plain terms, without counting a
second question against the budget, it was answered immediately and then
improved on.

Recorded because it is a repeatable failure: the loop's internal vocabulary is
the thing it thinks in, and reaching for it in a user-facing question spends the
user's attention on translation rather than on the decision.

### The split that survived

The six slice steps sort by whether anything outside the application can
establish them:

| Step | External ground truth | Presentation claim |
| --- | --- | --- |
| 1 two Fleets, own worktree and branch | `git worktree list`, `git branch`, durable state | none |
| 2 primary agent window bound 1:1 | SDK `listSessions()` | the window exists |
| 3 subagent tree with correct parentage | `events.jsonl`, `toolCallId` -> `agentId` | it renders live |
| 4 select Fleet B, panels re-scope | **none** | entirely visual |
| 5 Attention on that Fleet only | `permissions.pendingRequests()` | where it appears |
| 6 zero survivors, relaunch intact, resume | `ps` by process group, on-disk state, `resumeSession` | none |

Three steps are fully external; three carry a presentation half; step 4 has no
external truth at all. That asymmetry is the whole design: a **State Oracle**
that needs no cooperation from the route, and a **Presentation Check** that
does.

The State Oracle matters beyond convenience. Because it asks `git`, `ps`, the
event log, and the SDK rather than the application, a route cannot assert its
own success, and no stack is advantaged by being easier to instrument. It is the
same discipline that made c-0009 and c-0012 trustworthy, generalised.

### What the user changed

The loop asked who checks the visual steps. The user answered a different and
better question: **user-interface automation belongs in the stack selection**,
because automated regression checks are the work that follows the MVP.
Storybook and Playwright were named as reference points.

Then, in the next turn, two constraints that sharpened it further: **"i can't
afford human testers, so we will test with machines as much as we can"** and
**"but first - we have to prove an MVP on a stack."**

Together these settle more than the question asked:

- a manual step is a stopgap of last resort, and its survival into a route's
  verification is a **cost recorded against that route**;
- how far each route automates the Presentation Check **is** the evidence for
  the rubric criterion, so the criterion is measured rather than assessed;
- harness work is sized for the Electron route only - breadth before a proven
  MVP would repeat the pattern that produced c-0013's premature seam decision.

### The criterion is not neutral, and that is recorded

A component-driven web stack reaches Storybook and Playwright directly; Tauri
reaches Playwright through WebDriver; Swift uses XCUITest; a terminal surface
exposes almost nothing to any of them. Naming user-interface automation as a
criterion therefore predicts part of the ranking before any route is built.

That is a legitimate product decision by the person who owns it, and it is
recorded as one rather than presented as a neutral measurement - so that when
the evaluation reaches the WezTerm route, the reason it scores badly is visible
as a choice made in c-0015 rather than as a discovery made at the end.

### The priority-debt table emptied

Over four cycles it did its whole job: opened in c-0012 with six rows, blocked
three routes from gaining depth while two provider-level questions were
unsettled, **reopened automatically in c-0014** when a settled decision lost its
evidence, and emptied in c-0015 once both questions were genuinely understood.
With it empty, rule 2 stops firing and selection returns to the higher rules.


## c-0016 - The harness gets an automation path, and a prototype gets falsified

Selected n-0009 under rule 3 (shared blocker). Both researchable questions were
answered before the group ran, so the group spent one question of twelve.

### The `Attention` handoff finally completed, three cycles late

`/domain-mapping` ran in a live user turn and confirmed `Attention` into
[`CONTEXT.md`](../../../../CONTEXT.md), discharging a handoff `pending` since
c-0012. Four sources had described it as two different kinds of thing:
`herdr-arch.md` and `domain-model.md` as a **ranking** (`Blocked > Done >
Working > seen Idle > Unknown`), `discovery.md` and `requirements.md` as a
**per-Fleet condition**. The ranking reading is falsified by c-0010's confirmed
total-Fleet-isolation decision: a definition requiring comparison across
siblings contradicts it. Resolved as **separate concepts** - the condition is
the domain term, the ranking is presentation and stays out of the glossary.

The user chose the **broad** reading, so Attention means the Fleet wants its
human, not only that it cannot proceed. `docs/adr/0002` was approved separately,
recording the decision to consume the runtime's permission model rather than
build a mediation layer.

### The confirmed trigger set maps cleanly onto SDK surfaces

Established by read-only inspection, then confirmed against
`@github/copilot-sdk@1.0.11-preview.2` installed under the prototype:

| Attention trigger | SDK surface |
| --- | --- |
| Blocked on an unanswered permission | `permission.requested` unmatched by `permission.completed`; `onPermissionRequest` |
| Stopped by an error | `session.error`; `hooks.onErrorOccurred` |
| Stopped by an abort | `session.idle` with `aborted: true` |
| Finished and unacknowledged | `session.idle` with `aborted` falsy; `hooks.onSessionEnd` |

`pendingRequests()` at `dist/generated/rpc.d.ts:19984`, `onPermissionRequest?`
optional at `dist/types.d.ts:1992`, `session.idle` and `IdleData.aborted` at
`dist/generated/session-events.d.ts:1073` and `:1082`.

Subagent vocabulary is richer than c-0010 recorded: `subagent.started`,
`subagent.completed`, **`subagent.failed`**, `subagent.selected`,
`subagent.deselected`. A failed subagent is a distinct terminal state the tree
must show.

### The permission surface is version-volatile, measured across three versions

`copilot-sdk@0.3.0` and the copy bundled in `@github/copilot@1.0.40` both make
`onPermissionRequest` **required** and expose **no** `pendingRequests()` at all.
Version ordering was checked before concluding anything - `npm view` runs `0.x`
through `1.0.11-preview.2` - so 0.3.0 **predates** c-0014's reading and the pull
model was *added*, not removed. **c-0014 is confirmed, not falsified.**

But the contract has now changed shape three times across observed versions, and
the current doc comment reads "**Reconstructs** the set of pending tool
permission requests **from the session's event history**." c-0014 concluded
"Attention becomes a query rather than a reconstruction". It **is** a
reconstruction; the runtime performs it. The defensible claim is narrower:
Maestro need not *implement* the reconstruction. Pinning the SDK version is a
route requirement, and the pinned version belongs in the executive report.

### Research - Playwright against Electron

`_electron` is experimental by deliberate naming but actively maintained
(`artifactsDir` added in v1.59), attaching over the Chrome DevTools Protocol.
Every panel in one `BrowserWindow` is one Playwright `Page`, so step 4 is
asserted with `Promise.all` over several **auto-retrying** `expect(locator)`
calls. Native menus and native dialogs are **completely invisible** and must be
stubbed in the main process. `executablePath` must name the Mach-O binary inside
`Contents/MacOS/`, not the `.app` wrapper.

**Storybook was assessed and set aside** for the hard step: it renders one
component with mocked props, so it structurally cannot express "one selection
re-scopes four sibling panels". Useful for per-panel visual regression only.

Credible alternative: **WebdriverIO with `wdio-electron-service`**, officially
endorsed, more stable API, worse debugging. Spectron is dead (archived February
2022).

### Research - the WezTerm automation ceiling

Assertable deterministically: `wezterm cli list --format json` (panes, sizes,
titles, cwd), `get-text --pane-id` (pane text), `list-clients` (focused pane),
`get-pane-direction` (adjacency).

Unreachable through any surface: colors reliably - `--escapes` emits a
non-standard SGR variant that even the `rich` library misparses - focus rings,
cursor state, images, pane borders, tab-bar rendering, frontmost-window state,
scroll position.

**No macOS accessibility tree at all** (issue #913). Terminal.app and iTerm2
both expose one; WezTerm does not, which closes XCTest UI Testing, Appium, and
AppleScript in one stroke. The only fallback is `screencapture` plus Tesseract
or pixel diffing - brittle to font, resolution, and OS rendering changes.

**Roughly 40-50% of on-screen verification is automatable**, and the remainder
is structural, not a fixable tooling gap.

### Prototype n-0009-c-0016 - what it proved, and what it got wrong

Approved as `Approve prototype n-0009`. A four-panel Electron app with panel
updates deliberately staggered at 40, 120, 260, and 500 ms so a point-in-time
assertion cannot pass by luck. Playwright 1.62.1, Electron 44.0.0-beta.3,
electron-builder 26.15.3.

**Established, and this is the cycle's main result:**

- **Acceptance-slice step 4 is machine-verifiable.** One click, then four
  auto-retrying assertions - `toHaveText`, `toContainText`, `toHaveAttribute`,
  `toHaveClass` - passed 3/3 against an **unpackaged** app (8.2 s) and 3/3
  against a **packaged `.app`** (4.1 s). Step 4 was the only slice step with no
  external ground truth, and it is the one that decided whether the Presentation
  Check is viable at all. It is.
- **The negative control passed**, and it is what makes the result trustworthy:
  an immediate `getAttribute` right after the click still read the stale
  `data-fleet="a"`. The auto-retry is doing real work.
- `electronApp.evaluate()` returned `BrowserWindow.getAllWindows().length` from
  the main process, so the harness can read main-process truth too.

**Withdrawn as confounded.** The probe first concluded that disabling
`enableNodeCliInspectArguments` is what stops Playwright attaching, isolated by
a variant holding `runAsNode: true`. The user reported repeated "probe quit
unexpectedly" dialogs, and the crash reports gave the real cause:

```text
exception:    EXC_BAD_ACCESS, SIGKILL (Code Signature Invalid)
termination:  namespace CODESIGNING, indicator "Invalid Page"
```

`@electron/fuses` rewrites the Mach-O **after** electron-builder ad-hoc signs
it, so on Apple Silicon the signature no longer matches and the kernel refuses
to execute the binary. `Error: Process failed to launch!` is downstream of the
OS kill, not evidence about `--inspect`. The fuse claim reverts to **documentary
only**; a valid test must re-sign after flipping fuses.

**Newly established instead:** flipping Electron fuses without re-signing
produces a binary macOS kills on sight. That is a real packaging constraint for
the Electron route, and it interacts directly with this cycle's decision to ship
the MVP unsigned.

**Process lesson.** The failing tests looked exactly like the researched failure
mode, which is why the wrong conclusion was convincing, and nothing inside the
loop caught it - it was caught only because the user mentioned an operating
system dialog the loop never thought to look for. **A prototype asserting a
negative result must establish *why* the negative happened, not merely that it
happened.**

**Cleanup and side effects.** The isolation path was removed and verified gone,
and no prototype process survives. macOS wrote six `.ips` crash reports to
`~/Library/Logs/DiagnosticReports/`, outside the isolation path and outside this
skill's permitted deletion scope; they were disclosed and left for the user.

### Decision - which binary the slice runs against

The MVP targets an **unsigned, fuse-enabled `.app`**. Signing and notarization
are excluded from the acceptance slice and deferred, with the trigger being the
first distribution of Maestro to anyone but the author. The user is the only
user of the MVP, and c-0012 already showed the property that matters -
LaunchServices reparenting to `launchd` while still reaching zero survivors -
holds for a packaged unsigned `.app`. This retires n-0003's last open question
by scoping it out rather than deferring it indefinitely, and keeps one binary
under test so no step is verified against a binary the user does not run.

## c-0017 - Two leaves clear, and the constraint moves above them

No measurement this cycle. Every advance is a reclassification, a settled rule,
or a gate evaluation, and that is stated rather than dressed up.

Selection was rule 3 (shared blocker) for the second consecutive cycle. The
deterministic tie-break reached **n-0008**, not n-0009: with n-0009 advanced to
`decision-ready` in c-0016, n-0008 became the only P0 candidate still at
maturity `researched`, so the lower-maturity tie-break resolved before the
dependent-count tie-break ran. The user authorized either node, and n-0009 was
taken because it was the sole remaining gate on n-0003 and therefore on the MVP.
`selection-source: user`.

### One question was spent and returned nothing, for the second time in three cycles

The loop asked how the harness should prove it is not vacuously passing, with a
recommendation and an alternative. The answer was a rejection of the question
itself: *"this seems like internal banter that you need to resolve. I don't see
any product decisions here. You should reframe this as a product decision if you
need my input."*

c-0015 recorded the same failure from a different direction - a question framed
in the loop's internal vocabulary, answered with *"I'm not sure I even follow
what you are asking."* c-0017's question was perfectly comprehensible and still
wrong, because it was not the user's to answer: it was an engineering-quality
decision about **this loop's own verification apparatus**, not about what
Maestro is or does.

The standing correction, recorded because two instances make it a pattern rather
than an incident: **before spending a grounded question, test whether the answer
changes what the product is or does for its user. If it only changes how this
loop verifies something, the loop owns it.** The question budget exists to buy
decisions the user alone can make, and both wasted questions failed that test in
different ways - one by being unintelligible, one by being irrelevant to them.

### The fuse question does not gate the MVP, and never did

n-0009 carried "does disabling `enableNodeCliInspectArguments` block Playwright"
as an open question after c-0016 failed to establish it. Re-reading it against
c-0016's own build decision retires it as a blocker without any new work:

- the MVP ships an **unsigned, fuse-enabled** `.app` (c-0016 decision);
- Playwright was measured attaching to exactly that build, 3/3, packaged;
- the fuse question is only live for a build that turns fuses **off**, which is
  the configuration the MVP has explicitly deferred;
- `requirements.md` already carried the trigger - "the first Electron route
  build that configures fuses at all".

It becomes an accepted unknown with its risk and trigger, and no prototype was
run. The user had pre-authorized one ("do the next required prototype if
necessary"); it was not necessary, and a general authorization is not the
`Approve prototype <node-id>` gate string in any case, so nothing was proposed.

This is worth recording as its own finding: **an open question inherited across
cycles can stop being load-bearing without anyone re-deriving it.** c-0016
recorded the fuse question and the unsigned-build decision in the *same cycle*
and did not notice that the second retires the first.

### The harness's missing gate condition was its own verification seam

n-0009 sat at maturity `decision-ready` rather than `promotion-ready`, and the
condition it failed was number 9: a verification seam. For a **verification
apparatus** that condition is circular unless answered explicitly - the question
"what verifies the verifier" has no external answer, so it must be designed in.

The answer is the generalisation of the one control c-0016 actually measured:

> The Acceptance Harness runs a **paired-falsification suite** against itself,
> first, on every run. Every assertion in both layers ships with a fixture it
> must **fail** on. The negative suite executes before the route suite; if any
> negative case passes, the harness declares **itself** broken and refuses to
> report on the route at all.

Granularity is per assertion, not per slice step, because the near-miss in
c-0016 was at assertion granularity: an auto-retrying `expect()` that passes is
indistinguishable from one that never tested anything, and a step can pass with
four assertions of which three are vacuous. The State Oracle needs it at least
as much as the Presentation Check, in a different shape - a "both worktrees
exist" assertion written as a subset test passes trivially on empty `git
worktree list` output - and the Oracle is the layer nobody would think to doubt,
because no route can influence it.

Settled by the loop under `delegated-to-loop`, and recorded as a rule the
implementation must satisfy rather than as something demonstrated at six-step
scale. Its first honest test is the harness's own first run.

### The finding that matters: the leaves are ready and the branches are not

With n-0009 cleared, n-0003's last blocker is gone. Both were evaluated against
the eleven-condition leaf gate and both pass:

| Node | Fog | Maturity | Verification seam | Accepted unknowns |
| --- | --- | --- | --- | --- |
| n-0009 Acceptance Harness | cleared | promotion-ready | the paired-falsification suite | the fuse question, with risk and trigger |
| n-0003 v2 Electron MVP | cleared | promotion-ready | the Acceptance Harness | inherits n-0008's quota-gated permission-callback unknown |

**Neither can be published.** The promotion gate requires the branch node to be
at fog `cleared` **and** maturity `promotion-ready`, with no exception for a
branch at `decision-ready`. n-0000 is at `decision-ready` / `researched`;
n-0001 is at `decision-ready` / `decision-ready`. Both fail.

This inverts the shape of the session. For six cycles the constraint on shipping
was fog on the leaves - the seam, the harness, the packaging, the Attention
predicate. It no longer is. What blocks the Electron MVP from becoming real work
items is:

1. **n-0001's one open product question** - what evidence each route's executive
   report must carry so four reports are genuinely comparable. It has sat
   unasked since c-0011 while every cycle selected something below it.
2. **n-0000's maturity**, which has been `researched` since c-0005 and was never
   re-raised after c-0011 moved all of its questions down to children. The
   decomposition that made the tree usable also left its root behind.
3. **Issue #1's stale "Isolation" section**, seventh cycle. Cosmetic until now;
   load-bearing from now, because Issue #1 is the tracker parent that promoted
   MVP work would hang beneath, and it contradicts the confirmed c-0010 state
   those work items would be specified from.

The first is a question. The second follows from the first. The third needs
`/discovery`, which this loop may not run.

### Limitations of this cycle

- Nothing was measured. n-0009 reaches `promotion-ready` on a design decision.
- The paired-falsification rule is asserted at six-step scale and demonstrated
  at one-assertion scale.
- n-0003 advanced without being the selected node, as a consequence of its last
  blocker clearing. That is legitimate under the fog transition rules but it
  means no cycle has ever examined n-0003 deeply with it unblocked.
- `discovery.md`'s node `History` fields exceed the schema's five-entries-plus-
  compaction bound and were left uncompacted again, to avoid rewriting
  provenance under a mechanical edit. Disclosed rather than silently fixed.

## c-0018 - A cleanup cycle that found a falsified requirement

Directed by the user after a read-only review of the tree: *"Great- let's do a
cycle of cleanup."* Traversal broad across all ten nodes rather than deep on
one, because every defect found was cross-cutting maintenance rather than fog
on a single node. Deterministic rule 3 would have selected n-0008; overridden.

**None of these defects was an anchor-driven `invalidated` verdict.** Every one
was caused by *this loop* leaving stale text behind when its own later decisions
superseded earlier ones. Reinterpretation classifies anchor-driven change;
recording loop-authored staleness as `invalidated` would misattribute the cause.
All ten nodes were verdicted `intact`.

### Route scope split by route, not deferred

The loop asked whether to keep or reduce the commitment to routes 2-4 and
recommended deferring the whole question until the Electron report existed. The
answer was neither: *"You can build Electron and WezTerm variants now and
delegate the Swift and Rust variants if you recommend. That would be going deep
on half of our discovery tree, and it's OK with me."*

The user committed the two routes carrying evidence - Electron has measured
results, WezTerm has an existing `proto-v1/` implementation - and handed back
the two with none. That split is sharper than either option the loop offered.

Sequencing was then delegated and decided by the loop: **both committed, still
one at a time, Electron first.** The Acceptance Harness is shared and unbuilt,
so building it against two routes concurrently would let it be shaped by
whichever route is easier to instrument - the exact bias the State Oracle exists
to prevent - and a harness defect would appear in both executive reports at once
with no clean control.

### Research gave the two handed-back routes a decisive question each

Both nodes previously recorded `Open questions: Everything`. One bounded
read-only agent replaced that with one question apiece, and falsified a
confirmed requirement on the way.

**Falsified: "Tauri reaches Playwright through WebDriver" (c-0015).** Wrong on
macOS. `WKWebView` exposes no Chrome DevTools Protocol, so Playwright is out
entirely - not routed differently, simply unavailable. Tauri's own documentation
states that driving `tauri-driver` directly supports "only Windows and Linux ...
as macOS has no WKWebView driver tool available"
(v2.tauri.app/develop/tests/webdriver/, accessed 2026-08-20). The working path
is **WebdriverIO with `@wdio/tauri-service`**, which embeds a W3C WebDriver
server *inside the application binary* via `tauri-plugin-wdio-webdriver`. That
is a materially different cost from Electron's: the route must **modify the
product under test to make it testable**. CrabNebula's macOS driver is
commercial; Appium's `mac2` driver reaches the accessibility layer but not the
webview DOM.

**Swift has the strongest verification story of the four, and the weakest
integration story.** `XCUITest` is first-class, and `XCUIApplication` drives an
already-packaged `.app` by bundle identifier or file URL with no test target
compiled into the product - the exact opposite of Tauri's requirement. But
GitHub publishes official Copilot SDK bindings for TypeScript, Python, Go,
**Rust**, Java, and .NET, and **none for Swift**.

That last fact cuts both ways and neither direction had been counted:

- **n-0005 (Tauri/Rust) gains an advantage** - its Rust core can consume an
  official SDK binding natively, with no Node sidecar.
- **n-0006 (Swift) pays a cost** - a sidecar process, or a hand-rolled JSON-RPC
  client against no published specification.

SDK language-binding availability is therefore a **second rubric axis**
alongside user-interface automation, and it partly inverts the ranking c-0015's
criterion implied: Swift was assumed middling and is strongest on automation;
Tauri was assumed Electron-like and is materially worse.

Both routes were reduced to bounded feasibility probes under `delegated-to-loop`
- the reduction the loop recommended in c-0011 and was overruled on. What
changed is that it is now grounded in per-route facts rather than a general cost
argument, and each probe still produces the executive report c-0011 requires.

### Maintenance defects found and fixed

**A question existing in three places, two of them stale.** "Does
`subagent.started` reach a client live?" was recorded on n-0002 phrased against
**ACP**, on n-0008 phrased against the **SDK**, and in `requirements.md` phrased
against **ACP**. c-0014 superseded ACP with the SDK four cycles earlier. It now
lives once, on n-0008, which owns the seam.

**The Active Frontier was lossy.** n-0002's row listed one of its two open
questions. This matters mechanically rather than cosmetically: the deterministic
selection rules read the frontier, so a question present in a node block but
absent from its frontier row is invisible to the rule that decides what to work
on. The table was rewritten so every row carries every open question.

**n-0000's maturity was a twelve-cycle-old artifact acting as a constraint.** It
was lowered to `researched` in c-0005 for a stated reason - the destination's
*form* was unsettled, the user having floated neovim, the GitHub app, tmux, and
a Visual Studio Code extension inside one cycle. c-0011 settled that. No cycle
re-raised the field, and in c-0017 it silently became the thing blocking
promotion of two ready leaves. Corrected to `decision-ready`, recorded as a
**correction rather than an advance**.

**`tracker-tier-map` was not a tier map.** It held
`n-0000 -> Issue #1 (discovery:map); n-0001..n-0009 unpromoted` - a promotion
status list. The schema wants semantic tiers mapped to provider types, and
`docs/agents/issue-tracker.md` defines only **two** native levels, so Task must
collapse. A mapping was proposed and awaits
`Approve tier map maestro-graphical-agent-orchestrator`; the field now reads
`unmapped` rather than carrying something that would have failed at the first
promotion.

### A correction to the loop's own review

Two turns before this cycle the loop asserted that whether the SDK exposes a
session rename was "answerable from typings already on disk, in minutes."
**It is not.** Those typings existed only inside c-0014's prototype isolation
path, which was cleaned up; `~/.copilot-cli/*/` ships the binary alone and no
copy remains. Answering it needs an `npm install` in a fresh isolation path,
under a prototype gate.

Recorded because it is the same class of error the session keeps catching: a
claim asserted from memory of a prior cycle rather than checked against the
current disk. The accepted unknown stands with a corrected cost.

### The WezTerm ceiling became measurable

*"I do not use WezTerm actively on this computer so you may experiment with it's
capabilities and read the documentation as necessary."*

This matters more than it appears. Every WezTerm fact in the session - the
~40-50% automation ceiling, the absent macOS accessibility tree, the assertable
`wezterm cli` surface - comes from c-0016 **delegated research**, untrusted-
evidence class by this loop's own rules. It feeds a **fixed rubric criterion**
for a route now committed to a complete MVP, and it has never been measured.
Permission to measure it directly now exists. Recorded as a standing permission,
not as the `Approve prototype n-0004` gate string, so nothing ran on it here.

### External reference added

`v2/docs/reference/aeon-arch.md`, 327 lines, analysing `aeonfun/aeon@eb86eac6`
at the user's request and joining the shelf beside `herdr-arch.md` and
`firstmate-arch.md`. Written outside this loop's write path, as a direct user
instruction rather than cycle output, and cited here.

The finding most relevant to this session is a **vocabulary collision with
inverted scope**: aeon uses `fleet` to mean *a pool of GitHub repository forks
supervised by a parent instance*, whereas Maestro's confirmed `Fleet` is *one
isolated worktree plus session unit*. aeon's nearest analogue to a Maestro Fleet
is its `instance`. A reader moving between the two will misread the word in the
most damaging possible direction - as the whole ensemble rather than the unit.

Three structural contrasts are worth carrying:

- **aeon has no Attention analogue.** Notifications are fire-and-forget; there
  is no framework-level blocked, waiting, or finished-and-unacknowledged state,
  and a missed notification changes nothing in the state model. Maestro's
  Attention is precisely that state.
- **aeon has no process ownership problem because it has no processes.** Every
  run is an ephemeral GitHub Actions job; the scheduler, supervisor, and log
  store are all GitHub. The teardown, escalation, and reaping requirements that
  dominate this session's evidence simply do not arise - which also means aeon
  offers nothing transferable on the problem c-0006 through c-0012 measured.
- **aeon's automation loop closes without a human**, by design: `skill-health`
  detects, `skill-repair` opens a pull request, `self-improve` iterates, all
  under numeric backpressure gates (3 repair pull requests per day, a 24-hour
  per-skill cooldown). Maestro's human *is* the integration point. These are
  opposite postures, and the contrast is the useful part.

Transferable mechanisms, stated as mechanisms rather than compliments:
model-graded quality scoring of each run; a **structured exit taxonomy** so the
loop parses named exit codes rather than natural language; numeric backpressure
gates on autonomous action; and committed-file state with `git log` as the
recovery path.

### Limitations of this cycle

- **No measurement.** One delegated research agent, untrusted-evidence class,
  and one external analysis. Nothing was run.
- **The Tauri and Swift findings are research, not measurement**, and they are
  now load-bearing for a rubric criterion and for two route reductions. Each
  probe exists precisely to convert its own finding into measurement.
- **The tier map is proposed, not approved**, so promotion remains structurally
  blocked even once n-0001 clears.
- `.discovery-prototypes/maestro-graphical-agent-orchestrator/` remains on disk
  as an empty scaffold directory. Harmless, outside the discovery package, and
  disclosed rather than removed.
- Node `History` fields still exceed the schema's five-entries-plus-compaction
  bound. Third cycle disclosed, third cycle not fixed.

## c-0019 - The first promotion, and a term renamed before it was recorded

**The anchor was reconciled through `/discovery`, and it moved toward the tree
rather than away from it.** Issue #1's body had contradicted confirmed c-0010
state for seven consecutive cycles. The reconciliation corrected five things and
removed four dead fog items:

| Corrected | From | To |
| --- | --- | --- |
| Worktree policy | "a strong default, reinforced but not enforced" | a hard rule; one Worktree per Fleet, never shared |
| Sibling awareness | "A Fleet must know that other Fleets may be working concurrently" | reversed - Fleets are fully isolated and unaware |
| Integration seam | naming the Session through `-n, --name` | the Copilot SDK, with `sessionId` binding and a Maestro-owned display name |
| Issue #18 route scope | "every candidate must be a working end-to-end MVP" | split by route in c-0018 - two committed, two reduced to probes |
| Attention | **absent from the map entirely** | a new `Attention and observability` decision group |

Four `Not yet specified` items were already answered and were removed: sibling
awareness, the `AT_RISK` replacement, subagent tree depth, and inter-session
messaging - all resolved in c-0010. The 8-Fleet ceiling was narrowed to duplicated
untracked and build state and recorded as an accepted known unknown with a revisit
trigger. Verified by content digest against the intended bytes; the only delta was
a single trailing newline GitHub appends to every issue body.
Evidence: <https://github.com/jdylanmc/maestro/issues/1#issuecomment-5359304402>

**Three of the five corrections had never been tracked by this loop.** Only the
two Isolation bullets were carried as the known divergence. The stale seam
decision, the falsified Issue #18 clause, and the wholly missing Attention group
were found by reading the anchor against `requirements.md` line by line rather
than against the loop's own record of what was wrong. A divergence note records
what a cycle *noticed*, not what is *true*, and the gap between those grew for
seven cycles.

**The branch gate was misread for two cycles, and the misreading was the blocker.**
c-0017 and c-0018 both recorded n-0001's maturity as a precondition for promoting
n-0009, on the reasoning that n-0001 is n-0009's parent in the tree. The gate does
not say that. It requires the **branch node** of the promoted subtree and every
**leaf selected for promotion** to be at the promotion values, and it explicitly
folds deeper conceptual nodes into branch or story context. With n-0000 as the
Branch and n-0003 and n-0009 as the Stories, n-0001 and n-0002 are exactly those
deeper nodes - the acceptance-slice specification and the provider contract - and
their content belongs in the Story bodies, which is where it went. Tree parentage
is not promotion shape. n-0001 reached `promotion-ready` this cycle anyway, so the
question is moot in both directions, but the two cycles it cost were spent on a
constraint the loop invented for itself.

**A question about report comparability had a product requirement hiding inside
it.** Asked what evidence makes four executive reports comparable, the user
accepted the fixed template and then said *"the intention is that I may come back
to a session and not remember what is going on and want a quick 'what were we
doing and where are we at'."* The word `session` is a **confirmed term** in this
session's lexicon meaning a Copilot Session, so the sentence had two readings with
very different costs: a report section, or a product capability that would re-open
both promotion-ready leaves. Q2 disambiguated instead of guessing. The answer was
"report now, product capability as P1" - and it produced a new node and a new term.

**`Orientation` was rejected as a term, on evidence, before it was ever
recorded.** The user proposed it. A repository search found `## Scope and
Orientation` as a section heading in **eight** files under `v2/docs/reference/`,
which - with the executive report's lead section and the proposed product
capability - made it triple-booked on arrival. That is the same failure that
retired `Workspace` in c-0007, and `Workspace` was caught only after it had been
in use. A second objection was structural: every term in `CONTEXT.md` names the
thing or the **Fleet's** condition, including `Attention`, defined as "*A Fleet*
observed to want its human". `Orientation` named the *human's* state and would
have been the only such term. `recap` and `situation` were the only collision-free
candidates tested; `digest` and `standing` are already heavily used in this
repository. **`Recap`** was confirmed into a new `Account` group. Digest of the
written artifact: `acc94bc972249cc3ccd3098aea887af063cb082fc39eda51416b39199ca535e1`.

**The first promotion in nineteen cycles.** Under the tier map approved in the
same cycle, n-0000 was published as the Branch - updating
[Issue #1](https://github.com/jdylanmc/maestro/issues/1) with its promotion key -
and two Stories were created as native sub-issues:
[#29 Build the working v2 Electron Maestro MVP](https://github.com/jdylanmc/maestro/issues/29)
(`discovery:prototype`, `proto-v2.0`, `ready-for-agent`) and
[#30 Build the route-agnostic Acceptance Harness for the Maestro MVP](https://github.com/jdylanmc/maestro/issues/30)
(`discovery:task`, `ready-for-agent`), with #29 carrying a native blocked-by edge
to #30. All three verified against the approved preview after the apply. The
Electron title matches the shape already used by #23, #24, and #27 - v2 was the
only route whose build issue had never been created, which is a small sign that
the route carrying all the evidence was also the one nobody had written down.

**Tooling note.** `gh api --method POST .../sub_issues -f sub_issue_id=<n>` fails
with HTTP 422 because `-f` sends a string and the field is typed `integer`; `-F`
is required. Separately, `gh issue edit --body-file` appends exactly one trailing
newline, so post-write verification must compare `rstrip`-normalized content
digests rather than raw bytes, or every correct write reports a false mismatch.

## c-0020

**Selected node: n-0008 - Copilot integration mode.** Rule 3 (shared blocker), deterministic,
fourth consecutive cycle. No prototype was proposed and no research was delegated; every finding
below is a first-party read or a direct measurement made in the parent loop.

### The classification that was wrong

c-0019 recorded all three of n-0008's open questions as prototype-gated, one of them explicitly as
needing "an `npm install` in an isolation path, **not** a free read". The Copilot SDK is in fact
already on disk, with full typings, in five installed versions:

```text
~/.copilot/pkg/darwin-arm64/{1.0.80,1.0.81-0,1.0.81-1,1.0.81-3,1.0.81-5}/copilot-sdk
```

Two of the three questions were therefore repository-fact class all along, and both were answered
read-only. **The lesson is not that the SDK moved; it is that a cost was asserted rather than
checked, and then carried forward unexamined for six cycles.** The same node had already produced
one instance of this in c-0014, where a seam was chosen without looking at a third option that was
sitting in the same package.

### Findings from the SDK typings

| Question | Finding | Citation |
| --- | --- | --- |
| Does `subagent.started` reach an SDK client as a typed event? | **Yes**, with `subagent.completed`, `.failed`, `.selected`, `.deselected`, each with a `type` discriminator. | `generated/session-events.d.ts` |
| Can a client subscribe to just those? | **Yes.** `EventsAgentScope` `'primary'` returns "main-agent events plus events whose type starts with `subagent.`". | `generated/rpc.d.ts:426` |
| Is `parentId` usable for tree structure? | **No**, in the vendor's own words: "ID of the chronologically preceding event in the session, forming a linked chain." | `generated/session-events.d.ts` |
| What is the true parent edge? | `SubagentStartedData.toolCallId` - "Tool call ID of the parent tool invocation that spawned this sub-agent". | `generated/session-events.d.ts` |
| Does the SDK expose a session rename? | **No** rename API and no name field on `SessionConfig`. But `sessionId?: string` is caller-suppliable - "Optional custom session ID. If not provided, the server generates one" - and `session.title_changed` exists as a typed event. | `types.d.ts:2112` |
| What does `pendingRequests()` claim? | "Reconstructs the set of pending tool permission requests from the session's event history." Confirms the c-0016 narrowing verbatim. | `generated/rpc.d.ts:19441` |

**Version bound.** All four load-bearing surfaces - `pendingRequests`, `subagent.started`,
caller-supplied `sessionId`, and `session.title_changed` - are present and identically shaped
across **1.0.80 through 1.0.81-5**. This is the evidence ADR 0002 has needed since c-0016.

### Measurements against real event logs

Two sessions, **36,517 events**, neither of them among the sessions c-0010 measured.

| Measurement | Result |
| --- | --- |
| `ephemeral` events | **0 of 36,517.** All 85 `subagent.started` durably persisted. |
| `agentId` vs `data.toolCallId` on `subagent.started` | **Identical on all 85.** |
| Distinct `agentId` vs `subagent.started` count | **Exactly equal** (15/15 and 70/70) - 1:1, no reuse, no orphans. |
| Tree construction (parent = emitter of the tool call whose id is the subagent's `agentId`) | **85 subagents, 100% resolved, 0 unresolved.** |
| Depth | 1 and 2. In the larger session, 43 of 70 nested. **Reproduces c-0010's max depth of 2 with fan-out dominating.** |

**This is a revalidation, not a discovery.** c-0010 had already specified the join and excluded
`parentId`, and `requirements.md` recorded both. What c-0020 adds is that the rule now holds on
data it was not derived from, and that the vendor's published types independently say the same
thing - moving it from a measured inference to a corroborated one.

### The question whose framing failed

Q1 was justified partly by the `ephemeral` completeness gap. The measurement above **deflated that
justification** - 0 in 36,517 - so the loop re-put the question rather than building on a premise
it had just weakened. The re-put failed on language: *"Again, treat me like the product manager. I
have not a clue what you are talking about."* This is the **second** such correction in the session,
after *"this seems like internal banter that you need to resolve."* Recorded as a loop defect.

Re-framed in product terms - should helpers appear the moment they start, or fill in when you next
look? - it answered immediately: **live**. **The decision is unchanged; its justification is not.**
Live-first now rests on immediacy, which the user chose, rather than on completeness, which
measurement had just undermined. Recorded because the harness must assert the former, not the latter.

### Limitations

- The one remaining item on n-0008 is untouched: the SDK permission callback has still never been
  observed firing. It is quota-gated and unchanged since c-0014.
- The two sessions measured are Copilot CLI sessions on this machine. Nothing here establishes
  behaviour under a differently configured runtime.
- `ephemeral` being 0 across 36,517 events bounds its observed frequency; it does not prove the
  field is never set.

## c-0021 - The terminal pivot lands, and the P0 set is rewritten by its owner

### Prototype n-0011-c-0021 - wrapping stock cmux

Approved with the exact string in a live turn. Isolation path
`.discovery-prototypes/maestro-graphical-agent-orchestrator/n-0011-c-0021/`, removed and verified
gone in the same cycle. **cmux pinned at 0.64.22 (102) [ddd4a01bc]**, installed by the operator via
Homebrew cask; the cask declares `auto_updates`, so the pin is the measurement's only anchor.

**Hypothesis.** Stock cmux, driven only by project-local configuration plus an external read-only
helper, can present a Fleet - enforced worktree and branch, a live Copilot session, and a live
subagent tree rendered inside cmux - with no cmux source changes and no writes to shared
configuration.

**Result: confirmed**, with one part unexercised.

### The decisive measurement - pane-hosted helpers get full control

cmux refuses external socket control by default: `automation.socketControlMode` is `cmuxOnly` with
an empty `socketPassword`. The boundary is **not** all-or-nothing, and the split matters:

- `cmux <path>` - open a directory as a workspace - **succeeds** from an outside process.
- `cmux workspace list` - any query or control - fails with
  `Access denied - only processes started inside cmux can connect`.

A helper started **inside a cmux pane** receives full access with no configuration change.
Confirmed visually: two values written by an external Python process - the metadata pill
`0 agents / 0 running` and the status line `Fleet alpha - Maestro attached` - render in cmux's own
sidebar beside the `fleet/alpha` branch cmux displays natively.

**This settles the wrap architecture.** Maestro runs as a pane-hosted helper: no fork, no Swift, no
`socketPassword`, no loosening of cmux's automation posture, no writes to shared configuration. The
security boundary rules out only the *outside-in* variant of the design.

### cmux's control plane is far larger than its published documentation

`cmux rpc`, `cmux events`, `read-screen`, `send`, `send-key`, `workspace list`,
`new-workspace --cwd --command --layout`, `set-status`, `set-progress`, `log`, `notify`, `sidebar`,
`top`, `tree`. Three consequences bear directly on the rubric:

- `top --processes --sort cpu|mem` **already implements F0.24**, the in-panel resource meter.
- `right-sidebar files` **already provides F0.20**, the file tree.
- `read-screen` + `send` + `workspace list` mean the Acceptance Harness can drive cmux directly -
  a materially better Presentation Check story than WezTerm's research-derived 40-50%, and one
  measured rather than researched.

Also measured: **Nord ships built in**, in six variants, settable with `cmux themes set Nord`.

### What the prototype built and proved

- **F0.1 enforced worktree-per-Fleet works over stock cmux.** Two Fleets created, each with its own
  worktree and branch; duplicate creation refused; `git worktree list` confirmed three checkouts on
  three distinct branches.
- **F0.5/F0.7 the subagent tree reproduces on this machine.** The measured c-0010/c-0020 join -
  `subagent.started.data.toolCallId` to the `agentId` on the spawning `tool.*` event - resolved
  100% of subagents, and rendered a real three-level tree with correct parentage.
- **12 of 13 harness assertions passed**, with one deliberate failure included to prove the suite
  is not vacuous.

### New findings that qualify earlier cycles

- **Subagent nesting reaches depth 3.** c-0010 and c-0020 both recorded a maximum observed depth of
  2. A scan of all local sessions found seven with genuine nesting and one at depth 3 (`b7d9967c`,
  six subagents, zero unresolved). The requirement survives; the figure does not.
- **`inuse.<pid>.lock` in a session directory is a liveness signal.** Not recorded anywhere in this
  session's prior state. The verdict derived from it agreed with `ps` (`Alive pid=53275`).

### The harness lied twice, silently - the c-0016 lesson reproduced

Evidence selection broke the negative control twice without failing:

1. selecting by **file size** picked a 195 MB session whose 12 MB read window held one subagent;
2. selecting by **subagent count** picked a 58-subagent session that was entirely **flat**, where
   the forbidden `parentId` construction *coincidentally agrees* with the correct join.

In both runs the control executed and reported PASS while testing nothing. `parentId` only diverges
where there is real nesting - which is precisely why it looked plausible for as long as it did.
Only after selecting for **depth** did the control fire: 2 of 6 parents wrong. A negative control
must be shown to fail on the case it exists to catch, not merely to run.

### Limitations of this cycle

- **No live Copilot session ran inside a Fleet worktree.** The tree was proven against real sessions
  elsewhere on disk, not against one owned by a Fleet. Slice steps 2 and 5 were not exercised.
- **Teardown was not measured on cmux at all.** The narrowed best-effort bar and the residual
  ~5 processes per live Session are carried from c-0012, not re-measured here.
- **Custom sidebars were not tested.** They live in `~/.config/cmux/sidebars/`, outside the approved
  isolation path, so the richest rendering surface remains an untested option rather than a
  rejected one.
- **`evidence.md` was read in bounded fashion this cycle** - structure and final section only - and
  modified by an anchored append. No section was re-rendered, so no unread bytes were at risk.
- cmux auto-updates; every measurement above is bound to 0.64.22 (102).

## c-0022 - The non-P0 set, vetted against the wrap route

User-directed subject: *"Take the previous p1 list that you had + the p0's I had deferred and run the
analysis that way."* Every requirement outside the c-0021 P0 set, judged against the now-settled
cmux wrap route. Verdicts: **free** (the host ships it), **partial**, **build** (ours), **moot**
(retired by hosting), **method** (verification, not product).

### Already delivered by the host - no work

| Id | Requirement | Mechanism |
| --- | --- | --- |
| F0.10 | Attention | `agentPermissionPrompt` on by default, Feed panel, pane ring, `jump-to-unread`, plus idle-suppression Maestro never designed |
| F0.11 | Consume runtime Attention rather than rebuild it | cmux Copilot hooks - `PreToolUse`, `agentStop` |
| F0.19 | Three-column layout | left sidebar / pane grid / right sidebar |
| F0.25 | Session addressable from the command line without Maestro | it is a terminal |
| F0.26 | Targeted per-Fleet cancellation | close the pane |
| F1.2 | Desktop notification on Attention | native banners and dock badge |
| N0.4 | Each Fleet in its own process group | PTY foreground groups; `copilot` self-assigns (c-0012) |
| N0.15 | Generic runtime evidence only | `events.jsonl`; nothing skill-specific |
| N1.1 | Keyboard-first, no new keymap | Ghostty keybinds, `Cmd+D` splits |

### Partly delivered

| Id | Requirement | Residual gap |
| --- | --- | --- |
| F0.3 | Primary window bound 1:1 | the pane is free; the binding and lock are ours |
| F0.17 | Liveness from process evidence | cmux's `running/idle/needsInput/unknown` is ephemeral; the durable verdict is ours |
| F0.21 | Main-window content rules | chat and file view free; the subagent log is ours |
| F0.23 | Admission control | `maxLiveTerminals` (default **12**) plus hibernation already degrade gracefully - adjacent to the 8-Fleet ceiling and never previously connected to it |
| N0.2 | Descendant-tree ownership | `agentHibernation` already signals an agent's process group - but to reclaim memory, not on quit |
| N0.10 | Isolation on both axes | no cross-Fleet messaging is **free**, since workspaces are independent by design; worktree isolation is ours |

### Must build

`F0.2` branch-per-Fleet, `F0.6` the `parentId` exclusion, and `F0.8` live-versus-reconstructed were
all demonstrated by the c-0021 prototype. `N0.7` state outside any worktree and `N0.8` Park
preserving uncommitted work are small. `N0.9` the 1:1 lock, `N0.13` the still-unmeasured 8-Fleet
ceiling, `N1.3` bounded per-worktree build state, and `F1.1` Fleet Recap remain.

**The substantial item is durable lifecycle state** - `F0.15` and `F0.16`, moved to `P0-implied`
this cycle. cmux deliberately holds **no durable intent at all**; its four agent states are
ephemeral and recomputed from hooks. This is the one thing the host philosophically refuses to
provide, and it is therefore the reason Maestro remains software rather than a cmux configuration
file.

### Moot rather than deferred

`N0.18` main-process authority boundary and `N0.19` the unsigned fuse-enabled build were v2 Electron
artifacts. `N0.3` verify-and-escalate teardown was dropped by the user in c-0021.

### Three findings the table does not carry

**1. The Copilot SDK is not used on this route, and the contradiction was live in confirmed state.**
The prototype ran `copilot` in a pane and read `events.jsonl`: no `CopilotClient`, no `sendAndWait`,
no `permissions.pendingRequests()`. Four cycles of SDK work (c-0014, c-0016, c-0020) appeared to be
stranded. The user resolved it by **route class** rather than by choosing a winner - terminal-hosted
routes use the CLI because the terminal *is* the chat interface; application routes use the SDK
because they must build one. The seam had been recorded as a property of the product when it is a
property of the route class, and that misfiling is what made the work look wasted.

**2. Permission accountability inverted rather than disappeared.** `N0.11` and `N0.12` exist because
macOS binds the responsible process at launch. Hosted in cmux, a Fleet's descendants raise prompts
attributed to **cmux**, not Maestro. By the test that rewrote `N0.5` in c-0021 this is an
improvement - the host is a visible foreground application the operator can identify and quit - but
"Maestro is accountable" is now false on a hosted route.

**3. The analysis contained a defect that the same cycle's principle removed.** cmux's global,
chronological notification Feed was scored a **partial miss** against "selecting a Fleet re-scopes
every panel". When the user confirmed *"we basically want to 'lean in' on each platform and embrace
it's strengths"*, that score became wrong: a unified triage inbox is a legitimate expression of
Attention across 8 Fleets. The rubric measures what the design *becomes* on a stack, not how
faithfully a stack reproduces a design authored for a different one.

### Limitations of this cycle

- **The analysis is desk work.** It reuses c-0021's measured CLI surface and the reference documents;
  nothing was re-measured against a running cmux, and no prototype was proposed or approved.
- Every "free" verdict inherits c-0021's version pin at cmux 0.64.22 (102), on an auto-updating
  application.
- The `maxLiveTerminals = 12` figure comes from published documentation, not from measurement, and
  its relationship to the 8-Fleet ceiling is an observation rather than a tested interaction.
- `evidence.md` was again read in bounded fashion and extended by an anchored append; no section was
  re-rendered.

## c-0024 - Five slice steps measured on cmux, and an observer that vetoed

### Prototype n-0011b-c-0024

Approved with the exact string. Isolation path removed and verified gone. Versions re-pinned before
measuring: **cmux 0.64.22 (102) [ddd4a01bc]** - unchanged from c-0021 despite `auto_updates` - and
**Copilot CLI 1.0.81-5**, the top of the band c-0020 measured.

### Slice steps 2, 3, 4 - met

A **real Copilot Session ran inside Fleet alpha's own worktree**, which c-0021 never did, and
delegated three subagents. The external helper read them from that session's own event log:

```
Fleet alpha  session 18564e66
  |- v notes-summarizer (explore)
  |- v readme-summarizer (explore)
  `- v Inspect Git branch status (execution-subagent)
```

3 of 3 resolved through the measured `toolCallId` join, zero unresolved. Fleet **beta reported no
session at all** in the same instant - the isolation control fired. Unplanned: cmux **auto-named the
workspace "Summarize README and Notes"** from the prompt, giving a human-meaningful Fleet name nobody
typed, which is adjacent to n-0010 and was not known to be free.

### Slice step 5 - met, first time in the project

The first attempt measured **0 permission events**, and the cause was neither runtime nor route:
`~/.copilot/permissions-config.json` holds an **approve-for-location** rule on `/Users/dylan/git`
granting `write: *`, `mcp: *`, and a command list. The Fleet worktree sits beneath it, so the command
was pre-approved and correctly never requested. This is the **third distinct reason** step 5 has
failed to fire - after ACP (c-0013) and the SDK hook (c-0020) - and the first that is the system
working as designed.

*Consequence for the harness:* a step-5 assertion must use a command outside the approved set, or a
location no standing rule covers, **and must assert that precondition**. Otherwise it measures the
operator's local trust configuration and returns a confident false negative.

The retry used an unapproved `rm` inside the disposable worktree:

```
  `- > Delete notes file (execution-subagent)
  ** ATTENTION ** 1 pending permission
  permissions: 1 requested / 0 completed / 1 pending
```

Raw: `permission.requested`, `requestId d5092cfc-1d68-4b22-8f65-bcb25b82f94d`,
`2026-08-21T22:13:03.447Z`, **0 matching completions**. On approval the same requestId completed with
`kind: approved` and **Attention cleared** - so the predicate holds in both directions, not as a
latch. **This discharges the accepted unknown carried since c-0014.**

Also measured: the tree is genuinely live (three `completed` beside one `running` in one render), and
`data.permissionRequest` carries `kind`, `fullCommandText`, `intention`, `commands`,
`commandSegments`, `possiblePaths`, `possibleUrls`, `hasWriteFileRedirection`,
`canOfferSessionApproval` - enough to present *what* a Fleet is blocked on, not merely *that* it is.

### Teardown - half measured

A live Fleet occupied **one process group of 8**: an `agency` wrapper, `copilot`, three Model Context
Protocol servers, and two `node` children, every one resolving by `lsof` to the Fleet's worktree and
distinct from the observing session's group. This reproduces c-0012's Electron shape exactly.

**Graceful path: 0 survivors of 8**, MCP servers included. The case `N0.1` exists for - host quit with
the agent still live - was **not run**. Recorded as an accepted unknown rather than a pass.

### The observer that vetoed

Installing the ecosystem's one dedicated Copilot plugin, `Attamusc/copilot-cmux`, **broke an
unrelated live Copilot session**: every tool call refused with `Denied by preToolUse hook from
"copilot-cmux" (hook errored)`, `pwd` included.

Root cause, reproduced directly: Copilot treats a **non-zero exit from `preToolUse` as a denial**, and
the plugin's runner set `exitCode = 1` on any internal error. Its parser requires `toolName` and
`toolArgs` as strings; 1.0.81-5 sends a different shape.

```console
$ echo '{"toolName":"bash","sessionId":"x","cwd":"/tmp"}' | node dist/hook-runner.js preToolUse
upstream  -> exit 1   # DENIED
fork      -> exit 0   # ALLOWED
```

**The plugin's own 68 tests passed before and after.** They only exercised the payload shape it
assumed. Forked to `maestro-cmux/` (MIT, attribution retained), fixed to fail open, and 12 fail-open
tests added with a negative control - 80/80 passing.

### Two ecosystem surveys

Across 190+ projects, independently confirmed: **nothing enforces one worktree per workspace**,
**nothing distinguishes a deliberate stop from a crash**, and **nothing renders a genuine parent-child
agent hierarchy** - all are flat boards, lane groups, or widgets. The Copilot hook surface has **no
subagent event at all**, so the ecosystem fakes trees by convention; Maestro's event-log join is a
path none of them found. Licensing: `cmux-agent-mcp` is PolyForm Strict (no commercial use);
`cmuxlayer` is Apache 2.0.

### Limitations of this cycle

- The force-quit teardown case was not run; the operator ended the probe.
- Custom sidebars remain untested, and are the intended tree surface.
- Both surveys are delegated research, which this loop classes as untrusted evidence; only the cmux
  and Copilot measurements above are first-hand.
- All measurements are bound to cmux 0.64.22 (102) and Copilot CLI 1.0.81-5.

## c-0026 - The custom sidebar interpreter fails silently, by design

**This section is the operating manual for the sidebar surface. Read it before
writing or debugging a line of `maestro.swift`.** Four separate debugging rounds
were spent rediscovering what cmux already documents.

### The governing rule

cmux's own authoring contract states it plainly:

> "unsupported syntax is skipped ... and even deeply nested or pathological
> source is rendered best-effort, never crashes"

The interpreter is a **documented growing subset** of SwiftUI. It does not
report what it dropped. Consequences, all confirmed by measurement:

- **`cmux sidebar validate` passing means nothing about rendering.** It reported
  `OK maestro [swift] ... 1 valid, 0 invalid` on a sidebar that rendered a blank
  pane, on one that rendered a single row where 23 were published, and on one
  where a whole tree section was missing. This is correct, specified behaviour.
- **A silent failure is scoped to the smallest enclosing view**, so an
  unsupported construct deletes its subtree while everything around it renders
  normally. That reads as a data bug and is not one.
- **Debugging is therefore bisection, not inspection.** Remove or branch one
  construct at a time. Reason about the published data separately, from the
  stored description, never from what the pane shows.

### The five constructs measured to fail silently

| # | Construct | Observed | Use instead |
| --- | --- | --- | --- |
| 1 | `filter { $0.description != nil }` | Empty sidebar. Optional fields are **absent**, not null. | `if let d = w.description { }` inside the loop |
| 2 | Arithmetic as a bare modifier **argument**, e.g. `.padding(.leading, depth * 9)` | Nothing renders. Arithmetic inside a function body or a `"\(...)"` interpolation is fine. | A ternary, or precompute in a `func` |
| 3 | `split(separator: "\n")` | Returns the whole string as **one** element - the `\n` escape is not interpreted. `whereSeparator: { $0.isNewline }` renders nothing at all. **A 23-line tree became one truncated row while cmux stored all 432 bytes intact.** | A single-line wire format split on a literal delimiter |
| 4 | `.frame(width: 0)` to hide a view | **Does not hide.** Six running subagents drew a red `xmark` that was supposed to be zero-width. | `if/else` branching between the two views |
| 5 | A nested function call used as an argument, e.g. `cued(anyRunning(d), clock.epoch, 0)` | Only part of the icon rendered; the rest was silently dropped. | Keep arguments flat: bindings and literals only. Precompute inside the called `func` when needed. |

Rule 3 is the expensive one: it is indistinguishable from a publishing bug. The
only way it was caught was reading the stored description out of
`~/Library/Application Support/cmux/session-com.cmuxterm.app.json` and finding
41 rows present while the pane showed 1.

### Corollary for the next cycle

Before treating any third-party host's behaviour as unknown, **check whether the
host publishes its own contract.** cmux exposes both through its CLI:

```
cmux docs sidebars   # -> docs/custom-sidebars.md   (bindings, views, modifiers, limits)
cmux docs api        # -> docs/cli-contract.md      (every verb, every namespace)
```

Neither had been read in the 27 hours the plugin existed. Reading them settled
three of five open capability questions outright and explained every silent
failure above. The check costs one `curl`.

### Measured available surface

The interpreter is richer than the first probe established. The following
render: `Rectangle`, `RoundedRectangle`, `Capsule`, `Circle`, `Ellipse`, `.fill`,
`.stroke("#hex", lineWidth:)`, `.trim(from:to:)` for arcs, `ZStack`, `.offset`,
`.rotationEffect`, `.mask`, `.overlay`, `ScrollView`, and `HSplitView`.
`HSplitView` provides a resizable divider whose position persists.

The workspace binding also exposes `w.progress` (an object with `value` and
`label`), `w.latestMessage`, `w.latestPrompt`, and `w.latestAt`. However,
`w.latestAt` was empty on every measured Copilot surface and must not be used as
a Copilot activity signal. Nil-coalescing (`??`) is outside the documented
supported subset and should be avoided.

### Documented as unsupported - do not attempt

`@State` and every two-way control (`TextField`, `Toggle`, `Slider`, `Picker`);
`switch`; custom `struct`/`View`; gradients; navigation (`sheet`, `popover`,
`NavigationStack`); `.keyboardShortcut`; `AsyncImage`/`.resizable`. There is
**no `VSplitView`** and **no `GeometryReader`**, and `.frame` exposes `width`,
`height`, and `maxWidth` but no `maxHeight`. Use `HSplitView` when a horizontal,
user-resizable split is appropriate; otherwise bound lists by row count.

## c-0029 prototype - cmux's Copilot hooks install, but only after Copilot moves them

Run 2026-08-22, on this machine, against `cmux` at `/opt/homebrew/bin/cmux` and
Copilot CLI 1.0.81-3. Every claim below was measured, not read.

### The installer refuses a stock Copilot CLI

```
$ cmux hooks copilot install --yes
Error: /Users/dylan/.copilot/config.json exists but is not valid JSON.
       Fix or remove it before installing hooks.
```

Copilot writes `config.json` as **JSONC** - it opens with two `//` lines that
Copilot itself authors ("This file is managed automatically"). cmux parses it as
**strict JSON**. So `cmux hooks copilot install` fails on a default, untouched
Copilot installation. Stripping exactly those two comment lines leaves valid
JSON and the install succeeds:

```
Copilot hooks installed at /Users/dylan/.copilot/config.json
```

cmux rewrote the whole file through `NSJSONSerialization`: keys sorted, slashes
escaped, no trailing newline. Every pre-existing value survived (15 top-level
keys, 4 plugins, login intact).

### Copilot relocates the hooks on its next launch

A fresh headless session (`copilot -p ... --allow-all-tools`) **succeeded** -
exit 0, correct answer. But afterwards:

- `config.json` was rewritten by Copilot, its `//` header restored, byte size
  back to the pre-install 6605, and the `hooks` key **gone**.
- `settings.json` now carries all five cmux hook entries verbatim.

Copilot did not discard the integration; it **migrated it to the correct file**.
`hooks` is a `settings.json` key on this version, not a `config.json` key. cmux
writes to the file Copilot no longer owns hooks in, and Copilot silently repairs
the mistake on first run. The integration therefore works, but only after one
Copilot launch, and `cmux hooks copilot uninstall` will very likely fail to find
what it installed.

### Both hook sources coexist

They never collide, because they live in different files under different
casing conventions:

| Source | File | Event keys |
| --- | --- | --- |
| Maestro plugin | `installed-plugins/_direct/maestro-cmux/hooks.json` | `sessionStart`, `preToolUse`, `postToolUse`, `userPromptSubmitted`, `sessionEnd`, `errorOccurred` |
| cmux | `~/.copilot/settings.json` | `SessionStart`, `PreToolUse`, `Stop`, `Notification`, `SessionEnd` |

The plugin file was untouched by the install and by Copilot's rewrite.

### cmux's hooks are fail-open, like Maestro's

Each command is guarded by `[ -n "$CMUX_SURFACE_ID" ]` and by
`$CMUX_COPILOT_HOOKS_DISABLED != 1`, resolves the CLI through
`CMUX_BUNDLED_CLI_PATH` then `command -v`, and falls through to
`cat >/dev/null; echo '{}'`. Executed outside cmux, all five returned
**exit 0 and `{}`**. `CMUX_COPILOT_HOOKS_DISABLED=1` is a documented kill switch
Maestro should mirror.

### The migrated hooks fire inside cmux

A Copilot session started inside cmux created
`~/.cmuxterm/copilot-hook-sessions.json`. Its record contains the expected
session id, workspace id, surface id, cwd, pid, process start time, launch
command, and timestamps. The measured lifecycle was `idle`, represented
consistently in both `agentLifecycle` and `runtimeStatus`; the last notification
also reported `idle` with the body "Copilot session completed". The other
documented lifecycle values have not yet been observed.

The store contained duplicate session records for one Copilot process. One used
the active Copilot session id; two used different ids while pointing at the same
process and transcript. That duplication needs explanation before Maestro treats
the file as a one-row-per-session source of truth.

### Status and progress render; log is stored but not shown on the workspace card

All three commands returned `OK` from inside cmux. `cmux list-status`,
`cmux list-log`, and `cmux sidebar-state` immediately exposed the published
values. Direct inspection of the cmux workspace card confirmed:

- `set-status` rendered the blue `hello` status.
- `set-progress 0.5 --label=half` rendered the `half` progress row.
- `log` appended `[info] hello` to the per-tab log and was returned by
  `list-log`, but no log row appeared on the workspace card.

The temporary status and progress were then removed with `clear-status` and
`clear-progress`. The result narrows the sidebar redesign: status and progress
are proven visual channels, while log is a retained/queryable channel rather
than workspace-card content.

A Copilot session outside cmux still cannot drive the CLI at all:

```
$ cmux list-status
Error: ERROR: Access denied - only processes started inside cmux can connect
```

### The spinner fix renders correctly

After `cmux sidebar reload maestro`, `cmux sidebar open maestro` opened the
custom sidebar as a real Bonsplit pane. The accessibility tree exposed the
splitter, workspace and terminal hierarchy, and both test rows.

A controlled description fixture rendered `running-probe` with the animated
braille spinner and `failed-probe` with the red SF Symbol `xmark`. This directly
confirms the c-0026 fix: branching between the spinner and failure image works,
and a running row no longer draws the red `x` that `.frame(width: 0)` failed to
hide.

The pane itself is resizable through cmux's persisted split system. That proves
the c-0026 candidate mechanism, but does not reverse the user's earlier decision
to keep the task panel bounded inside the sidebar rather than make every task
list a separate pane.

### Native lifecycle stayed idle during active work

The hook store grew as this cycle ran. A corrected 30-second watcher sampled
`sessions` 519 times at about 58 ms intervals while one tool call remained open
for ten seconds:

| Measurement | Result |
| --- | --- |
| Store records | 31 throughout the sample |
| `runtimeStatus` | `idle` in all 16,089 record observations |
| `agentLifecycle` | `idle` in all 16,089 record observations |
| Non-idle transitions | 0 |

This is a negative result with an active control: the tool call was deliberately
held open. cmux's native Copilot hooks did not expose `running` during that work,
so Maestro cannot delegate its live-working signal to the native lifecycle on
this version. The result does not establish that `needsInput` or `unknown`
cannot occur; neither was exercised.

The duplication also worsened from the three records first observed. Earlier in
the cycle the file held 23 records across three process identities, including
13 records sharing one active process and transcript. It later reached 31.
One-row-per-Session is disproven, and the file is not a safe identity source
until cmux defines or canonicalizes these duplicates.

### Native restore generated an invalid Copilot command

After restarting cmux, its workspace card offered a Copilot restore action. The
action launched:

```console
cmux restore copilot <checkpoint-id>
```

cmux accepted that invocation, but the generated Copilot command failed:

```text
error: option '-C <directory>' argument missing
```

This is not missing operator input. `cmux restore --help` documents only
`<kind> <checkpoint-id>` as required. Public cmux source builds restore from a
captured launch command and removes saved working-directory options only when
the option's following value equals the recorded directory. The failure
therefore lies in captured or reconstructed argument shape; the exact malformed
token was not isolated in this cycle.

The practical consequence is narrower than "restore is unavailable": the
session store and restore affordance exist, but Copilot restore is not working
for the measured record and must not be treated as inherited durable behavior
until re-measured.

### Rollback

`~/.copilot/_maestro-backups/config.json.pre-cmux-hooks.<timestamp>` holds the
pre-install file. Copilot's own rewrite already restored `config.json` to
semantically identical content, so rollback is now only
`cmux hooks copilot uninstall` plus removing the `hooks` key from
`settings.json` by hand if that command misses it.

## c-0030 - A hook cannot report a blocked Session, and two unavailability claims were wrong

Every measurement below was taken in the parent loop against live Sessions and
the running cmux, not delegated and not read from documentation.

### The structural finding: a hook-driven observer cannot report a blocked Session

Ordering measured directly around a real permission request:

```text
2325  14:16:25.417  tool.execution_start     bash
2326  14:16:25.421  hook.start               preToolUse
2327  14:16:25.552  hook.end                 preToolUse
2328  14:16:27.340  permission.requested     4c8e1776-...
2329  14:16:27.371  permission.completed     4c8e1776-...
```

`preToolUse` fires **before the permission request exists**, and while the
operator is being waited on **no hook fires at all**. The mechanism that would
report "I am blocked" is idle exactly when the state is true. This generalises
the #36 staleness defect from an accident into a structural property.

The waits are real, not theoretical. Across 135 requests in one session:
min 0.013 s, median 0.025 s, max **13432 s (3.7 hours)**, with 5 waits over 5 s.

### Two hooks Maestro never registered

| hookType | Count | Payload |
| --- | --- | --- |
| `notification` | 146 | `notificationType`, `title`, `message`, `sessionId`, `cwd`, `timestamp` |
| `agentStop` | 51 | `stopReason`, `sessionId`, `transcriptPath`, `cwd`, `timestamp` |

`notificationType` values: `permission_prompt` 135, `agent_idle` 7,
`elicitation_dialog` 2, `shell_completed` 1, `shell_detached_completed` 1. Only
the first two **block** the Session. `stopReason` was `end_turn` on all 51.

`notification.message` for a permission prompt is the **full command text** -
observed carrying a local tool invocation, redacted here - and must never be
published. Only `title` is safe.

This entry was itself caught by `scripts/check-public.sh` on the first commit
attempt, because the illustrative value quoted verbatim was employer-specific.
The hazard was documented and reproduced in the same sentence that warns about
it, which is the strongest available argument for the rule.

### Attention is attributable per subagent

`permission.requested` carries **no** `agentId` - 0 of 129 - but carries
`data.permissionRequest.toolCallId`, which joins to
`tool.execution_start.data.toolCallId`, which carries a **top-level** `agentId`.
The join resolved requests to named subagents (`sidebar-auditor`,
`Initialize discovery chronicle`). c-0012 and c-0024 established the predicate at
Session level only; it is per-subagent.

A first attempt at this measurement produced a plausible table showing
`129 SUBAGENT` - built entirely from guessed field names (`data.name`,
`data.agentId`) that were all `None`. It was discarded and re-run against dumped
payload shapes. **A confident aggregate over fields that do not exist looks
exactly like a real result.**

### `subagent.failed` does not exist

c-0016 recorded, from SDK typings: *"Subagent vocabulary is richer than c-0010
recorded: `subagent.started`, `subagent.completed`, **`subagent.failed`**,
`subagent.selected`, `subagent.deselected`. A failed subagent is a distinct
terminal state the tree must show."* c-0020 repeated it from the same source.

Measured across the 60 most recent local sessions:

| Event | Count |
| --- | --- |
| `subagent.started` | 133 |
| `subagent.completed` | 132 |
| `subagent.failed` | **0** |

`subagent.completed` carries no success flag - only `toolCallId`, `agentName`,
`agentDisplayName`, `model`, `totalToolCalls`, `totalTokens`, `durationMs`. A
failed subagent is **indistinguishable from a successful one**, and the red
`xmark` requirement had only ever rendered from hand-written fixtures.

**The type is declared; the event is not emitted.** Both cycles read a
declaration and recorded a behaviour. This is the same evidence class that
produced the c-0006 spawn requirement falsified by c-0009, and the c-0014 seam
decision taken on typings - the third instance, and the one that survived
longest, nine cycles.

### The attention hooks were never registered, so no badge has ever been real

`hooks.json` is **generated** by `install.sh` from a hardcoded list, not shipped.
Editing it by hand is discarded at the next install. The installed plugin carried
only `errorOccurred, postToolUse, preToolUse, sessionEnd, sessionStart,
userPromptSubmitted`. Every ASK badge observed during development came from a
hand-injected description fixture. Corrected: `install.sh` is the single source
of truth, its fail-open loop covers all eight hooks, and both new hooks are
verified silent-and-zero across 12 payload shapes.

### The sidebar's animation ceiling, measured

`clock.epoch` returns **seconds** - `1787427474`, ten digits - and the sidebar
re-renders about once a second, so anything hand-drawn from `clock` is capped at
**1 fps**. `clock.second` wraps at 60 and visibly jerks once a minute; use the
monotonic `clock.epoch`. Refresh drift makes one-tick-per-phase sequences
stutter, so hold every phase for at least two ticks. Sequenced animation is
fragile; symmetric animation is robust. There is no `withAnimation`,
`.animation`, `.transition`, or `symbolEffect`, and no CSS.

A throwaway probe sidebar established what renders: `ProgressView()`,
`ProgressView(value:)`, `Gauge`, `Circle().trim().stroke()`, `.shadow`, `.blur`,
`.opacity`, `.scaleEffect`. **`ProgressView()` resolves to a native
`AXBusyIndicator`** - an AppKit `NSProgressIndicator` - which animates itself at
native framerate, independent of the tick. It renders 32x32 raw and needs
`.scaleEffect` plus an explicit `.frame`; `.controlSize(.small)` also works
despite being absent from the documented modifier list. `.tint()` does **not**
apply to it.

**Hover is impossible, and it is documented upstream**, not merely unmeasured:
the sidebar authoring guide states input is *"limited to forwarded clicks (no
hover, focus, or keyboard)"*.

### Surface ownership is publishable, not inferable

`CMUX_SURFACE_ID` in the plugin's environment is byte-identical to the surface
UUID cmux reports, and to the sidebar's `t.id`:

```console
$ cmux list-pane-surfaces --id-format uuids --workspace workspace:1
* 06DF8701-7CFD-428E-99D2-85F43C0EEDD2  MAESTRO  [selected]
$ echo $CMUX_SURFACE_ID
06DF8701-7CFD-428E-99D2-85F43C0EEDD2
```

So Maestro **publishes** the owning surface rather than inferring it. The
alternative considered and rejected was the `" - GitHub Copilot"` title suffix
Copilot sets: every Copilot Session is `type: "terminal"` to cmux, because
Copilot is launched as a shell command rather than via
`new-surface --type agent-session`, so cmux genuinely has no type to expose.

`workspace.action` exists as a generic RPC dispatcher accepting `set-description`,
and `cmux workspace list --json` returns the stored description - together these
let the sidebar mutate state on tap and let the plugin read back what the
operator dismissed.

### Context percentage: an unavailability claim that was wrong twice

The first scan covered only `assistant.turn_end`, `assistant.message`, and
`subagent.completed`, and concluded no context data exists. Scanning **every**
event type found otherwise:

| Event | Fields | Measured |
| --- | --- | --- |
| `session.compaction_start` | `currentTokens`, `conversationTokens`, `systemTokens`, `toolDefinitionsTokens` | `currentTokens = 644933` |
| `session.compaction_complete` | **`tokenLimit`**, `preCompactionTokens`, `postCompactionTokens`, `tokensRemoved` | **`tokenLimit = 936000`** |
| `session.start`, `session.model_change` | `contextTier` | `long_context` |

Both fire only at compaction, and `assistant.turn_end` carries only `{turnId}`,
so there is still no live numerator in the log.

**But Copilot publishes the figure itself, and cmux can read it:**

```console
$ cmux read-screen --surface 06DF8701-...
 Claude Opus 5 · Medium · 1M context (40%)
```

Measured across live Sessions in three workspaces: `1M context (21%)`,
`1.1M context (14%)`, `1M context (40%)`. This is the runtime's own number, not
an estimate. It also yields the Session's model and effort, closing the gap left
by `assistant.turn_start.data.model` being null in all 260 measured turns.
`read-screen` was measured available in c-0021 and never connected to this
question.

Limitations: it is screen-scraping; the tier string varies; it requires the
status line in the **visible viewport** (one of three Sessions returned no match
for that reason, so absence must be treated as unknown, never as zero); it costs
one subprocess per Session per publish; and it works only from inside cmux.

### Other runtime facts

- `skill.invoked` exists with `name, path, content, allowedTools, source,
  pluginName, pluginVersion, description, trigger, model`. There is **no
  `skill.completed`**, so "currently running skill" is unknowable; only "last
  invoked" is. `content` is the full skill markdown and must never be published.
- `subagent.started.data.model` gives a per-subagent model
  (`gpt-5.6-luna` x34, `gpt-5.5` x1).
- A legacy `~/.copilot/hooks/maestro-herdr-fleet.json` from the retired herdr
  prototype is still registered globally and still executes on session start,
  session end, and every tool call. Disclosed, not removed - it is outside this
  loop's write scope.

### Repository scope change

`proto-v1/`, `proto-v2.0/`, `harness/`, and `v2/` were moved to `archive/` in
commit `59a785a`, with an `archive/README.md` marking them inert. Nothing in
`maestro-cmux/` references them; only `README.md` and `AGENTS.md` did, and both
were updated. This is the repository catching up with the c-0025 route
retirement, and it is what makes n-0001 and n-0009 concretely dead rather than
merely superseded.

### Limitations of this cycle

- The `notification` and `agentStop` hooks are **registered but have never been
  observed firing into Maestro**. Copilot binds plugins at session start, so
  every Session running during this cycle carried the old six-hook set. The
  end-to-end ASK path is unproven and needs a newly started Session.
- The derived-Attention design is decided, not implemented; the plugin still
  stores the flag.
- The per-subagent attention join is measured on completed requests only. No
  unmatched request was observed live this cycle (129 requested, 129 completed).
- Context-percentage scraping was measured on three Sessions on one machine, one
  cmux version, one Copilot version.
- The 60-session `subagent.failed` scan reads only the last 4 MB of each log, so
  it bounds the observed frequency at zero rather than proving the event can
  never be emitted.
