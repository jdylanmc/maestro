---
schema-version: 1
session: maestro-graphical-agent-orchestrator
state-root: docs/discovery
revision: 32
anchor: https://github.com/jdylanmc/maestro/issues/1
anchor-revision: 2026-08-22T14:22:20Z
anchor-status: revised
question-group-size: 12
last-question-group-size: 3
last-cycle: c-0030
cycle-state: complete
state-digest: bb532cd4f89b1aae1a3f8385a218a579ccf47e1ffcf898b21b3611a8e2343590
root-map-digest: 1ed71badaeca6f21840296bcf59daf591616b2dbba41fc2ad255385b0f12977e
root-lexicon-digest: 11e2f30ca56f615b4658f0b4880068fb4b8e34a426626b1456e94a5dbc0d27fa
digest-tool: shasum -a 256
digest-status: verified
state-scope: full
tracker-mode: remote
tracker-tier-map: approved c-0019 - Branch=GitHub issue labelled `discovery:map`; Story=native sub-issue labelled with its Discovery type marker (`discovery:prototype` for a route MVP, `discovery:task` for enabling work); Task=collapsed into the Story body as a `## Tasks` checklist
---

# Discovery Session - Maestro Graphical Agent Orchestrator

## Anchor

GitHub Issue #1: [Discovery - Maestro graphical agent orchestrator](https://github.com/jdylanmc/maestro/issues/1).

Issue #1 is reachable and unchanged, but its body is stale behind the confirmed
c-0025 scope reduction and the canonical vocabulary in `CONTEXT.md`. It still
describes a standalone orchestrator, worktree enforcement, durable lifecycle
ownership, and a multi-route comparison. This cycle records that divergence
rather than treating the stale anchor as current intent.

## Destination

Finish the smallest reliable cmux extension that makes a Copilot Session's
delegated work visible: a live, correctly parented subagent tree with honest
running, completed, and failed state, safe fail-open hooks, exact Session
identity, and a visually verified cmux surface.

## Session Domain Lexicon

| Term | Status | Definition | Bounded context | Aliases | Source | First seen | Last verified | Related terms | Scope |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Agent | confirmed | A selectable Copilot persona or configuration; never a running participant. | Copilot runtime | none | [`CONTEXT.md`](../../../../CONTEXT.md) | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0029 | Session | session:maestro-graphical-agent-orchestrator |
| Attention | confirmed | A Session observed to want its human. | Maestro observation | AT_RISK (discouraged) | [`CONTEXT.md`](../../../../CONTEXT.md) | maestro-graphical-agent-orchestrator/n-0000/c-0010 | c-0030 | Session, Liveness | session:maestro-graphical-agent-orchestrator |
| Fleet | deprecated | Former Maestro-owned unit; retired when worktree enforcement and durable lifecycle left scope. | Historical Maestro product | fleet | [`ADR 0004`](../../../../docs/adr/0004-retire-fleet.md) | maestro-graphical-agent-orchestrator/n-0000/c-0007 | c-0029 | Session | session:maestro-graphical-agent-orchestrator |
| Host Application | confirmed | The application a Session runs inside; it owns process lifetime and operating-system attribution. | Maestro observation | host (discouraged), shell (discouraged) | [`CONTEXT.md`](../../../../CONTEXT.md) | maestro-graphical-agent-orchestrator/n-0011/c-0021 | c-0029 | Session | session:maestro-graphical-agent-orchestrator |
| Interrupted | deprecated | Former durable intent for an unintentionally stopped Fleet. | Historical Maestro product | none | [`ADR 0004`](../../../../docs/adr/0004-retire-fleet.md) | maestro-graphical-agent-orchestrator/n-0000/c-0005 | c-0029 | Fleet | session:maestro-graphical-agent-orchestrator |
| Liveness | confirmed | Whether a Session's processes are observed to be Alive, Dead, or Ambiguous; never persisted as truth. | Maestro observation | none | [`CONTEXT.md`](../../../../CONTEXT.md) | maestro-graphical-agent-orchestrator/n-0000/c-0007 | c-0029 | Session, Attention | session:maestro-graphical-agent-orchestrator |
| Parked | deprecated | Former durable intent for a deliberately stopped Fleet. | Historical Maestro product | none | [`ADR 0004`](../../../../docs/adr/0004-retire-fleet.md) | maestro-graphical-agent-orchestrator/n-0000/c-0005 | c-0029 | Fleet | session:maestro-graphical-agent-orchestrator |
| Primary Agent | deprecated | Former interface name for a Fleet's Session pane. | Historical Maestro interface | none | [`ADR 0004`](../../../../docs/adr/0004-retire-fleet.md) | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0029 | Session | session:maestro-graphical-agent-orchestrator |
| Recap | deprecated | Former account of Fleet work; it may return only if a Session Recap is implemented. | Historical Maestro product | Orientation (discouraged) | [`ADR 0004`](../../../../docs/adr/0004-retire-fleet.md) | maestro-graphical-agent-orchestrator/n-0010/c-0019 | c-0029 | Session | session:maestro-graphical-agent-orchestrator |
| Session | confirmed | A runtime-owned, resumable Copilot conversation together with the subagents it delegates; the unit Maestro observes. | Copilot runtime | Fleet (discouraged), Workspace (discouraged) | [`CONTEXT.md`](../../../../CONTEXT.md) | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0029 | Task, subagent, Host Application | session:maestro-graphical-agent-orchestrator |
| Squad Mate | deprecated | Superseded by `subagent`. | Historical Maestro product | none | c-0005 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0029 | subagent | session:maestro-graphical-agent-orchestrator |
| Squadron | deprecated | Superseded by `subagent tree`. | Historical Maestro product | none | c-0005 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0029 | subagent tree | session:maestro-graphical-agent-orchestrator |
| Task | confirmed | A runtime-tracked unit of delegated or background work. Every subagent is a Task; shell-command Tasks are not subagents. | Copilot runtime | none | [`CONTEXT.md`](../../../../CONTEXT.md) | maestro-graphical-agent-orchestrator/n-0000/c-0007 | c-0029 | Session, subagent | session:maestro-graphical-agent-orchestrator |
| Worktree | deprecated | Plain git vocabulary; no longer a Maestro domain term. | Historical Maestro product | none | [`ADR 0004`](../../../../docs/adr/0004-retire-fleet.md) | maestro-graphical-agent-orchestrator/n-0000/c-0005 | c-0029 | Fleet | session:maestro-graphical-agent-orchestrator |
| Workspace | deprecated | Retired as a structural term because Copilot and Visual Studio Code already own it. | Historical Maestro product | none | c-0007 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0029 | Session | session:maestro-graphical-agent-orchestrator |
| subagent | confirmed | A delegated agent under a Session, with observable start, activity, and completion. | Copilot runtime | Sub-agent (discouraged), Squad Mate (deprecated) | [`CONTEXT.md`](../../../../CONTEXT.md) | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0029 | Session, Task, subagent tree | session:maestro-graphical-agent-orchestrator |
| subagent tree | confirmed | The nested hierarchy of a Session's subagents; the surface Maestro reconstructs and renders. | Maestro observation | Squadron (deprecated), Swarm (deprecated) | [`CONTEXT.md`](../../../../CONTEXT.md) | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0029 | Session, subagent | session:maestro-graphical-agent-orchestrator |

## Tree

### n-0000 - Maestro observability plugin

- Parent: none
- Fog: cleared
- Maturity: promotion-ready
- Priority: P0
- Outcome: Make a Copilot Session's delegated work visible inside cmux through a live, correctly parented subagent tree and honest state, while delegating terminal, workspace, and native agent behavior to cmux.
- Open questions: none held directly; current product fog is decomposed onto n-0011, n-0013, n-0014, n-0015, and n-0016.
- Evidence: [Issue #1](https://github.com/jdylanmc/maestro/issues/1); [Issue #18](https://github.com/jdylanmc/maestro/issues/18); [Issue #12](https://github.com/jdylanmc/maestro/issues/12); [Issue #6](https://github.com/jdylanmc/maestro/issues/6); [Issue #9](https://github.com/jdylanmc/maestro/issues/9); [c-0005 wireframe and firstmate research](./cycles/c-0005.md); [c-0006 live orphan-process forensics](./cycles/c-0006.md); [c-0007 worktree experiment, ship-with-squadron specification, and Copilot vocabulary extraction](./cycles/c-0007.md)
- Links: parent-of n-0001, n-0002, n-0003, n-0004, n-0005, n-0006, n-0007, n-0010; refined-by n-0011, n-0012
- First seen: c-0001
- Former node id: none
- Reinterpreted: c-0030 (intact)
- Promotion key: maestro-graphical-agent-orchestrator/n-0000
- Tracker: Branch - [Issue #1](https://github.com/jdylanmc/maestro/issues/1), synced c-0019
- Divergence: **The c-0029 divergence is resolved.** Issue #1 was reconciled through `/discovery` and now states the observability-plugin destination, the `events.jsonl` join, the fail-open rule, the custom-sidebar surface, and the c-0025 route cancellation. Two new divergences replace it, both opened in c-0030: (1) the anchor's `Not yet specified` section asserts that "`subagent.started` and `subagent.completed` are emitted together at completion, so the tree cannot currently show work in flight" - a claim corrected during c-0030's invocation, where recorded spans of 31-44 s were measured against agents demonstrably running 254 s+, making the mechanism deferred batched writes with write-time timestamps rather than completion-gating; (2) the anchor's Notes and Out-of-scope sections reference `proto-v1/`, which moved to `archive/proto-v1/` in commit `59a785a`. Reconciliation belongs to `/discovery`; this loop runs no tracker command.
- History: c-0001 created from Issue #1 and grounded in the existing cross-prototype contract; c-0001 settled the proving slice and sequencing; c-0003 validated the Electron runtime/state boundary probe; c-0004 deferred real Electron installation and window validation; c-0005 confirmed Electron as the first route, established that no Agent process may outlive the application after an observed orphan defect in the v1.1 WezTerm build, set a ceiling of 8 concurrent Sessions with in-panel resource metering and active admission control, captured a three-column wireframe with global Session-scoped selection, confirmed the 1:1 Session/Primary Agent binding against firstmate's lock model, and retired the military vocabulary in favour of plain literal nouns; maturity lowered one level to researched because the form of the destination proved less settled than the tree recorded, the user having floated neovim, the GitHub app, tmux, and a Visual Studio Code extension within one cycle; c-0006 corrected c-0005's erroneous retraction of the orphan defect by observing the running system rather than the repository source, identifying a detached `herdr server` daemon that kept Sessions and Model Context Protocol servers alive for two days past application exit while macOS attributed their permission prompts to Maestro through inherited responsibility, and hardened lifecycle ownership into seven verifiable non-functional requirements; c-0007 reconciled the vocabulary against the Copilot runtime and renamed the structural unit to Fleet, released `Session` and `Agent` to their runtime meanings, retired `Workspace` as triple-booked, respelled `subagent`, adopted `Task`, settled lifecycle onto two independent axes, made worktree-per-Fleet the strong default with branch-per-Fleet as a verified consequence, chose a fully generic display model over orchestration-specific awareness, and bound a primary agent window 1:1 to each Fleet; c-0008 confirmed the vocabulary through `/domain-mapping`, which published `CONTEXT.md` and the first Architecture Decision Record and corrected two definitions, resolved the in-app editing contradiction in favour of read-only viewers, settled that closing the application auto-Parks every Fleet behind an acknowledged summary, and moved the tracker to `remote`, reconciling the map, five issues, two titles, and the missing v3/v4 dependency edges that had left prototypes unblocked ahead of their own research; c-0009 ran the first approved prototype and cleared the node's last blocker, confirming in Electron's real lifecycle that a supervisor can hold three Fleets as three process groups and reach zero survivors on quit, while falsifying the c-0006 requirement to spawn non-detached - a non-detached child is not a process-group leader and cannot be signalled as a group at all, so detachment paired with durable process-group ownership and a reap-on-launch step is the only strategy measured to work; **c-0010 was omitted from this history when it was published and is recorded here in c-0011**: it delegated four read-only research agents, then falsified two of their consequential claims by direct measurement - `parentId` is a linear event-chain pointer, not a parent-agent link, so the reported depth of 16 was an artifact and the real maximum depth is 2 with fan-out dominating, and `inbox_entries` holds 27 rows across all 674 local databases rather than the 0 a sampled scan reported, though every sender is a subagent reporting to its owning session so the conclusion that no peer channel exists survived - and it closed isolation on both axes, the user confirming that Fleets get no sibling awareness at all and, unprompted, that Fleets are isolated to worktrees, which reversed the c-0007 "strong default" and the c-0007 requirement that a Fleet must know it is not alone; c-0011 decomposed this node, which had held every open question in a single-node tree for eleven cycles, into seven children, and settled the shape of the work: all four routes are driven to a **complete** MVP rather than reduced to feasibility probes, executed strictly one at a time in evidence order rather than version order - v2 Electron first because it alone carries measured evidence, then v1.1 WezTerm, v3 Tauri/Rust, and v4 native macOS Swift - each producing a per-stack executive report, with a stack that cannot build the app **rejected** rather than treated as a failure, and a terminal comparative evaluation consuming the four reports; the acceptance slice unresolved since c-0001 was settled as one scripted six-step flow identical across routes, and the 8-Fleet ceiling was accepted as a known unknown with a stated trigger because no target monorepo exists to measure against; c-0012 ran two approved prototypes and retired every empirical unknown that had been carried since c-0009: packaging preserves the supervision property measured in a development run, with the packaged application itself reparented to `launchd` and that reparenting proved harmless because the application owns and reaps its groups, and the Attention predicate was observed firing for the first time anywhere in this project - a sustained unmatched `permission.requested` on a genuinely blocked live Session, joined by `data.requestId` - while two assumptions failed: a live Copilot Session does **not** tear down on `SIGTERM` like the synthetic trees c-0009 measured, stalling at five survivors until `SIGKILL` escalation, and a Session driven non-interactively can never surface Attention at all, which turned the integration mode into new blocking fog (n-0008) alongside the acceptance harness the verification seam now requires (n-0009); c-0013 settled the seam by probing it - ACP is adopted, it resumes sessions with history and streams tool-call status, and it neither asks permission nor accepts a session name, so Attention became mode-dependent rather than universal and the runtime-naming requirement narrowed to binding by `sessionId` with a Maestro-owned display name; c-0017 did not select this node and changed neither of its axes, but changed its **role**: with n-0003 and n-0009 both reaching fog `cleared` and maturity `promotion-ready`, this node's own maturity of `researched` became the binding constraint on publishing any MVP work at all, because the branch gate admits no exception for a branch below the promotion values. It has been the quiet consequence of the c-0011 decomposition ever since - every question moved down to a child, and no cycle since has re-matured the parent they were moved out of; c-0019 selected it by user redirect - the deterministic rule reached n-0008 for the third consecutive cycle - and **cleared it without asking a question about it**, because it held none: the reconciliation of Issue #1 completed immediately before the cycle met the one condition its own text named, and every other question had moved to a child in c-0011. It reached fog `cleared` and maturity `promotion-ready` and was **promoted as the Branch**, updating [Issue #1](https://github.com/jdylanmc/maestro/issues/1) with its promotion key and taking [#29](https://github.com/jdylanmc/maestro/issues/29) and [#30](https://github.com/jdylanmc/maestro/issues/30) as native sub-issues. The c-0018 suspicion that its blocking role was self-inflicted is confirmed: tree parentage had been read as promotion shape, and n-0001 and n-0002 were always foldable into Story context rather than gates
### n-0001 - MVP acceptance slice and per-route deliverables

- Parent: n-0000
- Fog: invalidated
- Maturity: promotion-ready
- Priority: P0
- Retired: c-0030 - MVP acceptance slice and per-route deliverables - **retired in c-0030.** Its outcome is one scripted flow "identical across all four routes" plus a per-route executive report. Issue #1 now states outright that the four-route comparison was cancelled in c-0025, so the outcome has no referent. The slice's confirmed requirements survive in `requirements.md`; only the multi-route framing is dead.
- Outcome: One scripted end-to-end flow, identical across all four routes, that defines "complete" and supplies the comparative evaluation's rubric: create two named Fleets, each in its own enforced Worktree and branch; present each Fleet's primary agent window bound 1:1; prompt Fleet A so it delegates at least one subagent and the tree renders live with correct parentage; select Fleet B and observe every panel re-scope; drive Fleet A into a permission request and observe Attention surface on that Fleet; quit through the pre-close summary, auto-Parking both Fleets with zero surviving processes; relaunch and find both Fleets with identity, history, Worktree, and recomputed Liveness intact, resuming Fleet A's Session by name. Each route additionally produces an executive report of that stack's pros and cons, and a stack that cannot build the app is **rejected** rather than counted as a failure.
- Open questions: **None blocking.** The executive-report comparability question - open since c-0011 and never put to the user - was **settled in c-0019**: reports use a fixed five-section template, every claim a harness measurement rather than an assessment, so that n-0007 consumes the four reports instead of re-deriving the comparison from prose. The user attached a second purpose the loop had not proposed: the report must also re-orient a reader who has lost context, which added a lead **Recap** section ahead of the four rubric sections. The remaining question - whether executing the slice reveals a step that is unimplementable rather than merely hard - stays an **accepted unknown by construction**, since running the slice is what answers it; gate condition 8 admits an accepted unknown with its risk recorded. *Risk:* a slice step could prove unimplementable on a route and force a choice between changing the slice and rejecting the route. *Trigger:* the first route to reach a step it cannot execute.
- Evidence: [c-0011](./cycles/c-0011.md); [Issue #18](https://github.com/jdylanmc/maestro/issues/18); every step restates a requirement already confirmed in c-0005 through c-0010
- Links: blocks n-0003, n-0004, n-0005, n-0006; informs n-0007; parent-of n-0009
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0030 (invalidated)
- Promotion key: none
- Tracker: none - relates to [Issue #18](https://github.com/jdylanmc/maestro/issues/18)
- Divergence: none
- History: c-0030 retired it under reinterpretation rule 1. It had been left at fog `cleared` when c-0025 retired the four routes around it, and the anchor reconciliation made the contradiction explicit; c-0011 created by decomposition and settled in the same cycle. The slice had been carried as an unresolved requirement since c-0001 in superseded vocabulary; the user's answer replaced it and added two things the loop did not propose - the per-stack executive report as a first-class deliverable, and rejection as a legitimate terminal verdict for a route; c-0012 settled the slice's verification seam as a single route-agnostic Acceptance Harness asserting external ground truth, spun that harness out as n-0009, and measured two of the slice's steps for the first time - step 5's Attention predicate fired and cleared on a live Session, and step 6's zero-survivor teardown held under packaging; c-0017 left both axes unchanged and identified this node as one of the two branch nodes now blocking promotion, separating its two open questions by kind - one is an accepted unknown by construction, the other is a live product decision about executive-report comparability that no cycle has yet put to the user; c-0019 settled its one product-owned question and advanced both axes to fog `cleared` and maturity `promotion-ready`. It was **not promoted**: the promotion gate names only the branch node and the leaves selected for promotion, and folds deeper conceptual nodes into branch or story context. This node is the acceptance-slice specification, so its content became the acceptance criteria of [#29](https://github.com/jdylanmc/maestro/issues/29) and [#30](https://github.com/jdylanmc/maestro/issues/30) rather than a work item of its own. Its maturity had been recorded across c-0017 and c-0018 as a gate on promoting n-0009; that reading was wrong, and c-0019 corrected it
### n-0002 - Copilot provider integration contract

- Parent: n-0000
- Fog: researched
- Maturity: decision-ready
- Priority: P0
- Outcome: The provider-side facts every route inherits unchanged, so each route implements a presentation of the same contract rather than rediscovering it. Established: the subagent tree is reconstructed by joining `subagent.started.data.toolCallId` to the `agentId` on the spawning agent's own `tool.*` event, never through `parentId`; `agentId` is reliable identity; the tree is arbitrary-depth but must be optimised for fan-out; Sessions are named with `-n, --name` and resumed by name; `inbox_entries` is the subagent-to-owning-session channel and out of scope. **Added in c-0012 by measurement:** Attention is an unmatched `permission.requested` joined to `permission.completed` by `data.requestId`, and `data.result.kind` discriminates the outcome; events are read from `events.jsonl`, never from `session.db`, which holds only `inbox_entries`, `todos`, and `todo_deps`; a live Session's teardown requires `SIGKILL` escalation because `SIGTERM` alone leaves survivors; and `copilot` self-assigns its own process group even when spawned without a detach flag.
- Open questions: Which processes survive `SIGTERM` and why - only the count was captured, not the identity, so the c-0006 pattern of wrapper processes exiting after their children is inferred rather than shown. Does `subagent.started` reach an **SDK** client as a typed event, or only through `events.jsonl`? **Restated in c-0018: this question was still phrased against ACP, a seam c-0014 superseded, and was duplicated in its SDK form on n-0008 and in its ACP form in `requirements.md`.** One question, three recordings, two of them stale. It is now held solely by n-0008, which owns the seam; this node retains only the `SIGTERM` survivor-identity question. It bears on acceptance-slice step 3.
- Evidence: [c-0010](./cycles/c-0010.md) measurement of 41,928 events and 132 subagents in one Session and a full scan of all 674 local session databases; [c-0009](./cycles/c-0009.md) supervisor teardown prototype; [Issue #2](https://github.com/jdylanmc/maestro/issues/2); [Issue #11](https://github.com/jdylanmc/maestro/issues/11); [Issue #9](https://github.com/jdylanmc/maestro/issues/9)
- Links: blocks n-0003; parent-of n-0008
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0020 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #2](https://github.com/jdylanmc/maestro/issues/2), [Issue #11](https://github.com/jdylanmc/maestro/issues/11)
- Divergence: none
- History: c-0011 extracted the provider-level findings of c-0009 and c-0010 into their own node, because they are inherited identically by all four routes and were being re-read out of the root's prose each cycle. Enters at maturity `researched` on c-0010's measured evidence, with two genuinely empirical questions outstanding, both of which can only be answered against a live Session; c-0012 answered both against live Sessions under an approved prototype, advancing fog to `researched` and maturity to `decision-ready` - the predicate fired and cleared, and teardown falsified the assumption that a live Session behaves like a synthetic tree - and spun the newly exposed integration-mode question out as n-0008 rather than absorbing it back into this node; c-0018 removed a stale duplicate question phrased against ACP and left this node holding exactly one open item, the identity of the five `SIGTERM` survivors, which is the only genuinely empirical question in the session that nothing else is waiting on

### n-0003 - v2 Electron MVP

- Parent: n-0000
- Fog: invalidated
- Maturity: promotion-ready
- Priority: P0
- Retired: c-0025 - v2 Electron MVP - **retired in c-0025.** Built and promoted; the application it was a route to will not be shipped. Its executive report stands as evidence.
- Outcome: The first route driven to a complete MVP, executing n-0001's acceptance slice end to end and producing its executive report. Chosen to lead on evidence rather than version order: it is the only route carrying measured results.
- Open questions: **Both prior questions are answered.** Packaging preserves supervision (c-0012, measured), and the real `BrowserWindow` seam was already exercised in c-0009. n-0008 was settled in c-0013, so one blocker is gone; the Acceptance Harness (n-0009) is the last one it cannot clear itself. **The signed-and-notarized question was retired in c-0016 by scoping it out**: the MVP ships an unsigned, fuse-enabled `.app`, so this node now holds **no open question of its own** and is gated solely on n-0009. **n-0009 cleared in c-0017, so this node has no remaining gate**: it passes all eleven leaf conditions, with the Acceptance Harness as its verification seam and a `feasible-with-constraint` disposition - the constraint being that a build manipulating Electron fuses must re-sign afterwards. What blocks it now is not its own state but its **branch**: n-0000, whose maturity c-0018 corrected upward to `decision-ready` after finding the `researched` value was a twelve-cycle-old artifact rather than a judgment. **c-0018 also confirmed this route runs first and alone**: both it and n-0004 are committed, but strictly one at a time, so the shared Acceptance Harness is validated against one route before it is asked to judge a second.
- Evidence: [c-0003](./cycles/c-0003.md) runtime/state boundary probe; [c-0004](./cycles/c-0004.md) deferral of real installation; [c-0005](./cycles/c-0005.md) confirmation of Electron as the first route; [c-0009](./cycles/c-0009.md) prototype reaching zero survivors across three process groups on quit; [c-0012](./cycles/c-0012.md) packaged `.app` measured at zero survivors on graceful quit, nine survivors on Force Quit without a reaper, and zero after reap-on-launch; [Issue #4](https://github.com/jdylanmc/maestro/issues/4)
- Links: depends-on n-0001, n-0002, n-0009; blocks n-0004, n-0007; informed-by n-0008 (settled c-0013; the stale reciprocal `blocks` edge on n-0008 was corrected in c-0016)
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0020 (intact)
- Promotion key: maestro-graphical-agent-orchestrator/n-0003
- Tracker: Story - [Issue #29](https://github.com/jdylanmc/maestro/issues/29), synced c-0019
- Divergence: none
- History: c-0011 created by decomposition, inheriting the Electron evidence accumulated across c-0003, c-0004, c-0005, and c-0009, and placed first in the sequence. Its maturity is load-bearing for the whole sequence: because it enters at `researched`, the P1 nodes that depend on it generate no priority debt, and if it is ever weakened below that floor the loop is required to stop deepening n-0004 and n-0007 until it recovers; c-0012 selected it under rule 3, retired both of its open questions by measurement, and advanced it through fog `researched` to `decision-ready` with maturity `decision-ready` - but it did **not** reach promotion, because clearing its fog exposed two new blockers it does not own, and because the `Attention` vocabulary its step-5 Story is written in was still a `candidate` term with a pending domain handoff; c-0016 discharged that handoff - `Attention` is confirmed in `CONTEXT.md` - and retired this node's last open question by scoping signing out of the MVP, leaving n-0009 as its only gate; c-0017 cleared n-0009, which advanced this node to fog `cleared` and maturity `promotion-ready` without the node itself being selected - the advance is a consequence of its last blocker clearing, not of new work on it. It is now a passing promotion candidate held back solely by its branch, which is the first time in this session that the constraint on shipping has sat **above** a route node rather than inside one; c-0019 **promoted it** as a Story beneath n-0000 with no change to its own understanding - the branch cleared, not the leaf. Published as [#29](https://github.com/jdylanmc/maestro/issues/29), labelled `discovery:prototype`, `proto-v2.0`, and `ready-for-agent`, blocked by [#30](https://github.com/jdylanmc/maestro/issues/30). Its title matches the shape already used by #23, #24, and #27; v2 was the only route whose build issue had never been created
### n-0004 - v1.1 WezTerm MVP

- Parent: n-0000
- Fog: invalidated
- Maturity: framed
- Priority: P1
- Retired: c-0025 - v1.1 WezTerm MVP - **retired in c-0025.** An alternative Host Application; cmux is settled.
- Outcome: The second route driven to a complete MVP against the same acceptance slice, with its own executive report. **Committed unconditionally in c-0018** - *"You can build Electron and WezTerm variants now"* - so it is no longer a route whose scope depends on how the Electron route turns out. It remains **sequenced after** n-0003 rather than concurrent with it, because the Acceptance Harness is shared and unbuilt, and building it against two routes at once would let it be shaped by whichever route is easier to instrument, which is the exact bias the State Oracle exists to prevent.
- Open questions: Can a WezTerm-hosted route satisfy the process-ownership requirement at all? v1.0's detached `herdr server` daemon is the original violation, so this route starts holding the defect that produced the requirement. Does `proto-v1/` shorten the distance to completion, or does it carry the architecture that has to be abandoned? **And the one that is newly answerable:** what is this route's *measured* Presentation Check ceiling? The ~40-50% figure and the missing macOS accessibility tree come from c-0016 **delegated research**, which is untrusted-evidence class, and they feed a fixed rubric criterion for a route now committed to completion. c-0018 obtained standing permission to measure it directly - *"I do not use WezTerm actively on this computer so you may experiment with it's capabilities"* - so the ceiling can be moved from research to measurement under a prototype gate.
- Evidence: [c-0006](./cycles/c-0006.md) live orphan-process forensics; `proto-v1/` preserved v1.0 implementation; [Issue #26](https://github.com/jdylanmc/maestro/issues/26); [Issue #27](https://github.com/jdylanmc/maestro/issues/27); [Issue #28](https://github.com/jdylanmc/maestro/issues/28)
- Links: depends-on n-0003, n-0008, n-0009; blocks n-0005, n-0007
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0020 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #27](https://github.com/jdylanmc/maestro/issues/27)
- Divergence: none
- History: c-0011 created by decomposition and sequenced second; c-0012 added the two provider-level blockers n-0008 and n-0009 that every route inherits, which put this node into priority debt against both; c-0013 debt cleared (n-0008 reached researched); the n-0009 row remains open; c-0015 debt cleared (n-0009 reached researched) - this node now carries no priority debt; c-0018 committed it unconditionally alongside n-0003 while keeping the one-at-a-time sequencing, advanced it to fog `investigating` and maturity `framed` on the strength of having a bounded outcome and named exclusions rather than new evidence, and recorded that its automation ceiling - the single input it contributes to a fixed rubric criterion - has never been measured, only researched, and that permission to measure it now exists

### n-0005 - v3 Tauri/Rust feasibility probe

- Parent: n-0000
- Fog: invalidated
- Maturity: framed
- Priority: P1
- Retired: c-0025 - v3 Tauri/Rust feasibility probe - **retired in c-0025.**
- Outcome: **Reduced in c-0018 from a complete MVP to a bounded feasibility probe**, under a `delegated-to-loop` disposition after the user committed n-0003 and n-0004 and handed this route back to the loop. The probe answers one decisive question and still produces an executive report, which c-0011 requires of every route including a rejected one. **The decisive question: does the WebdriverIO embedded-WebDriver path actually drive a packaged Tauri `.app` on macOS, and does the official Rust SDK binding remove the Node sidecar?** Research established both halves of why this is the right question. Playwright is out entirely on macOS - `WKWebView` exposes no Chrome DevTools Protocol - and Tauri's own documentation states that driving `tauri-driver` directly supports only Windows and Linux. The working path, `@wdio/tauri-service`, embeds a W3C WebDriver server **inside the application binary**, so this route must modify the product to make it testable, which no other route does. Offsetting that, GitHub publishes an **official Rust SDK** binding for Copilot, so a Tauri route can consume the seam natively with no Node sidecar - an advantage no cycle had counted.
- Open questions: The decisive question above. Everything beyond it is deliberately out of the probe's scope.
- Evidence: [c-0018](./cycles/c-0018.md) delegated research on macOS user-interface automation and Copilot SDK language bindings; [Issue #23](https://github.com/jdylanmc/maestro/issues/23)
- Links: depends-on n-0004, n-0008, n-0009; blocks n-0006, n-0007
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0020 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #23](https://github.com/jdylanmc/maestro/issues/23)
- Divergence: none
- History: c-0011 created by decomposition and sequenced third; c-0012 added the inherited blockers n-0008 and n-0009; c-0013 debt cleared (n-0008 reached researched); the n-0009 row remains open; c-0015 debt cleared (n-0009 reached researched) - this node now carries no priority debt; c-0018 reduced it from a complete MVP to a bounded feasibility probe under delegation, and replaced "Open questions: Everything" with one decisive question derived from research. This is the reduction the loop recommended in c-0011 and was overruled on; what changed is that it is now grounded in per-route facts rather than in a general cost argument, and the user split the decision by route rather than accepting or rejecting it wholesale

### n-0006 - v4 native macOS Swift feasibility probe

- Parent: n-0000
- Fog: invalidated
- Maturity: framed
- Priority: P1
- Retired: c-0025 - v4 native macOS Swift feasibility probe - **retired in c-0025.**
- Outcome: **Reduced in c-0018 from a complete MVP to a bounded feasibility probe**, under the same `delegated-to-loop` disposition as n-0005, and still producing an executive report. **The decisive question: what does the Copilot seam cost from Swift, given there is no Swift SDK?** Research established the asymmetry that makes this route unlike the other three. Its verification story is the **best** of the four - `XCUITest` is Apple's first-class framework and `XCUIApplication` drives an already-packaged `.app` by bundle identifier or file URL, with no test target compiled into the product, which is the exact opposite of what Tauri requires. But GitHub publishes official Copilot SDK bindings for TypeScript, Python, Go, Rust, Java, and .NET, and **none for Swift**, so this route must spawn a Node or Rust sidecar and speak JSON-RPC, or hand-roll the wire protocol against no published specification. Known macOS costs on the verification side: the test runner needs Accessibility permission, an active graphical session, and there is no per-run sandbox reset.
- Open questions: The decisive question above. Everything beyond it is deliberately out of the probe's scope.
- Evidence: [c-0018](./cycles/c-0018.md) delegated research on macOS user-interface automation and Copilot SDK language bindings; [Issue #24](https://github.com/jdylanmc/maestro/issues/24)
- Links: depends-on n-0005, n-0008, n-0009; blocks n-0007
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0020 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #24](https://github.com/jdylanmc/maestro/issues/24)
- Divergence: none
- History: c-0011 created by decomposition and sequenced fourth; c-0012 added the inherited blockers n-0008 and n-0009; c-0013 debt cleared (n-0008 reached researched); the n-0009 row remains open; c-0015 debt cleared (n-0009 reached researched) - this node now carries no priority debt; c-0018 reduced it to a bounded feasibility probe under delegation and gave it one decisive question. The research that produced it also inverted the assumption behind this route's low ranking: it has the strongest verification story of the four and the weakest provider-integration story, which is the opposite shape from the terminal route and is exactly the kind of tradeoff n-0007 exists to weigh

### n-0007 - Comparative technology evaluation

- Parent: n-0000
- Fog: invalidated
- Maturity: vague
- Priority: P1
- Retired: c-0025 - Comparative technology evaluation - **cancelled in c-0025**, not deferred. It consumes one executive report per register row to select a stack; the stack is selected and the remaining reports will never be written.
- Outcome: The terminal deliverable: an analysis selecting which stack is best suited to this problem, consuming **one per-route executive report per row of the route register in `requirements.md`** rather than re-deriving the comparison. A rejected stack is an input to this evaluation, not an absence from it - the reason a stack could not build the app is itself a finding. **The literal count was removed in c-0023** after being wrong in three consecutive cycles: four (c-0011), corrected to five (c-0022), superseded to six (c-0023) when Zellij was added. The register is now the only place a route count exists. Two axes recorded in c-0022 also bear directly on this node: the seam is a property of the **route class** - terminal-hosted routes use the Copilot CLI, application routes use the SDK - so "SDK language-binding cost" applies to only three rows; and each route implements the contract in **its host's idiom**, which means the evaluation compares what the design *becomes* on each stack rather than how faithfully each stack reproduces one design. The Acceptance Slice and the fixed five-section report shape are unchanged, and are what keep the comparison like-for-like under that principle.
- Open questions: **Partly answered in c-0015.** The user fixed one criterion before any route shipped - **user-interface automation capability** - on the stated reasoning that automated regression checks are the work that follows the MVP. The remaining question is what else the rubric holds and how the criteria weigh against each other. Recorded honestly: this criterion is **not neutral** between the routes. A component-driven web stack reaches Storybook and Playwright directly, Swift uses XCUITest, and a terminal surface exposes very little to any of them - so naming it predicts part of the ranking. **One clause of that reasoning was falsified in c-0018:** "Tauri reaches Playwright through WebDriver" is wrong on macOS. Playwright cannot drive `WKWebView` at all, and Tauri's own documentation excludes macOS from `tauri-driver`; the working path embeds a WebDriver server inside the application binary. The criterion's *shape* survives - the routes still separate on automation reach - but the predicted ordering shifts, because Swift turns out to have the strongest automation story of the four rather than a middling one. That is a legitimate product decision, recorded as one rather than presented as a neutral measurement.
- Evidence: [c-0015](./cycles/c-0015.md) fixed the user-interface-automation criterion and made each route's automation reach the evidence for it; [c-0011](./cycles/c-0011.md)
- Links: depends-on n-0003, n-0004, n-0005, n-0006; informed-by n-0001, n-0009
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0020 (intact)
- Promotion key: none
- Tracker: none
- Divergence: none
- History: c-0018 falsified one clause of the criterion's supporting reasoning and inverted part of the ranking it implied - Swift's `XCUITest` story is the strongest of the four, and Tauri's is materially worse than recorded, requiring the product under test to be modified to be testable. It also learned that Copilot SDK language bindings differ per route, which is a second, previously uncounted axis the rubric must weigh: Rust has an official binding and Swift has none. c-0015 fixed its first rubric criterion before any route shipped, and tied it to measurement rather than assessment: how far each route automates the Presentation Check **is** the evidence. c-0011 created by decomposition. It exists as a node rather than as a closing step because the user named it a first-class deliverable - "then do an analysis and evaluation on which technology is best to solve this problem" - and because its rubric question has to be settled before the routes finish, not after

### n-0008 - Copilot integration mode

- Parent: n-0002
- Fog: cleared
- Maturity: decision-ready
- Priority: P0
- Outcome: **Settled in c-0014: the Copilot SDK is the seam, reversing c-0013's choice of ACP.** A route drives a Fleet through `CopilotClient` from `copilot-sdk`, shipped inside the platform package: `start()`, `createSession(config)`, `sendAndWait`, `resumeSession(sessionId)`, `listSessions()`. Permissions are first-class - `onPermissionRequest` delivers an answerable callback, and omitting it leaves requests pending for `permissions.pendingRequests()`, whose documented return is exactly the c-0010 Attention predicate. `setApproveAll` expresses the user's usual broad-permission posture as a toggle rather than an architecture. **Narrowed in c-0016:** the current documentation reads "**Reconstructs** the set of pending tool permission requests **from the session's event history**", so Attention *is* a reconstruction - the runtime simply performs it. Maestro need not implement it; that is the defensible claim, and it is narrower than the one c-0014 recorded. **A route must also pin the SDK version**, because the permission surface changed shape three times across observed versions. ACP remains a working fallback, and what it lost on was measured: no permission surfacing, no session naming. Maestro still builds **no** permission-mediation layer; it consumes the runtime's. Original framing: c-0012 proved the choice is not free: a Session driven with `-p` completes every permission request instantly as `denied-no-approval-rule-and-could-not-request-from-user`, so it **can never surface Attention** and acceptance-slice step 5 is unreachable through it. The candidate is `copilot --acp`, the Agent Client Protocol server the binary already exposes; the fallback is driving the terminal user interface through a pseudo-terminal, which c-0012 found fragile enough to need four attempts before it accepted input.
- Open questions: **One remains, and it is an accepted unknown.** **Accepted unknown (c-0014, unchanged):** the SDK permission callback has never been observed firing - the probe reached `createSession` and was stopped by an exhausted monthly quota before a single model turn. *Risk:* the seam decision, and acceptance-slice step 5 with it, rests on declarations shipped with the binary rather than on behaviour - the same evidence class that produced the c-0006 spawn requirement that measurement later falsified. *Trigger:* the next quota reset, or any earlier chance to run one model turn. **The other two were answered in c-0020 by free reads, and their prototype classification was wrong.** c-0019 recorded the session-rename question as needing "an `npm install` in an isolation path, **not** a free read"; in fact the SDK ships on disk at `~/.copilot/pkg/darwin-arm64/<version>/copilot-sdk` in five installed versions, typings included, so both were repository-fact class all along. **Session rename: there is no rename API** - `SessionConfig` carries no name field - but it does expose `sessionId?: string`, "Optional custom session ID. If not provided, the server generates one", so the client may *choose* the id rather than merely learn it; and `session.title_changed` exists as a typed runtime event carrying "The new display title for the session". This does not reopen the c-0013/c-0014 decision to bind by `sessionId` with a Maestro-owned display name - it **strengthens** it. **`subagent.started` reaches an SDK client as a typed event**, alongside `subagent.completed`, `subagent.failed`, `subagent.selected`, and `subagent.deselected`, and `generated/rpc.d.ts` documents an `EventsAgentScope` filter whose `'primary'` value returns "main-agent events plus events whose type starts with 'subagent.'". The State Oracle therefore does not have to parse `events.jsonl` to see the tree.
- Evidence: [c-0020](./cycles/c-0020.md) read-only SDK typings survey across five installed versions plus 36,517 real events measured across two sessions - typed `subagent.*` events, the `EventsAgentScope` `'primary'` filter, `parentId` documented verbatim as a chronological chain pointer, `SubagentStartedData.toolCallId` as the true parent edge, caller-suppliable `SessionConfig.sessionId`, and all four load-bearing surfaces identically shaped across 1.0.80 through 1.0.81-5; [c-0014](./cycles/c-0014.md) SDK probe - `copilot-sdk` typings shipped inside the platform package, `onPermissionRequest`, `permissions.pendingRequests()` documenting the Attention predicate verbatim, `setApproveAll`, and a live `createSession`; [orbit-arch.md](../../../../v2/docs/reference/orbit-arch.md) independently implements the same permission loop in an Electron application; [c-0013](./cycles/c-0013.md) full ACP probe - protocol handshake, streaming vocabulary, zero permission events across two capability declarations, `session/list` over 50 sessions, and `session/load` resuming with real history; [c-0012](./cycles/c-0012.md) non-interactive auto-denial measured in session `0e840075`, live interactive firing in `225cda11` and `c8f382bc`, and four failed pseudo-terminal driving attempts; `copilot --help` (`--acp`, "Start as Agent Client Protocol server")
- Links: depends-on n-0002; blocks n-0004, n-0005, n-0006; informs n-0003
- First seen: c-0012
- Former node id: none
- Reinterpreted: c-0020 (intact)
- Promotion key: none
- Tracker: none
- Divergence: none
- History: c-0012 created it as new fog exposed by measurement rather than by reasoning. It is provider-level, so every route inherits the answer, which is why it blocks all four rather than only Electron; c-0013 selected it under rule 2 - the first time priority debt has ever driven selection - probed ACP directly, and settled the seam. The probe found ACP superior on every structural axis and silent on exactly two: it never asks permission, and it will not name a session. The loop recommended building a Maestro-owned permission boundary; the user delegated the decision and disclosed that they run with broad permissions, which retired the recommendation rather than confirming it - a mediation layer would have serviced a gate the target workflow rarely reaches. Attention is instead derived from what the seam provides, with ACP permission surfacing recorded as an upstream dependency carrying a re-test trigger on every CLI upgrade; c-0014 **weakened this node one cycle later** when answering a user question about firstmate surfaced `orbit-arch.md`, which documents a third seam c-0013 never probed - the SDK - and the re-probe found permissions first-class there, so the seam decision reversed to the SDK, acceptance-slice step 5 reverted to the wording the user had actually confirmed, and what c-0013 had recorded as an upstream gap turned out to be a surface the loop simply had not looked at; c-0020 selected it under rule 3 for the fourth consecutive cycle and **cleared it without a prototype and without spending a question on it**, by discovering that two of its three open questions were misclassified. The SDK ships on disk in five versions, so what c-0019 recorded as needing an `npm install` was a free read. Both were answered from first-party typings, and the vendor's own documentation corroborated c-0010's `parentId` finding verbatim - the first time an inference this session made about the runtime has been confirmed by the runtime's own published types rather than only by our measurement. It also supplied the **version bound ADR 0002 has lacked for three cycles**: the four load-bearing surfaces are identically shaped across 1.0.80 through 1.0.81-5, which is the evidence that discharges it, though the ADR edit itself remains `/domain-mapping`'s to make. What is left is exactly one accepted unknown, still quota-gated

### n-0009 - Route-agnostic Acceptance Harness

- Parent: n-0001
- Fog: invalidated
- Maturity: promotion-ready
- Priority: P0
- Retired: c-0030 - Route-agnostic Acceptance Harness - **retired in c-0030.** It judges routes against n-0001's slice, and the routes are cancelled. Its `harness/` implementation was moved to `archive/harness/` in commit `59a785a`. Under fog transition rule 4 it **keeps** its tracker link, tier, and promotion key; the loop does not unpublish [Issue #30](https://github.com/jdylanmc/maestro/issues/30). The paired-falsification discipline it established survives as a method and is cited by later cycles.
- Outcome: **Settled in c-0015 as two layers.** The **State Oracle** asserts slice steps 1 through 6 from `git worktree list`, `git branch`, `ps` by recorded process group, `~/.copilot/session-state/<id>/events.jsonl`, and the SDK's `listSessions()`, `resumeSession()`, and `permissions.pendingRequests()`. It requires no cooperation from the route under test, so no stack is advantaged by being easy to instrument and no route can assert its own success - and it can be written before any route exists, which is what unblocks n-0003. The **Presentation Check** covers what only appears on screen and is automated as far as each stack allows, beginning with Playwright against Electron. **Pass or fail never depends on automation reach**; a route checked only by the operator still passes if it behaves correctly. What changes is the executive report, which must state the manual residue explicitly, because that residue is evidence for n-0007's user-interface-automation criterion. **c-0016 gave the Presentation Check a measured automation path**: step 4 - the only slice step with no external ground truth, and therefore the step that decided whether this layer was viable at all - was asserted successfully against a packaged Electron `.app` using `Promise.all` over auto-retrying `expect(locator)` calls, 3/3 passing. It also fixed the harness's own honesty rule: **every Presentation Check assertion is paired with a negative control**, because an auto-retrying assertion that passes is indistinguishable from one that never tested anything. Storybook is excluded - it renders one component with mocked props and structurally cannot express cross-panel re-scoping. The WezTerm end is bounded rather than solved: roughly **40-50%** is automatable through `wezterm cli list`, `get-text`, and `list-clients`, and WezTerm exposes **no macOS accessibility tree at all**, which closes XCTest, Appium, and AppleScript together. **c-0017 settled the harness's own verification seam, which is the question a verification apparatus is easiest to leave circular: the harness runs a paired-falsification suite against itself, first, on every run.** Every assertion in both layers ships with a fixture it must **fail** on; the negative suite executes before the route suite; and if any negative case passes, the harness declares **itself** broken and refuses to report on the route at all. Granularity is **per assertion, not per slice step**, because the failure c-0016 caught was at assertion granularity - a step can pass with four assertions of which three are vacuous. This generalises the one control c-0016 actually measured rather than inventing a mechanism, and it is what makes a harness that silently stops asserting distinguishable from a passing one.
- Open questions: **None blocking.** Playwright reaches step 4 on a packaged `.app` (measured, c-0016), and the WezTerm ceiling is bounded at roughly 40-50% with no accessibility-tree fallback (researched, c-0016). The vacuous-pass question was settled in c-0017 as the paired-falsification rule above, under a `delegated-to-loop` disposition after the user declined it as a non-product decision. The `enableNodeCliInspectArguments` question is **reclassified in c-0017 as an accepted unknown rather than a blocker**: the MVP ships fuse-*enabled* (c-0016), Playwright is measured 3/3 against exactly that build, and the fuse question only becomes live for a configuration the MVP has deferred. *Risk:* if the claim is false, the build decision is more conservative than it needs to be. *Trigger:* the first Electron route build that configures fuses at all.
- Evidence: [c-0020](./cycles/c-0020.md) **revalidated** the State Oracle's slice-step-3 construction - which c-0010 had already specified - against 36,517 previously unmeasured events in two fresh sessions: **85 subagents resolved, zero unresolved**, reproducing c-0010's max depth of 2 with fan-out dominating, and adding first-party documentary corroboration from the SDK typings for both the join and the `parentId` exclusion; [c-0016](./cycles/c-0016.md) prototype - step 4 asserted 3/3 against a packaged Electron `.app` with a passing negative control, `electronApp.evaluate()` reaching main-process state, plus delegated research bounding the WezTerm ceiling and excluding Storybook; [c-0015](./cycles/c-0015.md) settled the two-layer shape and the machine-first constraint; [c-0014](./cycles/c-0014.md) supplied the SDK queries the State Oracle asserts with; [c-0012](./cycles/c-0012.md) - both prototypes were trustworthy only because they measured external ground truth rather than asking the application under test
- Links: depends-on n-0001; blocks n-0003, n-0004, n-0005, n-0006
- First seen: c-0012
- Former node id: none
- Reinterpreted: c-0020 (intact)
- Promotion key: maestro-graphical-agent-orchestrator/n-0009
- Tracker: Story - [Issue #30](https://github.com/jdylanmc/maestro/issues/30), synced c-0019
- Divergence: none
- History: c-0012 created it from the Q4 verification-seam decision, taken under `delegated-to-loop` with the user absent, so it carried a revisit flag the other nodes did not; c-0015 selected it under rule 2, split it into a State Oracle and a Presentation Check, and advanced it to maturity `researched`, clearing the last three priority-debt rows. The user supplied two constraints that shaped it: user-interface automation is a **selection criterion** for the stack rather than a harness implementation detail, and **there are no human testers**, so a manual step is a stopgap of last resort whose survival is a cost recorded against the route. The revisit flag is discharged - the user has now engaged with this node's substance directly; c-0016 selected it under rule 3, retired both of its open questions - one by measurement and one by research - and advanced both axes one level to `decision-ready`. Its prototype also produced the cycle's sharpest lesson: it reported a confident causal finding about the `enableNodeCliInspectArguments` fuse that was **wrong**, because the fuse-disabled builds were killed by macOS for an invalid code signature and the failing tests looked exactly like the researched failure mode. Nothing inside the loop caught it; the user did, by mentioning an operating-system crash dialog. The node now carries the rule that a prototype asserting a negative result must establish *why* the negative happened; c-0017 selected it again under rule 3 - by user authorization rather than by the deterministic tie-break, which reached n-0008 - and **cleared it without measurement**. Two things did that. Its remaining empirical question was found not to gate the MVP at all and was demoted to an accepted unknown, and its missing gate condition turned out to be condition 9, a verification seam, which for a verification apparatus is circular unless stated: the paired-falsification suite is that seam. The node reaches fog `cleared` and maturity `promotion-ready` on a settled rule rather than on an observation, and that is recorded as a limitation rather than smoothed over - the harness has never been built, so the rule's first honest test is its own first run; c-0020 did not select it but de-risked its **step 3**. The construction was not new - c-0010 had specified it - so what changed is its evidence class: it now holds on two fresh sessions it was not derived from (85 subagents, zero unresolved), and the vendor's own typings independently document both the join and the reason `parentId` must not be used. The tree is also readable from typed SDK events rather than from raw log parsing, which is a genuinely new option. The user also settled that the tree must update **live** as helpers start, which makes the live path a thing the harness asserts rather than an optimization

### n-0010 - Fleet Recap

- Parent: n-0000
- Fog: invalidated
- Maturity: framed
- Priority: P1
- Retired: c-0029 - `Recap` was deprecated by the accepted [`ADR 0004`](../../../../docs/adr/0004-retire-fleet.md) because the Fleet referent dissolved and Maestro implements no Session Recap. A new Session-scoped capability may return as a new node if the product implements one.
- Outcome: Historical requirement for an account of what a Fleet was doing. No current Maestro capability implements it.
- Open questions: none in current scope.
- Evidence: [c-0019](./cycles/c-0019.md); [`ADR 0004`](../../../../docs/adr/0004-retire-fleet.md)
- Links: refines n-0000
- First seen: c-0019
- Former node id: none
- Reinterpreted: c-0029 (invalidated)
- Promotion key: none
- Tracker: none
- Divergence: none
- History: c-0019 created it from the Q2 answer. It exists because a question about executive-report comparability turned out to have a product requirement hiding inside it: the user's reason for wanting comparable reports was *"I may come back to a session and not remember what is going on and want a quick 'what were we doing and where are we at'"*, and the word `session` was ambiguous between the confirmed runtime term and the ordinary English sense. Q2 disambiguated rather than guessing, because the two readings had very different costs - binding it to the product would have re-opened n-0003 and n-0009, the only two promotion-ready leaves, for a capability that cannot separate four stacks. The user placed it at **P1**, "very desired" but not P0, matching the c-0016 disposition of desktop notifications. The concept was named `Orientation` by the user and renamed **`Recap`** by `/domain-mapping` in the same cycle, on evidence that `Orientation` was already triple-booked in this repository - the `## Scope and Orientation` heading in eight reference documents, the executive report's lead section, and this capability - which is the failure that retired `Workspace` in c-0007. `Orientation` survives as a discouraged alias; c-0020 narrowed its first open question without selecting it. The runtime's event stream is now known to carry typed `subagent.*` lifecycle events with resolvable parentage, and `parentId` is confirmed useless for structure by the vendor's own typings - so the raw material a Recap would be derived from is better understood than when this node was written. What stays open is whether that material is *sufficient*, which is a different question from whether it is *available*

### n-0011 - vNext route: Maestro as a pane-hosted wrap of cmux

- Parent: n-0000
- Fog: decision-ready
- Maturity: promotion-ready
- Priority: P0
- Outcome: Maestro is an observability plugin hosted inside cmux. cmux supplies the Host Application, terminal, workspace, native status channels, and agent integration. Maestro supplies the live, correctly parented subagent tree and the smallest fail-open fallback needed where native behavior is incomplete.
- Open questions: (1) Replace the 8 MiB tail read with incremental event-log reads; current behavior silently misses 73.4% of subagents in large logs. (2) Bind the exact Session instead of choosing the newest log for a shared working directory - **partially resolved in c-0030**: `CMUX_SURFACE_ID` binds the exact *surface*, which removes the ambiguity between terminals in one workspace, but the `cwd`-plus-newest-mtime heuristic still resolves the Session itself. (3) **Closed in c-0030** - `preToolUse` removed, `CMUX_COPILOT_HOOKS_DISABLED=1` honoured and `MAESTRO_DISABLED=1` added. (4) Re-cut publication away from the transitional workspace description; it was extended with typed owner and attention rows in c-0030 rather than replaced. (5) Treat cmux hook-store identity, live lifecycle, and restore as incomplete until duplicate records, idle-only state, and the generated `-C` restore failure are resolved - **live lifecycle is no longer blocking**, since Maestro now derives its own state.
- Evidence: [c-0021](./cycles/c-0021.md); [c-0024](./cycles/c-0024.md); [c-0029](./cycles/c-0029.md); [cmux-arch.md](../../../../v2/docs/reference/cmux-arch.md)
- Links: refines n-0000; depends-on n-0002; informs n-0007; parent-of n-0013, n-0016; **peer-of n-0004, n-0005, n-0006** (the c-0021 `supersedes-candidate` links were withdrawn in c-0022 when the user confirmed cmux joins the comparison rather than replacing it)
- First seen: c-0021
- Former node id: none
- Reinterpreted: c-0030 (intact)
- Promotion key: none
- Tracker: none
- Divergence: none
- History: c-0030 closed its hook-safety question and narrowed its Session-binding question; c-0021 created it by user redirect after four reference analyses (cmux, ccmux, Ghostty, Warp) and the user's own reframing - *"it's a terminal multiplexer at the end of the day… maybe we just customize one of these solutions"*. The cycle asked which shape to take and the loop's recommendation **changed mid-cycle on the user's own answer**: `own it (fork)` was recommended while verified-zero teardown was a P0, and was withdrawn in favour of `wrap it` the moment the user narrowed that bar to best effort, because the fork's whole justification was source access for teardown. The prototype then falsified the remaining objection: wrapping was assumed to require loosening cmux's automation security, and it does not - a pane-hosted helper is fully privileged. Two things were measured that no prior cycle knew: cmux's CLI already implements the resource meter and file tree this session had specified as work, and its `read-screen`/`send` surface makes it the **most** automatable host measured so far, inverting the ranking the c-0015 automation criterion implied. The node enters at fog `researched` on measured evidence rather than at `scouted`, matching the n-0002 precedent

### n-0012 - Zellij candidate route

- Parent: n-0000
- Fog: invalidated
- Maturity: framed
- Priority: P1
- Retired: c-0025 - Zellij candidate route - **retired in c-0025**, never measured.
- Outcome: Evaluate Zellij as a host, on the hypothesis that it trades in the opposite direction to cmux: **less given away, but far deeper extensibility, and open**. Zellij plugins are WebAssembly modules that render **first-class user-interface panes** - Zellij's own interface is built with the same system - so a Fleet panel and a subagent tree would be native components rather than a script drawing into a terminal pane. It is **MIT licensed** and ships **session resurrection**, which restores panes, tabs, and running commands across terminal closure and reboot.
- Open questions: (1) **How much does it cost to rebuild what cmux gives free?** Zellij has no agent awareness at all - no Attention, no agent hooks, no notifications, no resource meter, no file tree, no workspace metadata - so eight of c-0022's nine "already delivered" items move back into the build column. (2) **Does the plugin API actually reach a live subagent tree**, and is a Rust/WebAssembly plugin a proportionate way to render one? (3) **What is the measured automation ceiling?** As a multiplexer inside a host terminal it owns no window and exposes **no accessibility tree of its own** - the property that capped the WezTerm route - so its Presentation Check surface is its CLI and plugin API instead, and that is unmeasured. (4) **Is session resurrection usable as Park?** It is the first candidate host shipping anything in that neighbourhood, and c-0022 identified durable lifecycle state as the largest remaining build item. (5) Does hosting inside a host terminal reopen the input-model requirement, since the operator's own terminal keeps its keymap and Zellij layers its own on top.
- Evidence: [c-0023](./cycles/c-0023.md) bounded read-only research - `brew info zellij` (0.45.0, MIT, one dependency) plus delegated web research on the plugin system, themes, and session resurrection. **No Zellij was run; nothing here is measured.**
- Links: refines n-0000; peer-of n-0003, n-0004, n-0005, n-0006, n-0011
- First seen: c-0023
- Former node id: none
- Reinterpreted: c-0023 (created)
- Promotion key: none
- Tracker: none
- Divergence: none
- History: c-0023 created it on one user instruction - *"vnext prototype of zellij is also warranted - write that down"* - in a recording cycle that opened no question group, because the user asked for a record rather than a decision. Bounded research was run first so the node would not enter as empty fog. It enters at fog `scouted` rather than `investigating`: the candidate is named and its shape is understood, but nothing about it has been measured, and the loop's own rules class delegated web research as untrusted evidence. The node exists to be measured, and the comparison it feeds is the reason it is not simply folded into n-0011

## Active Frontier

The frontier is a bounded defect and integration list against the running
observability plugin.

| Node | Fog | Maturity | Priority | Blocked by | Open questions |
| --- | --- | --- | --- | --- | --- |
| n-0011 | decision-ready | promotion-ready | P0 | none | Complete event-log reads; exact Session identity beyond the surface binding; replace the transitional description publisher. |
| n-0013 | decision-ready | researched | P0 | none | Replace the transitional wire format; task-list presentation; editor hand-off file. |
| n-0016 | decision-ready | researched | P0 | none | Duplicate native hook-store records, failed restore, migrated uninstall. |
| n-0015 | cleared | decision-ready | P2 | none | Whether Maestro has a visible mark at all, now that the sidebar title row is removed. |

**n-0014 reached fog `cleared` and maturity `decision-ready` in c-0030** and
leaves the frontier. Its remaining item is an accepted unknown with a recorded
trigger: a Session that dies while blocked never resumes, so nothing clears its
badge.

**Two nodes were retired in c-0030.** n-0001 (the acceptance slice, "identical
across all four routes") and n-0009 (the harness that judged routes against it)
were invalidated by the reconciled anchor's explicit statement that the
four-route comparison was cancelled in c-0025. n-0009 keeps its tracker link to
[Issue #30](https://github.com/jdylanmc/maestro/issues/30) under fog transition
rule 4; the loop does not unpublish.

**Six nodes were retired in c-0025** and are off the frontier permanently:
n-0003 (Electron, built), n-0004 (WezTerm), n-0005 (Tauri), n-0006 (Swift), and
n-0012 (Zellij) were routes to an application that will not be built; n-0007,
the comparative evaluation, was cancelled rather than deferred.

**n-0010 is retired in c-0029** from the accepted domain decision that deprecated
`Recap`. n-0002's remaining process-lifetime question is outside current scope,
and n-0008 remains a historical tracker concern rather than current product fog.

## Priority Debt

| Lower-priority node | Outran (maturity below researched) | Relation | Cause | Detected | Last seen | Status |
| --- | --- | --- | --- | --- | --- | --- |

**The table is still empty as of c-0030**, and this cycle tested it on the
trigger that is not bounded by the three-cycle window. **No node was weakened**,
so the unbounded weakening comparison did not run at all. Two nodes were
*invalidated* - n-0001 and n-0009 - and under the clear semantics an invalidated
node clears any row it was part of rather than opening one. Both are P0, and the
table requires a *lower*-priority node to outrun a higher one. n-0014 advanced
**upward** (fog `decision-ready` to `cleared`, maturity `researched` to
`decision-ready`), which can only close a row. Every remaining P0 node sits at or
above the maturity `researched` floor: n-0002 `decision-ready`, n-0008
`decision-ready`, n-0011 `promotion-ready`, n-0013 `researched`, n-0016
`researched`. **Fifteen consecutive cycles with an empty table.**

**The previous statement is retained:**

**The table is still empty as of c-0016**, and no new debt was detected: every
P0 node sits at maturity `researched` or above, so no lower-priority node is
outrunning anything, and nothing was weakened this cycle.

It opened in c-0012 with six rows. Three cleared in c-0013 when n-0008 reached
maturity `researched`; those three reopened inside c-0014 when reinterpretation
weakened n-0008, and cleared again in the same cycle when the SDK probe restored
it. The final three cleared in c-0015 when n-0009 reached `researched`. Every
clear is recorded in the affected nodes' history rather than netted out. *(A
dangling fragment left here by c-0015's write - "The three n-0009 rows remain
open," contradicting the sentence before it - was removed in c-0016.)*

Over five cycles the table did its whole job: it blocked three routes from
gaining depth while two provider-level questions were unsettled, it reopened
automatically when a settled decision lost its evidence, and it emptied only
once both were genuinely understood. **With it empty, rule 2 no longer fires**,
and selection returns to the higher rules. **c-0015 predicted n-0003 here and
was wrong**: rule 3 selects on *being* a shared blocker, not on being unblocked,
so it reaches n-0009 instead. c-0016 reported that difference rather than
quietly following the prediction, and corrected a stale n-0008 -> n-0003
blocking edge whose presence would have flipped the tie-break to n-0008.

**In c-0017 rule 3 fired again and reached n-0008**, because with n-0009 having
advanced to `decision-ready` in c-0016, n-0008 became the only P0 candidate
still at `researched` and the lower-maturity tie-break resolved before the
dependent-count tie-break ever ran. The user authorized either, and **n-0009 was
taken** - `selection-source: user` - because it was the sole gate on n-0003 and
therefore on the MVP itself. The deterministic recommendation is kept here so
the difference stays visible: n-0008's remainder is one quota-gated accepted
unknown and one cheaply researchable question about a session rename, and
nothing about deferring it created debt, because the table requires a *lower*
priority node to outrun a higher one and n-0008 is P0.

**It stays empty in c-0019, and this cycle tested it against a newly added node.**
n-0010 was created at P1, and adding a node counts as an advance for detection
purposes, so every related P0 node was checked: n-0000 `promotion-ready`, n-0001
`promotion-ready`, n-0002 `decision-ready`, n-0003 `promotion-ready`, n-0008
`researched`, n-0009 `promotion-ready`. All at or above the maturity `researched`
floor, so no row opens. Deferring n-0008 for the third consecutive cycle also
creates none: the table requires a *lower*-priority node to outrun a higher one,
and n-0008 is P0.

**It stays empty in c-0018 too, and this cycle tested it properly.** Three P1
nodes advanced - n-0004 to `framed`, n-0005 and n-0006 to `framed` - which is
exactly the condition that generates debt if any *related* higher-priority node
sits below maturity `researched`. Every P0 node was checked: n-0000
`decision-ready` (corrected up this cycle), n-0001 `decision-ready`, n-0002
`decision-ready`, n-0003 `promotion-ready`, n-0008 `researched`, n-0009
`promotion-ready`. All at or above the floor, so no row opens.

**It stays empty in c-0020, and this cycle tested it on the harder trigger.** n-0008 was the
only node to advance, and it advanced *upward* - fog `decision-ready` to `cleared`, maturity
`researched` to `decision-ready`. An upward move by a P0 node cannot open a row; it can only close
one. No node was weakened, so the unbounded weakening comparison did not run either. Every P0 node
remains at or above the maturity `researched` floor: n-0000 `promotion-ready`, n-0001
`promotion-ready`, n-0002 `decision-ready`, n-0003 `promotion-ready`, n-0008 `decision-ready`,
n-0009 `promotion-ready`. **Four consecutive selections of n-0008 have now created no debt**, for
the reason stated three times above and still true: the table requires a *lower*-priority node to
outrun a higher one, and n-0008 is P0.

**The previous statement below is retained, and c-0017's reason still holds:**

**The table stayed empty in c-0017 for a reason worth stating**, because two
nodes advanced this cycle: both n-0003 and n-0009 are P0, and every P0 node in
the session sits at maturity `researched` or above, so no lower-priority node
outran anything and no weakening occurred. Debt detection is not the constraint
on this session any more - the branch gate is.

## Tracker Synchronization

| Node | Tier | Promotion key | Tracker item | Last synced cycle | Divergence |
| --- | --- | --- | --- | --- | --- |
| n-0000 | Branch | maestro-graphical-agent-orchestrator/n-0000 | [Issue #1](https://github.com/jdylanmc/maestro/issues/1) | c-0019 | **c-0029's divergence resolved**; the anchor was reconciled to the plugin scope. Two new entries opened in c-0030: the stale `subagent.started`-at-completion claim, and the `proto-v1/` path that moved to `archive/proto-v1/`. |
| n-0001 | unpromoted - folded into Story context | none | relates to [Issue #18](https://github.com/jdylanmc/maestro/issues/18) | never | Retired in c-0030; Issue #18 still describes the multi-route MVP contract. |
| n-0002 | unpromoted | none | relates to [Issue #2](https://github.com/jdylanmc/maestro/issues/2), [Issue #11](https://github.com/jdylanmc/maestro/issues/11) | never | none |
| n-0003 | Story | maestro-graphical-agent-orchestrator/n-0003 | [Issue #29](https://github.com/jdylanmc/maestro/issues/29) | c-0019 | none |
| n-0004 | unpromoted | none | relates to [Issue #27](https://github.com/jdylanmc/maestro/issues/27) | never | none |
| n-0005 | unpromoted | none | relates to [Issue #23](https://github.com/jdylanmc/maestro/issues/23) | never | none |
| n-0006 | unpromoted | none | relates to [Issue #24](https://github.com/jdylanmc/maestro/issues/24) | never | none |
| n-0007 | unpromoted | none | none | never | none |
| n-0008 | unpromoted | none | none | never | none |
| n-0009 | Story | maestro-graphical-agent-orchestrator/n-0009 | [Issue #30](https://github.com/jdylanmc/maestro/issues/30) | c-0019 | **Opened in c-0030** - the node is invalidated and its implementation archived, but the issue is still open and still describes a harness for routes that were cancelled. The loop does not unpublish; `/discovery` owns the decision to close it. |
| n-0010 | unpromoted | none | none | never | none |
| n-0011 | unpromoted | none | none | never | none |
| n-0012 | unpromoted | none | none | never | none |

**First promotion in the session's history.** c-0019 published the Branch and two
Stories under the tier map approved in the same cycle: Branch = a `discovery:map`
issue, Story = a native sub-issue carrying its Discovery type marker, Task =
collapsed into the Story body. Both Stories are native sub-issues of Issue #1,
and [#29](https://github.com/jdylanmc/maestro/issues/29) carries a native
blocked-by edge to [#30](https://github.com/jdylanmc/maestro/issues/30).

**Five of the six stale child issues were closed after c-0019** - #4, #8, #13,
#21, and #22 - through `/discovery`, together with two retitles (#23 and #24).
**#10 "Choose the v2 Agent execution model" is still open** and still reads as
settled by the c-0014 SDK seam; it was deferred only because `/discovery` allows
one non-research resolution per session. **c-0020 strengthens the case for
closing it**: the seam's two remaining unknowns were answered from first-party
typings this cycle, leaving nothing about the execution model in doubt. Recorded
here so the next cycle does not rediscover it. This loop runs no tracker command
of its own.

### n-0013 - Maestro's observable surface inside cmux

- Parent: n-0011
- Fog: decision-ready
- Maturity: researched
- Priority: P0
- Outcome: The plugin renders **workspace -> terminal -> Session -> subagent tree** in a custom cmux sidebar, expanding the selected workspace and collapsing completed history behind counts. Workspace management stays native to cmux. The same sidebar can be opened as a resizable Bonsplit pane for inspection or expanded use, but the bounded in-sidebar task panel remains the default the user chose.
- Open questions: (1) Replace the transitional single-line workspace-description wire format. **Extended rather than replaced in c-0030**: it now carries a typed `@` owner row and a `!` attention row alongside depth-tagged subagent rows, and it is still the only channel proven to carry the tree. (2) Present the Session task list now that `log` is proven retained and queryable but not workspace-card content. (3) Choose the editor hand-off file when only the folder is unambiguous. **Platform facts settled in c-0030:** subagents nest under the Copilot surface that produced them, matched by publishing `CMUX_SURFACE_ID` against the sidebar's `t.id`; a running row uses a **native `ProgressView`** (an AppKit `AXBusyIndicator`) rather than a hand-drawn frame; **there is no failed row**, because `subagent.failed` is never emitted; hand-drawn animation is capped at **1 fps** because `clock.epoch` is seconds; and **hover is impossible**, stated outright by the upstream authoring guide as input "limited to forwarded clicks".
- Evidence: [c-0030](./cycles/c-0030.md) - surface-ownership publication, the native `AXBusyIndicator`, the 1 fps ceiling, documented absence of hover, and the `workspace.action` / `workspace list --json` round trip that makes click-to-dismiss persist; [c-0026](./cycles/c-0026.md); [c-0029](./cycles/c-0029.md); [cmux custom sidebar authoring contract](https://raw.githubusercontent.com/manaflow-ai/cmux/main/docs/custom-sidebars.md); [cmux CLI contract](https://raw.githubusercontent.com/manaflow-ai/cmux/main/docs/cli-contract.md); live c-0029 accessibility-tree verification of the spinner, failure mark, hierarchy, and split pane
- Links: refines n-0011; parent-of n-0014, n-0015; informed-by n-0016
- First seen: c-0026
- Former node id: none
- Reinterpreted: c-0030 (intact)
- Promotion key: none
- Tracker: none
- Divergence: none
- History: **c-0030 settled every remaining platform fact without spending a question on this node.** Its three open questions were empirical, and measurement answered them: surface ownership is *published* rather than inferred, because cmux types every Copilot Session as `terminal` and genuinely has no type to expose; the failed-row requirement was deleted rather than implemented; and the animation ceiling was measured rather than assumed after the user pushed back on "1 FPS really?" - `clock.epoch` returns seconds, but `ProgressView` is native and escapes the tick entirely; c-0026 created it by user redirect from five observations against the running plugin - context-menu parity, a visual overhaul carrying the full hierarchy, a per-session task panel, resource metering, and an editor hand-off. The cycle's decisive act was **reading two contracts that had existed all along**: `cmux docs sidebars` and `cmux docs api`. The authoring guide states that "unsupported syntax is skipped ... never crashes", which is the documented mechanism behind every silent render failure this plugin hit - `validate` reporting OK on a sidebar that renders nothing is correct behaviour, not a defect. The CLI contract then collapsed three of the five asks from build work to configuration: `workspace-action` and `tab-action` already cover almost every item in the screenshotted context menu including `set-color`, `cmux top` already reports resource usage per surface, and `cmux open` already performs the editor hand-off. The cycle also retired a guess: cmux injects the protected variables `CMUX_SURFACE_ID`, `CMUX_TAB_ID`, and `CMUX_WORKSPACE_ID` into every terminal it spawns, so a Copilot Session knows exactly which terminal it occupies. That makes the workspace -> terminal -> session hierarchy directly representable and replaces the `cwd`-plus-newest-mtime heuristic that c-0025 recorded as a defect

### n-0014 - Visible agent lifecycle state

- Parent: n-0013
- Fog: cleared
- Maturity: decision-ready
- Priority: P0
- Outcome: **Maestro owns its own lifecycle signal and derives it from the Copilot event log.** Attention is a `permission.requested` unmatched by a `permission.completed` sharing its `requestId` - the predicate measured in c-0012, confirmed on cmux in c-0024, and documented verbatim by the runtime's own `pendingRequests()`. It is **derived, never stored**: a hook fires only to trigger a recompute, and the log is the truth. Attention is a **mirror of runtime state, not a notification with a lifetime** - it persists for exactly as long as the Session is stopped and returns to the running indicator when work resumes, with no timer. Blocking kinds (`permission_prompt`, `elicitation_dialog`) outrank the non-blocking finished turn (`agentStop`, `end_turn`). Maestro registers `notification` and `agentStop`, and does **not** register `preToolUse`. cmux's native lifecycle is no longer on the critical path.
- Open questions: **None blocking.** (1) The clearing question is answered: clearing is a state transition observed in the log, not a timer or a hook flag. (2) `initializing` versus `working` and (3) `needsInput`/`unknown` were both questions about **cmux's** native vocabulary; deriving state from the Copilot log makes them irrelevant to Maestro's own signal, and they persist only as inputs to n-0016's delegation question. **Accepted unknown:** a Session that dies **while blocked** never resumes, so nothing clears its badge. Under the confirmed state-mirror model that badge is a correct statement about a Session that never got its answer, and manual dismissal is the exit. *Risk:* an operator seeing a badge they cannot account for. *Trigger:* the first such report.
- Evidence: [c-0030](./cycles/c-0030.md) - hook ordering proving a hook-driven observer cannot report a blocked Session; the `notification`/`agentStop` hook surface and its `notificationType` taxonomy; permission waits to 13432 s; per-subagent attribution through `permissionRequest.toolCallId`; [c-0027](./cycles/c-0027.md); [c-0029](./cycles/c-0029.md) - 16,089 lifecycle observations stayed `idle` during a ten-second active tool call; the Attention predicate measured firing in [c-0012](./cycles/c-0012.md) and confirmed on cmux in [c-0024](./cycles/c-0024.md); [cmux CLI contract](https://raw.githubusercontent.com/manaflow-ai/cmux/main/docs/cli-contract.md)
- Links: refines n-0013
- First seen: c-0027
- Former node id: none
- Reinterpreted: c-0030 (intact)
- Promotion key: none
- Tracker: none
- Divergence: none
- History: **c-0030 selected it by user redirect** from the deterministic n-0001, advanced it to fog `cleared` and maturity `decision-ready`, and settled its shape on three questions. The decisive measurement was an **ordering** one: `tool.execution_start` -> `preToolUse` -> `permission.requested`, which proves the hook that would report a block fires *before the block exists*, and that **no hook fires at all while the operator is being waited on**. That turned #36's staleness from an accident into a structural property, and it is why two hooks Maestro had never registered - `notification` and `agentStop` - are required. The user then rejected the loop's framing of the badge as a notification with a lifetime: *"copilot pauses and waits - so it should do the same. just be present until i've addressed it."* A 15-minute expiry would have erased a real block, since the measured maximum wait is 3.7 hours. That answer made the **clearing signal** load-bearing and re-opened c-0029's undone `preToolUse` removal - and the loop recommended **keeping** it, arguing the veto risk was bounded because 48 payload combinations are verified silent-and-zero. The user refused on lived evidence: *"at one point all of my copilot sessions were busted because of this."* **The recommendation was wrong and was withdrawn**: the c-0024 plugin that denied every tool call had 68 passing tests, so a suite cannot bound the risk of an unknown payload shape, and citing ours as if it could was the same reasoning error one fork later. The objection produced the cycle's main result - Attention becomes **derived from the log rather than stored**, which removes the only reason to keep `preToolUse` and eliminates a whole class of staleness rather than patching it; c-0027 created it from the user's request to see whether an agent is finished, initializing, or waiting for a human. The research step found the vocabulary already existed on both sides: every state signal is present in the Copilot event log, and cmux ships a five-lane taxonomy - `todo`, `working`, `needs-attention`, `review`, `done` - with an inferred value and a manual override. **Waiting-for-human is the one state that is already proven**: an unmatched `permission.requested` joined by `requestId` is the Attention predicate this session first observed firing in c-0012 and confirmed on cmux in c-0024. Two mismatches turned an apparently free win into a real decision - the lane is per workspace while agents are per terminal, and the lane is **not** in the sidebar binding set, so Maestro cannot read back what it writes. The user chose to push the lane anyway, which the loop had recommended against; the objection was then answered rather than overruled, by aggregating most-urgent-wins instead of last-writer-wins

### n-0015 - Maestro's visual mark

- Parent: n-0013
- Fog: cleared
- Maturity: decision-ready
- Priority: P2
- Outcome: Maestro's mark inside cmux is an **SF Symbol**, not the project icon. `archive/proto-v1/assets/Maestro.icns` and `Maestro.png` remain repository and non-cmux assets.
- Open questions: (1) **Whether Maestro has a visible mark at all.** c-0030 removed the sidebar title row - the operator's reason was that it "just takes up extra room", and the pane's own tab already reads `maestro` - so `point.3.connected.trianglepath.dotted` is no longer rendered anywhere. The question is no longer "which symbol" but whether the surface needs a mark; the prior wording assumed a header that no longer exists.
- Evidence: [c-0027](./cycles/c-0027.md); the sidebar authoring contract exposes only `Image(systemName:)` and `Label(_, systemImage:)`, and names `AsyncImage` and `.resizable` as unsupported, with no file-loading image view of any kind; `app.appIcon` accepts exactly `automatic`, `dark`, and `light`, enumerated from the application binary as `appIcon.automatic`, `appIcon.dark`, `appIcon.light`, with no custom-path option
- Links: refines n-0013
- First seen: c-0027
- Former node id: none
- Reinterpreted: c-0030 (intact)
- Promotion key: none
- Tracker: none
- Divergence: none
- History: c-0027 created and closed it in the same cycle **without asking the user a question**, because the published contract answered it. The user asked to use the Maestro icon; the sidebar cannot render a raster image at all, and cmux's application icon admits only its own three variants. The ask is not deferred or descoped - it is unavailable on this route, and the node records why so no later cycle re-proposes it

### n-0016 - Native-first: delegate Copilot integration to cmux

- Parent: n-0011
- Fog: decision-ready
- Maturity: researched
- Priority: P0
- Outcome: **Maestro leverages native cmux wherever it exists, and extends only where core functionality falls apart or cannot bridge a gap.** *User, c-0028: "we should be leveraging as much native cmux as possible, and only provide extensions where core functionality falls apart or can't bridge a gap. I would like to leverage cmux's inbuilt copilot integration so that we can reliably delegate that integration to someone else and inherit it from the platform itself."* Concretely: cmux's own Copilot hook integration is installed and owned by cmux; Maestro consumes what it produces and adds only the subagent tree.
- Open questions: The install and coexistence questions are settled by c-0029: after a backup, cmux's hooks installed, Copilot migrated them from JSONC `config.json` to `settings.json`, and both hook sources fired without denying tools. Remaining: (1) explain or canonicalize the many store records that share one process and transcript; (2) fix and re-measure Copilot restore after the generated `-C` argument failure; (3) verify uninstall after migration; (4) observe `needsInput` and `unknown` - **now non-blocking**, since c-0030 moved Maestro's own state off cmux's native lifecycle. **Settled in c-0030:** `preToolUse` is removed, executing the c-0029 decision; `notification` and `agentStop` are registered; `hooks.json` is generated by `install.sh`, which is the single source of truth; and the kill switch is **two** switches - Maestro honours cmux's own `CMUX_COPILOT_HOOKS_DISABLED=1` and provides `MAESTRO_DISABLED=1` so this plugin can be silenced without disabling cmux's native integration.
- Evidence: [c-0030](./cycles/c-0030.md) - the hook-ordering proof, the `notification`/`agentStop` surface, and the generated-`hooks.json` defect that meant the attention hooks were never registered at all; [c-0028](./cycles/c-0028.md); [c-0029](./cycles/c-0029.md); [cmux agent-hooks contract](https://raw.githubusercontent.com/manaflow-ai/cmux/main/docs/agent-hooks.md); measured install, Copilot migration, fail-open coexistence, status/progress rendering, duplicate session-store growth, idle-only lifecycle, and failed restore
- Links: refines n-0011; informs n-0013, n-0014
- First seen: c-0028
- Former node id: none
- Reinterpreted: c-0030 (intact)
- Promotion key: none
- Tracker: none
- Divergence: none
- History: **c-0030 executed the removal c-0029 decided and no cycle had performed**, and found why it mattered more than recorded: the loop first recommended *keeping* `preToolUse`, and the user refused on the grounds that it had once broken every one of their Copilot sessions. It also found that `hooks.json` is **generated**, so the two attention hooks had never been registered and no ASK badge had ever fired from a real prompt - every one observed during development came from a hand-injected fixture; c-0028 created it when the documentation sweep found that cmux ships first-class Copilot support the session had never looked for. The user's answer generalised it into a standing principle rather than a one-off adoption, which retroactively decides several open questions and narrows Maestro's scope again: **after this, the subagent tree is the only capability Maestro adds.** The loop had recommended treating the hook install as a separate measured prototype; the user accepted the direction but framed it as delegation of ownership - the value is not only the feature but that someone else maintains it
