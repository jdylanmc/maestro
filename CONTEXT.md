# Maestro

Maestro makes agent work visible inside a terminal the operator already uses. It
reads a Copilot session's own event log and shows what that session delegated to,
live. It concerns itself with what the work is, who is doing it, and when it
wants its human.

## Language

### Units of work

**Session**

A Copilot conversation, named and resumable by the runtime, together with the
subagents it delegates to. The unit Maestro observes. Defined by the Copilot
runtime; this domain borrows the term and does not redefine it.

Discouraged aliases: `Fleet`, `Workspace`, `Squadron`

**Task**

A unit of delegated or background work that the runtime tracks and can resume.
Every subagent is a Task; not every Task is a subagent, because shell commands
are also Tasks.

### Participants

**Agent**

A selectable persona or configuration. Reserved for the Copilot meaning; it
never means a running participant.

**subagent**

A delegated agent working under a Session, with its own observable start,
activity, and completion.

Discouraged aliases: `Sub-agent`, `Squad Mate`, `swarm agent`

**subagent tree**

The nested hierarchy of a Session's subagents and their descendants. Maestro's
reason to exist: the runtime records it but presents it nowhere.

Discouraged aliases: `Sub-agent tree`, `Squadron`, `Swarm`

### Condition

**Liveness**

Whether a Session's processes are observed to be `Alive`, `Dead`, or
`Ambiguous`. Observed from process evidence, never assumed and never persisted
as truth.

**Attention**

A Session observed to want its human: blocked on an unanswered permission
request, stopped by an error or an abort, or finished and unacknowledged.
Observed per Session and never inferred from another Session.

Discouraged aliases: `AT_RISK`

### Place

**Host Application**

The application a Session runs inside. It owns the lifetime of the Session's
processes and is the identity the operating system attributes their permission
prompts to. Maestro runs inside a Host Application rather than being one.

Discouraged aliases: `host` (bare - reserved for the machine), `shell`,
`harness`, `container`
