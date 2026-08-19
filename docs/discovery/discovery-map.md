---
schema-version: 1
state-root: docs/discovery
sessions: 1
last-updated-cycle: maestro-graphical-agent-orchestrator/c-0005
---

# Primary Discovery Map - Maestro

## Product Idea and Destination

Select and validate a daily-driver macOS graphical agent orchestrator. Maestro
should make named Sessions, their workspaces, Primary Agents, and recursively
delegated Squadron visible and controllable while preserving durable restart
behavior.

## Verticals and Cross-Cutting Domains

| Session | Kind | Priority | Maturity | Active fog | Major blockers | Package |
| --- | --- | --- | --- | --- | --- | --- |
| maestro-graphical-agent-orchestrator | vertical | P0 | researched | Prove one shared end-to-end flow on Electron, judged on lifecycle ownership and the three-column layout, then compare equivalent functionality across platform routes. | Unbuilt Electron probe; vocabulary unconfirmed because no domain contract exists | [discovery.md](./sessions/maestro-graphical-agent-orchestrator/discovery.md) |

## Typed Session Links

| From | Link | To | Why |
| --- | --- | --- | --- |

## Shared Actors and Constraints

- Human operator - needs a visible, controllable daily-driver experience, is keyboard-first with settled muscle memory, and treats learning a new keymap as a real adoption cost.
- Primary Agent - owns the normal command channel and delegates work, one per Session.
- Sub-agent - a delegated Agent with observable lifecycle, activity, outcome, and control state.
- macOS is the supported platform for current prototypes.
- No Agent process may outlive the application; durable state persists, processes do not.
- Credentials, authentication state, employer configuration, and runtime state stay outside the repository.
