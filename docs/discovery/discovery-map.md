---
schema-version: 1
state-root: docs/discovery
sessions: 1
last-updated-cycle: maestro-graphical-agent-orchestrator/c-0029
---

# Primary Discovery Map - Maestro

## Product Idea and Destination

Maestro is a macOS observability plugin that makes a Copilot Session's delegated
work visible inside cmux. cmux remains the Host Application and owns terminal,
workspace, process-lifetime, and native agent integration behavior. Maestro
adds the live parent-child subagent tree where cmux has no native equivalent.

## Verticals and Cross-Cutting Domains

| Session | Kind | Priority | Maturity | Active fog | Major blockers | Package |
| --- | --- | --- | --- | --- | --- | --- |
| maestro-graphical-agent-orchestrator | vertical | P0 | researched | The plugin and custom sidebar run end to end. Open fog is now bounded to complete event-log reads, exact Session identity, replacement of the transitional workspace-description wire format, reliable live lifecycle state, cmux hook-store duplication, restore correctness, and deliberate visual polish. | cmux's native hooks remained `idle` during active tool work; its restore action generated an invalid `-C` invocation; and its store accumulated many records for the same process/transcript. Maestro therefore still needs a fail-open hook fallback and cannot yet delegate all Session state or restore behavior to cmux. | [discovery.md](./sessions/maestro-graphical-agent-orchestrator/discovery.md) |

## Typed Session Links

| From | Link | To | Why |
| --- | --- | --- | --- |

## Shared Actors and Constraints

- Human operator - needs agent work visible in the terminal already in use.
- Session - the runtime-owned resumable Copilot conversation Maestro observes.
- subagent - a delegated agent with observable lifecycle and parentage.
- cmux - the Host Application; Maestro consumes its native behavior where that
  behavior is measured to work.
- macOS is the supported platform.
- Maestro is observability-only: no worktree enforcement, durable orchestration
  intent, process sweeping, standalone application, or command surface.
- An observer is always fail-open and never gains authority over a tool call.
- Credentials, personal data, employer configuration, machine-specific paths,
  and runtime state stay outside the repository.
