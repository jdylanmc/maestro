---
schema-version: 1
session: maestro-graphical-agent-orchestrator
state-root: docs/discovery
revision: 12
anchor: https://github.com/jdylanmc/maestro/issues/1
anchor-revision: 2026-08-19T20:00:11Z
anchor-status: revised
question-group-size: 12
last-question-group-size: 5
last-cycle: c-0011
cycle-state: complete
state-digest: 2e0e8c40780075d0f993506aec3bfe851a5e8e23da879067e8c710fa9075166e
root-map-digest: 249c98ad89126447e2af22b79b9fd2fbc2b6e4ba3718cfc0ce2c2321ad1f96ca
root-lexicon-digest: 996bd740e483473691d06862dd280b3ac5929e3c4dfbea7ac4ecf803307c5ed5
digest-tool: shasum -a 256
digest-status: verified
state-scope: full
tracker-mode: remote
tracker-tier-map: n-0000 -> Issue #1 (discovery:map); n-0001..n-0007 unpromoted
---

# Discovery Session - Maestro Graphical Agent Orchestrator

## Anchor

GitHub Issue #1: [Discovery - Maestro graphical agent orchestrator](https://github.com/jdylanmc/maestro/issues/1).

This session grounds the prototype work in the shared product destination rather
than in one platform. The open prototype branches are evidence-gathering paths:
v1.1 WezTerm (#27), v2 Electron (#4), v3 Tauri/Rust (#23), and v4 native macOS
(#24). Issue #18 is the current cross-platform MVP contract.

## Destination

Identify the smallest empirical prototype sequence that can prove or falsify
Maestro's shared MVP contract: a real graphical shell around named Fleets, each
holding one Copilot Session presented as a primary agent window, with an
observable subagent tree, file and git context, targeted controls, worktree
isolation, and restart reconciliation.

## Session Domain Lexicon

| Term | Status | Definition | Bounded context | Aliases | Source | First seen | Last verified | Related terms | Scope |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fleet | confirmed | The structural unit: one feature, one Worktree, one Copilot Session, its subagent tree, and its durable state. Replaces `Session`. | Maestro product | fleet (user's spoken form); Session (superseded structural sense) | c-0007; Copilot CLI `/fleet` | c-0007 | c-0007 | Session, Worktree, subagent tree | session:maestro-graphical-agent-orchestrator |
| Session | confirmed | **Borrowed from the Copilot runtime, not redefined here.** A named, resumable Copilot conversation, nameable with `-n, --name` and resolvable by name via `--resume`. Exactly one per Fleet. | Copilot runtime | none | Copilot CLI `--help`; c-0007 | c-0001 | c-0008 | Fleet, Task, subagent | session:maestro-graphical-agent-orchestrator |
| Primary Agent | confirmed (interface-only) | The interface term for a Fleet's chat surface. **Not a domain entity.** Retained because the user speaks this way; the word `Session` need not appear in the interface. | Maestro interface | none | c-0007 user input | c-0001 | c-0008 | Fleet, Session | session:maestro-graphical-agent-orchestrator |
| Agent | confirmed (reserved) | **Reserved for the Copilot meaning:** a selectable persona or configuration, chosen with `--agent` or `/agent`. No longer means a running actor. | Copilot runtime | none | Copilot CLI `--help`; c-0007 | c-0001 | c-0007 | Session, skill | session:maestro-graphical-agent-orchestrator |
| subagent | confirmed | A delegated unit of work under a Fleet's Session, emitting `subagent.started` and `subagent.completed`. Spelled as the runtime spells it. | Copilot runtime | Sub-agent (superseded spelling); Squad Mate (deprecated) | Copilot event stream; Issue #6; c-0007 | c-0001 | c-0007 | subagent tree, Task | session:maestro-graphical-agent-orchestrator |
| subagent tree | confirmed | The nested visible hierarchy of a Fleet's subagents. | Maestro orchestration | Sub-agent tree (superseded spelling); Squadron (deprecated); Swarm (deprecated) | Issue #6; c-0005; c-0007 | c-0001 | c-0008 | Fleet, subagent | session:maestro-graphical-agent-orchestrator |
| Task | confirmed | The runtime's handle for a unit of delegated or background work; `/tasks` manages "tasks (subagents and shell commands)" and `--resume` accepts a task ID. A tree node's underlying handle. | Copilot runtime | none | Copilot CLI `--help`; c-0007 | c-0007 | c-0007 | subagent, Session | session:maestro-graphical-agent-orchestrator |
| Worktree | confirmed | The git worktree a Fleet operates in. **Exactly one per Fleet, enforced**; Fleets never share a checkout (c-0010). Implies branch-per-Fleet, since two worktrees cannot share a branch. | Maestro product | none | c-0007 experiment; c-0010 measurement; firstmate-arch.md | c-0005 | c-0010 | Fleet | session:maestro-graphical-agent-orchestrator |
| Workspace | deprecated | Retired as a structural term in c-0007: triple-booked across Copilot (`workspace.yaml`, `~/.copilot/workspaces/`), Visual Studio Code, and this model. | Maestro product | none | c-0007 | c-0001 | c-0008 | Fleet, Worktree | session:maestro-graphical-agent-orchestrator |
| Parked | confirmed | A Fleet deliberately stopped by the user: durable state persisted, processes terminated, uncommitted work preserved. Not teardown. A **Fleet state**, on the intent axis. | Maestro Fleet | none | c-0005 | c-0005 | c-0007 | Interrupted, Fleet | session:maestro-graphical-agent-orchestrator |
| Interrupted | confirmed | A Fleet stopped unintentionally, leaving in-flight work dangling. The opposite of `Parked` and distinguishable from it in the store. A **Fleet state**. | Maestro Fleet | none | Issue #9; c-0005 | c-0005 | c-0007 | Parked, Fleet | session:maestro-graphical-agent-orchestrator |
| Liveness | confirmed | The observed process-evidence axis, independent of Fleet state: `Alive`, `Dead`, or `Ambiguous`. Never persisted as truth; recomputed each launch. | Maestro orchestration | none | firstmate-arch.md; c-0006; c-0007 | c-0007 | c-0008 | Fleet, Parked, Interrupted | session:maestro-graphical-agent-orchestrator |
| Acceptance Slice | candidate | The single scripted end-to-end flow every prototype route must execute to be judged complete. Identical across routes, so the comparison is like-for-like. | Maestro discovery process | none | c-0011 | c-0011 | c-0011 | Fleet, MVP contract | session:maestro-graphical-agent-orchestrator |
| Squad Mate | deprecated | Superseded by `subagent`. Retired in c-0005. | Maestro orchestration | none | c-0005 | c-0001 | c-0007 | subagent | session:maestro-graphical-agent-orchestrator |
| Squadron | deprecated | Superseded by `subagent tree`. Retired in c-0005. | Maestro orchestration | none | c-0005 | c-0001 | c-0007 | subagent tree | session:maestro-graphical-agent-orchestrator |

## Tree

### n-0000 - Maestro graphical agent orchestrator MVP

- Parent: none
- Fog: decision-ready
- Maturity: researched
- Priority: P0
- Outcome: Prove the shared Maestro MVP contract through one complete real flow on Electron, judged primarily on lifecycle ownership - durable Fleet state with strictly ephemeral processes and verified-zero orphans on quit - and on a three-column Visual Studio Code-shaped layout where selecting a Fleet re-scopes every panel and always presents that Fleet's primary agent window.
- Open questions: none held directly. **Decomposed in c-0011** into n-0001 through n-0007; every question this node was carrying now lives on the child that owns it.
- Evidence: [Issue #1](https://github.com/jdylanmc/maestro/issues/1); [Issue #18](https://github.com/jdylanmc/maestro/issues/18); [Issue #12](https://github.com/jdylanmc/maestro/issues/12); [Issue #6](https://github.com/jdylanmc/maestro/issues/6); [Issue #9](https://github.com/jdylanmc/maestro/issues/9); [c-0005 wireframe and firstmate research](./cycles/c-0005.md); [c-0006 live orphan-process forensics](./cycles/c-0006.md); [c-0007 worktree experiment, ship-with-squadron specification, and Copilot vocabulary extraction](./cycles/c-0007.md)
- Links: parent-of n-0001, n-0002, n-0003, n-0004, n-0005, n-0006, n-0007
- First seen: c-0001
- Former node id: none
- Reinterpreted: c-0005 (intact)
- Promotion key: none
- Tracker: none
- Divergence: **one outstanding (c-0011).** Issue #1's "Isolation" section still reads "Worktree-per-Fleet is a strong default, reinforced but not enforced" and "A Fleet must know that other Fleets may be working concurrently." Both were reversed by confirmed decisions in c-0010. Durable state is ahead of the anchor, not contradicted by it, so no node is invalidated - but the anchor must be reconciled through `/discovery` before a later cycle misreads it as authority. Previously: The c-0005 wireframe's file editor contradicted Issue #12's deferral; c-0008 resolved it in favour of read-only viewers with an "open in Visual Studio Code" action, and no editor is built. **Both c-0007 tracker divergences were reconciled in c-0008.** The map body was rewritten in confirmed vocabulary; #5 carries a correcting comment recording that its naming decision is falsified; #6, #12, #14, and #17 carry vocabulary substitution tables; #6 and #17 were retitled. `CONTEXT.md` is authoritative over any remaining issue-body wording.
- History: c-0001 created from Issue #1 and grounded in the existing cross-prototype contract; c-0001 settled the proving slice and sequencing; c-0003 validated the Electron runtime/state boundary probe; c-0004 deferred real Electron installation and window validation; c-0005 confirmed Electron as the first route, established that no Agent process may outlive the application after an observed orphan defect in the v1.1 WezTerm build, set a ceiling of 8 concurrent Sessions with in-panel resource metering and active admission control, captured a three-column wireframe with global Session-scoped selection, confirmed the 1:1 Session/Primary Agent binding against firstmate's lock model, and retired the military vocabulary in favour of plain literal nouns; maturity lowered one level to researched because the form of the destination proved less settled than the tree recorded, the user having floated neovim, the GitHub app, tmux, and a Visual Studio Code extension within one cycle; c-0006 corrected c-0005's erroneous retraction of the orphan defect by observing the running system rather than the repository source, identifying a detached `herdr server` daemon that kept Sessions and Model Context Protocol servers alive for two days past application exit while macOS attributed their permission prompts to Maestro through inherited responsibility, and hardened lifecycle ownership into seven verifiable non-functional requirements; c-0007 reconciled the vocabulary against the Copilot runtime and renamed the structural unit to Fleet, released `Session` and `Agent` to their runtime meanings, retired `Workspace` as triple-booked, respelled `subagent`, adopted `Task`, settled lifecycle onto two independent axes, made worktree-per-Fleet the strong default with branch-per-Fleet as a verified consequence, chose a fully generic display model over orchestration-specific awareness, and bound a primary agent window 1:1 to each Fleet; c-0008 confirmed the vocabulary through `/domain-mapping`, which published `CONTEXT.md` and the first Architecture Decision Record and corrected two definitions, resolved the in-app editing contradiction in favour of read-only viewers, settled that closing the application auto-Parks every Fleet behind an acknowledged summary, and moved the tracker to `remote`, reconciling the map, five issues, two titles, and the missing v3/v4 dependency edges that had left prototypes unblocked ahead of their own research; c-0009 ran the first approved prototype and cleared the node's last blocker, confirming in Electron's real lifecycle that a supervisor can hold three Fleets as three process groups and reach zero survivors on quit, while falsifying the c-0006 requirement to spawn non-detached - a non-detached child is not a process-group leader and cannot be signalled as a group at all, so detachment paired with durable process-group ownership and a reap-on-launch step is the only strategy measured to work; **c-0010 was omitted from this history when it was published and is recorded here in c-0011**: it delegated four read-only research agents, then falsified two of their consequential claims by direct measurement - `parentId` is a linear event-chain pointer, not a parent-agent link, so the reported depth of 16 was an artifact and the real maximum depth is 2 with fan-out dominating, and `inbox_entries` holds 27 rows across all 674 local databases rather than the 0 a sampled scan reported, though every sender is a subagent reporting to its owning session so the conclusion that no peer channel exists survived - and it closed isolation on both axes, the user confirming that Fleets get no sibling awareness at all and, unprompted, that Fleets are isolated to worktrees, which reversed the c-0007 "strong default" and the c-0007 requirement that a Fleet must know it is not alone; c-0011 decomposed this node, which had held every open question in a single-node tree for eleven cycles, into seven children, and settled the shape of the work: all four routes are driven to a **complete** MVP rather than reduced to feasibility probes, executed strictly one at a time in evidence order rather than version order - v2 Electron first because it alone carries measured evidence, then v1.1 WezTerm, v3 Tauri/Rust, and v4 native macOS Swift - each producing a per-stack executive report, with a stack that cannot build the app **rejected** rather than treated as a failure, and a terminal comparative evaluation consuming the four reports; the acceptance slice unresolved since c-0001 was settled as one scripted six-step flow identical across routes, and the 8-Fleet ceiling was accepted as a known unknown with a stated trigger because no target monorepo exists to measure against

### n-0001 - MVP acceptance slice and per-route deliverables

- Parent: n-0000
- Fog: decision-ready
- Maturity: decision-ready
- Priority: P0
- Outcome: One scripted end-to-end flow, identical across all four routes, that defines "complete" and supplies the comparative evaluation's rubric: create two named Fleets, each in its own enforced Worktree and branch; present each Fleet's primary agent window bound 1:1; prompt Fleet A so it delegates at least one subagent and the tree renders live with correct parentage; select Fleet B and observe every panel re-scope; drive Fleet A into a permission request and observe Attention surface on that Fleet; quit through the pre-close summary, auto-Parking both Fleets with zero surviving processes; relaunch and find both Fleets with identity, history, Worktree, and recomputed Liveness intact, resuming Fleet A's Session by name. Each route additionally produces an executive report of that stack's pros and cons, and a stack that cannot build the app is **rejected** rather than counted as a failure.
- Open questions: Does executing the slice against a real route reveal a step that is unimplementable rather than merely hard, and if so is the slice wrong or is the route rejected? What evidence must the executive report carry to make four reports genuinely comparable?
- Evidence: [c-0011](./cycles/c-0011.md); [Issue #18](https://github.com/jdylanmc/maestro/issues/18); every step restates a requirement already confirmed in c-0005 through c-0010
- Links: blocks n-0003, n-0004, n-0005, n-0006; informs n-0007
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0011 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #18](https://github.com/jdylanmc/maestro/issues/18)
- Divergence: none
- History: c-0011 created by decomposition and settled in the same cycle. The slice had been carried as an unresolved requirement since c-0001 in superseded vocabulary; the user's answer replaced it and added two things the loop did not propose - the per-stack executive report as a first-class deliverable, and rejection as a legitimate terminal verdict for a route

### n-0002 - Copilot provider integration contract

- Parent: n-0000
- Fog: investigating
- Maturity: researched
- Priority: P0
- Outcome: The provider-side facts every route inherits unchanged, so each route implements a presentation of the same contract rather than rediscovering it. Established: the subagent tree is reconstructed by joining `subagent.started.data.toolCallId` to the `agentId` on the spawning agent's own `tool.*` event, never through `parentId`; `agentId` is reliable identity; the tree is arbitrary-depth but must be optimised for fan-out; Sessions are named with `-n, --name` and resumed by name; `inbox_entries` is the subagent-to-owning-session channel and out of scope.
- Open questions: Does the Attention predicate - an unmatched `permission.requested`, plus `session.error` and `abort` - actually fire against a genuinely blocked Session? No unresolved permission request exists anywhere in local evidence, so the predicate has never been observed firing and must be tested against a deliberately constructed block. Do live Copilot Sessions, which install their own signal handlers, tear down like the synthetic `sh`/`sleep` trees c-0009 measured?
- Evidence: [c-0010](./cycles/c-0010.md) measurement of 41,928 events and 132 subagents in one Session and a full scan of all 674 local session databases; [c-0009](./cycles/c-0009.md) supervisor teardown prototype; [Issue #2](https://github.com/jdylanmc/maestro/issues/2); [Issue #11](https://github.com/jdylanmc/maestro/issues/11); [Issue #9](https://github.com/jdylanmc/maestro/issues/9)
- Links: blocks n-0003
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0011 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #2](https://github.com/jdylanmc/maestro/issues/2), [Issue #11](https://github.com/jdylanmc/maestro/issues/11)
- Divergence: none
- History: c-0011 extracted the provider-level findings of c-0009 and c-0010 into their own node, because they are inherited identically by all four routes and were being re-read out of the root's prose each cycle. Enters at maturity `researched` on c-0010's measured evidence, with two genuinely empirical questions outstanding, both of which can only be answered against a live Session

### n-0003 - v2 Electron MVP

- Parent: n-0000
- Fog: investigating
- Maturity: researched
- Priority: P0
- Outcome: The first route driven to a complete MVP, executing n-0001's acceptance slice end to end and producing its executive report. Chosen to lead on evidence rather than version order: it is the only route carrying measured results.
- Open questions: Does **packaging**, as opposed to the development-run lifecycle, preserve the supervision property c-0009 measured? c-0009 ran under a development lifecycle, and packaging changes how the application is launched and how its process tree is rooted. Does the real BrowserWindow and packaging seam hold now that the external Electron dependency is available, which c-0004 deferred?
- Evidence: [c-0003](./cycles/c-0003.md) runtime/state boundary probe; [c-0004](./cycles/c-0004.md) deferral of real installation; [c-0005](./cycles/c-0005.md) confirmation of Electron as the first route; [c-0009](./cycles/c-0009.md) prototype reaching zero survivors across three process groups on quit; [Issue #4](https://github.com/jdylanmc/maestro/issues/4)
- Links: depends-on n-0001, n-0002; blocks n-0004, n-0007
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0011 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #4](https://github.com/jdylanmc/maestro/issues/4)
- Divergence: none
- History: c-0011 created by decomposition, inheriting the Electron evidence accumulated across c-0003, c-0004, c-0005, and c-0009, and placed first in the sequence. Its maturity is load-bearing for the whole sequence: because it enters at `researched`, the P1 nodes that depend on it generate no priority debt, and if it is ever weakened below that floor the loop is required to stop deepening n-0004 and n-0007 until it recovers

### n-0004 - v1.1 WezTerm MVP

- Parent: n-0000
- Fog: scouted
- Maturity: vague
- Priority: P1
- Outcome: The second route driven to a complete MVP against the same acceptance slice, with its own executive report.
- Open questions: Can a WezTerm-hosted route satisfy the process-ownership requirement at all? v1.0's detached `herdr server` daemon is the original violation, so this route starts holding the defect that produced the requirement. Does `proto-v1/` shorten the distance to completion, or does it carry the architecture that has to be abandoned?
- Evidence: [c-0006](./cycles/c-0006.md) live orphan-process forensics; `proto-v1/` preserved v1.0 implementation; [Issue #26](https://github.com/jdylanmc/maestro/issues/26); [Issue #27](https://github.com/jdylanmc/maestro/issues/27); [Issue #28](https://github.com/jdylanmc/maestro/issues/28)
- Links: depends-on n-0003; blocks n-0005, n-0007
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0011 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #27](https://github.com/jdylanmc/maestro/issues/27)
- Divergence: none
- History: c-0011 created by decomposition and sequenced second

### n-0005 - v3 Tauri/Rust MVP

- Parent: n-0000
- Fog: scouted
- Maturity: vague
- Priority: P1
- Outcome: The third route driven to a complete MVP against the same acceptance slice, with its own executive report.
- Open questions: Everything. No feasibility research has been done on this route beyond its tracker item.
- Evidence: [Issue #23](https://github.com/jdylanmc/maestro/issues/23)
- Links: depends-on n-0004; blocks n-0006, n-0007
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0011 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #23](https://github.com/jdylanmc/maestro/issues/23)
- Divergence: none
- History: c-0011 created by decomposition and sequenced third

### n-0006 - v4 native macOS Swift MVP

- Parent: n-0000
- Fog: scouted
- Maturity: vague
- Priority: P1
- Outcome: The fourth route driven to a complete MVP against the same acceptance slice, with its own executive report.
- Open questions: Everything. No feasibility research has been done on this route beyond its tracker item.
- Evidence: [Issue #24](https://github.com/jdylanmc/maestro/issues/24)
- Links: depends-on n-0005; blocks n-0007
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0011 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #24](https://github.com/jdylanmc/maestro/issues/24)
- Divergence: none
- History: c-0011 created by decomposition and sequenced fourth

### n-0007 - Comparative technology evaluation

- Parent: n-0000
- Fog: scouted
- Maturity: vague
- Priority: P1
- Outcome: The terminal deliverable: an analysis selecting which stack is best suited to this problem, consuming the four per-route executive reports rather than re-deriving the comparison. A rejected stack is an input to this evaluation, not an absence from it - the reason a stack could not build the app is itself a finding.
- Open questions: What makes four reports comparable enough to decide from - a fixed rubric agreed before the first route ships, or a rubric derived after the fact from what actually differentiated them? Deciding this late risks a rubric shaped by the outcome; deciding it early risks measuring the wrong things.
- Evidence: [c-0011](./cycles/c-0011.md)
- Links: depends-on n-0003, n-0004, n-0005, n-0006; informed-by n-0001
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0011 (intact)
- Promotion key: none
- Tracker: none
- Divergence: none
- History: c-0011 created by decomposition. It exists as a node rather than as a closing step because the user named it a first-class deliverable - "then do an analysis and evaluation on which technology is best to solve this problem" - and because its rubric question has to be settled before the routes finish, not after

## Active Frontier

| Node | Fog | Maturity | Priority | Blocked by | Open questions |
| --- | --- | --- | --- | --- | --- |
| n-0000 | decision-ready | researched | P0 | none | none held directly; decomposed in c-0011 |
| n-0001 | decision-ready | decision-ready | P0 | none | Whether executing the slice exposes an unimplementable step; what makes four executive reports comparable |
| n-0002 | investigating | researched | P0 | none | Attention predicate against a genuine block, never observed firing; live Session signal handling under teardown |
| n-0003 | investigating | researched | P0 | n-0001, n-0002 | Packaging versus development-run supervision; real BrowserWindow and packaging seams |
| n-0004 | scouted | vague | P1 | n-0003 | Whether a WezTerm route can satisfy process ownership at all; whether `proto-v1/` helps or hinders |
| n-0005 | scouted | vague | P1 | n-0004 | No feasibility research yet |
| n-0006 | scouted | vague | P1 | n-0005 | No feasibility research yet |
| n-0007 | scouted | vague | P1 | n-0003, n-0004, n-0005, n-0006 | Whether the comparison rubric is fixed before the first route ships or derived afterwards |

## Priority Debt

| Lower-priority node | Outran (maturity below researched) | Relation | Cause | Detected | Last seen | Status |
| --- | --- | --- | --- | --- | --- | --- |

## Tracker Synchronization

| Node | Tier | Promotion key | Tracker item | Last synced cycle | Divergence |
| --- | --- | --- | --- | --- | --- |
| n-0000 | map | maestro-graphical-agent-orchestrator/n-0000 | [Issue #1](https://github.com/jdylanmc/maestro/issues/1) | c-0008 | **Anchor body lags confirmed state (c-0011).** Issue #1's "Isolation" section still records worktree-per-Fleet as "not enforced" and requires that "A Fleet must know that other Fleets may be working concurrently." Both reversed in c-0010. Needs reconciliation through `/discovery`. |
| n-0001 | unpromoted | none | relates to [Issue #18](https://github.com/jdylanmc/maestro/issues/18) | never | none |
| n-0002 | unpromoted | none | relates to [Issue #2](https://github.com/jdylanmc/maestro/issues/2), [Issue #11](https://github.com/jdylanmc/maestro/issues/11) | never | none |
| n-0003 | unpromoted | none | relates to [Issue #4](https://github.com/jdylanmc/maestro/issues/4) | never | none |
| n-0004 | unpromoted | none | relates to [Issue #27](https://github.com/jdylanmc/maestro/issues/27) | never | none |
| n-0005 | unpromoted | none | relates to [Issue #23](https://github.com/jdylanmc/maestro/issues/23) | never | none |
| n-0006 | unpromoted | none | relates to [Issue #24](https://github.com/jdylanmc/maestro/issues/24) | never | none |
| n-0007 | unpromoted | none | none | never | none |
