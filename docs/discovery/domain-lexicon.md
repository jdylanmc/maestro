---
schema-version: 1
state-root: docs/discovery
last-updated-cycle: maestro-graphical-agent-orchestrator/c-0005
---

# Shared Domain Lexicon

| Term | Status | Definition | Bounded context | Aliases | Source | First seen | Last verified | Related terms | Scope |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Agent | candidate | A runtime participant that can receive work and emit structured lifecycle or activity evidence. | Maestro orchestration | none | Issue #12; v2 architecture references | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0005 | Primary Agent, Sub-agent | shared |
| Primary Agent | candidate | The single Agent serving as the command channel for one Session, in a strict 1:1 binding enforced by a lock. | Maestro Session | none | Issue #12; c-0005 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0005 | Agent, Session, Sub-agent tree | shared |
| Session | candidate | A named durable unit pairing one workspace, one Primary Agent, transcript, delegated topology, and restart state. | Maestro product | none | Issue #12; Issue #18 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0005 | Workspace, Primary Agent, Sub-agent tree | shared |
| Sub-agent | candidate | A delegated Agent represented in the Session's visible tree, holding its own endpoint and worktree. | Maestro orchestration | Squad Mate (discouraged); swarm agent (discouraged) | Issue #6; Issue #12; c-0005 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0005 | Agent, Sub-agent tree | shared |
| Sub-agent tree | candidate | The recursively nested visible hierarchy of a Session's Primary Agent and its Sub-agents. | Maestro orchestration | Squadron (discouraged); Swarm (discouraged); agent tree | Issue #6; Issue #12; c-0005 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0005 | Session, Sub-agent | shared |
| Squad Mate | deprecated | Superseded by `Sub-agent`. Retired in c-0005 with the military metaphor. | Maestro orchestration | none | c-0005 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0005 | Sub-agent | shared |
| Squadron | deprecated | Superseded by `Sub-agent tree`. Retired in c-0005 with the military metaphor. | Maestro orchestration | none | c-0005 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0005 | Sub-agent tree | shared |
| Workspace | candidate | The user's project-oriented visual and filesystem context associated with a Session. Its boundary against `Worktree` is unresolved. | Maestro product | none | Issue #18; proto-v1 README | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0005 | Session, Worktree | shared |
| Worktree | candidate | The git worktree a Session and its Sub-agents operate in. Whether a Session is 1:1 with one, or merely contains one, is undecided. | Maestro product | none | c-0005 wireframe; firstmate-arch.md | maestro-graphical-agent-orchestrator/n-0000/c-0005 | c-0005 | Session, Workspace | shared |
| Parked | candidate | A Session deliberately stopped by the user: durable state is persisted, Agent processes are terminated, and uncommitted work is preserved. Not teardown. | Maestro Session | none | c-0005 | maestro-graphical-agent-orchestrator/n-0000/c-0005 | c-0005 | Interrupted, Session | shared |
| Interrupted | candidate | A Session stopped unintentionally, leaving in-flight work dangling. The opposite of `Parked`, and must be distinguishable from it in the store. | Maestro Session | none | Issue #9; c-0005 | maestro-graphical-agent-orchestrator/n-0000/c-0005 | c-0005 | Parked, Session | shared |
