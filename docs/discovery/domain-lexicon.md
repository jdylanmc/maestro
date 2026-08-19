---
schema-version: 1
state-root: docs/discovery
last-updated-cycle: maestro-graphical-agent-orchestrator/c-0007
---

# Shared Domain Lexicon

| Term | Status | Definition | Bounded context | Aliases | Source | First seen | Last verified | Related terms | Scope |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fleet | candidate | The structural unit of Maestro: one feature, one Worktree, one Copilot Session, its subagent tree, and its durable state. | Maestro product | fleet (spoken); Session (superseded structural sense) | c-0007; Copilot CLI `/fleet` | maestro-graphical-agent-orchestrator/n-0000/c-0007 | c-0007 | Session, Worktree, subagent tree | shared |
| Session | candidate | Borrowed from the Copilot runtime and not redefined: a named, resumable Copilot conversation, nameable with `-n, --name` and resolvable by name via `--resume`. Exactly one per Fleet. | Copilot runtime | none | Copilot CLI `--help`; c-0007 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0007 | Fleet, Task, subagent | shared |
| Primary Agent | interface-only | The interface term for a Fleet's chat surface. Not a domain entity. | Maestro interface | none | c-0007 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0007 | Fleet, Session | shared |
| Agent | reserved | Reserved for the Copilot meaning: a selectable persona or configuration chosen with `--agent` or `/agent`. No longer means a running actor. | Copilot runtime | none | Copilot CLI `--help`; c-0007 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0007 | Session, skill | shared |
| subagent | candidate | A delegated unit of work under a Fleet's Session, emitting `subagent.started` and `subagent.completed`. | Copilot runtime | Sub-agent (superseded spelling); Squad Mate (deprecated) | Copilot event stream; Issue #6; c-0007 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0007 | subagent tree, Task | shared |
| subagent tree | candidate | The nested visible hierarchy of a Fleet's subagents. | Maestro orchestration | Sub-agent tree (superseded spelling); Squadron (deprecated) | Issue #6; c-0005; c-0007 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0007 | Fleet, subagent | shared |
| Task | candidate | The runtime's handle for a unit of delegated or background work; `/tasks` manages "tasks (subagents and shell commands)". | Copilot runtime | none | Copilot CLI `--help`; c-0007 | maestro-graphical-agent-orchestrator/n-0000/c-0007 | c-0007 | subagent, Session | shared |
| Worktree | candidate | The git worktree a Fleet operates in. Strong default of one per Fleet, reinforced but not enforced; implies one branch per Fleet. | Maestro product | none | c-0007 experiment; firstmate-arch.md | maestro-graphical-agent-orchestrator/n-0000/c-0005 | c-0007 | Fleet | shared |
| Workspace | deprecated | Retired as a structural term in c-0007: triple-booked across Copilot, Visual Studio Code, and this model. | Maestro product | none | c-0007 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0007 | Fleet, Worktree | shared |
| Parked | candidate | A Fleet deliberately stopped: durable state persisted, processes terminated, uncommitted work preserved. Not teardown. On the intent axis. | Maestro Fleet | none | c-0005 | maestro-graphical-agent-orchestrator/n-0000/c-0005 | c-0007 | Interrupted, Fleet | shared |
| Interrupted | candidate | A Fleet stopped unintentionally, leaving in-flight work dangling. The opposite of Parked and distinguishable from it in the store. | Maestro Fleet | none | Issue #9; c-0005 | maestro-graphical-agent-orchestrator/n-0000/c-0005 | c-0007 | Parked, Fleet | shared |
| Liveness | candidate | The observed process-evidence axis, independent of Fleet state: Alive, Dead, or Ambiguous. Recomputed each launch, never persisted as truth. | Maestro orchestration | none | firstmate-arch.md; c-0006; c-0007 | maestro-graphical-agent-orchestrator/n-0000/c-0007 | c-0007 | Fleet, Parked | shared |
| Squad Mate | deprecated | Superseded by `subagent`. Retired in c-0005. | Maestro orchestration | none | c-0005 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0007 | subagent | shared |
| Squadron | deprecated | Superseded by `subagent tree`. Retired in c-0005. | Maestro orchestration | none | c-0005 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0007 | subagent tree | shared |
