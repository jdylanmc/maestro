# Domain Model - Maestro Graphical Agent Orchestrator

## Confirmed Domain Model

The repository root [`CONTEXT.md`](../../../../CONTEXT.md) is authoritative.
It was revised by the accepted
[`docs/adr/0004-retire-fleet.md`](../../../../docs/adr/0004-retire-fleet.md)
after Maestro narrowed from an orchestrator to an observability plugin.

- **Session** is the runtime-owned structural unit Maestro observes: one
  resumable Copilot conversation and the subagents it delegates.
- **Task** is a runtime unit of background work. Every subagent is a Task; shell
  commands are Tasks that are not subagents.
- **Agent** remains reserved for a selectable Copilot persona.
- A **subagent** is a delegated agent under a Session.
- The **subagent tree** is the hierarchy Maestro reconstructs and renders. It
  is the only domain concept naming something Maestro itself produces.
- **Liveness** is the observed `Alive`, `Dead`, or `Ambiguous` process-evidence
  verdict for a Session.
- **Attention** means a Session is observed to want its human.
- The **Host Application** owns the Session process lifetime and the operating
  system identity attributed to its permission prompts. For the current route,
  cmux is the Host Application and Maestro runs inside it.

`Fleet`, `Parked`, `Interrupted`, `Primary Agent`, `Worktree`, and `Recap` are
deprecated. Their referents disappeared when Maestro stopped enforcing
worktrees, owning durable lifecycle intent, and presenting a standalone
application. Existing checkpoints keep the historical wording.

## Candidate and Unconfirmed

- **Activity** - the current work shown for one subagent. The interface uses the
  idea, but no domain definition is needed unless another bounded context uses
  the term differently.
- cmux's persisted Copilot hook records are not yet a domain authority for
  Session identity. c-0029 measured many records for one process and transcript,
  so one stored row cannot currently be treated as one Session.
- cmux's documented lifecycle vocabulary is not yet reliable evidence for live
  work. c-0029 observed only `idle`, including during a ten-second tool call.
