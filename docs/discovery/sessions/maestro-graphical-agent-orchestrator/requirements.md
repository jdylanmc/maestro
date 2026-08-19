# Requirements - Maestro Graphical Agent Orchestrator

> **Terminology confirmed in c-0008.** The canonical glossary is the repository
> root [`CONTEXT.md`](../../../../CONTEXT.md), published by `/domain-mapping`.
> It is authoritative over any wording below. Two c-0007 definitions were
> corrected there: a Fleet does **not** require a Worktree, and every subagent is
> a Task while not every Task is a subagent.
>
> **Terminology changed in c-0007.** The structural unit formerly called
> `Session` is now a **Fleet**: one feature, one Worktree, one Copilot Session,
> its subagent tree, and its durable state. `Session` now means only what the
> Copilot runtime means by it. `Agent` and `Primary Agent` are no longer domain
> entities; `Primary Agent` survives as an interface term only. Requirements
> below that still read `Session` in a structural sense refer to a Fleet and are
> reconciled progressively, with each reconciled item marked.

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
- **No Agent process may outlive the application.** Closing Maestro terminates every Agent and Sub-agent it started, leaving no orphan, no daemon, and no background helper. **Observed violated in c-0006**: a detached `herdr server` daemon kept two Copilot Sessions and five Model Context Protocol servers alive for two days after the graphical host exited. [c-0005](./cycles/c-0005.md), [c-0006](./cycles/c-0006.md)
- **Closing Maestro auto-Parks every Fleet** - state persisted, processes terminated, uncommitted work preserved - behind a pre-close summary naming any Fleet with in-flight work or uncommitted changes, acknowledged to proceed. Silent termination would make every Fleet `Interrupted` on next launch, rendering the confirmed Parked/Interrupted distinction decorative. Blocking the close was rejected because `Ambiguous` is a real liveness verdict and could trap the user in the application. [c-0008](./cycles/c-0008.md)
- Persistence is of durable state, never of live processes. Data survives; processes do not. [c-0005](./cycles/c-0005.md)
- **Ownership extends to the whole descendant tree, not to direct children.** The observed orphans were grandchildren - Model Context Protocol servers under Copilot Sessions under a daemon. Teardown operates on the process group, and correctness is judged by the tree, not by the processes Maestro spawned directly. [c-0006](./cycles/c-0006.md)
- **Termination is verified and escalated, never fired and forgotten.** `SIGTERM` was observed to be ignored by wrapper processes that exited only after their children died. Teardown sends the signal, re-reads the process table, escalates to `SIGKILL` on timeout, and reports any survivor rather than assuming success. [c-0006](./cycles/c-0006.md)
- **Reap on launch.** `SIGKILL`, a crash, and macOS Force Quit all bypass in-process cleanup, so graceful teardown cannot be the only defense. Maestro durably records the process-group identifiers it owns and reaps any survivor from a previous run at the next launch, before starting new work. [c-0006](./cycles/c-0006.md)
- **No third-party dependency may supply the process lifetime.** Adopting a supervisor imports its lifetime model wholesale; `herdr` was adopted for convenience and its detachment became the product's observable behavior. Maestro owns its processes' lifetime directly, or it does not use the dependency. [c-0006](./cycles/c-0006.md)
- **Each Fleet is spawned detached, in its own process group.** ~~c-0006 required non-detached spawning;~~ **falsified by measurement in c-0009.** A non-detached child is not a process-group leader, so it shares the supervisor's group and cannot be signalled as a group at all - `process.kill(-pid)` returns `ESRCH` and every descendant survives even a graceful quit. Detachment is what makes complete teardown of a nested tree, and targeted per-Fleet cancellation, possible. [c-0009](./cycles/c-0009.md)
- **Detachment is safe only when paired with durable ownership and a reaper.** Maestro records each Fleet's process-group identifier durably, terminates the group on quit with verification and escalation, and reaps any recorded group left over at next launch. Measured: with the reaper, zero survivors; without it, six. [c-0009](./cycles/c-0009.md)
- **The application is accountable for every permission prompt its descendants raise.** macOS binds the responsible process at launch and descendants inherit it for their own lifetime, independent of whether the responsible process still exists, so prompts from binaries Maestro never authored are presented to the user under Maestro's name with no way to identify the real requester. Leaving a descendant alive is therefore a trust defect, not only a resource leak. [c-0006](./cycles/c-0006.md)
- **Bundle identity must be distinct.** Shipping under a bundle identifier attached to a cloned third-party binary makes permission grants, and their attribution, indistinguishable from that upstream application. [c-0006](./cycles/c-0006.md)
- `Parked` and `Interrupted` are opposites and must be distinguishable in the store: parked is a deliberate user-initiated stop, interrupted is an unintended one. [Issue #9](https://github.com/jdylanmc/maestro/issues/9), [c-0005](./cycles/c-0005.md)
- Parking must not discard uncommitted work; park is not teardown. [firstmate-arch.md](../../../../v2/docs/reference/firstmate-arch.md), [c-0005](./cycles/c-0005.md)
- **Fleet lifecycle is carried on two independent axes, not one state set.** Durable Fleet state expresses user intent and survives quit: `Active`, `Parked`, `Interrupted`, `Failed`. Runtime Liveness is observed from process evidence at each launch and is never persisted as truth: `Alive`, `Dead`, `Ambiguous`. A flat set cannot express "Active but orphaned", which c-0006 observed and which is the defect that must be detected and reaped. [c-0007](./cycles/c-0007.md)
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
- Delegation is shown as a live tree of names, states, and current activity, with full output read on demand by drilling into one node. Concurrent scrollback for every subagent is explicitly rejected. [c-0005](./cycles/c-0005.md)
- **Selecting a Fleet always presents that Fleet's primary agent window, bound 1:1 to it.** The binding is structural - one Fleet, one Copilot Session, one primary agent window - so the window is never absent, never shared between Fleets, and never ambiguous about which Fleet it belongs to. This specifies the main context window's default content, where c-0005 specified only its scoping. [c-0007](./cycles/c-0007.md)
- **`Primary Agent` is the interface term for that window.** The word `Session` need not appear in the interface at all, which keeps the Copilot naming collision out of the user's view entirely. [c-0007](./cycles/c-0007.md)

- **File panes are read-only viewers with an "open in Visual Studio Code" action.** No in-app editor is built for the MVP. This closes the contradiction between Issue #12's deferral and the c-0005 wireframe, which specified a basic editor. [c-0008](./cycles/c-0008.md)

### Adoption

- **Input-model continuity.** The user is keyboard-first with settled muscle memory and a real cost to learning new hotkeys. A route requiring a new keymap pays an adoption penalty against the daily-driver bar. The present-day baseline workflow is Visual Studio Code with its integrated terminal. [c-0005](./cycles/c-0005.md)
- The structural vocabulary uses plain literal nouns, with "Maestro" retained only as the product name and interface chrome. Decided by the user in c-0005; **not yet confirmed**, because no domain contract exists to cite. [c-0005](./cycles/c-0005.md)

### Isolation and concurrency

- **Fleets are isolated by default.** Concurrent Fleets work different features in the same large monorepo, so they must not share a working checkout by default. [c-0007](./cycles/c-0007.md)
- ~~**Worktree-per-Fleet is the strong default**, not enforced as a hard rule; a Fleet may be pointed at an existing checkout.~~ **Superseded in c-0010.** **Worktree-per-Fleet is a hard rule.** Every Fleet has exactly one worktree of its own and Fleets never share a checkout. The user: "fleets are isolated to worktrees." [c-0010](./cycles/c-0010.md)
- **Worktree-per-Fleet implies branch-per-Fleet.** Two worktrees cannot check out the same branch; this is a verified hard git constraint, not a policy choice. Fleet creation therefore implies branch creation or selection. [c-0007](./cycles/c-0007.md)
- ~~**A Fleet must know it is not alone.**~~ **Reversed in c-0010.** **Fleets are fully isolated and unaware of each other.** No cross-Fleet awareness or messaging is built for the MVP; the human is the only integration point. This overturns the c-0007 requirement rather than refining it: research established that the runtime provides no peer channel to inherit, so awareness would have had to be invented, and the user declined. [c-0010](./cycles/c-0010.md)
- **Isolation holds on both axes at once.** A Fleet shares neither a working checkout nor a message channel with any other Fleet. A consequence is that no cross-Fleet conflict resolution is needed, because two Fleets cannot touch the same working files. [c-0010](./cycles/c-0010.md)
- Isolation is not total: the git stash and the object store are shared across worktrees. Any feature that uses the stash is a cross-Fleet interaction and must be treated as such. [c-0007](./cycles/c-0007.md)
- The target repository is a large monorepo, so per-worktree duplication of build artifacts and editor indexes is a real cost that bears on the ceiling of concurrent Fleets. [c-0007](./cycles/c-0007.md)
- **Git is not the constraint; duplicated working state is.** Measured: a worktree of a clean checkout costs ~2.6 MiB and ~50 ms to create, with the object store shared and unchanged. What scales badly is per-worktree untracked and build state - `node_modules`, build output, caches. File descriptors are not a risk at this scale. Because worktrees are now mandatory rather than optional, this is the load-bearing limit on concurrent Fleets. [c-0010](./cycles/c-0010.md)
- **Maestro must not duplicate build state per Fleet where it can avoid it.** Sparse checkout is settable per worktree and is the strongest available mitigation for a monorepo. [c-0010](./cycles/c-0010.md)

### Runtime integration

- **Maestro names the runtime's Session rather than maintaining a private name.** The Copilot CLI accepts `-n, --name`, supports `/rename`, and resolves `--resume` by name. This supersedes the recorded decision on [Issue #5](https://github.com/jdylanmc/maestro/issues/5) that Maestro owns naming. A consequence is that a Maestro-created Fleet stays addressable from the command line without Maestro. [c-0007](./cycles/c-0007.md)
- Maestro's vocabulary aligns with the runtime's where they overlap: `subagent` rather than `Sub-agent`, and `Task` for a tree node's underlying runtime handle. [c-0007](./cycles/c-0007.md)
- **Maestro reads only generic runtime evidence.** It does not special-case any orchestration skill, and does not read the `ship-with-squadron` run ledger. Skill-specific state such as deadlines, merge gates, ticket states, and the `AT_RISK` classification is therefore unavailable to the interface. [c-0007](./cycles/c-0007.md)
- Durable Maestro state belongs outside any single worktree, so that it is shared across the worktrees of one repository rather than trapped in one. [c-0007](./cycles/c-0007.md)
- **The subagent tree is reconstructed by joining `subagent.started.data.toolCallId` to the `agentId` on the spawning agent's own `tool.*` event.** A root-spawned subagent's tool event carries a null `agentId`. [c-0010](./cycles/c-0010.md)
- **`parentId` must never be used to build the tree.** It is a linear event-chain pointer, not a parent-agent link: in a measured 41,928-event session it held 41,927 distinct values, every one resolving to an event id and none to an `agentId`. Consecutive parallel *siblings* therefore appear as parent and child, and building on it yields a plausible but wholly fictional tree. [c-0010](./cycles/c-0010.md)
- **`agentId` is a reliable identity for attribution.** In the same session the 132 ids appearing on `subagent.started` were exactly the 132 appearing on other events, so every event is attributable to the agent that produced it. [c-0010](./cycles/c-0010.md)
- **The tree renders arbitrary depth, but must be optimised for breadth.** Measured real depth in the largest local session was 2, not the 16 a `parentId` reading suggests: 51 subagents root-spawned, 72 at depth 1, 9 at depth 2 - and 72 of 132 spawned by a single agent. Nesting is genuine but shallow; fan-out dominates. [c-0010](./cycles/c-0010.md)
- **Attention is an unmatched `permission.requested`**, plus `session.error` and `abort` as terminal states. This replaces `AT_RISK`, which is not computable from generic events. [c-0010](./cycles/c-0010.md)
- **`assistant.turn_end` must not be read as Attention.** It means the assistant yielded control, not that a human is required. [c-0010](./cycles/c-0010.md)
- **`inbox_entries` is an intra-Fleet path, not an inter-Fleet one.** Across all 674 local session databases it holds 27 rows, every sender a `background-agent` or `sidekick-agent` reporting to its owning session - never a peer session. It is the subagent reporting channel and offers nothing for cross-Fleet messaging. [c-0010](./cycles/c-0010.md)
- **`unread` must not be read as "the human has seen this."** All 27 observed rows carry `unread = 1`; the flag is never cleared in persisted state. [c-0010](./cycles/c-0010.md)

## Unresolved requirements

- The minimum end-to-end acceptance slice that every prototype must prove.
- Which deferred capabilities are truly outside the MVP once a working shell exists.
- The required fidelity of restart reconciliation for active or interrupted work.
- The acceptable provider-specific degradation when runtime controls are experimental.
- Whether the Electron route's real BrowserWindow and packaging seams hold once the external Electron dependency is available.
- ~~**Workspace versus Worktree.**~~ **Resolved in c-0007.** A Fleet prefers its own Worktree, not as a hard rule. `Workspace` is retired as a structural term because Copilot and Visual Studio Code both own it.
- ~~**How a Fleet is made aware of its siblings.**~~ **Resolved in c-0010:** it is not. Fleets are fully isolated; the human is the only integration point.
- ~~**What Maestro uses for Attention now that the ledger is excluded.**~~ **Resolved in c-0010:** an unmatched `permission.requested`, plus `session.error` and `abort`. Unproven in the blocking case, because no unresolved request was found in local evidence.
- ~~**Whether the tree renders arbitrary depth or a bounded depth.**~~ **Resolved in c-0010:** arbitrary depth, optimised for breadth. Measured real depth was 2, with fan-out dominating.
- ~~**Whether `inbox_entries` inter-session messaging is in scope.**~~ **Resolved in c-0010:** out of scope, and misread. It is the subagent-to-owning-session channel, not a peer channel.
- **Whether the 8-Fleet ceiling survives worktree-per-Fleet in a large monorepo.** Narrowed in c-0010: git cost is negligible and file descriptors are not a risk, so the question reduces to duplicated untracked and build state. Still unmeasured against the actual target monorepo, and now sharper because worktrees are mandatory.
- ~~**In-app editing is contradicted.**~~ **Resolved in c-0008:** read-only viewers plus an "open in Visual Studio Code" action. No editor is built.
- Whether the Sessions ceiling of 8 and the host-capacity guardrail need distinct user-facing treatment when the guardrail binds first.
- **Whether `herdr` remains in the architecture at all.** Its detached-daemon lifetime directly contradicts the process-ownership requirement. Either Maestro replaces it with directly owned child processes, or it must prove `herdr` can be run in a non-detaching mode it fully controls. [c-0006](./cycles/c-0006.md)
- ~~**What happens to long-running Agent work when the user closes the application.**~~ **Resolved in c-0008:** auto-Park behind an acknowledged pre-close summary.
