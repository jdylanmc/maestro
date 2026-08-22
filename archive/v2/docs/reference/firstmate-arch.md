# Firstmate Architecture Reference

**Evidence:** `bdae21ed09d2cca4f57caed4bda9d30d8f9d9be8` (default head, 2026-08-17). All links pinned. Descriptive only.

## Scope and Orientation

Read-only reference for `kunchenguid/firstmate`. Not a compiled app: "the cloned repo is the distro" ([README](https://github.com/kunchenguid/firstmate/blob/bdae21ed09d2cca4f57caed4bda9d30d8f9d9be8/README.md)). No manifest, build, or service. Surface: Bash (`bin/` 138 scripts + 7 adapters; `tests/` 147), Markdown instructions (`AGENTS.md`, 19 skills, 28 docs), harness hook files, and three workflows.

**Core idea (Interpreted):** two programs sharing one filesystem--an LLM-executed instruction program (`AGENTS.md`) and a deterministic Bash toolbelt owning every safety-critical step ("no heuristics and no LLM", [fm-crew-state.sh:15-17](https://github.com/kunchenguid/firstmate/blob/bdae21ed09d2cca4f57caed4bda9d30d8f9d9be8/bin/fm-crew-state.sh#L15-L17)).

Not inspected: Herdr/cmux/Zellij/Orca internals, Relay, `docs/configuration.md`, and skill bodies.

## Observed Vocabulary

No formal glossary exists.

**captain** (user) · **first mate** (orchestrator) · **crewmate** (worker with endpoint and worktree) · **secondmate** ("a crewmate with an isolated firstmate home and a charter, not a second architecture", [AGENTS.md:19](https://github.com/kunchenguid/firstmate/blob/bdae21ed09d2cca4f57caed4bda9d30d8f9d9be8/AGENTS.md#L19)) · **ship/scout** · **backend** (`tmux herdr zellij orca cmux`) · **harness** · **wake queue** · **absorb/actionable** · **provably working** · **wedge** · **afk** · **treehouse worktree** · **project mode** · **yolo** · **`FM_HOME`**.

`AGENTS.md:435-439` prohibits most internal nouns in captain-facing text; *scout* and *second mate* are exceptions.

## Architecture at a Glance

```text
CAPTAIN --chat--> PRIMARY HARNESS ("first mate", FM_ROOT, session lock)
       hooks ------> | invokes bin/fm-*.sh subprocesses
                    +-- fm-session-start
                    +-- fm-spawn · fm-send · fm-control · fm-crew-state
                    +-- fm-teardown · fm-pr-*

fm-watch.sh --> .wake-queue --> fm-wake-drain --> LLM turn
                       |
fm-backend.sh --> backends/*.sh --> MULTIPLEXER --> visible fm-<id> panes
                                             +--> crewmate · scout · secondmate

SSH: fm-on.sh --> remote entrypoint --> worker --> remote FM_HOME
```

Boundaries are process, runtime backend, asynchronous filesystem communication, home (`FM_HOME`), and host (SSH). No socket or shared-memory interprocess mechanism was observed between the watcher and primary.

## Runnable Units and Process Boundaries

- **Primary harness:** interactive first-mate process holding the home lock.
- **`fm-session-start.sh`:** one-shot startup composition.
- **`fm-startup-network.sh`:** detached, bounded network startup.
- **Watcher:** blocking singleton using `state/.watch.lock` and a beacon ([fm-watch.sh:712-745](https://github.com/kunchenguid/firstmate/blob/bdae21ed09d2cca4f57caed4bda9d30d8f9d9be8/bin/fm-watch.sh#L712-L745)).
- **Away daemon:** long-lived process gated by `state/.afk`; runs the watcher as a child.
- **Crewmate/scout:** task agent with a backend endpoint and worktree.
- **Secondmate:** isolated `FM_HOME`, local or remote.
- **Remote carrier and worker:** per-call SSH execution.
- **Continuous Integration (CI):** eight workflow jobs.

No language packages or workspaces exist. Configuration is expressed through `.tasks.toml`, `.no-mistakes.yaml`, workflows, scripts, and private operational files. The tracked/private split is enforced by `.gitignore` and CI invariants.

## Modules and Responsibilities

| Module | Responsibility | Called by | Depends on | Evidence/class |
|---|---|---|---|---|
| `AGENTS.md`, `CLAUDE.md`, `.agents/skills/` | Always-loaded rules, lifecycle, supervision, skill routing | LLM at session start | Script contracts | [Verified](https://github.com/kunchenguid/firstmate/blob/bdae21ed09d2cca4f57caed4bda9d30d8f9d9be8/AGENTS.md#L14-L45) |
| `fm-session-start.sh` | Nine ordered, lock-first startup stages | LLM; session hook | Lock, bootstrap, drain, network | Verified |
| `fm-spawn.sh` | Backend choice, locks, endpoint, worktree, launch, metadata, relaunch | LLM; control; bootstrap | Libraries, backend, treehouse | [Verified](https://github.com/kunchenguid/firstmate/blob/bdae21ed09d2cca4f57caed4bda9d30d8f9d9be8/bin/fm-spawn.sh#L940-L1010) |
| `fm-backend.sh` | Backend detection, validation, loading, and verb dispatch | Spawn, send, watch, teardown, state, daemon | `bin/backends/*.sh` | Verified |
| `backends/tmux.sh` | Reference adapter and recovery-grade agent-state classification | `fm_backend_source` | tmux, `ps`, tmux library | Verified |
| `fm-watch.sh`, `fm-wake-lib.sh` | Zero-token triage, durable queue, locks, process identity, recovery generations | Hooks, arm layer, daemon | State and classification libraries | Verified |
| `fm-wake-drain.sh` | Present wakes, decisions, status, and generation-bound acknowledgement | LLM wake turns | Wake, classify, guard libraries | Verified |
| `fm-crew-state.sh` | Deterministic current-state projection with fixed precedence | Watcher, LLM, snapshots | Backend, busy, run-step libraries | Verified |
| `fm-send.sh`, `fm-control.sh` | Verified text data plane versus closed-verb control plane | LLM | Backend submission; relaunch | Verified |
| `fm-teardown.sh` | Landed-work proof before cleanup | LLM after landing | treehouse, GitHub CLI, lock library | [Verified](https://github.com/kunchenguid/firstmate/blob/bdae21ed09d2cca4f57caed4bda9d30d8f9d9be8/bin/fm-teardown.sh#L1-L95) |

Each mechanical fact generally has one named owner: lint, test lanes, current state, landed-work checks, lock staleness, composer verdicts, tmux submission, fast-forward mechanics, endpoint identity, and wake format. Harness behavior is deliberately split across detection, launch, busy-state, composer, cleanup, and skill-prose owners.

## Main Execution and Data Flow

### Startup

Clone equals installation. Nine startup stages run lock-first because bootstrap mutation and wake draining require exclusive ownership. A lock-refused session becomes read-only: it cannot spawn, steer, merge, drain, or repair. Network work is detached from the blocking path.

### Dispatch

`fm-send` types once, retries only Enter, exits nonzero on a confirmed swallowed submission, and refuses unresolved targets. `fm-control` accepts only `interrupt`, `exit`, and `relaunch`, verifies postconditions, and targets exact task identifiers. Teardown is permanently excluded from the control plane. `--resolve-key` makes the answering home close its decision locally.

### Spawn

The brief's mode and yolo contract is validated, followed by backend resolution:

```text
--backend --> environment --> config --> auto-detection --> tmux default
```

A backend refusal is terminal. Spawn acquires task locks, creates the endpoint, obtains a treehouse worktree with a two-consecutive-read settle check, expands the harness launch template, and publishes `<id>.meta`. Secondmates differ primarily through launch environment and isolated `FM_HOME`. Relaunch reconstructs identity from validated metadata and requires a positively dead endpoint.

### Worktree and Teardown

Work is landed when reachable from a remote-tracking branch, represented by a merged pull-request head containing the work, or already present in the default branch. Uncommitted work is never landed; inconclusive evidence causes refusal. Scouts require `report.md` and the decision gate. Stale Git locks are removed only after a multi-part proof.

### Backend and Liveness

Detection is innermost-first: tmux outranks `HERDR_ENV`, cmux is checked last, and Zellij/Orca are never auto-detected. The tmux adapter combines exact-window inventory, foreground process group, executable name, and pane command. Any harness evidence means alive; an entirely shell-like group means dead; incomplete evidence means ambiguous.

### Supervision

A signal is actionable in away mode, when it contains a captain-relevant verb, or when it has no verb and the crewmate is not provably working. Wake publication records the recovery marker before appending the row and advancing suppression markers.

Drain presents wakes, unread status, a byte-capped fleet-wide open-decision fold, and:

```text
WAKE_ACK_REQUIRED --ack-through <seq> --recovery-generation <gen>
```

Interruption before acknowledgement leaves work durable. Away mode injects one batched operational digest behind an otherwise untypeable marker. Unsupported supervision backends refuse startup; wedged injection writes an alarm marker; legacy checks are migrated without execution or refused.

### Architectural Seams

**Foundational:** filesystem-as-IPC per home, `<id>.meta` identity, durable queue and acknowledgement, append-only logs plus current-state projection, single-owner contracts, `AGENTS.md`, and worktree isolation.

**Replaceable behind explicit registration:** backend, harness, backlog provider, validation mode, supervision protocol, away engine, remote transport, Relay, and worktree provider. There is no dynamic plugin loader.

## Callers, Consumers, Integrations, and Persistence

Production callers are the LLM and harness hooks. Hooks invoke startup, pre-tool guards, subagent guards, turn-end guards, and watcher auto-arm behavior without another agent turn. Cursor and Pi provide equivalent surfaces.

```text
watcher --> durable queue --> drain --> LLM turn
```

Cross-home operations use explicit `FM_HOME`. Remote updates route through `fm-on.sh` and remain fast-forward-only. CI and contributor tooling invoke linting and tests independently.

Integrations include Git, GitHub CLI, treehouse, no-mistakes, task tooling, five multiplexers, nine harness command-line interfaces, OpenSSH, ShellCheck, and optional Relay.

Persistence is plain files only: no database and no daemon-owned authoritative memory. Durable state and live backend inventory--not conversation memory--are authoritative after restart.

## Test Seams

`tests/lib.sh` provides process-safe temporary fixtures, orphan reaping using process identifier and identity, command fakes through `PATH`, deterministic Git fixtures, metadata writers, and assertions.

[`fm-spawn-worktree-settle.test.sh`](https://github.com/kunchenguid/firstmate/blob/bdae21ed09d2cca4f57caed4bda9d30d8f9d9be8/tests/fm-spawn-worktree-settle.test.sh) fakes external commands, executes the real spawn script under `FM_*_OVERRIDE`, and asserts against `state/<id>.meta`.

The watcher supports function loading without entering its lock-and-loop path. `fm-test-run.sh` owns selection, lanes, markers, and the proven-isolated parallel set. CI verifies lint, coverage partitioning, serial and parallel shards, pinned Herdr behavior, macOS Bash compatibility, and repository invariants.

## Constraints, Risks, Intent vs. Implementation, and Unknowns

### Verified Constraints

- macOS and Linux only, with explicit portability handling;
- one session lock and watcher per home;
- lock refusal means read-only operation;
- backend capabilities are nonuniform;
- fast-forward-only synchronization;
- secondmates cannot spawn secondmates;
- no cross-home child-tree supervision;
- `fm-send` fails closed without explicit `FM_HOME`;
- teardown requires landed-work proof.

### Risks

- The instruction surface is large and acknowledged as prone to regrowth.
- Guarantees are divided between code enforcement and model compliance.
- Digest truncation is a known failure mode with ordering mitigations.
- Experimental backend guarantees differ.
- Fail-open and fail-closed directions are deliberate and adapter-sensitive.
- Some single-writer state rules are conventional rather than filesystem-enforced.

### Intent vs. Implementation

Restart-proofing, zero-token supervision, teardown safety, unsupported-backend refusals, and "not a second architecture" are corroborated by code.

The strict project boundary is primarily instruction-enforced; no general filesystem interceptor was found. "Crewmates never address the captain" is structural for secondmates but brief-level for ordinary crewmates. Composer ownership is only partially verified across adapters. Arm-layer status behavior and Herdr presentation projection are documented intent whose implementations were not inspected.

### Unknowns

- non-tmux adapter internals;
- arm and turn-end guards;
- JavaScript policy files;
- Relay;
- fleet snapshot schema;
- skill bodies;
- full configuration schema;
- several central classification/composer libraries;
- real runtime behavior;
- design history beyond the pinned revision.

## Recommended Reading Order

1. `README.md`
2. `AGENTS.md:14-131`
3. `AGENTS.md` sections 3, 7, and 8
4. `fm-session-start.sh`
5. `fm-backend.sh`
6. `backends/tmux.sh`
7. `fm-spawn.sh`
8. `fm-watch.sh` and `fm-wake-lib.sh`
9. `fm-wake-drain.sh`
10. `fm-crew-state.sh`
11. `fm-teardown.sh`
12. `fm-control.sh` and `fm-send.sh`
13. `fm-supervise-daemon.sh`
14. Harness registration and detection
15. Remote entry points
16. `tests/lib.sh`, one representative test, and CI
17. `CONTRIBUTING.md`
18. `docs/architecture.md`

## Evidence Index

| Evidence | Proves |
|---|---|
| [AGENTS.md:47-131](https://github.com/kunchenguid/firstmate/blob/bdae21ed09d2cca4f57caed4bda9d30d8f9d9be8/AGENTS.md#L47-L131) | `FM_HOME` semantics and operational file inventory |
| [AGENTS.md:378-432](https://github.com/kunchenguid/firstmate/blob/bdae21ed09d2cca4f57caed4bda9d30d8f9d9be8/AGENTS.md#L378-L432) | Supervision, drain, acknowledgement, and away contracts |
| [fm-spawn.sh:1101-1180](https://github.com/kunchenguid/firstmate/blob/bdae21ed09d2cca4f57caed4bda9d30d8f9d9be8/bin/fm-spawn.sh#L1101-L1180) | Harness launch seam and closed-set dispatch |
| [fm-spawn.sh:2621-2706](https://github.com/kunchenguid/firstmate/blob/bdae21ed09d2cca4f57caed4bda9d30d8f9d9be8/bin/fm-spawn.sh#L2621-L2706) | Task metadata and relaunch publication |
| [fm-backend.sh:595-635](https://github.com/kunchenguid/firstmate/blob/bdae21ed09d2cca4f57caed4bda9d30d8f9d9be8/bin/fm-backend.sh#L595-L635) | Explicit backend registration |
| [fm-wake-lib.sh:926-993](https://github.com/kunchenguid/firstmate/blob/bdae21ed09d2cca4f57caed4bda9d30d8f9d9be8/bin/fm-wake-lib.sh#L926-L993) | Wake format and publication ordering |
| [fm-wake-drain.sh](https://github.com/kunchenguid/firstmate/blob/bdae21ed09d2cca4f57caed4bda9d30d8f9d9be8/bin/fm-wake-drain.sh) | Presentation-before-consumption and generation-bound acknowledgement |
| [ci.yml](https://github.com/kunchenguid/firstmate/blob/bdae21ed09d2cca4f57caed4bda9d30d8f9d9be8/.github/workflows/ci.yml) | Test partitioning, pinned Herdr lane, and repository invariants |

**Status:** approved architecture reference. Claims are Verified, Interpreted, or Unknown as marked. Strictly descriptive; no secret values reproduced.
