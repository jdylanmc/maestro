# Consume the runtime's permission model

Maestro needs to know when a Fleet is waiting on its human, and the obvious
reading was that Maestro should broker permission requests itself - intercepting
them, presenting them, and returning decisions. We rejected that. The Copilot
SDK already exposes permissions as first-class, including a call whose
documented return is exactly the condition Maestro wanted to reconstruct, so
Maestro consumes the runtime's model and builds no mediation layer of its own.

## Status

Accepted.

## Considered Options

- **The Copilot SDK.** Chosen. `SessionConfig.onPermissionRequest` delivers an
  answerable callback; omit it and requests stay pending for
  `permissions.pendingRequests()`, documented in the generated schema as "the
  set of `permission.requested` events that have not yet been followed by a
  matching `permission.completed` event". That sentence is the `Attention`
  predicate, in the runtime's own words. The decision union is ten members wide,
  distinguishing a human approval from a policy denial, and `setApproveAll`
  expresses a broad-permission posture as a toggle rather than an architecture.
- **A Maestro-owned permission proxy.** Rejected. It was the standing
  recommendation until the SDK surface was actually read. It would have required
  Maestro to model, store, and re-issue decisions it does not own, in four
  separate route implementations, to reproduce a query the runtime already
  answers.
- **The Agent Client Protocol server (`copilot --acp`).** Rejected as the
  primary seam, retained as a working fallback. It handshakes, streams tool-call
  status, and resumes sessions with history, but it emitted **no**
  `session/request_permission` and recorded **zero** permission events across
  two capability declarations, and it ignores session naming. What it lost on
  was measured, not assumed.
- **Non-interactive invocation (`copilot -p`).** Rejected on measurement. Every
  permission request completes instantly as
  `denied-no-approval-rule-and-could-not-request-from-user`, so a Fleet driven
  this way never blocks and can never raise `Attention` at all.
- **Driving the terminal user interface through a pseudo-terminal.** Rejected as
  fragile. It does surface real permission prompts - it is how the predicate was
  first observed firing - but it needed four attempts before the interface
  accepted input, and it depends on screen behaviour rather than a contract.

## Consequences

- `Attention` is a query against the runtime, not a reconstruction from an event
  log. Maestro reads the condition; it does not derive or persist it.
- Maestro stores no permission decisions and owns no approval rules. The
  runtime's policy surfaces - per-tool `skipPermission`, `permissionDecision`,
  and `setApproveAll` - are the only ones.
- **The seam is chosen by route class, and permission behaviour therefore *is* a
  differentiator.** This corrects the original consequence, which read "all four
  prototype routes integrate through the same SDK seam, so a route's permission
  behaviour is not a differentiator between technology stacks." Both halves
  became false. There are now six routes, and a **terminal-hosted** route -
  cmux, WezTerm - does not use the SDK at all: it runs the Copilot command-line
  interface, because the terminal already is the chat interface, and reads
  `events.jsonl`. Only **application** routes - Electron, Tauri, Swift - consume
  this seam, because only they must build a chat interface. So permission
  behaviour differs by route: an application route queries the SDK, while a
  terminal-hosted route inherits whatever its Host Application already surfaces.
  This narrows the decision's *scope* without weakening it - within application
  routes, the reasoning and the rejected alternatives stand unchanged.
- **The seam is pinned to a measured version range.** `permissions.pendingRequests()`,
  the typed `subagent.*` events, caller-supplied `SessionConfig.sessionId`, and
  `session.title_changed` are present and identically shaped across **1.0.80
  through 1.0.81-5**. The pin matters because the permission surface changed
  shape across three earlier observed versions: `copilot-sdk@0.3.0` and the copy
  bundled in `@github/copilot@1.0.40` made `onPermissionRequest` required and
  exposed no query at all; `1.0.9-preview.2` added it; `1.0.11-preview.2`
  re-worded its contract. An unpinned SDK means an unstable `Attention`
  implementation. This obligation binds only where the SDK is used.
- **The permission callback has never been observed firing.** The live probe
  reached `start()` and `createSession()`, then failed on an exhausted monthly
  quota before a decision could be requested. This decision therefore rests on
  documentary evidence plus an independent implementation of the same loop in an
  Electron application, and carries a standing trigger to re-test.
- Reversing this is expensive in proportion to how many **application** routes
  exist when the reversal happens, because the mediation layer would have to be
  built once per route. Terminal-hosted routes are unaffected either way.
