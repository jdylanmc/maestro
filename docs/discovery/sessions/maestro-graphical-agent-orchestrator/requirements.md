# Requirements - Maestro Graphical Agent Orchestrator

## Confirmed requirements

- The MVP contract is implementation-independent and shared across prototype routes. [Issue #18](https://github.com/jdylanmc/maestro/issues/18)
- The product is visualization-first: named Sessions, one workspace and Primary Agent per Session, recursively nested Squadron visibility, structured activity, attention, outcomes, and targeted cancellation where supported. [Issue #12](https://github.com/jdylanmc/maestro/issues/12), [Issue #6](https://github.com/jdylanmc/maestro/issues/6)
- macOS is the supported platform for current prototypes. [AGENTS.md](../../../AGENTS.md)
- The first proving MVP is one complete real flow on one platform; cross-platform prototypes share the same functionality specification, while implementation tasks vary by platform. [c-0001](./cycles/c-0001.md)
- The first acceptance slice includes Session creation or resume, real Primary Agent chat, one structured delegated Squad Mate, Workspace and file context, targeted cancellation where supported, restart, and accurate reconciliation. [c-0001](./cycles/c-0001.md)
- The Electron route must preserve a main-process authority boundary, a preload-mediated renderer API, durable Session state, structured delegated-Agent state, restart reconciliation, and targeted cancellation. [c-0003](./cycles/c-0003.md)

### Lifecycle and process ownership

- Exactly one Primary Agent per Session, a strict 1:1 binding. [c-0005](./cycles/c-0005.md)
- The 1:1 binding is enforced by a lock rather than by convention: a second primary for the same Session is refused, and a lock-refused Session degrades to read-only. Modelled on the firstmate primary-harness home lock. [firstmate-arch.md](../../../../v2/docs/reference/firstmate-arch.md), [c-0005](./cycles/c-0005.md)
- **No Agent process may outlive the application.** Closing Maestro terminates every Agent and Sub-agent it started, leaving no orphan, no daemon, and no background helper. [c-0005](./cycles/c-0005.md)
- Persistence is of durable state, never of live processes. Data survives; processes do not. [c-0005](./cycles/c-0005.md)
- `Parked` and `Interrupted` are opposites and must be distinguishable in the store: parked is a deliberate user-initiated stop, interrupted is an unintended one. [Issue #9](https://github.com/jdylanmc/maestro/issues/9), [c-0005](./cycles/c-0005.md)
- Parking must not discard uncommitted work; park is not teardown. [firstmate-arch.md](../../../../v2/docs/reference/firstmate-arch.md), [c-0005](./cycles/c-0005.md)
- Liveness must be classified from process evidence, not assumed, and must admit an explicit `ambiguous` verdict alongside alive and dead. [firstmate-arch.md](../../../../v2/docs/reference/firstmate-arch.md), [c-0005](./cycles/c-0005.md)
- Session state is projected deterministically from evidence with a fixed precedence, with no heuristic or model-inferred state. [firstmate-arch.md](../../../../v2/docs/reference/firstmate-arch.md), [c-0005](./cycles/c-0005.md)

### Capacity

- No more than 8 concurrent Sessions. [c-0005](./cycles/c-0005.md)
- Available processor and memory are surfaced inside the Sessions panel, beside the Sessions competing for them. [c-0005](./cycles/c-0005.md)
- Admission control is active, not advisory: the application refuses or warns against starting a Session the host cannot carry. The effective ceiling is the lower of 8 and host capacity. [c-0005](./cycles/c-0005.md)

### Interface

- Three columns: a left column with a collapsible Sessions/Worktrees panel above a collapsible Sub-agent tree panel; a collapsible directory-structure column; and an expandable main context window. [c-0005 wireframe](./cycles/c-0005.md)
- Selecting a Session re-scopes every other panel together - the Sub-agent tree, the directory structure, and the main context window. Selection is a single global control, not per-panel navigation. [c-0005](./cycles/c-0005.md)
- The main context window is Session-scoped chat by default; selecting a Sub-agent shows its log and details; selecting a file shows the file. [c-0005 wireframe](./cycles/c-0005.md)
- The directory structure supports open and close folder and shows git information inline. [c-0005 wireframe](./cycles/c-0005.md)
- Tabs across the top with vertical and horizontal splits, following Visual Studio Code conventions. [c-0005 wireframe](./cycles/c-0005.md)
- Delegation is shown as a live tree of names, states, and current activity, with full output read on demand by drilling into one node. Concurrent scrollback for every Sub-agent is explicitly rejected. [c-0005](./cycles/c-0005.md)

### Adoption

- **Input-model continuity.** The user is keyboard-first with settled muscle memory and a real cost to learning new hotkeys. A route requiring a new keymap pays an adoption penalty against the daily-driver bar. The present-day baseline workflow is Visual Studio Code with its integrated terminal. [c-0005](./cycles/c-0005.md)
- The structural vocabulary uses plain literal nouns, with "Maestro" retained only as the product name and interface chrome. Decided by the user in c-0005; **not yet confirmed**, because no domain contract exists to cite. [c-0005](./cycles/c-0005.md)

## Unresolved requirements

- The minimum end-to-end acceptance slice that every prototype must prove.
- Which deferred capabilities are truly outside the MVP once a working shell exists.
- The required fidelity of restart reconciliation for active or interrupted work.
- The acceptable provider-specific degradation when runtime controls are experimental.
- Whether the Electron route's real BrowserWindow and packaging seams hold once the external Electron dependency is available.
- **Workspace versus Worktree.** The wireframe pairs Sessions with worktrees, but whether a Session is 1:1 with a git worktree, or merely contains one, is undecided. It constrains Session creation either way.
- **In-app editing is contradicted.** [Issue #12](https://github.com/jdylanmc/maestro/issues/12) explicitly defers in-app editing, while the c-0005 wireframe specifies "secondary windows are basic file viewer/editor". Until reconciled, file panes are treated as read-only viewers.
- Whether the Sessions ceiling of 8 and the host-capacity guardrail need distinct user-facing treatment when the guardrail binds first.
