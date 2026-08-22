---
schema-version: 1
state-root: docs/discovery
last-updated-cycle: maestro-graphical-agent-orchestrator/c-0029
---

# Shared Domain Lexicon

| Term | Status | Definition | Bounded context | Aliases | Source | First seen | Last verified | Related terms | Scope |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Agent | confirmed | A selectable Copilot persona or configuration; never a running participant. | Copilot runtime | none | [`CONTEXT.md`](../../CONTEXT.md) | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0029 | Session | shared |
| Attention | confirmed | A Session observed to want its human: blocked on an unanswered permission request, stopped by an error or abort, or finished and unacknowledged. | Maestro observation | AT_RISK (discouraged) | [`CONTEXT.md`](../../CONTEXT.md) | maestro-graphical-agent-orchestrator/n-0000/c-0010 | c-0029 | Session, Liveness | shared |
| Fleet | deprecated | Former Maestro-owned unit of work; retired when its worktree and durable-lifecycle properties left scope. | Historical Maestro product | fleet | [`ADR 0004`](../adr/0004-retire-fleet.md) | maestro-graphical-agent-orchestrator/n-0000/c-0007 | c-0029 | Session | shared |
| Host Application | confirmed | The application a Session runs inside; it owns process lifetime and the operating-system identity attributed to permission prompts. | Maestro observation | host (discouraged), shell (discouraged) | [`CONTEXT.md`](../../CONTEXT.md) | maestro-graphical-agent-orchestrator/n-0011/c-0021 | c-0029 | Session | shared |
| Interrupted | deprecated | Former durable intent for an unintentionally stopped Fleet; Maestro no longer persists this state. | Historical Maestro product | none | [`ADR 0004`](../adr/0004-retire-fleet.md) | maestro-graphical-agent-orchestrator/n-0000/c-0005 | c-0029 | Fleet | shared |
| Liveness | confirmed | Whether a Session's processes are observed to be Alive, Dead, or Ambiguous; never persisted as truth. | Maestro observation | none | [`CONTEXT.md`](../../CONTEXT.md) | maestro-graphical-agent-orchestrator/n-0000/c-0007 | c-0029 | Session, Attention | shared |
| Parked | deprecated | Former durable intent for a deliberately stopped Fleet; Maestro no longer persists this state. | Historical Maestro product | none | [`ADR 0004`](../adr/0004-retire-fleet.md) | maestro-graphical-agent-orchestrator/n-0000/c-0005 | c-0029 | Fleet | shared |
| Primary Agent | deprecated | Former interface name for a Fleet's Session pane; the Host Application now presents the Session directly. | Historical Maestro interface | none | [`ADR 0004`](../adr/0004-retire-fleet.md) | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0029 | Session | shared |
| Recap | deprecated | Former account of a Fleet's work; it may return only if a Session Recap is implemented. | Historical Maestro product | Orientation (discouraged) | [`ADR 0004`](../adr/0004-retire-fleet.md) | maestro-graphical-agent-orchestrator/n-0010/c-0019 | c-0029 | Session | shared |
| Session | confirmed | A runtime-owned, resumable Copilot conversation together with the subagents it delegates; the unit Maestro observes. | Copilot runtime | Fleet (discouraged), Workspace (discouraged) | [`CONTEXT.md`](../../CONTEXT.md) | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0029 | Task, subagent, Host Application | shared |
| Squad Mate | deprecated | Superseded by `subagent`. | Historical Maestro product | none | c-0005 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0029 | subagent | shared |
| Squadron | deprecated | Superseded by `subagent tree`. | Historical Maestro product | none | c-0005 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0029 | subagent tree | shared |
| Task | confirmed | A runtime-tracked unit of delegated or background work. Every subagent is a Task; shell-command Tasks are not subagents. | Copilot runtime | none | [`CONTEXT.md`](../../CONTEXT.md) | maestro-graphical-agent-orchestrator/n-0000/c-0007 | c-0029 | Session, subagent | shared |
| Worktree | deprecated | Plain git vocabulary; no longer a Maestro domain term because Maestro does not create or enforce one. | Historical Maestro product | none | [`ADR 0004`](../adr/0004-retire-fleet.md) | maestro-graphical-agent-orchestrator/n-0000/c-0005 | c-0029 | Fleet | shared |
| Workspace | deprecated | Retired as a structural term because Copilot and Visual Studio Code already own it. | Historical Maestro product | none | c-0007 | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0029 | Session | shared |
| subagent | confirmed | A delegated agent under a Session, with observable start, activity, and completion. | Copilot runtime | Sub-agent (discouraged), Squad Mate (deprecated) | [`CONTEXT.md`](../../CONTEXT.md) | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0029 | Session, Task, subagent tree | shared |
| subagent tree | confirmed | The nested hierarchy of a Session's subagents; the surface Maestro reconstructs and renders. | Maestro observation | Squadron (deprecated), Swarm (deprecated) | [`CONTEXT.md`](../../CONTEXT.md) | maestro-graphical-agent-orchestrator/n-0000/c-0001 | c-0029 | Session, subagent | shared |
