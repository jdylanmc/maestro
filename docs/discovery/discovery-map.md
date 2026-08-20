---
schema-version: 1
state-root: docs/discovery
sessions: 1
last-updated-cycle: maestro-graphical-agent-orchestrator/c-0015
---

# Primary Discovery Map - Maestro

## Product Idea and Destination

Select and validate a daily-driver macOS graphical agent orchestrator. Maestro
should make named Fleets, their Worktrees, their primary agent windows, and
their delegated subagent trees visible and controllable while preserving durable
restart behavior.

## Verticals and Cross-Cutting Domains

| Session | Kind | Priority | Maturity | Active fog | Major blockers | Package |
| --- | --- | --- | --- | --- | --- | --- |
| maestro-graphical-agent-orchestrator | vertical | P0 | researched | Drive all four routes to a complete MVP one at a time - v2 Electron, then v1.1 WezTerm, v3 Tauri/Rust, and v4 native macOS Swift - each executing one identical six-step acceptance slice verified by one shared route-agnostic Acceptance Harness and producing a per-stack executive report, then select the durable technology in a terminal comparative evaluation. | **No priority debt remains.** Both provider-level blockers are settled: the seam is the Copilot SDK (c-0014) and the Acceptance Harness is a State Oracle plus a Presentation Check (c-0015). One accepted unknown stands - the SDK permission callback has not been observed firing, because the probe hit an exhausted monthly quota. The next work is taking the Electron route through the promotion gate into buildable tickets. | [discovery.md](./sessions/maestro-graphical-agent-orchestrator/discovery.md) |

## Typed Session Links

| From | Link | To | Why |
| --- | --- | --- | --- |

## Shared Actors and Constraints

- Human operator - needs a visible, controllable daily-driver experience, is keyboard-first with settled muscle memory, and treats learning a new keymap as a real adoption cost.
- Fleet - the structural unit: one feature, one Worktree, one Copilot Session, its subagent tree, and its durable state.
- Copilot Session - the runtime's own nameable, resumable conversation; exactly one per Fleet, presented as that Fleet's primary agent window.
- subagent - a delegated unit of work with observable lifecycle, activity, outcome, and control state.
- macOS is the supported platform for current prototypes.
- No process may outlive the application; durable state persists, processes do not. Measured under packaging in c-0012, where `launchd` reparenting proved harmless but graceful `SIGTERM` alone failed against a live Copilot Session and `SIGKILL` escalation was required.
- Fleets are **fully isolated**: exactly one Worktree each, enforced, which implies one branch each, and no cross-Fleet awareness of any kind. The human is the only integration point. (c-0010; this bullet still carried the superseded "preferring" wording until c-0011.)
- Vocabulary is reconciled against the Copilot runtime rather than competing with it, and is **confirmed** in the repository root `CONTEXT.md` with `docs/adr/0001` recording the `Fleet` naming decision.
- File surfaces are read-only viewers with an "open in Visual Studio Code" action; no in-app editor is built.
- Closing the application auto-Parks every Fleet behind an acknowledged pre-close summary.
- Credentials, authentication state, employer configuration, and runtime state stay outside the repository.
- A route that cannot build the app is **rejected**, and the reason is an input to the comparative evaluation rather than an absence from it.
- A Fleet is driven through the **Copilot SDK**, settled in c-0014: `CopilotClient` shipped inside the platform package, with permissions as first-class callbacks and `permissions.pendingRequests()` returning the Attention predicate as the runtime defines it. ACP is a measured fallback that surfaces no permissions and accepts no session name; non-interactive `-p` mode is excluded outright, because it auto-denies.
- Route completion is judged by one shared Acceptance Harness asserting external ground truth, never by a route reporting on itself. Its State Oracle needs no cooperation from the route; its Presentation Check is automated as far as each stack allows.
- **Verification is machine-first: there are no human testers.** A manual step is a stopgap, and its survival is a cost recorded against the route.
- **User-interface automation capability is a fixed criterion of the stack selection**, measured by how far each route automates its own Presentation Check. The criterion is deliberately not neutral between stacks.
