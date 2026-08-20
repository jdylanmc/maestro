---
schema-version: 1
session: maestro-graphical-agent-orchestrator
state-root: docs/discovery
revision: 14
anchor: https://github.com/jdylanmc/maestro/issues/1
anchor-revision: 2026-08-19T20:00:11Z
anchor-status: unchanged
question-group-size: 12
last-question-group-size: 1
last-cycle: c-0013
cycle-state: complete
state-digest: 1d9afe6c99b5fe08f32f82085da5b0fc2ff35a7eb1a3f136909d5ab5d6cf425d
root-map-digest: a18176a5b954c3f0207d8352f97c7a495ab6a5b6c4452bd275e08ec2cdf7bef2
root-lexicon-digest: 996bd740e483473691d06862dd280b3ac5929e3c4dfbea7ac4ecf803307c5ed5
digest-tool: shasum -a 256
digest-status: verified
state-scope: full
tracker-mode: remote
tracker-tier-map: n-0000 -> Issue #1 (discovery:map); n-0001..n-0009 unpromoted
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
| Attention | candidate | A Fleet state meaning the human is required. Signals: `session.error` and `abort` always; a `permission.requested` whose `data.requestId` has no matching `permission.completed` **wherever the integration mode surfaces one** - c-0012 observed it firing and clearing on a pseudo-terminal session, and c-0013 measured that ACP emits no permission events at all. Availability is mode-dependent, not universal. Replaces the unreachable `AT_RISK` reading. | Maestro orchestration | AT_RISK (rejected reading) | c-0010 derivation; c-0012 live measurement; c-0013 ACP absence | c-0010 | c-0013 | Fleet, Session, permission.requested | session:maestro-graphical-agent-orchestrator |
| Acceptance Harness | candidate | The single route-agnostic checker every route must pass, asserting the Acceptance Slice against external ground truth rather than through the application under test. | Maestro discovery process | none | c-0012 | c-0012 | c-0012 | Acceptance Slice, n-0009 | session:maestro-graphical-agent-orchestrator |
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
- Reinterpreted: c-0013 (intact)
- Promotion key: none
- Tracker: none
- Divergence: **one outstanding (c-0011).** Issue #1's "Isolation" section still reads "Worktree-per-Fleet is a strong default, reinforced but not enforced" and "A Fleet must know that other Fleets may be working concurrently." Both were reversed by confirmed decisions in c-0010. Durable state is ahead of the anchor, not contradicted by it, so no node is invalidated - but the anchor must be reconciled through `/discovery` before a later cycle misreads it as authority. Previously: The c-0005 wireframe's file editor contradicted Issue #12's deferral; c-0008 resolved it in favour of read-only viewers with an "open in Visual Studio Code" action, and no editor is built. **Both c-0007 tracker divergences were reconciled in c-0008.** The map body was rewritten in confirmed vocabulary; #5 carries a correcting comment recording that its naming decision is falsified; #6, #12, #14, and #17 carry vocabulary substitution tables; #6 and #17 were retitled. `CONTEXT.md` is authoritative over any remaining issue-body wording.
- History: c-0001 created from Issue #1 and grounded in the existing cross-prototype contract; c-0001 settled the proving slice and sequencing; c-0003 validated the Electron runtime/state boundary probe; c-0004 deferred real Electron installation and window validation; c-0005 confirmed Electron as the first route, established that no Agent process may outlive the application after an observed orphan defect in the v1.1 WezTerm build, set a ceiling of 8 concurrent Sessions with in-panel resource metering and active admission control, captured a three-column wireframe with global Session-scoped selection, confirmed the 1:1 Session/Primary Agent binding against firstmate's lock model, and retired the military vocabulary in favour of plain literal nouns; maturity lowered one level to researched because the form of the destination proved less settled than the tree recorded, the user having floated neovim, the GitHub app, tmux, and a Visual Studio Code extension within one cycle; c-0006 corrected c-0005's erroneous retraction of the orphan defect by observing the running system rather than the repository source, identifying a detached `herdr server` daemon that kept Sessions and Model Context Protocol servers alive for two days past application exit while macOS attributed their permission prompts to Maestro through inherited responsibility, and hardened lifecycle ownership into seven verifiable non-functional requirements; c-0007 reconciled the vocabulary against the Copilot runtime and renamed the structural unit to Fleet, released `Session` and `Agent` to their runtime meanings, retired `Workspace` as triple-booked, respelled `subagent`, adopted `Task`, settled lifecycle onto two independent axes, made worktree-per-Fleet the strong default with branch-per-Fleet as a verified consequence, chose a fully generic display model over orchestration-specific awareness, and bound a primary agent window 1:1 to each Fleet; c-0008 confirmed the vocabulary through `/domain-mapping`, which published `CONTEXT.md` and the first Architecture Decision Record and corrected two definitions, resolved the in-app editing contradiction in favour of read-only viewers, settled that closing the application auto-Parks every Fleet behind an acknowledged summary, and moved the tracker to `remote`, reconciling the map, five issues, two titles, and the missing v3/v4 dependency edges that had left prototypes unblocked ahead of their own research; c-0009 ran the first approved prototype and cleared the node's last blocker, confirming in Electron's real lifecycle that a supervisor can hold three Fleets as three process groups and reach zero survivors on quit, while falsifying the c-0006 requirement to spawn non-detached - a non-detached child is not a process-group leader and cannot be signalled as a group at all, so detachment paired with durable process-group ownership and a reap-on-launch step is the only strategy measured to work; **c-0010 was omitted from this history when it was published and is recorded here in c-0011**: it delegated four read-only research agents, then falsified two of their consequential claims by direct measurement - `parentId` is a linear event-chain pointer, not a parent-agent link, so the reported depth of 16 was an artifact and the real maximum depth is 2 with fan-out dominating, and `inbox_entries` holds 27 rows across all 674 local databases rather than the 0 a sampled scan reported, though every sender is a subagent reporting to its owning session so the conclusion that no peer channel exists survived - and it closed isolation on both axes, the user confirming that Fleets get no sibling awareness at all and, unprompted, that Fleets are isolated to worktrees, which reversed the c-0007 "strong default" and the c-0007 requirement that a Fleet must know it is not alone; c-0011 decomposed this node, which had held every open question in a single-node tree for eleven cycles, into seven children, and settled the shape of the work: all four routes are driven to a **complete** MVP rather than reduced to feasibility probes, executed strictly one at a time in evidence order rather than version order - v2 Electron first because it alone carries measured evidence, then v1.1 WezTerm, v3 Tauri/Rust, and v4 native macOS Swift - each producing a per-stack executive report, with a stack that cannot build the app **rejected** rather than treated as a failure, and a terminal comparative evaluation consuming the four reports; the acceptance slice unresolved since c-0001 was settled as one scripted six-step flow identical across routes, and the 8-Fleet ceiling was accepted as a known unknown with a stated trigger because no target monorepo exists to measure against; c-0012 ran two approved prototypes and retired every empirical unknown that had been carried since c-0009: packaging preserves the supervision property measured in a development run, with the packaged application itself reparented to `launchd` and that reparenting proved harmless because the application owns and reaps its groups, and the Attention predicate was observed firing for the first time anywhere in this project - a sustained unmatched `permission.requested` on a genuinely blocked live Session, joined by `data.requestId` - while two assumptions failed: a live Copilot Session does **not** tear down on `SIGTERM` like the synthetic trees c-0009 measured, stalling at five survivors until `SIGKILL` escalation, and a Session driven non-interactively can never surface Attention at all, which turned the integration mode into new blocking fog (n-0008) alongside the acceptance harness the verification seam now requires (n-0009); c-0013 settled the seam by probing it - ACP is adopted, it resumes sessions with history and streams tool-call status, and it neither asks permission nor accepts a session name, so Attention became mode-dependent rather than universal and the runtime-naming requirement narrowed to binding by `sessionId` with a Maestro-owned display name

### n-0001 - MVP acceptance slice and per-route deliverables

- Parent: n-0000
- Fog: decision-ready
- Maturity: decision-ready
- Priority: P0
- Outcome: One scripted end-to-end flow, identical across all four routes, that defines "complete" and supplies the comparative evaluation's rubric: create two named Fleets, each in its own enforced Worktree and branch; present each Fleet's primary agent window bound 1:1; prompt Fleet A so it delegates at least one subagent and the tree renders live with correct parentage; select Fleet B and observe every panel re-scope; drive Fleet A into a permission request and observe Attention surface on that Fleet; quit through the pre-close summary, auto-Parking both Fleets with zero surviving processes; relaunch and find both Fleets with identity, history, Worktree, and recomputed Liveness intact, resuming Fleet A's Session by name. Each route additionally produces an executive report of that stack's pros and cons, and a stack that cannot build the app is **rejected** rather than counted as a failure.
- Open questions: **Step 5 was re-specified in c-0013** after ACP proved it emits no permission events - Attention now means "a state requiring the human", with the permission signal used wherever the mode surfaces it. That change was made under delegation, not confirmed by the user, and is flagged revisitable. Does executing the slice against a real route reveal a step that is unimplementable rather than merely hard, and if so is the slice wrong or is the route rejected? What evidence must the executive report carry to make four reports genuinely comparable?
- Evidence: [c-0011](./cycles/c-0011.md); [Issue #18](https://github.com/jdylanmc/maestro/issues/18); every step restates a requirement already confirmed in c-0005 through c-0010
- Links: blocks n-0003, n-0004, n-0005, n-0006; informs n-0007; parent-of n-0009
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0013 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #18](https://github.com/jdylanmc/maestro/issues/18)
- Divergence: none
- History: c-0011 created by decomposition and settled in the same cycle. The slice had been carried as an unresolved requirement since c-0001 in superseded vocabulary; the user's answer replaced it and added two things the loop did not propose - the per-stack executive report as a first-class deliverable, and rejection as a legitimate terminal verdict for a route; c-0012 settled the slice's verification seam as a single route-agnostic Acceptance Harness asserting external ground truth, spun that harness out as n-0009, and measured two of the slice's steps for the first time - step 5's Attention predicate fired and cleared on a live Session, and step 6's zero-survivor teardown held under packaging

### n-0002 - Copilot provider integration contract

- Parent: n-0000
- Fog: researched
- Maturity: decision-ready
- Priority: P0
- Outcome: The provider-side facts every route inherits unchanged, so each route implements a presentation of the same contract rather than rediscovering it. Established: the subagent tree is reconstructed by joining `subagent.started.data.toolCallId` to the `agentId` on the spawning agent's own `tool.*` event, never through `parentId`; `agentId` is reliable identity; the tree is arbitrary-depth but must be optimised for fan-out; Sessions are named with `-n, --name` and resumed by name; `inbox_entries` is the subagent-to-owning-session channel and out of scope. **Added in c-0012 by measurement:** Attention is an unmatched `permission.requested` joined to `permission.completed` by `data.requestId`, and `data.result.kind` discriminates the outcome; events are read from `events.jsonl`, never from `session.db`, which holds only `inbox_entries`, `todos`, and `todo_deps`; a live Session's teardown requires `SIGKILL` escalation because `SIGTERM` alone leaves survivors; and `copilot` self-assigns its own process group even when spawned without a detach flag.
- Open questions: Which processes survive `SIGTERM` and why - only the count was captured, not the identity, so the c-0006 pattern of wrapper processes exiting after their children is inferred rather than shown. Does `subagent.started` reach an ACP client as a live notification, or only through `events.jsonl`? Held jointly with n-0008.
- Evidence: [c-0010](./cycles/c-0010.md) measurement of 41,928 events and 132 subagents in one Session and a full scan of all 674 local session databases; [c-0009](./cycles/c-0009.md) supervisor teardown prototype; [Issue #2](https://github.com/jdylanmc/maestro/issues/2); [Issue #11](https://github.com/jdylanmc/maestro/issues/11); [Issue #9](https://github.com/jdylanmc/maestro/issues/9)
- Links: blocks n-0003; parent-of n-0008
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0013 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #2](https://github.com/jdylanmc/maestro/issues/2), [Issue #11](https://github.com/jdylanmc/maestro/issues/11)
- Divergence: none
- History: c-0011 extracted the provider-level findings of c-0009 and c-0010 into their own node, because they are inherited identically by all four routes and were being re-read out of the root's prose each cycle. Enters at maturity `researched` on c-0010's measured evidence, with two genuinely empirical questions outstanding, both of which can only be answered against a live Session; c-0012 answered both against live Sessions under an approved prototype, advancing fog to `researched` and maturity to `decision-ready` - the predicate fired and cleared, and teardown falsified the assumption that a live Session behaves like a synthetic tree - and spun the newly exposed integration-mode question out as n-0008 rather than absorbing it back into this node

### n-0003 - v2 Electron MVP

- Parent: n-0000
- Fog: decision-ready
- Maturity: decision-ready
- Priority: P0
- Outcome: The first route driven to a complete MVP, executing n-0001's acceptance slice end to end and producing its executive report. Chosen to lead on evidence rather than version order: it is the only route carrying measured results.
- Open questions: **Both prior questions are answered.** Packaging preserves supervision (c-0012, measured), and the real `BrowserWindow` seam was already exercised in c-0009. n-0008 was settled in c-0013, so one blocker is gone; the Acceptance Harness (n-0009) is the last one it cannot clear itself. Does a signed, notarized, hardened-runtime build still spawn and reap process groups the way the unsigned `--dir` build measured in c-0012 does?
- Evidence: [c-0003](./cycles/c-0003.md) runtime/state boundary probe; [c-0004](./cycles/c-0004.md) deferral of real installation; [c-0005](./cycles/c-0005.md) confirmation of Electron as the first route; [c-0009](./cycles/c-0009.md) prototype reaching zero survivors across three process groups on quit; [c-0012](./cycles/c-0012.md) packaged `.app` measured at zero survivors on graceful quit, nine survivors on Force Quit without a reaper, and zero after reap-on-launch; [Issue #4](https://github.com/jdylanmc/maestro/issues/4)
- Links: depends-on n-0001, n-0002, n-0009; blocks n-0004, n-0007; informed-by n-0008 (settled c-0013)
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0013 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #4](https://github.com/jdylanmc/maestro/issues/4)
- Divergence: none
- History: c-0011 created by decomposition, inheriting the Electron evidence accumulated across c-0003, c-0004, c-0005, and c-0009, and placed first in the sequence. Its maturity is load-bearing for the whole sequence: because it enters at `researched`, the P1 nodes that depend on it generate no priority debt, and if it is ever weakened below that floor the loop is required to stop deepening n-0004 and n-0007 until it recovers; c-0012 selected it under rule 3, retired both of its open questions by measurement, and advanced it through fog `researched` to `decision-ready` with maturity `decision-ready` - but it did **not** reach promotion, because clearing its fog exposed two new blockers it does not own, and because the `Attention` vocabulary its step-5 Story is written in is still a `candidate` term with a pending domain handoff

### n-0004 - v1.1 WezTerm MVP

- Parent: n-0000
- Fog: scouted
- Maturity: vague
- Priority: P1
- Outcome: The second route driven to a complete MVP against the same acceptance slice, with its own executive report.
- Open questions: Can a WezTerm-hosted route satisfy the process-ownership requirement at all? v1.0's detached `herdr server` daemon is the original violation, so this route starts holding the defect that produced the requirement. Does `proto-v1/` shorten the distance to completion, or does it carry the architecture that has to be abandoned?
- Evidence: [c-0006](./cycles/c-0006.md) live orphan-process forensics; `proto-v1/` preserved v1.0 implementation; [Issue #26](https://github.com/jdylanmc/maestro/issues/26); [Issue #27](https://github.com/jdylanmc/maestro/issues/27); [Issue #28](https://github.com/jdylanmc/maestro/issues/28)
- Links: depends-on n-0003, n-0008, n-0009; blocks n-0005, n-0007
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0013 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #27](https://github.com/jdylanmc/maestro/issues/27)
- Divergence: none
- History: c-0011 created by decomposition and sequenced second; c-0012 added the two provider-level blockers n-0008 and n-0009 that every route inherits, which put this node into priority debt against both; c-0013 debt cleared (n-0008 reached researched); the n-0009 row remains open

### n-0005 - v3 Tauri/Rust MVP

- Parent: n-0000
- Fog: scouted
- Maturity: vague
- Priority: P1
- Outcome: The third route driven to a complete MVP against the same acceptance slice, with its own executive report.
- Open questions: Everything. No feasibility research has been done on this route beyond its tracker item.
- Evidence: [Issue #23](https://github.com/jdylanmc/maestro/issues/23)
- Links: depends-on n-0004, n-0008, n-0009; blocks n-0006, n-0007
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0013 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #23](https://github.com/jdylanmc/maestro/issues/23)
- Divergence: none
- History: c-0011 created by decomposition and sequenced third; c-0012 added the inherited blockers n-0008 and n-0009; c-0013 debt cleared (n-0008 reached researched); the n-0009 row remains open

### n-0006 - v4 native macOS Swift MVP

- Parent: n-0000
- Fog: scouted
- Maturity: vague
- Priority: P1
- Outcome: The fourth route driven to a complete MVP against the same acceptance slice, with its own executive report.
- Open questions: Everything. No feasibility research has been done on this route beyond its tracker item.
- Evidence: [Issue #24](https://github.com/jdylanmc/maestro/issues/24)
- Links: depends-on n-0005, n-0008, n-0009; blocks n-0007
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0013 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #24](https://github.com/jdylanmc/maestro/issues/24)
- Divergence: none
- History: c-0011 created by decomposition and sequenced fourth; c-0012 added the inherited blockers n-0008 and n-0009; c-0013 debt cleared (n-0008 reached researched); the n-0009 row remains open

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
- Reinterpreted: c-0013 (intact)
- Promotion key: none
- Tracker: none
- Divergence: none
- History: c-0011 created by decomposition. It exists as a node rather than as a closing step because the user named it a first-class deliverable - "then do an analysis and evaluation on which technology is best to solve this problem" - and because its rubric question has to be settled before the routes finish, not after

### n-0008 - Copilot integration mode

- Parent: n-0002
- Fog: decision-ready
- Maturity: researched
- Priority: P0
- Outcome: **Settled in c-0013: ACP is the seam.** A route drives a Fleet's Session through `copilot --acp` over JSON-RPC on stdio - `initialize`, `session/new`, `session/prompt`, `session/list`, `session/load` - consuming `session/update` notifications for streaming text and tool-call status. Maestro does **not** build a permission-mediation layer for the MVP. Original framing: c-0012 proved the choice is not free: a Session driven with `-p` completes every permission request instantly as `denied-no-approval-rule-and-could-not-request-from-user`, so it **can never surface Attention** and acceptance-slice step 5 is unreachable through it. The candidate is `copilot --acp`, the Agent Client Protocol server the binary already exposes; the fallback is driving the terminal user interface through a pseudo-terminal, which c-0012 found fragile enough to need four attempts before it accepted input.
- Open questions: Does `subagent.started` reach an ACP client as a `session/update`, or only through `events.jsonl`? No subagent was spawned during the probe, so the tree's live path is confirmed only for the shared event log. Does a Copilot release exist, or arrive, whose ACP server sends `session/request_permission`? That is the single assumption the Attention decision rests on, and it is cheap to re-test on every upgrade.
- Evidence: [c-0013](./cycles/c-0013.md) full ACP probe - protocol handshake, streaming vocabulary, zero permission events across two capability declarations, `session/list` over 50 sessions, and `session/load` resuming with real history; [c-0012](./cycles/c-0012.md) non-interactive auto-denial measured in session `0e840075`, live interactive firing in `225cda11` and `c8f382bc`, and four failed pseudo-terminal driving attempts; `copilot --help` (`--acp`, "Start as Agent Client Protocol server")
- Links: depends-on n-0002; blocks n-0003, n-0004, n-0005, n-0006
- First seen: c-0012
- Former node id: none
- Reinterpreted: c-0013 (intact)
- Promotion key: none
- Tracker: none
- Divergence: none
- History: c-0012 created it as new fog exposed by measurement rather than by reasoning. It is provider-level, so every route inherits the answer, which is why it blocks all four rather than only Electron; c-0013 selected it under rule 2 - the first time priority debt has ever driven selection - probed ACP directly, and settled the seam. The probe found ACP superior on every structural axis and silent on exactly two: it never asks permission, and it will not name a session. The loop recommended building a Maestro-owned permission boundary; the user delegated the decision and disclosed that they run with broad permissions, which retired the recommendation rather than confirming it - a mediation layer would have serviced a gate the target workflow rarely reaches. Attention is instead derived from what the seam provides, with ACP permission surfacing recorded as an upstream dependency carrying a re-test trigger on every CLI upgrade

### n-0009 - Route-agnostic Acceptance Harness

- Parent: n-0001
- Fog: scouted
- Maturity: vague
- Priority: P0
- Outcome: One committed checker, shared by all four routes, that decides whether a route has executed the Acceptance Slice. It asserts against **external ground truth** - `ps` against recorded process-group identifiers, `events.jsonl` predicates joined by `requestId`, and on-disk Fleet state - never through a handle the application under test supplies. Steps 1, 3, 5, and 6 are machine-checkable with techniques c-0012 exercised directly; steps 2 and 4 are visual and get a short scripted human pass.
- Open questions: What is the smallest interface a route must expose for the harness to drive it without knowing its stack - a command-line entry point, a file-based control channel, or an accessibility interface? How does the harness assert step 4's re-scoping, which is visual by nature? Who runs the human pass, and is its result recorded in the executive report?
- Evidence: [c-0012](./cycles/c-0012.md) - both prototypes were trustworthy only because they measured external ground truth rather than asking the application under test
- Links: depends-on n-0001; blocks n-0003, n-0004, n-0005, n-0006
- First seen: c-0012
- Former node id: none
- Reinterpreted: c-0013 (intact)
- Promotion key: none
- Tracker: none
- Divergence: none
- History: c-0012 created it from the Q4 verification-seam decision. That decision is the one this cycle took under `delegated-to-loop` with the user absent, so this node carries a revisit flag the others do not

## Active Frontier

| Node | Fog | Maturity | Priority | Blocked by | Open questions |
| --- | --- | --- | --- | --- | --- |
| n-0000 | decision-ready | researched | P0 | none | none held directly; decomposed in c-0011 |
| n-0001 | decision-ready | decision-ready | P0 | none | What evidence makes four executive reports genuinely comparable |
| n-0002 | researched | decision-ready | P0 | none | Which processes survive `SIGTERM` and why - identity not captured, only the count |
| n-0003 | decision-ready | decision-ready | P0 | n-0008, n-0009 | Whether a signed, notarized, hardened-runtime build still spawns and reaps like the unsigned build measured in c-0012 |
| n-0004 | scouted | vague | P1 | n-0003, n-0008, n-0009 | Whether a WezTerm route can satisfy process ownership at all; whether `proto-v1/` helps or hinders |
| n-0005 | scouted | vague | P1 | n-0004, n-0008, n-0009 | No feasibility research yet |
| n-0006 | scouted | vague | P1 | n-0005, n-0008, n-0009 | No feasibility research yet |
| n-0007 | scouted | vague | P1 | n-0003, n-0004, n-0005, n-0006 | Whether the comparison rubric is fixed before the first route ships or derived afterwards |
| n-0008 | decision-ready | researched | P0 | none | Whether `subagent.started` reaches an ACP client live; whether any release sends `session/request_permission` |
| n-0009 | scouted | vague | P0 | none | The smallest stack-agnostic interface a route must expose; how step 4's visual re-scoping is asserted |

## Priority Debt

| Lower-priority node | Outran (maturity below researched) | Relation | Cause | Detected | Last seen | Status |
| --- | --- | --- | --- | --- | --- | --- |
| n-0004 | n-0009 | blocked-by | advanced n-0009 | c-0012 | c-0013 | open |
| n-0005 | n-0009 | blocked-by | advanced n-0009 | c-0012 | c-0013 | open |
| n-0006 | n-0009 | blocked-by | advanced n-0009 | c-0012 | c-0013 | open |

The table opened in c-0012 with six rows. **Three cleared in c-0013** when
n-0008 reached maturity `researched`; `debt cleared (n-0008 reached researched)`
is recorded in each affected node's history. The three n-0009 rows remain open,
so the invariant still holds the three later routes until the Acceptance Harness
reaches `researched` - and rule 2 will select **n-0009** next cycle, exactly as
it selected n-0008 in this one.

## Tracker Synchronization

| Node | Tier | Promotion key | Tracker item | Last synced cycle | Divergence |
| --- | --- | --- | --- | --- | --- |
| n-0000 | map | maestro-graphical-agent-orchestrator/n-0000 | [Issue #1](https://github.com/jdylanmc/maestro/issues/1) | c-0008 | **Anchor body lags confirmed state (c-0011, still open in c-0012).** Issue #1's "Isolation" section still records worktree-per-Fleet as "not enforced" and requires that "A Fleet must know that other Fleets may be working concurrently." Both reversed in c-0010. Needs reconciliation through `/discovery`. |
| n-0001 | unpromoted | none | relates to [Issue #18](https://github.com/jdylanmc/maestro/issues/18) | never | none |
| n-0002 | unpromoted | none | relates to [Issue #2](https://github.com/jdylanmc/maestro/issues/2), [Issue #11](https://github.com/jdylanmc/maestro/issues/11) | never | none |
| n-0003 | unpromoted | none | relates to [Issue #4](https://github.com/jdylanmc/maestro/issues/4) | never | none |
| n-0004 | unpromoted | none | relates to [Issue #27](https://github.com/jdylanmc/maestro/issues/27) | never | none |
| n-0005 | unpromoted | none | relates to [Issue #23](https://github.com/jdylanmc/maestro/issues/23) | never | none |
| n-0006 | unpromoted | none | relates to [Issue #24](https://github.com/jdylanmc/maestro/issues/24) | never | none |
| n-0007 | unpromoted | none | none | never | none |
| n-0008 | unpromoted | none | none | never | none |
| n-0009 | unpromoted | none | none | never | none |
