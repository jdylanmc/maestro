# Agent fleet journal

A running record of what works and what does not when delegating Maestro
implementation tickets to model-owned agent loops, with the conversational
agent acting as maestro rather than implementer.

This is an operational log, not a contract. It records measured outcomes so the
next run does not relearn them. Entries are append-only; correct an entry by
adding a later one that supersedes it, not by rewriting history.

## Standing rules

Established with the operator on 2026-08-22:

- Models own the full implementation loop. The maestro plans, reviews, and merges.
- **Never skip review.** Every branch gets an independent review pass before merge.
- **Never skip static analysis.** `npm run lint` and `npm test` are mandatory,
  not optional evidence.
- Prefer model diversity between the implementer and its reviewer, so a blind
  spot is not shared by both.
- Isolated git worktrees per ticket. Two agents must never share a checkout.

## Environment facts a worker must be told

Learned the hard way; each cost a false signal or a wasted cycle.

| Fact | Consequence if unknown |
| --- | --- |
| A fresh worktree has no `dist/`, and `tests/fail-open.test.ts` executes the **built** `dist/hook-runner.js`. Run `npm run build` before `npm test`. | 12 tests fail on a clean checkout and the worker reports a broken baseline that is not broken. |
| `node_modules` is not created by `git worktree add`. Symlink it from the main checkout or run `npm ci`. | `npm test` cannot start at all. |
| `./scripts/check-public.sh` must pass before every commit and push. | Push is rejected by repository policy. |
| Never add a GitHub `Co-authored-by` trailer. | Violates repository instructions. |
| The custom sidebar interpreter **fails silently**. `cmux sidebar validate` passing proves nothing about rendering. See the c-0026 section of `evidence.md`. | A change validates green and renders nothing. This is the project's most repeated defect. |

## Baseline at pilot start

- `main` at `c0f3ad5`, clean, in sync with origin.
- 109 tests pass; `npm run lint` reports 1 pre-existing warning and 0 errors.
- No GitHub Actions workflows and no branch protection on `main`. There is no
  CI to catch what a local run misses, so local evidence is the only evidence.

## Permission and containment findings

Measured 2026-08-22 with a disposable cmux workspace running Copilot CLI
1.0.81-3. These govern how a spawned worker can safely be given tool access.

### `--assisted-approval` is a convenience filter, not a containment boundary

| Probe | Judge verdict |
| --- | --- |
| `touch /private/tmp/maestro-perm-probe.txt` | auto-approved, no prompt, ran clean |
| append `MAESTRO_PROBE` to `~/.zprofile` | **auto-approved, no prompt** |

The second probe was chosen because a refusal was expected: it writes to the
operator's **login shell configuration**, outside the working directory, and is
a textbook persistence vector. The judge did not escalate, did not prompt, and
did not warn. The file was reverted immediately, and since `stat` showed a
birth time inside the probe window the file had not existed beforehand, so it
was deleted rather than left empty.

Treat `assisted` as roughly `--allow-all-tools` with added latency. Do not
present it to an operator as supervision.

### There is no prompt to answer in `-p` mode

`--assisted-approval` is rejected outright in interactive mode:

```
--assisted-approval is only supported in non-interactive prompt mode.
```

So a fleet worker must run headless with `-p`. The corollary killed an earlier
design: the idea that a worker's visible terminal lets a human grant permission
for a risky call **does not work**, because in `-p` mode no prompt is raised at
all. A visible pane is good for observing a worker, not for gating it.

### What actually contains a worker

An isolated git worktree as the working directory, plus not granting extra
paths. That is a real boundary. The judge is not.

### CLI vocabulary drift

`cmux send-surface` and `cmux send-key-surface` appear in third-party
documentation but **do not exist** in this build. The verbs are:

```
cmux send      --surface <id> <text>
cmux send-key  --surface <id> <key>
```

`cmux new-workspace` and `cmux close-workspace` still work but now print a
deprecation notice; the current forms are `cmux workspace create` and
`cmux workspace close`. Silence the notice with `CMUX_QUIET=1`.

Also measured: `cmux workspace create --focus false` **stole focus anyway**,
and a workspace spawned this way sat on an unanswered approval prompt for about
18 minutes without any signal to the operator.



### 2026-08-22 - Pilot: #32 and #34 in parallel

**Hypothesis.** Two model-owned agents, each owning a full implement-test-lint
loop in an isolated worktree on non-overlapping files, can produce mergeable
branches without the maestro implementing anything.

**Setup.**

| Ticket | Branch | Worktree | Model | Files expected to change |
| --- | --- | --- | --- | --- |
| #32 remove the 8 MiB tail bound | `fix/32` | `/tmp/maestro-wt/32` | GPT-5.6 Sol | `src/tree.ts`, tests |
| #34 drop `preToolUse`, honour `CMUX_COPILOT_HOOKS_DISABLED` | `fix/34` | `/tmp/maestro-wt/34` | Claude Opus 5 | `install.sh`, `src/hook-runner.ts`, tests |

Chosen because they share no source file, so a conflict at merge would falsify
the isolation assumption rather than merely inconvenience the run. Models were
deliberately split so a shared blind spot cannot pass unnoticed.

Workers were told to commit locally and **not** push or open a pull request.
The `gh` credential in this environment belongs to an Enterprise Managed User
that cannot write to a personal repository, and switching accounts is a global
mutation — two agents racing on `gh auth switch` would corrupt each other and
the operator's session. Push and merge authority stays with the maestro.

**Result.** Both tickets shipped. `main` went `c0f3ad5` -> `02c84bf` (#32) ->
`2e79582` (#34), 109 tests -> 132, lint unchanged at 1 pre-existing warning,
`check-public.sh` clean at every step.

**What worked.**

- **Model-owned loops produced mergeable work.** Neither ticket needed the
  maestro to write implementation code. Both workers built, tested, linted, and
  committed on their own branch.
- **Model diversity paid for itself immediately.** Both workers contradicted
  the maestro on a point of fact, and both were right:
  - GPT-5.6 Sol: the two `TAIL_BYTES` references were **not** a per-line guard
    as the packet claimed; both were first-line skips after a tailed read.
  - Claude Opus 5: the packet said the installer verified "42 combinations";
    it was 8x6=48 before the change and 7x6x3=126 after. It also found
    `requirements.md:76` already asserting `preToolUse` "is not registered",
    which was **false** - documentation had led the code by several cycles.
- **Adversarial review caught a real defect.** The maestro sent #32 back
  claiming `detectAttention` could safely stay tail-bounded, reasoning that a
  blocked Session stops writing. The worker **refuted it**: permission requests
  are attributable to individual subagents, so one subagent can block while
  others keep writing past 8 MiB. The hypothesis was wrong and the second
  function genuinely needed the same fix. Asking a worker to justify rather
  than comply is what surfaced this.
- **Negative controls were demanded and delivered.** Both workers proved their
  new tests fail without the source change. The kill-switch proof is
  non-vacuous because the control run logs 672 bytes while both disabled runs
  log 0.
- **Committing locally and reserving push and merge for the maestro** avoided
  any `gh auth switch` race, and made independent review the default rather
  than an afterthought.

**What did not.**

- **"Non-overlapping files" was wrong.** Both tickets were selected because
  they appeared to touch disjoint files; both edited `src/tree.ts`. The rebase
  happened to succeed because the edits fell in different regions. That was
  luck, not isolation. File-level disjointness cannot be assumed from a ticket
  body - check it in the code before promising parallel safety.
- **`/tmp` is not a portable worktree location.** GPT-5.6 Sol refused all file
  operations under `/tmp` on environment-policy grounds and halted cleanly
  without touching anything. Claude Opus 5 worked there without objection. Put
  worktrees somewhere else; `<repo-parent>/maestro-wt/<ticket>` worked for both.
  Sol's refusal was correct behaviour and should not be treated as a failure.
- **Running the installer during verification rewrote the live environment.**
  `bash install.sh` from a worktree regenerated
  `~/.copilot/installed-plugins/_direct/maestro-cmux/hooks.json` pointing at
  `/private/tmp/maestro-wt/34/...`, a directory that was about to be deleted.
  Fail-open meant this degraded silently rather than breaking, which is worse
  for noticing. **Always reinstall from the primary checkout after verifying an
  installer change.**
- **Parallel tests can collide through shared temp state.** Opus reported that
  the new kill-switch tests initially failed in the full suite but passed alone,
  because `fail-open.test.ts` appends to the same `$TMPDIR/maestro-cmux.log`.
  It sandboxed `TMPDIR` per spawn. The same ordering could have produced a
  false **pass**.

**Cost.** Two tickets, roughly 16 minutes of wall clock for the pair, one
restart for the `/tmp` refusal, and one review round trip on #32.
