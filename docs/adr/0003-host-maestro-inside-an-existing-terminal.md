# Host Maestro inside an existing terminal

Maestro was conceived as an application to build - four candidate stacks, one of
them already built in Electron. We reversed that. Maestro now runs **inside** an
existing Host Application, supplying only what a terminal will not: enforced
worktree isolation, the subagent tree, durable Fleet lifecycle, and a sweep of
leftover processes at launch. The decision rests on a measurement: a helper
process started inside a cmux pane receives full control-socket access, so
hosting requires no fork, no Swift, and no change to the Host Application's
configuration or security posture.

## Status

Accepted.

## Considered Options

- **Wrap a Host Application.** Chosen. Stock cmux plus a helper running inside
  one of its panes. Measured: the helper wrote Fleet state into cmux's own
  sidebar from an external process, and enforced worktree-per-Fleet and a live
  three-level subagent tree worked over an unmodified installation. The Host
  Application already supplies panel re-scoping, tabs and splits, a file tree, a
  per-process resource meter, notifications, a mature `Attention` implementation,
  and the confirmed Nord theme - most of which had been specified as work to do.
- **Fork the Host Application.** Rejected, and it had been the standing
  recommendation earlier in the same cycle. Its entire justification was source
  access for verified teardown; when the teardown requirement was narrowed to
  best effort, the justification disappeared and the recommendation was withdrawn
  rather than carried on a reason that no longer existed. A fork also inherits a
  permanent divergence from a fast-moving codebase, with no upstream path: the
  project states it "is not prescriptive about how developers hold their tools",
  while Maestro is prescriptive by design, so enforcement would be rejected on
  philosophy rather than on quality.
- **Build on the underlying terminal library.** Rejected as the most expensive
  option with the least evidence. It was credible - cmux itself is built this way
  - but it re-acquires every capability the Host Application already ships.
- **Build a standalone application.** Rejected as the default rather than on
  failure. The Electron route reached 11 of 13 acceptance assertions and is
  retained as a route on the register, so this is a change of lead, not a
  verdict of failure.

## Consequences

- **The Host Application owns the lifetime of a Fleet's processes.** This
  contradicts the founding requirement that no third-party dependency may supply
  process lifetime, which was rewritten rather than deleted: a dependency may
  supply the lifetime **when that lifetime is visible to and endable by the
  operator**. The daemon that motivated the original rule was dangerous because
  it was hidden, not because it owned processes.
- **Permission prompts are attributed to the Host Application, not to Maestro.**
  macOS binds the responsible process at launch. The requirement that Maestro
  hold a distinct bundle identity is retired on a hosted route rather than
  deferred, and "Maestro is accountable" is false there.
- **Maestro is not the chat interface.** A terminal-hosted route runs the Copilot
  command-line interface and reads the session event log; it does not consume the
  SDK. See `0002`, whose scope narrows to application routes as a result.
- **The remaining build is small and concentrated.** Of the requirements outside
  the confirmed P0 set, roughly half are already supplied by the Host
  Application. What it will not supply is **durable lifecycle state** - the
  distinction between a Fleet deliberately Parked and one Interrupted - because
  its own agent states are ephemeral by design. That gap is the reason Maestro
  remains software rather than a configuration file.
- **Reversal cost is asymmetric and low.** The helper is small and the contract
  it depends on - a session event log and a control socket - is narrow, so
  returning to a standalone application means rebuilding presentation, not
  rediscovering the domain. The Electron route already exists as evidence.
- **The measurements are bound to one version** of one Host Application, which
  auto-updates. Nothing yet re-tests them on upgrade.
- **The slice has not been run on this route.** No live Copilot Session has run
  inside a Fleet worktree, and teardown has never been measured on the Host
  Application at all. This decision is made on architectural evidence, not on a
  completed acceptance slice.
