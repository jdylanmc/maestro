# Domain Model - Maestro Graphical Agent Orchestrator

## Confirmed Domain Model

No terms have been confirmed through `/domain-mapping` yet.

The blocker that previously prevented confirmation is **cleared**. Earlier
revisions of this file stated that `docs/agents/domain.md` did not exist and
that no confirmed row could cite a canonical artifact location. That file now
exists, alongside `docs/agents/issue-tracker.md` and
`docs/agents/triage-labels.md`. Confirmation is therefore possible, and the
staged handoff is the next action rather than a blocked one.

Every term below remains `candidate` until that handoff completes.

## Decided but Unconfirmed

### The unit is a Fleet (c-0007)

A **Fleet** is one feature, one Worktree, one Copilot Session, its subagent
tree, and its durable state. It replaces `Session` as the structural unit.

Three independent reasons converged:

1. It is the user's own spontaneous word, so it costs nothing to learn under the
   recorded adoption constraint.
2. The Copilot CLI already uses `/fleet` for "fleet mode for parallel subagent
   execution" - the runtime's term for approximately the same idea.
3. It releases `Session` to mean exactly what Copilot means by it, eliminating
   the collision rather than relocating it.

This **partially reverses the c-0005 decision** to retire military metaphors in
favour of plain literal nouns. The reversal was put to the user explicitly and
accepted. The distinction that justifies it: c-0005 was rejecting *invented*
vocabulary carrying an indefinite teaching cost, whereas `Fleet` is vocabulary
the user and the runtime already use. `Squadron` and `Squad Mate` stay
deprecated and are not revived.

### `Workspace` is retired as a structural term (c-0007)

It is triple-booked: Copilot owns it through per-session `workspace.yaml` files
and `~/.copilot/workspaces/`; Visual Studio Code owns it; and this model had its
own conflicting meaning. Renaming the unit to `Workspace` was considered and
rejected for that reason.

### `Agent` and `Primary Agent` are not domain entities (c-0007)

Copilot's `--agent` and `/agent` select a persona or configuration. Our former
meaning - a running actor - is not needed, because a Fleet contains exactly one
Copilot Session and that Session **is** the actor. The runtime confirms this
shape: `assistant.turn_start`, `assistant.turn_end`, and `assistant.message` are
session-level events with no agent identifier, while delegates emit their own
`subagent.started` and `subagent.completed`.

Consequence: the lock-enforced 1:1 binding borrowed from firstmate is no longer
a requirement to satisfy. One Session per Fleet makes the binding structural, so
it cannot be violated.

**`Primary Agent` survives as an interface term** for a Fleet's chat surface,
because the user speaks that way. The word `Session` need not appear in the
interface at all.

This was decided by the loop under a `delegated-to-loop` answer in c-0007, then
**revised within the same cycle** when the user spontaneously used the phrase
"primary agent window". The loop had deleted a term the user actively speaks,
which contradicts the reasoning it had just used to adopt `Fleet`. The
inconsistency is recorded rather than quietly corrected.

### Other alignments with the runtime (c-0007)

- `Sub-agent` is respelled **`subagent`**, matching the event stream and
  `/subagents`.
- **`Task`** is adopted for a tree node's underlying runtime handle. `/tasks`
  manages "tasks (subagents and shell commands)" and `--resume` accepts a task
  ID, so Maestro uses the runtime's handle rather than inventing one.
- Maestro sets the runtime's session name with `-n, --name` rather than keeping
  a private name.

### Lifecycle is two axes, not one (c-0007)

- **Fleet state**, durable, expressing intent: `Active`, `Parked`,
  `Interrupted`, `Failed`.
- **Liveness**, observed per launch from process evidence, never persisted as
  truth: `Alive`, `Dead`, `Ambiguous`.

Decided by the loop under a `delegated-to-loop` answer. c-0006 observed a Fleet
that was durably Active while its processes were orphaned and its host was gone;
a flat state set cannot express that combination, and the combination is the
defect. `/ship-with-squadron` reaches the same separation independently, holding
durable ticket state in a ledger and deriving worker health from heartbeats.

### Retained from earlier cycles

- **Parked** is a deliberate stop: state persisted, processes terminated,
  uncommitted work preserved. It is not teardown and not process suspension.
- **Interrupted** is the unintended counterpart and must be distinguishable from
  Parked in the store.
- A fully orchestral vocabulary - Concertmaster, Section, Rest, Cue - was
  considered in c-0005 and rejected as invented vocabulary.

## Candidate and Unconfirmed

`Fleet`, `Worktree`, `subagent`, `subagent tree`, `Task`, `Parked`,
`Interrupted`, `Alive`, `Dead`, and `Ambiguous` are candidate terms.

`Session` is candidate **with a borrowed definition**: it means what the Copilot
runtime means, and this model does not redefine it.

The boundary between runtime authority, durable orchestration state, and
presentation state remains unresolved.

## Known Gaps in the Vocabulary

Concepts in use that still have no term:

- **Attention** - the actionable-versus-absorbable distinction deciding which of
  up to 8 Fleets should pull the user's eye. `/ship-with-squadron` defines
  `AT_RISK` as stale heartbeat, or under 15 minutes to a milestone with an
  unresolved blocker; the c-0007 decision to stay fully generic puts that
  definition out of reach, so a replacement must be derived from generic runtime
  events.
- **Activity** - the "what it is doing right now" line shown per subagent.
- **Capacity** and **admission** - the host-resource guardrail.
- **Focus** - the global selection that re-scopes every panel.
- **Supervisor** - the process that owns and reaps children. c-0006 gave this
  observed behavior to define against.
- **Transcript** - used inside the unit definition but never defined.
- **Teardown** - distinct from park and from close, gated on landed-work proof.

Terms the runtime owns that this model has no row for, and may need: `turn`,
`checkpoint`, `plan`, `skill`, `tool`, `MCP`, `mode`, `compaction`, `rewind`,
and `hook`.

**Unconsidered surface:** Copilot session state carries an `inbox_entries` table
with sender, recipient session, unread, and read-at columns, implying
inter-session messaging that no cycle has examined.
