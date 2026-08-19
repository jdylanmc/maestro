# Maestro

Maestro is a macOS application for running several units of agent work at the
same time and keeping them visible and controllable. It concerns itself with
what the work is, who is doing it, whether it is still running, and where it is
happening.

## Language

### Units of work

**Fleet**

One unit of parallel work: a named, durable body of work on a single feature,
carried out by one Copilot Session and the subagents it delegates to. A Fleet
outlives the processes that serve it.

Discouraged aliases: `Session` (structural sense), `Workspace`, `Squadron`

**Session**

A Copilot conversation, named and resumable by the runtime. Exactly one serves a
Fleet at a time. Defined by the Copilot runtime; this domain borrows the term
and does not redefine it.

**Task**

A unit of delegated or background work that the runtime tracks and can resume.
Every subagent is a Task; not every Task is a subagent, because shell commands
are also Tasks.

### Participants

**Primary Agent**

What a Fleet's Session is called on screen. A presentation term, not a distinct
participant.

**Agent**

A selectable persona or configuration. Reserved for the Copilot meaning; it
never means a running participant.

**subagent**

A delegated agent working under a Fleet's Session, with its own observable
start, activity, and completion.

Discouraged aliases: `Sub-agent`, `Squad Mate`, `swarm agent`

**subagent tree**

The nested hierarchy of a Fleet's subagents and their descendants.

Discouraged aliases: `Sub-agent tree`, `Squadron`, `Swarm`

### Condition

**Parked**

A Fleet deliberately stopped: state preserved, processes ended, uncommitted work
kept. Not teardown.

**Interrupted**

A Fleet stopped unintentionally, leaving work dangling. Distinguishable from
Parked.

**Liveness**

Whether a Fleet's processes are observed to be `Alive`, `Dead`, or `Ambiguous`.
Independent of whether the Fleet is Parked or Interrupted, and never assumed.

### Place

**Worktree**

The isolated checkout a Fleet works in. A Fleet normally has its own, which
implies its own branch, but may instead share an existing checkout.
