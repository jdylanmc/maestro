# Retire `Fleet`

`Fleet` named a unit of work Maestro owned: one feature, one worktree, one
Copilot session, its subagent tree, and its durable state. Maestro's scope
narrowed to observing agent work rather than orchestrating it, which removed
worktree enforcement and durable lifecycle state, and the two properties left
were exactly a Copilot session and its subagents. The term stopped naming
anything distinct, so it is retired and the structural role returns to
`Session`, the runtime term it was carved out of in
[0001](./0001-adopt-fleet-as-the-structural-unit.md).

## Status

Accepted. Supersedes [0001](./0001-adopt-fleet-as-the-structural-unit.md).

## Considered Options

- **Retire it and give the structural role back to `Session`.** Chosen. The
  collision that justified `0001` no longer exists: Maestro does not own a unit
  of work that competes with the runtime's `session`, so borrowing the runtime's
  term costs nothing and one fewer word stands between a reader and the code.
  `Fleet` is retained as a discouraged alias so existing prose still resolves.
- **Keep `Fleet` as a lighter concept** meaning "a session Maestro is watching."
  Rejected. It would be a synonym for `Session` with a different spelling, which
  is the failure `0001` was written to prevent, pointed the other way.
- **Keep `Fleet` and reinstate the properties that gave it meaning.** Rejected
  by the scope decision rather than here. Worktree enforcement and durable
  `Parked`/`Interrupted` state were the two properties that made a Fleet more
  than a session, and both were deliberately cut.

## Consequences

- **Five further terms retire with it**, each having lost its referent:
  `Parked` and `Interrupted` described durable intent Maestro no longer keeps;
  `Primary Agent` was the interface name for a Fleet's window; `Worktree` is a
  plain git term now that nothing creates or enforces one; and `Recap` was
  defined as an account of what a *Fleet* was doing.
- **The glossary is smaller than the software's ambition once was**, and that is
  the point. Eight terms remain, and `subagent tree` is the only one naming
  something Maestro itself produces.
- **`Recap` is retired rather than redefined.** It was confirmed as a strong
  desire, not built, and carrying a definition nothing implements is how a
  glossary starts describing intentions instead of the domain. It can return as
  a `Session` Recap when something renders one.
- **Existing prose is not rewritten.** Requirements, evidence, and published
  checkpoints keep saying `Fleet`, and they remain correct as records of what
  was decided when. The discouraged alias is what makes them still readable.
- **This is the third term retired for the same reason** - after `Workspace` in
  c-0007 and `Orientation` in c-0019 - and the first retired because the
  *software* changed rather than because the *word* collided. A term whose
  referent dissolves is worth removing as promptly as one that was ambiguous
  from the start.
