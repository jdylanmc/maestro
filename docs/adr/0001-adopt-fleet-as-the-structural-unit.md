# Adopt `Fleet` as the structural unit

Maestro's structural unit was called a `Session`, which collided with the
Copilot runtime's own `session` - a named, resumable conversation that Maestro
does not own and cannot redefine. We renamed the unit to `Fleet`, releasing
`Session` to mean exactly what the runtime means by it. This deliberately and
partially reverses an earlier decision to retire military metaphors in favour of
plain literal nouns.

## Status

Accepted.

## Considered Options

- **`Fleet`.** Already spoken by the primary user, and already the runtime's own
  word: `/fleet` enables "fleet mode for parallel subagent execution". Costs
  nothing to learn and aligns with the runtime instead of competing with it.
- **`Workspace`.** Rejected as triple-booked. The Copilot runtime owns it
  through per-session `workspace.yaml` files and `~/.copilot/workspaces/`,
  Visual Studio Code owns it, and Maestro's own vocabulary already used it for a
  different concept. This would have relocated the collision rather than
  removing it.
- **`Lane`.** A neutral literal noun colliding with nothing in Copilot, git, or
  Visual Studio Code. Rejected because it is vocabulary the user does not
  currently speak, which carries exactly the learning cost that the project's
  recorded adoption constraint treats as expensive.
- **Keeping `Session`.** Rejected: the collision is unavoidable in any sentence
  discussing both Maestro and the runtime, and it is worst precisely where
  precision matters most.

## Consequences

- `Session`, `Agent`, and `Workspace` are released to their runtime or
  third-party meanings. `Agent` now means a selectable Copilot persona and never
  a running participant.
- **This reverses part of an earlier vocabulary decision, and that is
  intentional.** The earlier decision retired `Squadron` and `Squad Mate`
  because invented vocabulary carries an indefinite teaching cost. `Fleet` is
  not invented - the user and the runtime already use it - so the cost that
  decision was avoiding is already paid. A reader who sees `Fleet` and concludes
  the earlier decision was forgotten would be wrong. `Squadron` and `Squad Mate`
  remain retired.
- The product is named Maestro, a musical metaphor, while its central unit is
  now nautical. This inconsistency was accepted knowingly, on the grounds that
  vocabulary the user already speaks is worth more than a coherent metaphor the
  user would have to learn.
- Renaming later would be expensive, because the term is the root noun that
  artifacts, interfaces, and file names inherit.
