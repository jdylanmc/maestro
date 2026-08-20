# aeon - Architecture Reference

**Evidence:** `aeonfun/aeon@eb86eac6653c70ff03d499e7c70092c377c7dc7e` (main, 2026-08-20). No versioned package or release tag exists; the project ships directly on `main`. Documentation site `https://www.aeon.fun/docs` last-updated stamp reads 2026-07-16 [V]; site warns it may lag the repo. Analyzed read-only 2026-08-20.

Tags: **[V]** verified · **[I]** interpreted · **[U]** unknown.

---

## Scope and Orientation

aeon is a GitHub Actions–hosted autonomous agent framework. An operator forks the repository, enables skills, sets API secrets, and the system runs recurring tasks unattended. The primary domain exhibited in the catalog is crypto/DeFi monitoring and on-chain action; the framework itself is domain-agnostic. This document is a descriptive record of the architecture as read in source. It does not propose adoption, redesign, or integration. Files not fetched: individual `skills/*/SKILL.md` files (~75 total), `apps/dashboard/` source, `apps/mcp-server/` source, `.github/workflows/` files, `aeon.yml` beyond the first 500 characters. Claims derived from those paths are marked `[I]` or `[U]`.

---

## Observed Vocabulary [V]

Defined from `CLAUDE.md` (SHA `3a3c8499`) and `docs/CORE.md` (SHA `75d492a5`) unless noted.

**skill** — a self-contained `SKILL.md` instruction file under `skills/`, executed by a coding-agent CLI in one ephemeral GitHub Actions job · **run** — one invocation of a skill; a fresh headless agent process that exits on completion; "there is no long-lived process" (`CLAUDE.md:§How Aeon works`) · **harness** — the coding-agent CLI executing the skill: Claude Code (default), Grok Build, Codex, Pi, Vibe, or Kimi (`docs/harnesses.md:¶1`) · **memory** — the `memory/` directory committed to the repo; five layers: `MEMORY.md` (index), `topics/` (concept store), `logs/` (append-only daily), `issues/` (structured issue tracker), `skill-health/` (per-run quality scores) · **cron-state.json** — committed file tracking per-skill success rates and last-run metadata; the primary health signal · **chain** — an operator-configured sequential pipeline of skills where each step may `consume:` prior step output (`CLAUDE.md:§Skill Chaining`) · **fleet** — a set of aeon repo instances: a parent plus its `spawn-instance`-generated GitHub repo forks, tracked in `memory/instances.json` (`docs/CORE.md:§Fleet`) · **instance** — one aeon fork; has its own secrets, Actions, and `memory/` · **strategy** — `STRATEGY.md`; operator-written north-star injected into every skill's context · **soul** — `soul/SOUL.md` + `soul/STYLE.md` + `soul/examples/`; operator voice and persona, read before any notification is composed · **capability** — a declared blast-radius hint on a skill pack: one of six locked values (`read_only`, `external_api`, `writes_external_host`, `onchain_writes`, `agent_messaging`, `sends_notifications`); documentation only, not a runtime gate (`docs/CAPABILITIES.md:§taxonomy`) · **mode** — `read-only` or `write`; per-skill frontmatter field enforced at runtime by an OS sandbox (`bwrap`/`sandbox-exec`); this is the load-bearing enforcement layer, not the tool allowlist (`docs/CAPABILITIES.md:§mode`) · **notify** — `./notify`, a shell script that fans output to all configured channels (Telegram, Discord, Slack, Buzz, Resend, json-render) · **skill-health** — the detector skill that scores runs and files issues into `memory/issues/` · **skill-repair** — the fixer skill that reads open issues and opens PRs · **spawn-instance** — the skill that forks the repo into a new GitHub repo and registers it in `memory/instances.json` · **fleet-control** — the skill that polls child instances via `gh` and can dispatch skills to them · **var** — the single configurable parameter a skill accepts at dispatch time

---

## Vocabulary Mapping to Maestro [V/I]

| aeon term | aeon meaning | Nearest Maestro term | Relationship |
|---|---|---|---|
| **fleet** ⚠️ | A pool of GitHub repo forks supervised by a parent instance | Fleet | **Term collision, inverted scope.** aeon fleet = multiple repos. Maestro Fleet = one isolated worktree+session unit. |
| **instance** | One aeon GitHub repo fork; own secrets, Actions, memory | Fleet | Near-miss. Closest structural analogue: isolated, own credentials, own state. But GitHub-infrastructure, not a local worktree. |
| **session** ⚠️ | Not a defined noun. `session_id` appears as a per-run opaque identifier in harness output metadata. | Session | Partial collision. aeon `session_id` is a run-scoped token, not a named resumable conversation. |
| **run** | One ephemeral GitHub Actions job executing one skill | — (single Copilot turn) | Unrelated to Fleet. Closer to one agent invocation with no resumption. |
| **skill** | A reusable task template (`SKILL.md`) | — | Unrelated. Not a structural isolation unit; a reusable instruction document. |
| **harness** | The coding-agent CLI (Claude Code, Grok, etc.) | Session | Near-miss. The harness is the executor; aeon can swap it per skill. Maestro Session is a named resumable conversation, not a swappable CLI. |
| **chain** | Operator-configured linear skill pipeline | subagent tree | Near-miss. Chain is static, operator-defined, sequential. Maestro subagent tree is runtime, delegated, observed. |
| **memory/** | Committed git directory; shared across all skills in one instance | Fleet durable state | Near-miss. Both durable across invocations. aeon memory is shared across all skills; Maestro Fleet state is per-Fleet. |
| **mode** | `read-only` vs. `write`, OS-sandbox-enforced | — | Unrelated to Maestro lifecycle states. |
| **workspace** | Not defined. Implicit: GitHub Actions runner checkout. | worktree | Unrelated. No explicit concept; not a persistent local worktree. |
| **agent** | Informal; refers to the running LLM process. Not a defined noun. | — | No formal definition in aeon. |

**Term collision summary.** `fleet` is the highest-risk collision: a reader familiar with Maestro will misread aeon's fleet as meaning one isolation unit when it means the entire ensemble. `session` is a minor collision localized to harness metadata.

---

## Architecture at a Glance [V/I]

```text
  ┌─────────────────────────────────────────────────────────┐
  │  GitHub (cloud infrastructure)                          │
  │                                                         │
  │  ┌─────────────────────────────────────────────────┐   │
  │  │  aeon repo (one instance)                       │   │
  │  │                                                 │   │
  │  │  aeon.yml ──► GitHub Actions scheduler          │   │
  │  │                     │                           │   │
  │  │              per-skill job (ephemeral runner)   │   │
  │  │                     │                           │   │
  │  │         install harness CLI (claude/grok/…)     │   │
  │  │                     │                           │   │
  │  │         OS sandbox (bwrap / sandbox-exec)       │   │
  │  │                     │                           │   │
  │  │         claude -p "run skill X"  ◄── CLAUDE.md  │   │
  │  │              │           │           STRATEGY.md│   │
  │  │         reads memory/   writes memory/          │   │
  │  │         fetches web     opens PR                │   │
  │  │              │                                  │   │
  │  │         ./notify ──► Telegram / Discord / Slack │   │
  │  │              │                                  │   │
  │  │  memory/ (committed) ◄──── cron-state.json      │   │
  │  │  ├── MEMORY.md                                  │   │
  │  │  ├── logs/YYYY-MM-DD.md                         │   │
  │  │  ├── topics/                                    │   │
  │  │  ├── issues/ISS-NNN.md                          │   │
  │  │  └── skill-health/*.json                        │   │
  │  └─────────────────────────────────────────────────┘   │
  │                                                         │
  │  ┌──────────┐  spawn-instance  ┌──────────────────┐    │
  │  │  parent  │ ──────────────►  │  child instance  │    │
  │  │ instance │ ◄── fleet-ctrl ─ │  (separate repo) │    │
  │  └──────────┘  (gh dispatch)   └──────────────────┘    │
  └─────────────────────────────────────────────────────────┘

  Operator machine
  ┌────────────────────────────────────┐
  │  ./aeon  ──►  apps/dashboard      │
  │               (Next.js, port 5555) │
  │               shells out to `gh`   │
  └────────────────────────────────────┘

  Human ◄──► Telegram bot (inline buttons, force-reply)
  Human ◄──► Dashboard (local, manual launch required)
  Human ◄──► GitHub PRs (review, merge, or close)
```

---

## Runnable Units and Process Boundaries [V]

The runnable unit is the GitHub Actions job. Each job is ephemeral: a fresh runner, a fresh repo checkout, a fresh harness CLI process. The agent process starts with `claude -p "run skill X"` (or equivalent for other harnesses) and exits when the skill completes or the job times out. No process persists between runs. `CLAUDE.md` states this explicitly: "there is no long-lived process and nothing persists between runs except the `memory/` directory and the git repo itself."

The `./aeon` binary is a shell script (2,749 bytes, SHA `eaba34ed`) that launches `apps/dashboard` (a local Next.js dev server). It is not a supervisor and does not run skills. It exits if `gh` is not authenticated.

No daemon, no scheduler process, no socket server. GitHub Actions is the entire scheduler and process supervisor.

**OS sandbox.** Read-only skills run inside `bwrap --ro-bind` (Linux) or `sandbox-exec` with `deny file-write*` (macOS), applied by `harness-adapter/lib/sandbox.sh`. `docs/CAPABILITIES.md` identifies this as "Layer 2 is the guarantee" — the tool allowlist (Layer 1) and post-run revert (Layer 3) are defense-in-depth, not the load-bearing boundary. The sandbox is the dispatcher's, applied uniformly across all six harnesses.

---

## Modules and Responsibilities [V/I]

| Path | Role |
|---|---|
| `aeon.yml` | Skill schedule and configuration; the operator's primary config file |
| `CLAUDE.md` | Operating manual; read by the agent on every run; authoritative over docs site |
| `STRATEGY.md` | Operator's north-star and constraints; injected into every skill's context |
| `skills/*/SKILL.md` | Per-skill instruction files; ~75 in the catalog |
| `harness-adapter/` | Adapters wrapping each agent CLI into a uniform `{result, usage, session_id}` contract |
| `harness-adapter/lib/sandbox.sh` | OS sandbox enforcement for read-only mode |
| `scripts/` | Shell utilities: `notify`, `secretcurl`, `skill-runs`, `run-grok.sh`, `fleet-scorecard.mjs`, `gen-agents-md.js` |
| `memory/` | All durable state; committed to git |
| `apps/dashboard/` | Local Next.js web UI; shells out to `gh`; not a hosted service [I from `aeon` script] |
| `apps/mcp-server/` | Local MCP server exposing skill dispatch to desktop clients |
| `apps/webhook/` | Relay: receives inbound webhooks and dispatches `messages.yml` |
| `catalog/` | Skill registry JSON for the dashboard and install tooling |
| `soul/` | Operator voice and persona files |
| `bin/install-skill-pack` | Community skill pack installer with capability allow-list validation |

---

## Main Execution and Data Flow [V]

### Dispatch

A GitHub Actions cron event, a manual workflow dispatch (dashboard or Telegram "Run again" button), or a `depends_on:` reactive trigger starts one workflow job. Chains dispatch each step through `chain-runner.yml`.

### Resolve

The workflow reads `aeon.yml` to determine the skill's `model:`, `mode:`, `harness:`, and `requires:` (API key names). It resolves `.mcp.json`, installs the harness CLI, and injects declared secrets into the runner environment. The OS sandbox is applied if `mode: read-only`.

### Run

The harness CLI is invoked: `claude -p "run skill X"` (Claude Code default). `CLAUDE.md` and `STRATEGY.md` auto-load as standing instructions. The skill reads `skills/X/SKILL.md` and executes its instructions: reading `memory/`, fetching web data, computing, and writing output.

### Act

In `write` mode: the skill may write files, commit, push branches, open PRs via `gh`, and call `./notify`. In `read-only` mode: file writes are blocked by the OS sandbox; output goes to stdout (captured by the workflow) and `./notify`.

### After

The workflow captures stdout as the run's output. `notify-jsonrender` converts it to a dashboard feed entry if `JSONRENDER_ENABLED=true`. For read-only runs, the workflow appends a `memory/logs/` entry and reverts any stray writes. The quality scorer (a separate Haiku call) grades stdout and writes a score to `memory/skill-health/`.

---

## The Automation Loop [V]

This is aeon's defining architectural feature and the primary point of divergence from Maestro.

**Trigger.** A cron schedule in `aeon.yml`, a manual dispatch, or a `depends_on:` dependency (e.g., `skill-repair` depends on `skill-health`). GitHub Actions is the clock.

**The meta-loop, as documented in `docs/CORE.md:§How the loop closes`:**

```
skill-health (daily 18:00)
  → scores all enabled skills from cron-state.json + skill-health/*.json
  → classifies CRITICAL / DEGRADED / FLAPPING / WARNING / HEALTHY / NO-DATA
  → files issues into memory/issues/ISS-NNN.md on state change

skill-repair (reactive, depends_on: skill-health)
  → reads open issues
  → triage: picks worst fixable target; clusters by error signature
  → PREFLIGHT → TRIAGE → DIAGNOSE → REPAIR → VERIFY → LOG
  → opens a PR with the fix

self-improve (every other day)
  → reads last 2 days of logs + cron-state
  → makes one minimal change (tighten prompt, add backoff)
  → opens a PR if <3 improvement PRs already open

autoresearch (operator-triggered via var=<skill-name>)
  → generates 4 improvement variations; ships the best as a PR
```

**Bound.** Per iteration: one skill run, one job, one exit. `skill-repair` caps at 3 repair PRs/day and a 24-hour per-skill cooldown. `self-improve` exits without writing if 3 or more improvement PRs are already open. These are explicit numeric backpressure gates in the documented spec; whether the implementations enforce them was not verified by running the skills.

**Stop condition.** The loop has no designed terminal state. It runs indefinitely while GitHub Actions is enabled. An operator stops it by disabling Actions, setting `enabled: false` on skills, or closing unmerged PRs.

**Human position inside the loop.** The loop is designed to close without human involvement: `skill-health` detects → `skill-repair` fixes → PR merged (by whom is not specified — [I] likely requires a human merge unless auto-merge is configured) → cron-state recovers → issue resolved. The human's optional roles: 👍/👎 on `health: <skill>` GitHub Issues to set repair priority; Telegram button taps to run, snooze, or mute; PR review. The operator can be absent for extended periods and the loop continues. This is the explicit design goal: *"aeon is built so an operator configures it once and walks away."*

**Divergence from Maestro.** Maestro's human is the integration point; a Fleet wanting its human is an observable state (Attention). In aeon, a failing skill pages the operator only via `./notify` and attempts self-repair without waiting. There is no framework-level blocked state.

---

## Isolation [V/I]

**Within one instance.** No isolation between skills. All skills share `memory/`, the git repo, and the git history. A skill with `write` mode can read or overwrite any file written by any other skill. Skills are expected to use namespaced paths (`memory/topics/`, per-skill log headings) by convention, not enforcement.

**Between instances (fleet members).** Strong isolation via GitHub infrastructure. Each fork has its own secrets, own Actions billing, own `memory/`, own runners. The parent communicates with children only by dispatching GitHub Actions events via `gh`; there is no shared filesystem. Secrets are never propagated on `spawn-instance` — each child is inert until its owner adds keys.

**Cross-instance topology.** Star: parent knows children via `memory/instances.json`; children have no built-in sibling awareness. `fleet-control` polls children and can dispatch skills to one or all.

**No worktree isolation.** aeon does not use `git worktree`. The GitHub Actions runner checkout is ephemeral and torn down when the job ends. Parallel skill runs on one instance could conflict on `memory/` writes; no locking mechanism is documented.

---

## Human Interaction Surface [V]

**Dashboard.** `apps/dashboard` is a Next.js dev server launched locally via `./aeon`. It requires `gh auth status` to pass before starting. It is not a hosted service — it runs on the operator's machine on demand. It manages skill config, secrets, and displays the json-render feed. Source not fetched; behavior is inferred from the `./aeon` shell script (SHA `eaba34ed`) and `CLAUDE.md`.

**Telegram.** The primary runtime channel. Every `./notify` call attaches inline buttons: `Run again` and `Schedule weekly` (global), plus skill-defined custom buttons. Skills can use `--force-reply` + `--context "skill::intent"` to solicit a reply; the reply is routed back to the skill as `var=intent:reply`. Mute and snooze state is tracked per `mute-key`. This is the closest analog to an Attention surface, but it is opt-in per-skill and stateless from the framework's perspective.

**Discord / Slack.** Outbound notification. Inbound polling exists per `CLAUDE.md:§Notifications`. Details not fetched.

**GitHub PRs and Issues.** The `skill-repair` and `self-improve` skills open PRs; merging them is a human action. `health: <skill>` GitHub Issues accept 👍/👎 votes to influence repair priority.

**No Attention equivalent.** There is no framework-level state marking a skill as blocked, waiting, or finished-and-unacknowledged. Notifications are fire-and-forget. A missed notification changes nothing in the system's state model.

**No per-action permission gate.** Permissions are set statically in `mode:` and `capabilities:`. A running skill does not pause to request runtime approval. The tool allowlist excludes `rm` and wildcard shell, but this is a static omission, not a prompt.

---

## Observability [V]

**Committed state.** `memory/logs/YYYY-MM-DD.md` — append-only daily log, structured as `### <skill-name>` headings with bullet points; parsed by the health loop. `cron-state.json` — per-skill success rate and last-run metadata. `memory/skill-health/*.json` — per-run Haiku quality scores (1–5). `memory/issues/ISS-NNN.md` — structured issue tracker with frontmatter schema. All of these are git-committed and therefore diffable and pullable.

**Notifications.** `./notify` with `--severity {info|success|warn|critical}`. `NOTIFY_MIN_SEVERITY` gates sends. Notify-only on signal: "a clean or no-change run should send nothing." (`CLAUDE.md:§Notifications`)

**GitHub Actions run history.** Every skill run is a workflow job; logs, exit codes, and metadata are available via `gh run list` / `gh run view`. `scripts/skill-runs` wraps this into a structured report. `fleet-control` uses this to poll child instance health.

**No push-based event bus.** Reconstruction of current state requires polling `cron-state.json`, `memory/logs/`, and GitHub Actions API. `fleet-control` does exactly this for child instances: three parallel `gh` calls per instance into `/tmp`.

**json-render feed.** When `JSONRENDER_ENABLED=true`, skill stdout is queued to `$AEON_PENDING_DIR/.pending-${SKILL_NAME}.md` and rendered into the dashboard feed. This is a display layer, not a structured event stream.

---

## Distinctive Mechanisms [V]

**Model-graded quality scoring.** A Claude Haiku call grades each skill's stdout on a 1–5 scale after every run. Scores are stored in `memory/skill-health/*.json` and drive the health loop's CRITICAL/DEGRADED/FLAPPING classification. This is an automated quality signal requiring no human evaluation.

**Structured exit taxonomy.** Skills return named exit codes as the final stdout line (`REPAIR_OK_FIXED`, `SPAWN_FORK_EXISTS_RECOVERED`, `DEPLOY_PROTOTYPE_EMPTY`, etc.). The health loop parses these without natural language interpretation. Enables reliable machine-to-machine state transfer within the loop.

**Numeric backpressure gates.** `skill-repair` caps at 3 PRs/day and a 24-hour per-skill cooldown. `self-improve` exits if ≥3 improvement PRs are open. Simple integer guards prevent autonomous loops from generating unbounded side-effects.

**Committed-file state with backend abstraction.** Durable state defaults to committed files (git as the database). An opt-in `STATE_BACKEND` variable moves state to a GitHub Issue's append-only body. Zero infrastructure in the default case; state is readable, diffable, and recoverable with `git log`.

**Per-action idempotency keys.** `distribute-tokens` generates per-recipient idempotency keys and records `txHash` to prevent double-sends across re-runs. Stated in `docs/CORE.md:§distribute-tokens`. Not verified by running the skill.

**OS-sandbox as the load-bearing read-only gate.** `bwrap --ro-bind` (Linux) / `sandbox-exec deny file-write*` (macOS) applied by the dispatcher, not by individual harnesses. `docs/CAPABILITIES.md` documents why: native harness sandboxes are inconsistent (grok's `--sandbox read-only` was silently ignored on 0.2.101; codex's kills the network). The wrapper sandbox applies uniformly.

**`secretcurl` pattern.** API secrets never appear on the command line (blocked by Claude's permission layer). `./secretcurl` accepts `{ENV_NAME}` placeholders and substitutes values internally before the syscall. Prevents secret exfiltration via command-line logging.

---

## Constraints and Risks [V/I]

**No versioned releases.** The project ships directly on `main`. No GitHub Releases page. Breaking changes arrive without a version bump signal. The docs site warns it may lag weeks behind the repo. Operators running a fork must manually rebase to pick up fixes.

**No automated test suite.** No test directory was found. The `ci-capabilities-parity.yml` workflow checks that capability declarations are consistent across three files; this is the only CI correctness check confirmed. Skill correctness is validated by running skills in GitHub Actions and grading stdout with Haiku. This is the project's explicit model, not a gap — but it means there is no offline or synthetic test path.

**GitHub Actions dependency.** The entire scheduler, supervisor, runner, and log store is GitHub Actions. Any GitHub outage, rate limit hit, or Actions disablement stops all aeon operation. There is no fallback runtime.

**Intra-instance skill interference.** All skills share `memory/` with no locking. Two parallel write-mode skills writing to overlapping paths will produce a git merge conflict or last-write-wins outcome. No mitigation is documented beyond convention.

**No process ownership.** aeon has no concept analogous to Maestro's process ownership. There is no teardown sequencing, no `SIGTERM`/`SIGKILL` escalation, no survivor reaping. GitHub Actions handles runner cleanup. This is a structural property of the cloud-hosted model, not a bug.

**PR merge not automated.** The self-healing loop generates PRs but does not merge them. [I] Auto-merge could be configured on GitHub, but this is not documented in any source read. If an operator does not review PRs, the repair loop generates debt without closing it.

**Primary contributor.** The primary author is Aaron Mars (`@aaronjmars`). Community contribution exists (CONTRIBUTING.md is 12.8 KB; `distribute-tokens` distributes rewards based on merged PR ranking) but contributor count is unknown [U].

---

## Intent Versus Implementation [V/I]

**Documented:** `docs/CAPABILITIES.md` states that `capabilities:` declarations are "not a gate" and are "documentation, not a sandbox." The docs are explicit and correct on this point — no gap.

**Documented and source-confirmed:** The OS sandbox as the load-bearing read-only mechanism (`bwrap`/`sandbox-exec` in `harness-adapter/lib/sandbox.sh`) matches the claim in `docs/CAPABILITIES.md`. The harnesses doc (`docs/harnesses.md`) also documents that grok's native `--sandbox read-only` was measured to be silently ignored, and that codex's kills the network. These are frank admissions of measured deficiencies, not marketing.

**Documented but unverifiable from source alone:** Per-action idempotency keys in `distribute-tokens`, the 24-hour `skill-repair` cooldown, the 3 PR/day cap, the `self-improve` backpressure exit — these are stated precisely in `docs/CORE.md` and read as descriptions of shipped behavior (specific file names, exit codes, tool calls cited). None were confirmed by reading the individual `SKILL.md` files, which were not fetched.

**Documented and inferred:** The docs claim "aeon is built so an operator configures it once and walks away" and that the self-healing loop closes without human involvement. The loop design as documented supports this claim. Whether it holds in practice (i.e., whether skill-repair's PRs are good enough to merge automatically and whether skill-health correctly classifies all failure modes) cannot be established without running the system.

**Gap found:** `docs/harnesses.md:§Verification status` documents that the all-six-harness sweep was performed on 2026-07-22 and that `vibe` and `kimi` have no real token usage field — their adapters fall back to a `char/4` estimate. The docs site (last updated 2026-07-16) may not reflect this finding. Prefer `docs/harnesses.md` over the docs site for harness behavior.

---

## Unknowns [U]

- Exact cron schedules and enabled skill list in the canonical `aeonfun/aeon` instance: `aeon.yml` was not read beyond the first 500 characters.
- Reactive trigger mechanism detail: the docs table of contents lists §07 "Reactive triggers" but that section was not fetched.
- `apps/dashboard/` source: UI behavior, auth flow, and dashboard-initiated dispatch mechanism not read.
- `apps/mcp-server/` source: MCP skill dispatch behavior not read.
- Individual `skills/*/SKILL.md` files (~75 total): per-skill behavior not verified.
- Contributor count: not established without a GitHub API call.
- Whether PR auto-merge is configured or recommended in the setup docs.
- Whether the quality scorer's Haiku call is itself a skill run (counted toward billing and rate limits) or a lightweight inline call.
- Whether `memory/instances.json` is managed exclusively by `spawn-instance` or can be hand-edited.

---

## Recommended Reading Order

1. **`CLAUDE.md`** (SHA `3a3c8499`) — the agent's own operating manual; the single most authoritative source; read before anything else.
2. **`docs/CORE.md`** (SHA `75d492a5`) — the ~15 load-bearing skills with precise mechanism descriptions; establishes the self-healing and fleet concepts.
3. **`docs/CAPABILITIES.md`** (SHA `040adccb`) — the capability taxonomy and, more importantly, the OS sandbox enforcement model; explains what `mode: read-only` actually does and why.
4. **`docs/harnesses.md`** (SHA `94bdf902`) — the six harnesses, their authentication, and the 2026-07-22 verification sweep; required reading for understanding execution guarantees.
5. **`aeon.yml`** (SHA `121adde6`) — the canonical configuration file; shows which skills are enabled and on what schedule in the reference instance.
6. **`STRATEGY.md`** (SHA `e6e2be72`) — the operator north-star template; shows what the operator writes and how it shapes every skill run.
7. **`.github/README.md`** (SHA `304f05fa`) — the user-facing README; covers installation, secrets matrix, and notification setup; not fetched in this analysis but referenced throughout the docs.
8. **`docs/telegram-commands.md`** — the full interactive Telegram command reference; the most detailed documentation of the human interaction surface.
9. **A representative `skills/*/SKILL.md`** (e.g., `skills/skill-health/SKILL.md` or `skills/skill-repair/SKILL.md`) — reading at least the two core loop skills confirms or refutes the mechanism claims in `docs/CORE.md`.
10. **`harness-adapter/lib/sandbox.sh`** — the actual OS sandbox implementation; confirms the read-only enforcement claims in `docs/CAPABILITIES.md`.

---

## Pinned Evidence Index

| Source | SHA / URL | Used for |
|---|---|---|
| `aeonfun/aeon` root | `eb86eac6653c70ff03d499e7c70092c377c7dc7e` | Repo snapshot; all file SHAs from this ref |
| `CLAUDE.md` | `3a3c8499d16fdf516ce7958a8ab3085f9c4e74c4` | Operating manual; primary vocabulary; run lifecycle; memory structure; tools |
| `AGENTS.md` | `91e034e9a49d207988812bbd284ac718106e0383` | Auto-generated from CLAUDE.md; confirms gen-agents-md.js pipeline |
| `docs/CORE.md` | `75d492a5a7da5fdc2a21676b00fc2698350f65d6` | Self-healing loop; fleet/replication; autonomous action skills |
| `docs/CAPABILITIES.md` | `040adccb0546a38d6a1cc1419e55d701f6be687a` | Capability taxonomy; OS sandbox enforcement; mode: field |
| `docs/harnesses.md` | `94bdf902c66dd2eb567924d9e6d4de5ac3f72247` | Six harnesses; 2026-07-22 verification sweep; token accounting |
| `aeon` (shell script) | `eaba34ed6556af9b79e99b4f91fc1a3534982a23` | Dashboard launcher; confirms ./aeon does not run skills |
| `STRATEGY.md` | `e6e2be722f6a3fd40942b6d8cd6ac4cc13330a43` | Operator north-star template |
| `LICENSE` | `0934d3a5689c308e5d6797899b65ca7e0e9ab9fe` | MIT licence confirmed |
| `aeon.yml` | `121adde66deb139d37e271beec1b7649ffd3f901` | Config shape; first 500 chars only |
| `catalog/packs.config.json` | `3f10e8206de0051e7178bbad52a8236f92e0f99f` | Catalog structure |
| `docs/` directory listing | — | Confirmed file inventory; files not individually fetched noted |
