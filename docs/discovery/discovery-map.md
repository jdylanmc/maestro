---
schema-version: 1
state-root: docs/discovery
sessions: 1
last-updated-cycle: maestro-graphical-agent-orchestrator/c-0030
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
| maestro-graphical-agent-orchestrator | vertical | P0 | researched | The plugin, its custom sidebar, and its attention surface run end to end. Open fog is bounded to complete event-log reads, exact Session identity beyond the surface binding, replacement of the transitional workspace-description wire format, cmux hook-store duplication, restore correctness, and whether the plugin has a visible mark at all. | cmux's restore action generated an invalid `-C` invocation, and its hook store accumulates many records for the same process/transcript, so neither restore nor store identity can be inherited. Native lifecycle is **no longer a blocker**: c-0030 moved Maestro's own state onto the Copilot event log, from which Attention is derived rather than stored. The registered `notification` and `agentStop` hooks have not yet been observed firing end to end, because Copilot binds plugins at session start. | [discovery.md](./sessions/maestro-graphical-agent-orchestrator/discovery.md) |

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
  `preToolUse` is **not registered**: its blast radius is every tool call in
  every live Session, and c-0030 removed it once Attention became derivable from
  the event log.
- Retired prototypes live under `archive/` and are inert. `maestro-cmux/` is the
  only live surface.
- Credentials, personal data, employer configuration, machine-specific paths,
  and runtime state stay outside the repository.
