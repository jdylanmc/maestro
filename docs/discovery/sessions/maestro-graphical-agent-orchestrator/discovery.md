---
schema-version: 1
session: maestro-graphical-agent-orchestrator
state-root: docs/discovery
revision: 20
anchor: https://github.com/jdylanmc/maestro/issues/1
anchor-revision: 2026-08-20T17:18:25Z
anchor-status: revised
question-group-size: 12
last-question-group-size: 12
last-cycle: c-0019
cycle-state: complete
state-digest: b40e640706ab20423f3171f6b6d2ce6204906b1b98b4851afac9de8e1201d218
root-map-digest: 337ebf920d2bb4c4b3401c57f86bdae931717f703f5d1372697969d21664b28d
root-lexicon-digest: 996bd740e483473691d06862dd280b3ac5929e3c4dfbea7ac4ecf803307c5ed5
digest-tool: shasum -a 256
digest-status: verified
state-scope: full
tracker-mode: remote
tracker-tier-map: approved c-0019 - Branch=GitHub issue labelled `discovery:map`; Story=native sub-issue labelled with its Discovery type marker (`discovery:prototype` for a route MVP, `discovery:task` for enabling work); Task=collapsed into the Story body as a `## Tasks` checklist
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
| Acceptance Slice | candidate | The single scripted end-to-end flow every prototype route must execute to be judged complete. Identical across routes, so the comparison is like-for-like. | Maestro discovery process | none | c-0011 | c-0011 | c-0019 | Fleet, MVP contract | session:maestro-graphical-agent-orchestrator |
| Attention | confirmed | A Fleet observed to want its human: blocked on an unanswered permission request, stopped by an error or an abort, or finished and unacknowledged. Observed per Fleet and never inferred from another Fleet. **Broadened from "cannot proceed" to "wants its human" on the user's choice in c-0016**; the c-0013 mode-dependence qualifier is removed as superseded, since c-0014 replaced ACP with the SDK. The cross-Fleet ranking that consumes it is presentation, not domain. | Maestro Fleet | AT_RISK (discouraged) | [`CONTEXT.md`](../../../../CONTEXT.md) Condition group; [`docs/adr/0002`](../../../../docs/adr/0002-consume-the-runtime-permission-model.md); c-0010 derivation; c-0012 live measurement | c-0010 | c-0016 | Fleet, Liveness, Parked, Interrupted | session:maestro-graphical-agent-orchestrator |
| Acceptance Harness | candidate | The verification apparatus every route must pass. **Two layers, settled in c-0015:** a State Oracle plus a Presentation Check. | Maestro discovery process | none | c-0012; c-0015 | c-0012 | c-0019 | Acceptance Slice, State Oracle, Presentation Check | session:maestro-graphical-agent-orchestrator |
| State Oracle | candidate | The route-agnostic layer of the Acceptance Harness. Asserts slice steps 1-6 from `git`, `ps` by recorded process group, `events.jsonl`, and the SDK, requiring no cooperation from the route under test - so a route can neither be advantaged by being easy to instrument nor assert its own success. | Maestro discovery process | none | c-0015 | c-0015 | c-0019 | Acceptance Harness | session:maestro-graphical-agent-orchestrator |
| Presentation Check | candidate | The layer verifying what only appears on screen - the primary agent window, the live subagent tree, panel re-scoping, and where Attention surfaces. Automated as far as each stack allows; whatever stays manual is a cost recorded against that route, never a neutral choice. | Maestro discovery process | none | c-0015 | c-0015 | c-0019 | Acceptance Harness, n-0007 | session:maestro-graphical-agent-orchestrator |
| Recap | confirmed | A short account of what a Fleet was doing and where it got to, produced for a human returning to it without context. Derived from the Fleet's durable state and history rather than reported by its processes. **Not a condition**: it does not change or replace `Attention`, `Parked`, `Interrupted`, or `Liveness`. | Maestro Fleet | Orientation (discouraged), status (discouraged), summary (discouraged) | [`CONTEXT.md`](../../../../CONTEXT.md) `Account` group, confirmed by `/domain-mapping` in c-0019 | maestro-graphical-agent-orchestrator/n-0010/c-0019 | c-0019 | Fleet, Attention, Liveness, Parked, Interrupted | session:maestro-graphical-agent-orchestrator |
| Squad Mate | deprecated | Superseded by `subagent`. Retired in c-0005. | Maestro orchestration | none | c-0005 | c-0001 | c-0007 | subagent | session:maestro-graphical-agent-orchestrator |
| Squadron | deprecated | Superseded by `subagent tree`. Retired in c-0005. | Maestro orchestration | none | c-0005 | c-0001 | c-0007 | subagent tree | session:maestro-graphical-agent-orchestrator |

## Tree

### n-0000 - Maestro graphical agent orchestrator MVP

- Parent: none
- Fog: cleared
- Maturity: promotion-ready
- Priority: P0
- Outcome: Prove the shared Maestro MVP contract through one complete real flow on Electron, judged primarily on lifecycle ownership - durable Fleet state with strictly ephemeral processes and verified-zero orphans on quit - and on a three-column Visual Studio Code-shaped layout where selecting a Fleet re-scopes every panel and always presents that Fleet's primary agent window.
- Open questions: none held directly. **Decomposed in c-0011** into n-0001 through n-0007; every question this node was carrying now lives on the child that owns it. **c-0018 corrected this node's maturity from `researched` to `decision-ready`, and the change is a correction rather than an advance.** It was lowered to `researched` in c-0005 for a stated reason - "the form of the destination proved less settled than the tree recorded", the user having floated neovim, the GitHub app, tmux, and a Visual Studio Code extension inside one cycle. That reason stopped being true in c-0011, when the destination was settled as four named routes in evidence order against one six-step slice. No cycle re-raised the field for twelve cycles, and in c-0017 it silently became the constraint blocking promotion. Reaching `promotion-ready` still requires reconciling Issue #1, which is tracked as a divergence rather than as fog.
- Evidence: [Issue #1](https://github.com/jdylanmc/maestro/issues/1); [Issue #18](https://github.com/jdylanmc/maestro/issues/18); [Issue #12](https://github.com/jdylanmc/maestro/issues/12); [Issue #6](https://github.com/jdylanmc/maestro/issues/6); [Issue #9](https://github.com/jdylanmc/maestro/issues/9); [c-0005 wireframe and firstmate research](./cycles/c-0005.md); [c-0006 live orphan-process forensics](./cycles/c-0006.md); [c-0007 worktree experiment, ship-with-squadron specification, and Copilot vocabulary extraction](./cycles/c-0007.md)
- Links: parent-of n-0001, n-0002, n-0003, n-0004, n-0005, n-0006, n-0007, n-0010
- First seen: c-0001
- Former node id: none
- Reinterpreted: c-0019 (intact)
- Promotion key: maestro-graphical-agent-orchestrator/n-0000
- Tracker: Branch - [Issue #1](https://github.com/jdylanmc/maestro/issues/1), synced c-0019
- Divergence: none. **The seven-cycle Issue #1 divergence was closed in c-0019** through `/discovery`, which reconciled the map body against confirmed c-0010 through c-0018 state: worktree-per-Fleet corrected to a hard rule, the sibling-awareness requirement recorded as reversed, the Copilot SDK seam and `sessionId` binding replacing the stale `-n, --name` decision, the c-0018 route split recorded against Issue #18, a new `Attention and observability` decision group added, and four already-resolved fog items removed. Verified by content digest against the intended bytes.
- History: c-0001 created from Issue #1 and grounded in the existing cross-prototype contract; c-0001 settled the proving slice and sequencing; c-0003 validated the Electron runtime/state boundary probe; c-0004 deferred real Electron installation and window validation; c-0005 confirmed Electron as the first route, established that no Agent process may outlive the application after an observed orphan defect in the v1.1 WezTerm build, set a ceiling of 8 concurrent Sessions with in-panel resource metering and active admission control, captured a three-column wireframe with global Session-scoped selection, confirmed the 1:1 Session/Primary Agent binding against firstmate's lock model, and retired the military vocabulary in favour of plain literal nouns; maturity lowered one level to researched because the form of the destination proved less settled than the tree recorded, the user having floated neovim, the GitHub app, tmux, and a Visual Studio Code extension within one cycle; c-0006 corrected c-0005's erroneous retraction of the orphan defect by observing the running system rather than the repository source, identifying a detached `herdr server` daemon that kept Sessions and Model Context Protocol servers alive for two days past application exit while macOS attributed their permission prompts to Maestro through inherited responsibility, and hardened lifecycle ownership into seven verifiable non-functional requirements; c-0007 reconciled the vocabulary against the Copilot runtime and renamed the structural unit to Fleet, released `Session` and `Agent` to their runtime meanings, retired `Workspace` as triple-booked, respelled `subagent`, adopted `Task`, settled lifecycle onto two independent axes, made worktree-per-Fleet the strong default with branch-per-Fleet as a verified consequence, chose a fully generic display model over orchestration-specific awareness, and bound a primary agent window 1:1 to each Fleet; c-0008 confirmed the vocabulary through `/domain-mapping`, which published `CONTEXT.md` and the first Architecture Decision Record and corrected two definitions, resolved the in-app editing contradiction in favour of read-only viewers, settled that closing the application auto-Parks every Fleet behind an acknowledged summary, and moved the tracker to `remote`, reconciling the map, five issues, two titles, and the missing v3/v4 dependency edges that had left prototypes unblocked ahead of their own research; c-0009 ran the first approved prototype and cleared the node's last blocker, confirming in Electron's real lifecycle that a supervisor can hold three Fleets as three process groups and reach zero survivors on quit, while falsifying the c-0006 requirement to spawn non-detached - a non-detached child is not a process-group leader and cannot be signalled as a group at all, so detachment paired with durable process-group ownership and a reap-on-launch step is the only strategy measured to work; **c-0010 was omitted from this history when it was published and is recorded here in c-0011**: it delegated four read-only research agents, then falsified two of their consequential claims by direct measurement - `parentId` is a linear event-chain pointer, not a parent-agent link, so the reported depth of 16 was an artifact and the real maximum depth is 2 with fan-out dominating, and `inbox_entries` holds 27 rows across all 674 local databases rather than the 0 a sampled scan reported, though every sender is a subagent reporting to its owning session so the conclusion that no peer channel exists survived - and it closed isolation on both axes, the user confirming that Fleets get no sibling awareness at all and, unprompted, that Fleets are isolated to worktrees, which reversed the c-0007 "strong default" and the c-0007 requirement that a Fleet must know it is not alone; c-0011 decomposed this node, which had held every open question in a single-node tree for eleven cycles, into seven children, and settled the shape of the work: all four routes are driven to a **complete** MVP rather than reduced to feasibility probes, executed strictly one at a time in evidence order rather than version order - v2 Electron first because it alone carries measured evidence, then v1.1 WezTerm, v3 Tauri/Rust, and v4 native macOS Swift - each producing a per-stack executive report, with a stack that cannot build the app **rejected** rather than treated as a failure, and a terminal comparative evaluation consuming the four reports; the acceptance slice unresolved since c-0001 was settled as one scripted six-step flow identical across routes, and the 8-Fleet ceiling was accepted as a known unknown with a stated trigger because no target monorepo exists to measure against; c-0012 ran two approved prototypes and retired every empirical unknown that had been carried since c-0009: packaging preserves the supervision property measured in a development run, with the packaged application itself reparented to `launchd` and that reparenting proved harmless because the application owns and reaps its groups, and the Attention predicate was observed firing for the first time anywhere in this project - a sustained unmatched `permission.requested` on a genuinely blocked live Session, joined by `data.requestId` - while two assumptions failed: a live Copilot Session does **not** tear down on `SIGTERM` like the synthetic trees c-0009 measured, stalling at five survivors until `SIGKILL` escalation, and a Session driven non-interactively can never surface Attention at all, which turned the integration mode into new blocking fog (n-0008) alongside the acceptance harness the verification seam now requires (n-0009); c-0013 settled the seam by probing it - ACP is adopted, it resumes sessions with history and streams tool-call status, and it neither asks permission nor accepts a session name, so Attention became mode-dependent rather than universal and the runtime-naming requirement narrowed to binding by `sessionId` with a Maestro-owned display name; c-0017 did not select this node and changed neither of its axes, but changed its **role**: with n-0003 and n-0009 both reaching fog `cleared` and maturity `promotion-ready`, this node's own maturity of `researched` became the binding constraint on publishing any MVP work at all, because the branch gate admits no exception for a branch below the promotion values. It has been the quiet consequence of the c-0011 decomposition ever since - every question moved down to a child, and no cycle since has re-matured the parent they were moved out of; c-0019 selected it by user redirect - the deterministic rule reached n-0008 for the third consecutive cycle - and **cleared it without asking a question about it**, because it held none: the reconciliation of Issue #1 completed immediately before the cycle met the one condition its own text named, and every other question had moved to a child in c-0011. It reached fog `cleared` and maturity `promotion-ready` and was **promoted as the Branch**, updating [Issue #1](https://github.com/jdylanmc/maestro/issues/1) with its promotion key and taking [#29](https://github.com/jdylanmc/maestro/issues/29) and [#30](https://github.com/jdylanmc/maestro/issues/30) as native sub-issues. The c-0018 suspicion that its blocking role was self-inflicted is confirmed: tree parentage had been read as promotion shape, and n-0001 and n-0002 were always foldable into Story context rather than gates
### n-0001 - MVP acceptance slice and per-route deliverables

- Parent: n-0000
- Fog: cleared
- Maturity: promotion-ready
- Priority: P0
- Outcome: One scripted end-to-end flow, identical across all four routes, that defines "complete" and supplies the comparative evaluation's rubric: create two named Fleets, each in its own enforced Worktree and branch; present each Fleet's primary agent window bound 1:1; prompt Fleet A so it delegates at least one subagent and the tree renders live with correct parentage; select Fleet B and observe every panel re-scope; drive Fleet A into a permission request and observe Attention surface on that Fleet; quit through the pre-close summary, auto-Parking both Fleets with zero surviving processes; relaunch and find both Fleets with identity, history, Worktree, and recomputed Liveness intact, resuming Fleet A's Session by name. Each route additionally produces an executive report of that stack's pros and cons, and a stack that cannot build the app is **rejected** rather than counted as a failure.
- Open questions: **None blocking.** The executive-report comparability question - open since c-0011 and never put to the user - was **settled in c-0019**: reports use a fixed five-section template, every claim a harness measurement rather than an assessment, so that n-0007 consumes the four reports instead of re-deriving the comparison from prose. The user attached a second purpose the loop had not proposed: the report must also re-orient a reader who has lost context, which added a lead **Recap** section ahead of the four rubric sections. The remaining question - whether executing the slice reveals a step that is unimplementable rather than merely hard - stays an **accepted unknown by construction**, since running the slice is what answers it; gate condition 8 admits an accepted unknown with its risk recorded. *Risk:* a slice step could prove unimplementable on a route and force a choice between changing the slice and rejecting the route. *Trigger:* the first route to reach a step it cannot execute.
- Evidence: [c-0011](./cycles/c-0011.md); [Issue #18](https://github.com/jdylanmc/maestro/issues/18); every step restates a requirement already confirmed in c-0005 through c-0010
- Links: blocks n-0003, n-0004, n-0005, n-0006; informs n-0007; parent-of n-0009
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0019 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #18](https://github.com/jdylanmc/maestro/issues/18)
- Divergence: none
- History: c-0011 created by decomposition and settled in the same cycle. The slice had been carried as an unresolved requirement since c-0001 in superseded vocabulary; the user's answer replaced it and added two things the loop did not propose - the per-stack executive report as a first-class deliverable, and rejection as a legitimate terminal verdict for a route; c-0012 settled the slice's verification seam as a single route-agnostic Acceptance Harness asserting external ground truth, spun that harness out as n-0009, and measured two of the slice's steps for the first time - step 5's Attention predicate fired and cleared on a live Session, and step 6's zero-survivor teardown held under packaging; c-0017 left both axes unchanged and identified this node as one of the two branch nodes now blocking promotion, separating its two open questions by kind - one is an accepted unknown by construction, the other is a live product decision about executive-report comparability that no cycle has yet put to the user; c-0019 settled its one product-owned question and advanced both axes to fog `cleared` and maturity `promotion-ready`. It was **not promoted**: the promotion gate names only the branch node and the leaves selected for promotion, and folds deeper conceptual nodes into branch or story context. This node is the acceptance-slice specification, so its content became the acceptance criteria of [#29](https://github.com/jdylanmc/maestro/issues/29) and [#30](https://github.com/jdylanmc/maestro/issues/30) rather than a work item of its own. Its maturity had been recorded across c-0017 and c-0018 as a gate on promoting n-0009; that reading was wrong, and c-0019 corrected it
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
- Reinterpreted: c-0019 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #2](https://github.com/jdylanmc/maestro/issues/2), [Issue #11](https://github.com/jdylanmc/maestro/issues/11)
- Divergence: none
- History: c-0011 extracted the provider-level findings of c-0009 and c-0010 into their own node, because they are inherited identically by all four routes and were being re-read out of the root's prose each cycle. Enters at maturity `researched` on c-0010's measured evidence, with two genuinely empirical questions outstanding, both of which can only be answered against a live Session; c-0012 answered both against live Sessions under an approved prototype, advancing fog to `researched` and maturity to `decision-ready` - the predicate fired and cleared, and teardown falsified the assumption that a live Session behaves like a synthetic tree - and spun the newly exposed integration-mode question out as n-0008 rather than absorbing it back into this node; c-0018 removed a stale duplicate question phrased against ACP and left this node holding exactly one open item, the identity of the five `SIGTERM` survivors, which is the only genuinely empirical question in the session that nothing else is waiting on

### n-0003 - v2 Electron MVP

- Parent: n-0000
- Fog: promoted
- Maturity: promotion-ready
- Priority: P0
- Outcome: The first route driven to a complete MVP, executing n-0001's acceptance slice end to end and producing its executive report. Chosen to lead on evidence rather than version order: it is the only route carrying measured results.
- Open questions: **Both prior questions are answered.** Packaging preserves supervision (c-0012, measured), and the real `BrowserWindow` seam was already exercised in c-0009. n-0008 was settled in c-0013, so one blocker is gone; the Acceptance Harness (n-0009) is the last one it cannot clear itself. **The signed-and-notarized question was retired in c-0016 by scoping it out**: the MVP ships an unsigned, fuse-enabled `.app`, so this node now holds **no open question of its own** and is gated solely on n-0009. **n-0009 cleared in c-0017, so this node has no remaining gate**: it passes all eleven leaf conditions, with the Acceptance Harness as its verification seam and a `feasible-with-constraint` disposition - the constraint being that a build manipulating Electron fuses must re-sign afterwards. What blocks it now is not its own state but its **branch**: n-0000, whose maturity c-0018 corrected upward to `decision-ready` after finding the `researched` value was a twelve-cycle-old artifact rather than a judgment. **c-0018 also confirmed this route runs first and alone**: both it and n-0004 are committed, but strictly one at a time, so the shared Acceptance Harness is validated against one route before it is asked to judge a second.
- Evidence: [c-0003](./cycles/c-0003.md) runtime/state boundary probe; [c-0004](./cycles/c-0004.md) deferral of real installation; [c-0005](./cycles/c-0005.md) confirmation of Electron as the first route; [c-0009](./cycles/c-0009.md) prototype reaching zero survivors across three process groups on quit; [c-0012](./cycles/c-0012.md) packaged `.app` measured at zero survivors on graceful quit, nine survivors on Force Quit without a reaper, and zero after reap-on-launch; [Issue #4](https://github.com/jdylanmc/maestro/issues/4)
- Links: depends-on n-0001, n-0002, n-0009; blocks n-0004, n-0007; informed-by n-0008 (settled c-0013; the stale reciprocal `blocks` edge on n-0008 was corrected in c-0016)
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0019 (intact)
- Promotion key: maestro-graphical-agent-orchestrator/n-0003
- Tracker: Story - [Issue #29](https://github.com/jdylanmc/maestro/issues/29), synced c-0019
- Divergence: none
- History: c-0011 created by decomposition, inheriting the Electron evidence accumulated across c-0003, c-0004, c-0005, and c-0009, and placed first in the sequence. Its maturity is load-bearing for the whole sequence: because it enters at `researched`, the P1 nodes that depend on it generate no priority debt, and if it is ever weakened below that floor the loop is required to stop deepening n-0004 and n-0007 until it recovers; c-0012 selected it under rule 3, retired both of its open questions by measurement, and advanced it through fog `researched` to `decision-ready` with maturity `decision-ready` - but it did **not** reach promotion, because clearing its fog exposed two new blockers it does not own, and because the `Attention` vocabulary its step-5 Story is written in was still a `candidate` term with a pending domain handoff; c-0016 discharged that handoff - `Attention` is confirmed in `CONTEXT.md` - and retired this node's last open question by scoping signing out of the MVP, leaving n-0009 as its only gate; c-0017 cleared n-0009, which advanced this node to fog `cleared` and maturity `promotion-ready` without the node itself being selected - the advance is a consequence of its last blocker clearing, not of new work on it. It is now a passing promotion candidate held back solely by its branch, which is the first time in this session that the constraint on shipping has sat **above** a route node rather than inside one; c-0019 **promoted it** as a Story beneath n-0000 with no change to its own understanding - the branch cleared, not the leaf. Published as [#29](https://github.com/jdylanmc/maestro/issues/29), labelled `discovery:prototype`, `proto-v2.0`, and `ready-for-agent`, blocked by [#30](https://github.com/jdylanmc/maestro/issues/30). Its title matches the shape already used by #23, #24, and #27; v2 was the only route whose build issue had never been created
### n-0004 - v1.1 WezTerm MVP

- Parent: n-0000
- Fog: investigating
- Maturity: framed
- Priority: P1
- Outcome: The second route driven to a complete MVP against the same acceptance slice, with its own executive report. **Committed unconditionally in c-0018** - *"You can build Electron and WezTerm variants now"* - so it is no longer a route whose scope depends on how the Electron route turns out. It remains **sequenced after** n-0003 rather than concurrent with it, because the Acceptance Harness is shared and unbuilt, and building it against two routes at once would let it be shaped by whichever route is easier to instrument, which is the exact bias the State Oracle exists to prevent.
- Open questions: Can a WezTerm-hosted route satisfy the process-ownership requirement at all? v1.0's detached `herdr server` daemon is the original violation, so this route starts holding the defect that produced the requirement. Does `proto-v1/` shorten the distance to completion, or does it carry the architecture that has to be abandoned? **And the one that is newly answerable:** what is this route's *measured* Presentation Check ceiling? The ~40-50% figure and the missing macOS accessibility tree come from c-0016 **delegated research**, which is untrusted-evidence class, and they feed a fixed rubric criterion for a route now committed to completion. c-0018 obtained standing permission to measure it directly - *"I do not use WezTerm actively on this computer so you may experiment with it's capabilities"* - so the ceiling can be moved from research to measurement under a prototype gate.
- Evidence: [c-0006](./cycles/c-0006.md) live orphan-process forensics; `proto-v1/` preserved v1.0 implementation; [Issue #26](https://github.com/jdylanmc/maestro/issues/26); [Issue #27](https://github.com/jdylanmc/maestro/issues/27); [Issue #28](https://github.com/jdylanmc/maestro/issues/28)
- Links: depends-on n-0003, n-0008, n-0009; blocks n-0005, n-0007
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0019 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #27](https://github.com/jdylanmc/maestro/issues/27)
- Divergence: none
- History: c-0011 created by decomposition and sequenced second; c-0012 added the two provider-level blockers n-0008 and n-0009 that every route inherits, which put this node into priority debt against both; c-0013 debt cleared (n-0008 reached researched); the n-0009 row remains open; c-0015 debt cleared (n-0009 reached researched) - this node now carries no priority debt; c-0018 committed it unconditionally alongside n-0003 while keeping the one-at-a-time sequencing, advanced it to fog `investigating` and maturity `framed` on the strength of having a bounded outcome and named exclusions rather than new evidence, and recorded that its automation ceiling - the single input it contributes to a fixed rubric criterion - has never been measured, only researched, and that permission to measure it now exists

### n-0005 - v3 Tauri/Rust feasibility probe

- Parent: n-0000
- Fog: investigating
- Maturity: framed
- Priority: P1
- Outcome: **Reduced in c-0018 from a complete MVP to a bounded feasibility probe**, under a `delegated-to-loop` disposition after the user committed n-0003 and n-0004 and handed this route back to the loop. The probe answers one decisive question and still produces an executive report, which c-0011 requires of every route including a rejected one. **The decisive question: does the WebdriverIO embedded-WebDriver path actually drive a packaged Tauri `.app` on macOS, and does the official Rust SDK binding remove the Node sidecar?** Research established both halves of why this is the right question. Playwright is out entirely on macOS - `WKWebView` exposes no Chrome DevTools Protocol - and Tauri's own documentation states that driving `tauri-driver` directly supports only Windows and Linux. The working path, `@wdio/tauri-service`, embeds a W3C WebDriver server **inside the application binary**, so this route must modify the product to make it testable, which no other route does. Offsetting that, GitHub publishes an **official Rust SDK** binding for Copilot, so a Tauri route can consume the seam natively with no Node sidecar - an advantage no cycle had counted.
- Open questions: The decisive question above. Everything beyond it is deliberately out of the probe's scope.
- Evidence: [c-0018](./cycles/c-0018.md) delegated research on macOS user-interface automation and Copilot SDK language bindings; [Issue #23](https://github.com/jdylanmc/maestro/issues/23)
- Links: depends-on n-0004, n-0008, n-0009; blocks n-0006, n-0007
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0019 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #23](https://github.com/jdylanmc/maestro/issues/23)
- Divergence: none
- History: c-0011 created by decomposition and sequenced third; c-0012 added the inherited blockers n-0008 and n-0009; c-0013 debt cleared (n-0008 reached researched); the n-0009 row remains open; c-0015 debt cleared (n-0009 reached researched) - this node now carries no priority debt; c-0018 reduced it from a complete MVP to a bounded feasibility probe under delegation, and replaced "Open questions: Everything" with one decisive question derived from research. This is the reduction the loop recommended in c-0011 and was overruled on; what changed is that it is now grounded in per-route facts rather than in a general cost argument, and the user split the decision by route rather than accepting or rejecting it wholesale

### n-0006 - v4 native macOS Swift feasibility probe

- Parent: n-0000
- Fog: investigating
- Maturity: framed
- Priority: P1
- Outcome: **Reduced in c-0018 from a complete MVP to a bounded feasibility probe**, under the same `delegated-to-loop` disposition as n-0005, and still producing an executive report. **The decisive question: what does the Copilot seam cost from Swift, given there is no Swift SDK?** Research established the asymmetry that makes this route unlike the other three. Its verification story is the **best** of the four - `XCUITest` is Apple's first-class framework and `XCUIApplication` drives an already-packaged `.app` by bundle identifier or file URL, with no test target compiled into the product, which is the exact opposite of what Tauri requires. But GitHub publishes official Copilot SDK bindings for TypeScript, Python, Go, Rust, Java, and .NET, and **none for Swift**, so this route must spawn a Node or Rust sidecar and speak JSON-RPC, or hand-roll the wire protocol against no published specification. Known macOS costs on the verification side: the test runner needs Accessibility permission, an active graphical session, and there is no per-run sandbox reset.
- Open questions: The decisive question above. Everything beyond it is deliberately out of the probe's scope.
- Evidence: [c-0018](./cycles/c-0018.md) delegated research on macOS user-interface automation and Copilot SDK language bindings; [Issue #24](https://github.com/jdylanmc/maestro/issues/24)
- Links: depends-on n-0005, n-0008, n-0009; blocks n-0007
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0019 (intact)
- Promotion key: none
- Tracker: none - relates to [Issue #24](https://github.com/jdylanmc/maestro/issues/24)
- Divergence: none
- History: c-0011 created by decomposition and sequenced fourth; c-0012 added the inherited blockers n-0008 and n-0009; c-0013 debt cleared (n-0008 reached researched); the n-0009 row remains open; c-0015 debt cleared (n-0009 reached researched) - this node now carries no priority debt; c-0018 reduced it to a bounded feasibility probe under delegation and gave it one decisive question. The research that produced it also inverted the assumption behind this route's low ranking: it has the strongest verification story of the four and the weakest provider-integration story, which is the opposite shape from the terminal route and is exactly the kind of tradeoff n-0007 exists to weigh

### n-0007 - Comparative technology evaluation

- Parent: n-0000
- Fog: investigating
- Maturity: vague
- Priority: P1
- Outcome: The terminal deliverable: an analysis selecting which stack is best suited to this problem, consuming the four per-route executive reports rather than re-deriving the comparison. A rejected stack is an input to this evaluation, not an absence from it - the reason a stack could not build the app is itself a finding.
- Open questions: **Partly answered in c-0015.** The user fixed one criterion before any route shipped - **user-interface automation capability** - on the stated reasoning that automated regression checks are the work that follows the MVP. The remaining question is what else the rubric holds and how the criteria weigh against each other. Recorded honestly: this criterion is **not neutral** between the routes. A component-driven web stack reaches Storybook and Playwright directly, Swift uses XCUITest, and a terminal surface exposes very little to any of them - so naming it predicts part of the ranking. **One clause of that reasoning was falsified in c-0018:** "Tauri reaches Playwright through WebDriver" is wrong on macOS. Playwright cannot drive `WKWebView` at all, and Tauri's own documentation excludes macOS from `tauri-driver`; the working path embeds a WebDriver server inside the application binary. The criterion's *shape* survives - the routes still separate on automation reach - but the predicted ordering shifts, because Swift turns out to have the strongest automation story of the four rather than a middling one. That is a legitimate product decision, recorded as one rather than presented as a neutral measurement.
- Evidence: [c-0015](./cycles/c-0015.md) fixed the user-interface-automation criterion and made each route's automation reach the evidence for it; [c-0011](./cycles/c-0011.md)
- Links: depends-on n-0003, n-0004, n-0005, n-0006; informed-by n-0001, n-0009
- First seen: c-0011
- Former node id: none
- Reinterpreted: c-0019 (intact)
- Promotion key: none
- Tracker: none
- Divergence: none
- History: c-0018 falsified one clause of the criterion's supporting reasoning and inverted part of the ranking it implied - Swift's `XCUITest` story is the strongest of the four, and Tauri's is materially worse than recorded, requiring the product under test to be modified to be testable. It also learned that Copilot SDK language bindings differ per route, which is a second, previously uncounted axis the rubric must weigh: Rust has an official binding and Swift has none. c-0015 fixed its first rubric criterion before any route shipped, and tied it to measurement rather than assessment: how far each route automates the Presentation Check **is** the evidence. c-0011 created by decomposition. It exists as a node rather than as a closing step because the user named it a first-class deliverable - "then do an analysis and evaluation on which technology is best to solve this problem" - and because its rubric question has to be settled before the routes finish, not after

### n-0008 - Copilot integration mode

- Parent: n-0002
- Fog: decision-ready
- Maturity: researched
- Priority: P0
- Outcome: **Settled in c-0014: the Copilot SDK is the seam, reversing c-0013's choice of ACP.** A route drives a Fleet through `CopilotClient` from `copilot-sdk`, shipped inside the platform package: `start()`, `createSession(config)`, `sendAndWait`, `resumeSession(sessionId)`, `listSessions()`. Permissions are first-class - `onPermissionRequest` delivers an answerable callback, and omitting it leaves requests pending for `permissions.pendingRequests()`, whose documented return is exactly the c-0010 Attention predicate. `setApproveAll` expresses the user's usual broad-permission posture as a toggle rather than an architecture. **Narrowed in c-0016:** the current documentation reads "**Reconstructs** the set of pending tool permission requests **from the session's event history**", so Attention *is* a reconstruction - the runtime simply performs it. Maestro need not implement it; that is the defensible claim, and it is narrower than the one c-0014 recorded. **A route must also pin the SDK version**, because the permission surface changed shape three times across observed versions. ACP remains a working fallback, and what it lost on was measured: no permission surfacing, no session naming. Maestro still builds **no** permission-mediation layer; it consumes the runtime's. Original framing: c-0012 proved the choice is not free: a Session driven with `-p` completes every permission request instantly as `denied-no-approval-rule-and-could-not-request-from-user`, so it **can never surface Attention** and acceptance-slice step 5 is unreachable through it. The candidate is `copilot --acp`, the Agent Client Protocol server the binary already exposes; the fallback is driving the terminal user interface through a pseudo-terminal, which c-0012 found fragile enough to need four attempts before it accepted input.
- Open questions: **Accepted unknown (c-0014):** the SDK permission callback has never been observed firing - the probe reached `createSession` and was stopped by an exhausted monthly quota before a single model turn. *Risk:* the seam decision, and acceptance-slice step 5 with it, rests on declarations shipped with the binary rather than on behaviour, which is the same evidence class that produced the c-0006 spawn requirement that measurement later falsified. *Trigger:* the next quota reset, or any earlier chance to run one model turn. Does the SDK expose a session rename? No name field was found in `SessionConfig`. Does `subagent.started` reach an SDK client as a typed event, or only through `events.jsonl`? **Retired in c-0016:** the widened Attention definition is fully served - `session.idle` carries `aborted?: boolean`, and `hooks.onSessionEnd` and `onErrorOccurred` cover the remaining triggers.
- Evidence: [c-0014](./cycles/c-0014.md) SDK probe - `copilot-sdk` typings shipped inside the platform package, `onPermissionRequest`, `permissions.pendingRequests()` documenting the Attention predicate verbatim, `setApproveAll`, and a live `createSession`; [orbit-arch.md](../../../../v2/docs/reference/orbit-arch.md) independently implements the same permission loop in an Electron application; [c-0013](./cycles/c-0013.md) full ACP probe - protocol handshake, streaming vocabulary, zero permission events across two capability declarations, `session/list` over 50 sessions, and `session/load` resuming with real history; [c-0012](./cycles/c-0012.md) non-interactive auto-denial measured in session `0e840075`, live interactive firing in `225cda11` and `c8f382bc`, and four failed pseudo-terminal driving attempts; `copilot --help` (`--acp`, "Start as Agent Client Protocol server")
- Links: depends-on n-0002; blocks n-0004, n-0005, n-0006; informs n-0003
- First seen: c-0012
- Former node id: none
- Reinterpreted: c-0019 (intact)
- Promotion key: none
- Tracker: none
- Divergence: none
- History: c-0012 created it as new fog exposed by measurement rather than by reasoning. It is provider-level, so every route inherits the answer, which is why it blocks all four rather than only Electron; c-0013 selected it under rule 2 - the first time priority debt has ever driven selection - probed ACP directly, and settled the seam. The probe found ACP superior on every structural axis and silent on exactly two: it never asks permission, and it will not name a session. The loop recommended building a Maestro-owned permission boundary; the user delegated the decision and disclosed that they run with broad permissions, which retired the recommendation rather than confirming it - a mediation layer would have serviced a gate the target workflow rarely reaches. Attention is instead derived from what the seam provides, with ACP permission surfacing recorded as an upstream dependency carrying a re-test trigger on every CLI upgrade; c-0014 **weakened this node one cycle later** when answering a user question about firstmate surfaced `orbit-arch.md`, which documents a third seam c-0013 never probed - the SDK - and the re-probe found permissions first-class there, so the seam decision reversed to the SDK, acceptance-slice step 5 reverted to the wording the user had actually confirmed, and what c-0013 had recorded as an upstream gap turned out to be a surface the loop simply had not looked at

### n-0009 - Route-agnostic Acceptance Harness

- Parent: n-0001
- Fog: promoted
- Maturity: promotion-ready
- Priority: P0
- Outcome: **Settled in c-0015 as two layers.** The **State Oracle** asserts slice steps 1 through 6 from `git worktree list`, `git branch`, `ps` by recorded process group, `~/.copilot/session-state/<id>/events.jsonl`, and the SDK's `listSessions()`, `resumeSession()`, and `permissions.pendingRequests()`. It requires no cooperation from the route under test, so no stack is advantaged by being easy to instrument and no route can assert its own success - and it can be written before any route exists, which is what unblocks n-0003. The **Presentation Check** covers what only appears on screen and is automated as far as each stack allows, beginning with Playwright against Electron. **Pass or fail never depends on automation reach**; a route checked only by the operator still passes if it behaves correctly. What changes is the executive report, which must state the manual residue explicitly, because that residue is evidence for n-0007's user-interface-automation criterion. **c-0016 gave the Presentation Check a measured automation path**: step 4 - the only slice step with no external ground truth, and therefore the step that decided whether this layer was viable at all - was asserted successfully against a packaged Electron `.app` using `Promise.all` over auto-retrying `expect(locator)` calls, 3/3 passing. It also fixed the harness's own honesty rule: **every Presentation Check assertion is paired with a negative control**, because an auto-retrying assertion that passes is indistinguishable from one that never tested anything. Storybook is excluded - it renders one component with mocked props and structurally cannot express cross-panel re-scoping. The WezTerm end is bounded rather than solved: roughly **40-50%** is automatable through `wezterm cli list`, `get-text`, and `list-clients`, and WezTerm exposes **no macOS accessibility tree at all**, which closes XCTest, Appium, and AppleScript together. **c-0017 settled the harness's own verification seam, which is the question a verification apparatus is easiest to leave circular: the harness runs a paired-falsification suite against itself, first, on every run.** Every assertion in both layers ships with a fixture it must **fail** on; the negative suite executes before the route suite; and if any negative case passes, the harness declares **itself** broken and refuses to report on the route at all. Granularity is **per assertion, not per slice step**, because the failure c-0016 caught was at assertion granularity - a step can pass with four assertions of which three are vacuous. This generalises the one control c-0016 actually measured rather than inventing a mechanism, and it is what makes a harness that silently stops asserting distinguishable from a passing one.
- Open questions: **None blocking.** Playwright reaches step 4 on a packaged `.app` (measured, c-0016), and the WezTerm ceiling is bounded at roughly 40-50% with no accessibility-tree fallback (researched, c-0016). The vacuous-pass question was settled in c-0017 as the paired-falsification rule above, under a `delegated-to-loop` disposition after the user declined it as a non-product decision. The `enableNodeCliInspectArguments` question is **reclassified in c-0017 as an accepted unknown rather than a blocker**: the MVP ships fuse-*enabled* (c-0016), Playwright is measured 3/3 against exactly that build, and the fuse question only becomes live for a configuration the MVP has deferred. *Risk:* if the claim is false, the build decision is more conservative than it needs to be. *Trigger:* the first Electron route build that configures fuses at all.
- Evidence: [c-0016](./cycles/c-0016.md) prototype - step 4 asserted 3/3 against a packaged Electron `.app` with a passing negative control, `electronApp.evaluate()` reaching main-process state, plus delegated research bounding the WezTerm ceiling and excluding Storybook; [c-0015](./cycles/c-0015.md) settled the two-layer shape and the machine-first constraint; [c-0014](./cycles/c-0014.md) supplied the SDK queries the State Oracle asserts with; [c-0012](./cycles/c-0012.md) - both prototypes were trustworthy only because they measured external ground truth rather than asking the application under test
- Links: depends-on n-0001; blocks n-0003, n-0004, n-0005, n-0006
- First seen: c-0012
- Former node id: none
- Reinterpreted: c-0019 (intact)
- Promotion key: maestro-graphical-agent-orchestrator/n-0009
- Tracker: Story - [Issue #30](https://github.com/jdylanmc/maestro/issues/30), synced c-0019
- Divergence: none
- History: c-0012 created it from the Q4 verification-seam decision, taken under `delegated-to-loop` with the user absent, so it carried a revisit flag the other nodes did not; c-0015 selected it under rule 2, split it into a State Oracle and a Presentation Check, and advanced it to maturity `researched`, clearing the last three priority-debt rows. The user supplied two constraints that shaped it: user-interface automation is a **selection criterion** for the stack rather than a harness implementation detail, and **there are no human testers**, so a manual step is a stopgap of last resort whose survival is a cost recorded against the route. The revisit flag is discharged - the user has now engaged with this node's substance directly; c-0016 selected it under rule 3, retired both of its open questions - one by measurement and one by research - and advanced both axes one level to `decision-ready`. Its prototype also produced the cycle's sharpest lesson: it reported a confident causal finding about the `enableNodeCliInspectArguments` fuse that was **wrong**, because the fuse-disabled builds were killed by macOS for an invalid code signature and the failing tests looked exactly like the researched failure mode. Nothing inside the loop caught it; the user did, by mentioning an operating-system crash dialog. The node now carries the rule that a prototype asserting a negative result must establish *why* the negative happened; c-0017 selected it again under rule 3 - by user authorization rather than by the deterministic tie-break, which reached n-0008 - and **cleared it without measurement**. Two things did that. Its remaining empirical question was found not to gate the MVP at all and was demoted to an accepted unknown, and its missing gate condition turned out to be condition 9, a verification seam, which for a verification apparatus is circular unless stated: the paired-falsification suite is that seam. The node reaches fog `cleared` and maturity `promotion-ready` on a settled rule rather than on an observation, and that is recorded as a limitation rather than smoothed over - the harness has never been built, so the rule's first honest test is its own first run

### n-0010 - Fleet Recap

- Parent: n-0000
- Fog: scouted
- Maturity: framed
- Priority: P1
- Outcome: Maestro presents a **Recap** for a Fleet - a short account of what that Fleet was doing and where it got to - so a human returning after days away can act without reconstructing context by hand. Derived from the Fleet's own durable state and history rather than reported by its processes. The actor is a returning operator who has lost context; the obvious exclusion is that this is **not** a condition like `Attention`, `Parked`, or `Liveness`, and it does not change any of them.
- Open questions: (1) What a Recap is derived from, and whether the runtime's own event stream is sufficient or Maestro must retain a synthesis of its own. (2) Whether a Recap is generated on demand or maintained continuously as the Fleet works. (3) Whether it is machine-checkable at all - a *correct* Recap is verifiable, but a *useful* one may not be, which is why it was kept out of the acceptance slice.
- Evidence: [c-0019](./cycles/c-0019.md) - created from the user's answer to Q2; [`CONTEXT.md`](../../../../CONTEXT.md) `Account` group, where the term was confirmed
- Links: refines n-0000
- First seen: c-0019
- Former node id: none
- Reinterpreted: c-0019 (intact)
- Promotion key: none
- Tracker: none
- Divergence: none
- History: c-0019 created it from the Q2 answer. It exists because a question about executive-report comparability turned out to have a product requirement hiding inside it: the user's reason for wanting comparable reports was *"I may come back to a session and not remember what is going on and want a quick 'what were we doing and where are we at'"*, and the word `session` was ambiguous between the confirmed runtime term and the ordinary English sense. Q2 disambiguated rather than guessing, because the two readings had very different costs - binding it to the product would have re-opened n-0003 and n-0009, the only two promotion-ready leaves, for a capability that cannot separate four stacks. The user placed it at **P1**, "very desired" but not P0, matching the c-0016 disposition of desktop notifications. The concept was named `Orientation` by the user and renamed **`Recap`** by `/domain-mapping` in the same cycle, on evidence that `Orientation` was already triple-booked in this repository - the `## Scope and Orientation` heading in eight reference documents, the executive report's lead section, and this capability - which is the failure that retired `Workspace` in c-0007. `Orientation` survives as a discouraged alias

## Active Frontier

Every row lists **all** of its node's open questions. c-0018 found n-0002's row
carrying one of two, which mattered because selection reads this table rather
than the node blocks.

| Node | Fog | Maturity | Priority | Blocked by | Open questions |
| --- | --- | --- | --- | --- | --- |
| n-0002 | researched | decision-ready | P0 | none | Which processes survive `SIGTERM` on a live Session, and why - only the count was captured |
| n-0004 | investigating | framed | P1 | n-0003 | (1) Can a WezTerm route satisfy process ownership at all. (2) Does `proto-v1/` shorten the distance or carry the architecture to abandon. (3) What is the **measured** Presentation Check ceiling - research-derived only, and measurable under permission granted in c-0018 |
| n-0005 | investigating | framed | P1 | n-0003, n-0004 | Reduced to a bounded probe: does the WebdriverIO embedded-WebDriver path drive a packaged Tauri `.app` on macOS, and does the official Rust SDK binding remove the Node sidecar |
| n-0006 | investigating | framed | P1 | n-0003, n-0004, n-0005 | Reduced to a bounded probe: what does the Copilot seam cost from Swift, given no Swift SDK binding exists |
| n-0007 | investigating | vague | P1 | n-0003, n-0004, n-0005, n-0006 | What the rubric holds beyond the user-interface-automation criterion, and how criteria weigh - now including SDK language-binding availability, a second axis found in c-0018 |
| n-0008 | decision-ready | researched | P0 | none | (1) **Accepted unknown:** the SDK permission callback has never been observed firing (quota). (2) Whether the SDK exposes a session rename - needs an `npm install` in an isolation path, **not** a free read. (3) Whether `subagent.started` reaches an SDK client as a typed event or only through `events.jsonl` |
| n-0010 | scouted | framed | P1 | none | (1) What a Recap is derived from, and whether the runtime's event stream suffices. (2) Generated on demand or maintained continuously. (3) Whether a *useful* Recap is machine-checkable at all |

**Four nodes are off the frontier.** n-0003 (v2 Electron MVP) and n-0009
(Acceptance Harness) are at fog `promoted` - published in c-0019 as
[#29](https://github.com/jdylanmc/maestro/issues/29) and
[#30](https://github.com/jdylanmc/maestro/issues/30). n-0000 and n-0001 are at
fog `cleared`: n-0000 was promoted as the Branch and holds no questions, and
n-0001's specification content became the acceptance criteria of both Stories
rather than a work item of its own.

**The shape of the frontier has changed.** For eighteen cycles it was a list of
things blocking an MVP that did not exist. It is now a list of things that
follow one: n-0004 through n-0007 are the remaining routes and the evaluation
that consumes them, n-0002 and n-0008 are provider questions that gate no
committed work, and n-0010 is a P1 product capability deliberately excluded
from MVP scope. **No row on this table blocks [#29](https://github.com/jdylanmc/maestro/issues/29)
or [#30](https://github.com/jdylanmc/maestro/issues/30).**

## Priority Debt

| Lower-priority node | Outran (maturity below researched) | Relation | Cause | Detected | Last seen | Status |
| --- | --- | --- | --- | --- | --- | --- |

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

**The previous statement below is retained, and c-0017's reason still holds:**

**The table stayed empty in c-0017 for a reason worth stating**, because two
nodes advanced this cycle: both n-0003 and n-0009 are P0, and every P0 node in
the session sits at maturity `researched` or above, so no lower-priority node
outran anything and no weakening occurred. Debt detection is not the constraint
on this session any more - the branch gate is.

## Tracker Synchronization

| Node | Tier | Promotion key | Tracker item | Last synced cycle | Divergence |
| --- | --- | --- | --- | --- | --- |
| n-0000 | Branch | maestro-graphical-agent-orchestrator/n-0000 | [Issue #1](https://github.com/jdylanmc/maestro/issues/1) | c-0019 | none - **the seven-cycle divergence closed in c-0019.** |
| n-0001 | unpromoted - folded into Story context | none | relates to [Issue #18](https://github.com/jdylanmc/maestro/issues/18) | never | none |
| n-0002 | unpromoted | none | relates to [Issue #2](https://github.com/jdylanmc/maestro/issues/2), [Issue #11](https://github.com/jdylanmc/maestro/issues/11) | never | none |
| n-0003 | Story | maestro-graphical-agent-orchestrator/n-0003 | [Issue #29](https://github.com/jdylanmc/maestro/issues/29) | c-0019 | none |
| n-0004 | unpromoted | none | relates to [Issue #27](https://github.com/jdylanmc/maestro/issues/27) | never | none |
| n-0005 | unpromoted | none | relates to [Issue #23](https://github.com/jdylanmc/maestro/issues/23) | never | none |
| n-0006 | unpromoted | none | relates to [Issue #24](https://github.com/jdylanmc/maestro/issues/24) | never | none |
| n-0007 | unpromoted | none | none | never | none |
| n-0008 | unpromoted | none | none | never | none |
| n-0009 | Story | maestro-graphical-agent-orchestrator/n-0009 | [Issue #30](https://github.com/jdylanmc/maestro/issues/30) | c-0019 | none |
| n-0010 | unpromoted | none | none | never | none |

**First promotion in the session's history.** c-0019 published the Branch and two
Stories under the tier map approved in the same cycle: Branch = a `discovery:map`
issue, Story = a native sub-issue carrying its Discovery type marker, Task =
collapsed into the Story body. Both Stories are native sub-issues of Issue #1,
and [#29](https://github.com/jdylanmc/maestro/issues/29) carries a native
blocked-by edge to [#30](https://github.com/jdylanmc/maestro/issues/30).

**Six open child issues are stale and were deliberately not touched.** #4, #8,
#10, #13, #21, and #22 look answered by loop work - #10 "Choose the v2 Agent
execution model" in particular reads as settled by the c-0014 SDK seam. Closing
them is `/discovery`'s work at one non-research resolution per session, and this
loop runs no tracker command of its own. Recorded here so the next cycle does not
rediscover it.
