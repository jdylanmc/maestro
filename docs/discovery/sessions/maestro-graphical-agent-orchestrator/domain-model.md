# Domain Model - Maestro Graphical Agent Orchestrator

## Confirmed Domain Model

No material domain meanings have been confirmed through `/domain-mapping`.

`docs/agents/domain.md` does not exist in this repository - `docs/agents/` is
absent entirely - so the canonical artifact locations a confirmed row must cite
are undefined. Until that contract exists, every term below stays `candidate`
however firmly it has been decided.

## Decided but Unconfirmed

- **Naming system: plain literal nouns.** Decided by the user in c-0005. The
  structural vocabulary uses Session, Agent, Sub-agent, Worktree, Parked, and
  Interrupted. "Maestro" is retained only as the product name and interface
  chrome. The rationale is the recorded input-model-continuity constraint:
  literal nouns cost nothing to learn, and the user has stated that learning new
  vocabulary and new keymaps is expensive.
- **Retired to discouraged aliases:** `Squadron`, `Squad Mate`, and `Swarm`.
  These were three labels for two concepts, drawn from military and biological
  metaphors that collided with the musical metaphor in the product name. The
  entries are kept with pointers to their replacements rather than deleted.
- **A fully orchestral vocabulary was considered and rejected.** Concertmaster,
  Section, Rest, and Cue map unusually well onto the domain - Rest in particular
  captures the deliberate-silence sense of Parked that this cycle first got
  wrong. It was rejected because it is a vocabulary the user would have to learn
  and re-teach indefinitely, which contradicts the adoption constraint.
- **1:1 Session to Primary Agent**, enforced by a lock rather than convention.

## Candidate and Unconfirmed

- `Session`, `Primary Agent`, `Sub-agent`, `Sub-agent tree`, `Workspace`,
  `Worktree`, `Agent`, `Parked`, and `Interrupted` are candidate terms.
- The boundary between runtime authority, durable orchestration state, and
  presentation state remains unresolved.

## Known Gaps in the Vocabulary

Concepts used throughout the discussion that have no term yet:

- **Lifecycle** - the full Session state set. `Parked` and `Interrupted` are
  named, but the complete set and its transitions are not. This gap caused a
  concrete error in c-0005, where park was modelled as process survival and the
  wrong architecture was briefly recommended as a result.
- **Attention** - the actionable-versus-absorbable distinction that decides
  which of up to 8 Sessions should pull the user's eye.
- **Liveness** - the alive, dead, or `ambiguous` classification that determines
  whether orphaned processes can be ruled out.
- **Activity** - the "what it is doing right now" line shown per Sub-agent.
- **Capacity** and **admission** - the host-resource guardrail.
- **Focus** - the global selection that re-scopes every panel.
- **Supervisor** - the process that owns and reaps children.
- **Transcript** - used inside the `Session` definition but never defined.
- **Teardown** - distinct from park and from close, gated on landed-work proof.

`Workspace` versus `Worktree` is an open conflict, not merely a gap: the
wireframe pairs Sessions with worktrees, but whether a Session is 1:1 with a git
worktree or merely contains one is undecided.
