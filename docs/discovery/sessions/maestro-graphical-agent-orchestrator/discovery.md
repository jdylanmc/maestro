---
schema-version: 1
session: maestro-graphical-agent-orchestrator
state-root: docs/discovery
revision: 11
anchor: https://github.com/jdylanmc/maestro/issues/1
anchor-revision: 2026-08-19T08:47:53-04:00
anchor-status: unchanged
question-group-size: 12
last-question-group-size: 2
last-cycle: c-0010
cycle-state: complete
state-digest: 9f45f872c9250e1e51591d07cc486d3b47dc14e8d653eaa5f944af693b564cfc
root-map-digest: d3619f69cbe739cbf5c24bacb53c809a060a32a1980f21830bd8d6f072e6bb2d
root-lexicon-digest: 996bd740e483473691d06862dd280b3ac5929e3c4dfbea7ac4ecf803307c5ed5
digest-tool: shasum -a 256
digest-status: verified
state-scope: full
tracker-mode: remote
tracker-tier-map: n-0000 -> Issue #1 (discovery:map)
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
| Squad Mate | deprecated | Superseded by `subagent`. Retired in c-0005. | Maestro orchestration | none | c-0005 | c-0001 | c-0007 | subagent | session:maestro-graphical-agent-orchestrator |
| Squadron | deprecated | Superseded by `subagent tree`. Retired in c-0005. | Maestro orchestration | none | c-0005 | c-0001 | c-0007 | subagent tree | session:maestro-graphical-agent-orchestrator |

## Tree

### n-0000 - Maestro graphical agent orchestrator MVP

- Parent: none
- Fog: decision-ready
- Maturity: researched
- Priority: P0
- Outcome: Prove the shared Maestro MVP contract through one complete real flow on Electron, judged primarily on lifecycle ownership - durable Fleet state with strictly ephemeral processes and verified-zero orphans on quit - and on a three-column Visual Studio Code-shaped layout where selecting a Fleet re-scopes every panel and always presents that Fleet's primary agent window.
- Open questions: Does packaging, as opposed to the development-run lifecycle, preserve the supervision property? Do live Copilot sessions with their own signal handlers tear down like the synthetic trees? Does the Attention predicate hold against a genuinely blocked session, which local evidence never contained? Does the 8-Fleet ceiling survive mandatory worktree-per-Fleet in the actual target monorepo? What bounded feasibility probes should run for WezTerm, Tauri/Rust, and native macOS? (Sibling awareness, the Attention rule, tree depth, and the messaging surface were resolved in c-0010.)
- Evidence: [Issue #1](https://github.com/jdylanmc/maestro/issues/1); [Issue #18](https://github.com/jdylanmc/maestro/issues/18); [Issue #12](https://github.com/jdylanmc/maestro/issues/12); [Issue #6](https://github.com/jdylanmc/maestro/issues/6); [Issue #9](https://github.com/jdylanmc/maestro/issues/9); [c-0005 wireframe and firstmate research](./cycles/c-0005.md); [c-0006 live orphan-process forensics](./cycles/c-0006.md); [c-0007 worktree experiment, ship-with-squadron specification, and Copilot vocabulary extraction](./cycles/c-0007.md)
- Links: none
- First seen: c-0001
- Former node id: none
- Reinterpreted: c-0005 (intact)
- Promotion key: none
- Tracker: none
- Divergence: none outstanding. The c-0005 wireframe's file editor contradicted Issue #12's deferral; c-0008 resolved it in favour of read-only viewers with an "open in Visual Studio Code" action, and no editor is built. **Both c-0007 tracker divergences were reconciled in c-0008.** The map body was rewritten in confirmed vocabulary; #5 carries a correcting comment recording that its naming decision is falsified; #6, #12, #14, and #17 carry vocabulary substitution tables; #6 and #17 were retitled. `CONTEXT.md` is authoritative over any remaining issue-body wording.
- History: c-0001 created from Issue #1 and grounded in the existing cross-prototype contract; c-0001 settled the proving slice and sequencing; c-0003 validated the Electron runtime/state boundary probe; c-0004 deferred real Electron installation and window validation; c-0005 confirmed Electron as the first route, established that no Agent process may outlive the application after an observed orphan defect in the v1.1 WezTerm build, set a ceiling of 8 concurrent Sessions with in-panel resource metering and active admission control, captured a three-column wireframe with global Session-scoped selection, confirmed the 1:1 Session/Primary Agent binding against firstmate's lock model, and retired the military vocabulary in favour of plain literal nouns; maturity lowered one level to researched because the form of the destination proved less settled than the tree recorded, the user having floated neovim, the GitHub app, tmux, and a Visual Studio Code extension within one cycle; c-0006 corrected c-0005's erroneous retraction of the orphan defect by observing the running system rather than the repository source, identifying a detached `herdr server` daemon that kept Sessions and Model Context Protocol servers alive for two days past application exit while macOS attributed their permission prompts to Maestro through inherited responsibility, and hardened lifecycle ownership into seven verifiable non-functional requirements; c-0007 reconciled the vocabulary against the Copilot runtime and renamed the structural unit to Fleet, released `Session` and `Agent` to their runtime meanings, retired `Workspace` as triple-booked, respelled `subagent`, adopted `Task`, settled lifecycle onto two independent axes, made worktree-per-Fleet the strong default with branch-per-Fleet as a verified consequence, chose a fully generic display model over orchestration-specific awareness, and bound a primary agent window 1:1 to each Fleet; c-0008 confirmed the vocabulary through `/domain-mapping`, which published `CONTEXT.md` and the first Architecture Decision Record and corrected two definitions, resolved the in-app editing contradiction in favour of read-only viewers, settled that closing the application auto-Parks every Fleet behind an acknowledged summary, and moved the tracker to `remote`, reconciling the map, five issues, two titles, and the missing v3/v4 dependency edges that had left prototypes unblocked ahead of their own research; c-0009 ran the first approved prototype and cleared the node's last blocker, confirming in Electron's real lifecycle that a supervisor can hold three Fleets as three process groups and reach zero survivors on quit, while falsifying the c-0006 requirement to spawn non-detached - a non-detached child is not a process-group leader and cannot be signalled as a group at all, so detachment paired with durable process-group ownership and a reap-on-launch step is the only strategy measured to work

## Active Frontier

| Node | Fog | Maturity | Priority | Blocked by | Open questions |
| --- | --- | --- | --- | --- | --- |
| n-0000 | decision-ready | researched | P0 | none | Packaging versus development-run lifecycle; live Copilot signal handling; the Attention predicate under a real block; the 8-Fleet ceiling in the target monorepo |

## Priority Debt

| Lower-priority node | Outran (maturity below researched) | Relation | Cause | Detected | Last seen | Status |
| --- | --- | --- | --- | --- | --- | --- |

## Tracker Synchronization

| Node | Tier | Promotion key | Tracker item | Last synced cycle | Divergence |
| --- | --- | --- | --- | --- | --- |
| n-0000 | map | maestro-graphical-agent-orchestrator/n-0000 | [Issue #1](https://github.com/jdylanmc/maestro/issues/1) | c-0008 | none |
