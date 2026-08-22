# Orbit Architecture Reference

> Evidence baseline: [`sesh-kebab/orbit@ac64f12`](https://github.com/sesh-kebab/orbit/tree/ac64f12df52cf96b869f9180979ae058cbe12b68), inspected 2026-08-17. This document maps the existing implementation for Maestro v2 reference; it is not a proposed Maestro design.

## Scope and Orientation

This is a repository-depth map of Orbit 0.3.0: its Electron process boundaries, GitHub Copilot Software Development Kit (SDK) integration, orchestration model, delegated Agent lifecycle, Watchers, persistence, and React presentation layer.

Orbit is one packaged Electron application with three build units: the privileged **main process**, a context-isolated **preload bridge**, and the unprivileged **renderer**. The main process owns all runtime behavior and state. The renderer is a projection of `OrbitState` plus a command surface exposed as `window.orbit`.

No repository-owned glossary was found. The vocabulary below is observed from public types, tool names, user-interface labels, and documentation:

- **Orbit**: the persistent conversational orchestrator session.
- **Agent**: one delegated task represented by `AgentView` and executed in a separate Copilot session.
- **AgentRunner**: the lifecycle owner for one Agent session.
- **Watcher**: a persisted `Schedule` that starts a fresh Agent when due.
- **Memory**: durable user context injected into future Orbit system prompts.
- **Open Item**: a durable decision awaiting the user.
- **Proposal**: a stateful self-improvement idea that may be proposed, approved, shipped, declined, or superseded.
- **Evolution Log**: narrative reflection history folded into future prompts.
- **Mission Control**: the renderer surface for Agents, Watchers, Memory, Open Items, history, and appearance.
- **Runtime**: the separately installed and authenticated Copilot command-line interface process spawned through the SDK.

## Architecture at a Glance

```text
Electron application lifecycle
        |
        v
src/main/index.ts --constructs--> Store + Persistence + Orchestrator + BrowserWindow
        |                                  |
        |                                  +--> CopilotClient over stdio
        |                                          |
        |                                          +--> Orbit session
        |                                          |      `orbit_*` tools only
        |                                          |
        |                                          +--> AgentRunner x N
        |                                                 full Agent sessions
        |
        +<-- IPC invoke -- preload/index.ts -- window.orbit -- React renderer
        |
        +-- Store "state" events --> BrowserWindow --> immutable renderer snapshots

Watcher tick --async--> AgentRunner --> Agent result --> Schedule state --> Persistence
Permission request --> PendingRequest --> renderer card --> answerRequest --> SDK decision
Soft restart --> SessionSnapshot --> Electron relaunch --> restored prompt context
```

The primary dependency direction is inward from Electron composition and React presentation toward `Orchestrator`; the SDK, filesystem, and operating-system services sit behind main-process boundaries.

## Modules and Responsibilities

| Module or boundary | Responsibility | Called by or entered from | Calls or depends on | Evidence |
| --- | --- | --- | --- | --- |
| `package.json`, `electron.vite.config.ts` | Define the packaged application and its three build entries | npm and electron-vite | main, preload, renderer; externalized Copilot SDK | `main` points to `out/main/index.js`; Vite inputs identify each process boundary |
| `src/main/index.ts` | Composition root: migration, settings, Store, Persistence, Orchestrator, panel, tray, timers, IPC, shutdown | Electron `app.whenReady()` | Every main-process service | `app.whenReady`, `registerIpc`, one-second `orchestrator.tick()` timer |
| `src/main/orchestrator/orchestrator.ts` | Application controller for the Runtime, Orbit session, Agents, Watchers, meetings, Memory, Open Items, Proposals, history, and restart | `index.ts`; Orbit model through registered `orbit_*` tools | Copilot SDK, `AgentRunner`, Store, Persistence, orchestration helpers | `Orchestrator.start`, `orbitTools`, `send`, `spawnAgent`, `tick` |
| `src/main/orchestrator/agentRunner.ts` | Own one delegated Copilot session from creation through completion, failure, timeout, or cancellation | `Orchestrator.spawnAgent()` | SDK session, permission policy, Agent prompt, Store hooks | `run`, `wire`, `message`, `cancel` |
| `src/main/store.ts` | Authoritative in-memory `OrbitState`; coalesce mutations into state events | Constructed by `index.ts`; mutated by Orchestrator and AgentRunner hooks | Node `EventEmitter` | `update`, `flush`, 60 ms scheduled emission |
| `src/main/persistence.ts` | Durable plain-file state and append-only history | Constructed by `index.ts`; used primarily by Orchestrator | Electron user-data directory and `~/.copilot/orbit` | schedules, memories, Open Items, Proposals, snapshots, history and interaction logs |
| `src/main/runtime.ts` | Locate the user's installed Copilot command-line interface | `Orchestrator.start()` | explicit setting, `PATH`, known paths, login shell | `findCopilotCli` |
| `src/main/mcp.ts` | Load Model Context Protocol (MCP) server definitions | `Orchestrator.start()` | local MCP configuration | `loadMcpServers` |
| `src/main/orchestrator/persona.ts` | Define the Orbit persona, delegation contract, MCP rule, and Agent preamble | Orchestrator and AgentRunner | prompt text | `ORBIT_PERSONA`, `MCP_TOOLS_RULE`, `buildAgentPrompt` |
| `src/main/orchestrator/permissions.ts` | Translate raw Agent permissions into automatic or human decisions | AgentRunner | settings and SDK permission types | `autoDecide`, `describePermission`, `optionToDecision` |
| `src/main/orchestrator/schedules.ts` | Watcher cadence, catch-up, slot deduplication, quiet backoff, and archival rules | Orchestrator Watcher methods | `Schedule` domain state | `makeSchedule`, `catchUpDecision`, `nextRunFor`, `noteQuietRun` |
| `src/main/orchestrator/meetings.ts` | Meeting classification and heads-up planning | Orchestrator timer path | calendar-capable Agent/MCP context | meeting parsing and prep helpers |
| `src/main/orchestrator/evolution.ts` | Turn Evolution Log entries and Proposal state into bounded prompt context | `Orchestrator.buildSystemMessage()` | Persistence and elapsed-time formatting | `parseEvolutionLog`, `evolutionBlock` |
| `src/shared/types.ts` | Contract shared across main, preload, and renderer | All three build units | no runtime owner | `OrbitState`, `OrbitApi`, `AgentView`, `Schedule`, `PendingRequest`, `Proposal` |
| `src/preload/index.ts` | Context-isolated adapter from renderer calls to IPC | BrowserWindow preload | `ipcRenderer` | exposes only `window.orbit` and snapshot harness APIs |
| `src/renderer/App.tsx` | Subscribe to `OrbitState` and compose the desktop experience | React entry point | `ChatPanel`, `Buddy`, Agent shelf | `getState`, `onState` |
| `src/renderer/components/ChatPanel.tsx` | Chat transcript, composer, dictation, settings controls, Mission Control entry | `App` | `window.orbit` commands and child components | `send`, `abort`, `softRestart`, dictation calls |
| `src/renderer/components/Message.tsx` | Render messages, Agent cards, quick replies, permission cards, and safe path actions | ChatPanel and Mission Control | markdown, path parsing, `window.orbit` | `answerRequest`, `cancelAgent`, `openPath` |
| `src/renderer/components/MissionControl.tsx` | Operational views over Agents, Watchers, Memory, Open Items, history, and appearance | ChatPanel | `OrbitState` and management commands | schedule, memory, Open Item and settings actions |
| `src/renderer/components/Buddy.tsx`, `mood.ts`, `styles.css`, `panel.ts` | Character theme, mood derivation, transparent window and desktop interaction | App and main composition | React animation and Electron BrowserWindow | replaceable presentation shell rather than orchestration behavior |

## Main Execution and Data Flow

### 1. Startup and Runtime connection

1. Electron enters `src/main/index.ts`, migrates legacy state, loads settings, and constructs `Store`, `Persistence`, and `Orchestrator`.
2. `createPanel()` creates the renderer window with the preload bridge. `index.ts` forwards Store state events to that window.
3. `Orchestrator.start()` loads persisted Watchers, Memory, Open Items, history, persona, Proposals, and any one-use restart snapshot.
4. `findCopilotCli()` resolves the external Runtime. Orbit deliberately does not package the large Copilot runtime.
5. `CopilotClient` starts over a standard-input/output connection, authentication is checked before session creation, MCP servers are loaded, and available models are listed.
6. `createOrbitSession()` creates the streaming Orbit session. Its available tools are restricted to custom `orbit_*` tools and configured MCP tools; filesystem and shell work are intentionally delegated.
7. Runtime status changes to `ready`, the Store flushes, and launch catch-up starts due Watchers and meeting planning.

Failure to find, start, or authenticate the Runtime leaves the application running with `OrbitState.runtime = "error"` and a user-facing recovery message.

### 2. Conversational orchestration

1. `ChatPanel` calls `window.orbit.send(prompt)`.
2. The preload bridge invokes `orbit:send`; `index.ts` dispatches to `Orchestrator.send()`.
3. The user message enters `OrbitState.messages`, is appended to the interaction log, and is sent to the Orbit Copilot session.
4. `wireOrbit()` translates streaming SDK deltas into one transient `ChatMessage`. Final content replaces the stream, extracts quick-reply markers, and records tool outcomes.
5. When the model calls an `orbit_*` tool, the tool handler directly invokes Orchestrator domain methods. This model-to-tool dispatch is a first-class production caller, not renderer code.
6. Store mutations are coalesced for 60 ms unless an immediate `flush()` is required; `index.ts` pushes snapshots across IPC and React rerenders.

### 3. Agent delegation and observation

1. The Orbit model calls `orbit_spawn_agent` with a standalone title, task, and optional working directory.
2. `spawnAgent()` enforces an eight-live-Agent cap, validates only that the requested directory exists, creates an `AgentView`, and inserts it into the Store.
3. A new `AgentRunner` creates an independent Copilot session using the same selected model and MCP servers, with its own permission and user-input callbacks.
4. SDK events update the Agent's status, current step, bounded activity feed, tool count, usage totals, result, or error.
5. Mission Control and Agent cards render those known facts; Orbit does not invent percentage completion.
6. Follow-ups enqueue into the existing session through `AgentRunner.message()`. Cancellation aborts and disconnects that session.
7. Completion notifies Orbit asynchronously and updates any Watcher associated with the Agent.

Agents are isolated by Copilot session, but not automatically by Git worktree or process-visible terminal. Unless the model supplies another existing directory, all Agents use the configured workspace and can act concurrently in it.

### 4. Human permission and clarification loop

1. AgentRunner auto-approves configured read-only operations; other SDK permission requests and `ask_user` questions call the Orchestrator `ask` hook.
2. Orchestrator creates a `PendingRequest`, changes the Agent to `needs-input`, logs the event, and may display a desktop bubble.
3. `Message.tsx` renders choices or freeform input and calls `window.orbit.answerRequest()`.
4. `Orchestrator.answerRequest()` removes the request, records its resolution, and resolves the pending Promise back into AgentRunner.
5. An unanswered request can time out and becomes a denial so an Agent does not hang indefinitely.

### 5. Watchers

1. Orbit tools or Mission Control create and manage persisted `Schedule` records.
2. `index.ts` calls `Orchestrator.tick()` every second; Watchers are evaluated every 15 ticks.
3. `schedules.ts` determines runnable cadence and catch-up behavior. Daily missed slots can run shortly after launch; due jobs are staggered to avoid Runtime contention.
4. `runSchedule()` starts a normal Agent with previous-run context. Quiet Watchers suppress `NOTHING TO REPORT`, increase backoff after dull runs, and return to requested cadence when they find news.
5. One-shot Watchers archive after firing. Archived Watchers preserve run count and the last report but cannot run until restored.
6. Every material transition updates both Store and `schedules.json`.

### 6. Memory, Open Items, and self-evolution

- Memory is deduplicated durable context and is injected into every newly built Orbit system prompt.
- Open Items preserve unanswered decisions separately from settled knowledge. A slower tick may re-raise them only while the user is recently active and Orbit is idle.
- Proposals preserve self-improvement lifecycle independently of prose. `evolution.ts` combines current Proposal state with a bounded digest of the Evolution Log so shipped or declined ideas are not repeatedly proposed.
- Interaction logs record user turns, Orbit turns, Agent lifecycle events, and Orbit tool outcomes in daily JSON Lines files intended for later reflection.
- Soft restart writes messages, usage, and descriptions of live Agents to a one-use `SessionSnapshot`; Electron relaunch restores conversation context but live Agent sessions are reported as interrupted rather than resumed.

## Callers and Consumers

### Production callers

- Electron lifecycle calls `index.ts`; timers call `Orchestrator.tick()`.
- React components call the preload `OrbitApi`; IPC handlers in `index.ts` call Orchestrator and platform services.
- The Orbit language model calls the custom `orbit_*` tools registered by `orbitTools()`.
- SDK event emitters call `wireOrbit()` and `AgentRunner.wire()` handlers asynchronously.
- Watcher and meeting timers call Agent creation paths without a user chat turn.
- Store state events are consumed by `index.ts` and forwarded to the renderer.

### Tooling and configuration consumers

- electron-vite builds separate main, preload, and renderer outputs.
- electron-builder packages only built output and intentionally excludes the Copilot Runtime.
- `tools/capture/` drives snapshot scenes for README imagery and visual inspection.

### Tests

No `*.test.*` or `*.spec.*` files and no package test script were found at the inspected commit. The capture harness is a visual asset/snapshot tool, not evidence of domain behavior.

## Test Seams

There are no checked-in automated behavior tests to establish supported contracts. The highest observable seams available in production code are:

1. `OrbitApi` and IPC handlers for renderer-to-main behavior.
2. `Store` state snapshots for user-visible transitions.
3. Pure helpers in `schedules.ts`, `meetings.ts`, `evolution.ts`, `choices.ts`, and `permissions.ts`.
4. Copilot SDK event handlers in `wireOrbit()` and `AgentRunner.wire()`.
5. Persistence methods and their plain-file outputs.
6. The snapshot capture harness for rendered scenes only.

## Constraints, Risks, and Unknowns

### Verified constraints

- The installed and authenticated Copilot command-line interface is required; Orbit does not bundle it.
- The Copilot SDK remains an external build dependency because it spawns the Runtime and uses native foreign-function integration.
- Renderer access is restricted to the preload `OrbitApi`; filesystem, Runtime, persistence, and Electron authority remain in the main process.
- Orbit is intentionally tool-restricted, while delegated Agents receive ordinary Copilot session capabilities.
- A maximum of eight Agents may be live concurrently.
- Watchers survive process restarts, but live Agent sessions do not.

### Evidence-backed change risks

- `Orchestrator` is the convergence point for session lifecycle, tool registration, Agent coordination, scheduling, meetings, durable domain state, logging, bubbles, and restart behavior. Changes there can cross several flows even when the edited method appears local.
- Agent session separation is not filesystem isolation. Concurrent Agents default to the same workspace, so overlapping writes are possible.
- Store mutation and persistence are coordinated manually by Orchestrator methods. A new state transition must update in-memory state, durable state when applicable, history, and immediate renderer visibility consistently.
- Persistence uses synchronous filesystem operations in the Electron main process. The records are small and bounded in several places, but latency directly occupies the application authority thread.
- No automated behavior suite was found, so refactoring confidence currently depends on type-checking, manual execution, and visual snapshots.

### Intent versus implementation

- Documentation describes nightly self-reflection as appending to `evolution-log.md`. The inspected application reads and digests that file and provides Proposal tools, but no built-in writer or default reflection schedule was found in `src/`. The writer may be a user-created Watcher, external process, uninspected release state, or documentation ahead of implementation.
- Orbit describes each Agent as having its own working directory. Code gives each Agent a `cwd`, but defaults every Agent to one configured workspace and does not create a worktree.

### Unknowns

- No Architecture Decision Records, repository instructions, or canonical domain glossary were found.
- Dynamic behavior inside the Copilot SDK and command-line Runtime is outside this repository; this map covers Orbit's visible contracts and event handling.
- The intended degree of autonomous self-modification cannot be established from source alone because Proposal approval, Agent prompts, repository permissions, and any external reflection writer determine what actually happens.

## Recommended Reading Order

1. `README.md` — product vocabulary and claimed behavior.
2. `src/shared/types.ts` — the authoritative cross-process state and command contracts.
3. `src/main/index.ts` — application composition, IPC, timers, and lifecycle.
4. `src/main/orchestrator/persona.ts` — why the Orbit session delegates rather than works directly.
5. `src/main/orchestrator/orchestrator.ts`: `start`, `createOrbitSession`, `orbitTools`, `send`, `spawnAgent`, and `tick` — the central execution path.
6. `src/main/orchestrator/agentRunner.ts` and `permissions.ts` — delegated session lifecycle and human gates.
7. `src/main/store.ts` and `persistence.ts` — transient versus durable state ownership.
8. `src/main/orchestrator/schedules.ts` and `evolution.ts` — Watcher and feedback-loop semantics.
9. `src/preload/index.ts`, `renderer/App.tsx`, `ChatPanel.tsx`, `Message.tsx`, and `MissionControl.tsx` — projection of domain state into interaction.

## Evidence Index

- [`package.json`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/package.json) identifies Orbit 0.3.0, Electron entry point, dependencies, scripts, and absence of a test command.
- [`electron.vite.config.ts`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/electron.vite.config.ts) proves the main/preload/renderer build split and external SDK boundary.
- [`electron-builder.yml`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/electron-builder.yml) proves packaging boundaries and exclusion of the bundled Runtime.
- [`src/shared/types.ts`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/src/shared/types.ts) defines observed domain vocabulary, `OrbitState`, and `OrbitApi`.
- [`src/main/index.ts`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/src/main/index.ts) proves composition, IPC callers, state forwarding, timers, and shutdown.
- [`src/main/orchestrator/orchestrator.ts`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/src/main/orchestrator/orchestrator.ts) proves Runtime startup, Orbit session restrictions, tool dispatch, Agent creation, Watchers, prompt assembly, persistence coordination, and soft restart.
- [`src/main/orchestrator/agentRunner.ts`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/src/main/orchestrator/agentRunner.ts) proves one-session-per-Agent execution, SDK event translation, watchdogs, follow-ups, and human input handling.
- [`src/main/orchestrator/persona.ts`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/src/main/orchestrator/persona.ts) proves the delegation-only product contract and self-evolution instructions.
- [`src/main/orchestrator/permissions.ts`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/src/main/orchestrator/permissions.ts) proves automatic read policy and human permission decisions.
- [`src/main/orchestrator/schedules.ts`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/src/main/orchestrator/schedules.ts) proves Watcher cadence and backoff rules.
- [`src/main/orchestrator/evolution.ts`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/src/main/orchestrator/evolution.ts) proves bounded reflection and Proposal prompt injection.
- [`src/main/store.ts`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/src/main/store.ts) proves state ownership and throttled publication.
- [`src/main/persistence.ts`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/src/main/persistence.ts) proves durable stores, atomic JSON writes, append-only logs, and restart snapshots.
- [`src/preload/index.ts`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/src/preload/index.ts) proves the context-isolated renderer command boundary.
- [`src/renderer/App.tsx`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/src/renderer/App.tsx), [`ChatPanel.tsx`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/src/renderer/components/ChatPanel.tsx), [`Message.tsx`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/src/renderer/components/Message.tsx), and [`MissionControl.tsx`](https://github.com/sesh-kebab/orbit/blob/ac64f12df52cf96b869f9180979ae058cbe12b68/src/renderer/components/MissionControl.tsx) prove the renderer's state-consumer and command-caller roles.
- Repository searches for instruction files, domain guidance, Architecture Decision Records, and `*.test.*`/`*.spec.*` files returned no matches at the evidence commit.
