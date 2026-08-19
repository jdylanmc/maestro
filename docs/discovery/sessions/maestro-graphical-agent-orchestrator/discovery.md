---
schema-version: 1
session: maestro-graphical-agent-orchestrator
state-root: docs/discovery
revision: 6
anchor: https://github.com/jdylanmc/maestro/issues/1
anchor-revision: 2026-08-19T08:47:53-04:00
anchor-status: unchanged
question-group-size: 12
last-question-group-size: 7
last-cycle: c-0005
cycle-state: complete
state-digest: 1f8bd76508b321b1bedb01acdb739a2983ae56b26813ffb0cf85c04cec72693c
root-map-digest: 2bd0aba1a788bd38fd3ec2e596c7e3f6edbf1a0c677becfec3a342608bc26438
root-lexicon-digest: 0308c64bc9fa4669b267a3ce4d4c32cd5cef0217935e3acb7ac58d32f4d6871d
digest-tool: shasum -a 256
digest-status: verified
state-scope: full
tracker-mode: markdown-only
tracker-tier-map: unmapped
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
Maestro's shared MVP contract: a real graphical shell around named Sessions,
workspaces, a Primary Agent, recursively observable Squadron work, file and git
context, targeted controls, and restart reconciliation.

## Session Domain Lexicon

| Term | Status | Definition | Bounded context | Aliases | Source | First seen | Last verified | Related terms | Scope |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Agent | candidate | A runtime participant that can receive work and emit structured lifecycle or activity evidence. | Maestro orchestration | none | Issue #12; v2 architecture references | c-0001 | c-0005 | Primary Agent, Sub-agent | session:maestro-graphical-agent-orchestrator |
| Primary Agent | candidate | The single Agent serving as the command channel for one Session, in a strict 1:1 binding enforced by a lock. | Maestro Session | none | Issue #12; c-0005 | c-0001 | c-0005 | Agent, Session, Sub-agent tree | session:maestro-graphical-agent-orchestrator |
| Session | candidate | A named durable unit pairing one workspace, one Primary Agent, transcript, delegated topology, and restart state. | Maestro product | none | Issue #12; Issue #18 | c-0001 | c-0005 | Workspace, Primary Agent, Sub-agent tree | session:maestro-graphical-agent-orchestrator |
| Sub-agent | candidate | A delegated Agent represented in the Session's visible tree, holding its own endpoint and worktree. | Maestro orchestration | Squad Mate (discouraged); swarm agent (discouraged) | Issue #6; Issue #12; c-0005 | c-0001 | c-0005 | Agent, Sub-agent tree | session:maestro-graphical-agent-orchestrator |
| Sub-agent tree | candidate | The recursively nested visible hierarchy of a Session's Primary Agent and its Sub-agents. | Maestro orchestration | Squadron (discouraged); Swarm (discouraged); agent tree | Issue #6; Issue #12; c-0005 | c-0001 | c-0005 | Session, Sub-agent | session:maestro-graphical-agent-orchestrator |
| Squad Mate | deprecated | Superseded by `Sub-agent`. Retired in c-0005 with the military metaphor. | Maestro orchestration | none | c-0005 | c-0001 | c-0005 | Sub-agent | session:maestro-graphical-agent-orchestrator |
| Squadron | deprecated | Superseded by `Sub-agent tree`. Retired in c-0005 with the military metaphor. | Maestro orchestration | none | c-0005 | c-0001 | c-0005 | Sub-agent tree | session:maestro-graphical-agent-orchestrator |
| Workspace | candidate | The user's project-oriented visual and filesystem context associated with a Session. Its boundary against `Worktree` is unresolved. | Maestro product | none | Issue #18; proto-v1 README | c-0001 | c-0005 | Session, Worktree | session:maestro-graphical-agent-orchestrator |
| Worktree | candidate | The git worktree a Session and its Sub-agents operate in. Whether a Session is 1:1 with one, or merely contains one, is undecided. | Maestro product | none | c-0005 wireframe; firstmate-arch.md | c-0005 | c-0005 | Session, Workspace | session:maestro-graphical-agent-orchestrator |
| Parked | candidate | A Session deliberately stopped by the user: durable state is persisted, Agent processes are terminated, and uncommitted work is preserved. Not teardown. | Maestro Session | none | c-0005 | c-0005 | c-0005 | Interrupted, Session | session:maestro-graphical-agent-orchestrator |
| Interrupted | candidate | A Session stopped unintentionally, leaving in-flight work dangling. The opposite of `Parked`, and must be distinguishable from it in the store. | Maestro Session | none | Issue #9; c-0005 | c-0005 | c-0005 | Parked, Session | session:maestro-graphical-agent-orchestrator |

## Tree

### n-0000 - Maestro graphical agent orchestrator MVP

- Parent: none
- Fog: decision-ready
- Maturity: researched
- Priority: P0
- Outcome: Prove the shared Maestro MVP contract through one complete real flow on Electron, judged primarily on lifecycle ownership - durable Session state with strictly ephemeral Agent processes and verified-zero orphans on quit - and on a three-column Visual Studio Code-shaped layout where selecting a Session re-scopes every panel.
- Open questions: Does a real Electron BrowserWindow, packaging path, and supervisor teardown hold once Electron is installed? Is a Session 1:1 with a git Worktree? Should the deferral of in-app editing be reopened, given the wireframe specifies an editor? What is the full Session lifecycle state set beyond Parked and Interrupted? What bounded feasibility probes should run for WezTerm, Tauri/Rust, and native macOS, now that admission control and teardown are discriminators?
- Evidence: [Issue #1](https://github.com/jdylanmc/maestro/issues/1); [Issue #18](https://github.com/jdylanmc/maestro/issues/18); [Issue #12](https://github.com/jdylanmc/maestro/issues/12); [Issue #6](https://github.com/jdylanmc/maestro/issues/6); [Issue #9](https://github.com/jdylanmc/maestro/issues/9); [c-0005 wireframe and firstmate research](./cycles/c-0005.md)
- Links: none
- First seen: c-0001
- Former node id: none
- Reinterpreted: c-0005 (intact)
- Promotion key: none
- Tracker: none
- Divergence: The c-0005 wireframe specifies a file editor, which contradicts Issue #12's explicit deferral of in-app editing. Unresolved; file panes are treated as read-only viewers meanwhile.
- History: c-0001 created from Issue #1 and grounded in the existing cross-prototype contract; c-0001 settled the proving slice and sequencing; c-0003 validated the Electron runtime/state boundary probe; c-0004 deferred real Electron installation and window validation; c-0005 confirmed Electron as the first route, established that no Agent process may outlive the application after an observed orphan defect in the v1.1 WezTerm build, set a ceiling of 8 concurrent Sessions with in-panel resource metering and active admission control, captured a three-column wireframe with global Session-scoped selection, confirmed the 1:1 Session/Primary Agent binding against firstmate's lock model, and retired the military vocabulary in favour of plain literal nouns; maturity lowered one level to researched because the form of the destination proved less settled than the tree recorded, the user having floated neovim, the GitHub app, tmux, and a Visual Studio Code extension within one cycle

## Active Frontier

| Node | Fog | Maturity | Priority | Blocked by | Open questions |
| --- | --- | --- | --- | --- | --- |
| n-0000 | decision-ready | researched | P0 | unbuilt Electron probe; unconfirmed vocabulary (no domain contract) | Real BrowserWindow, packaging, and supervisor teardown; Session-to-Worktree cardinality; the in-app editing contradiction; the full Session lifecycle state set |

## Priority Debt

| Lower-priority node | Outran (maturity below researched) | Relation | Cause | Detected | Last seen | Status |
| --- | --- | --- | --- | --- | --- | --- |

## Tracker Synchronization

| Node | Tier | Promotion key | Tracker item | Last synced cycle | Divergence |
| --- | --- | --- | --- | --- | --- |
