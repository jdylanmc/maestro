---
schema-version: 1
state-root: docs/discovery
sessions: 1
last-updated-cycle: maestro-graphical-agent-orchestrator/c-0007
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
| maestro-graphical-agent-orchestrator | vertical | P0 | researched | Prove one shared end-to-end flow on Electron, judged on lifecycle ownership and the three-column layout, then compare equivalent functionality across platform routes. | Unbuilt Electron probe; vocabulary decided in c-0007 but unconfirmed, `/domain-mapping` handoff pending and now unblocked | [discovery.md](./sessions/maestro-graphical-agent-orchestrator/discovery.md) |

## Typed Session Links

| From | Link | To | Why |
| --- | --- | --- | --- |

## Shared Actors and Constraints

- Human operator - needs a visible, controllable daily-driver experience, is keyboard-first with settled muscle memory, and treats learning a new keymap as a real adoption cost.
- Fleet - the structural unit: one feature, one Worktree, one Copilot Session, its subagent tree, and its durable state.
- Copilot Session - the runtime's own nameable, resumable conversation; exactly one per Fleet, presented as that Fleet's primary agent window.
- subagent - a delegated unit of work with observable lifecycle, activity, outcome, and control state.
- macOS is the supported platform for current prototypes.
- No process may outlive the application; durable state persists, processes do not.
- Fleets are isolated by default, preferring one Worktree each, which implies one branch each.
- Vocabulary is reconciled against the Copilot runtime rather than competing with it.
- Credentials, authentication state, employer configuration, and runtime state stay outside the repository.
