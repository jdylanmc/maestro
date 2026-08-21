# Executive report - v2 Electron route

**Route:** v2 Electron + TypeScript/React, macOS.
**Verdict:** **Built and largely proven. 11 of 13 harness assertions pass; acceptance-slice step 5 is unmet.**
**Not rejected:** the stack built the application, packaged it, and executed five of the six slice steps end to end.

---

## 1. Recap - what this route was, and where it got to

Maestro is a macOS graphical orchestrator for Copilot **Fleets**: one feature, one git
Worktree, one Copilot Session, its subagent tree, and its durable state. Four candidate
stacks are each driven against the same six-step acceptance slice and judged by one shared,
route-agnostic Acceptance Harness, so the comparison is like-for-like rather than a
reflection of which stack was easiest to instrument.

This is the **first** of those four routes, and the first time the harness has judged
anything real.

Where it got to: a packaged, unsigned, fuse-configured `Maestro.app` that creates Fleets in
their own worktrees and branches, binds each to its own Copilot Session, renders a live
subagent tree with true parentage, re-scopes every panel on selection, and quits through a
pre-close summary leaving **zero surviving processes**. What it has *not* demonstrated is
Attention, and the reason is understood and measured.

---

## 2. Slice result per step, with proving evidence

Every verdict below is produced by the harness from external ground truth - `git`, `ps`,
and the runtime's own `events.jsonl`. The application reports nothing about its own success;
it declares only identifiers, which the harness resolves independently.

| Step | Result | Proving evidence |
| --- | --- | --- |
| **1** - two named Fleets, each with its own Worktree and branch | **pass** | `git worktree list --porcelain`: 2 Fleets, one worktree each; `fleet-a=>fleet-a`, `fleet-b=>fleet-b` |
| **2** - primary agent window bound 1:1 | **pass** | Both Fleets bound 1:1 to Sessions that exist in `~/.copilot/session-state` (1,060 present) |
| **3** - subagent delegated, tree renders with correct parentage | **pass** | 1 subagent delegated, 100% resolved, root-spawned, max depth 1, every parent a real agent of the session |
| **4** - selecting Fleet B re-scopes every panel | **pass** | Playwright against the packaged `.app`: all 4 panels **and** the primary agent window re-scoped; window followed every selection |
| **5** - Attention surfaces on Fleet A and no other | **FAIL** | 0 permission events across 5 tool calls (see below) |
| **6** - quit auto-Parks with zero survivors; state survives | **pass** | `ps` against 2 recorded process groups: **zero survivors**; both Fleets kept Worktree and Session across the quit |

### Why step 5 is unmet

**The runtime never asked.** Across a full prompt cycle, Fleet A executed five tools -
`task`, `view`, `view`, `bash`, `bash` - and emitted **zero** `permission.requested` events.
This operator's configuration approves tool calls broadly, so a real Fleet in this
environment is almost never blocked. That is a true finding about the environment, not a
defect in the route.

An attempt to induce a request through the SDK's own `onPreToolUse` hook, returning
`permissionDecision: "ask"` for shell tools, did **not** change the outcome: `bash` still ran
twice with no permission event. The hook either did not fire or its decision was not honoured
in this configuration.

**What is therefore not established:** that this route surfaces Attention correctly when a
request *is* raised. The predicate itself - an unmatched `permission.requested` paired on
`data.requestId` - is implemented and is verified by the harness against synthetic logs with
a working falsifier, and the interface renders a per-Fleet Attention badge. But it has never
been observed firing end to end here. This is the same accepted unknown discovery has carried
since c-0014, now narrowed: it is no longer quota, it is permission policy.

---

## 3. Automation reach, with the manual residue named

| Layer | Reach |
| --- | --- |
| State Oracle | **11/11 (100%)** |
| Presentation Check | **2/2 (100%)** |

**Manual residue: none.** Every assertion in both layers was automated for this route.

This is the strongest possible result on the criterion the comparative evaluation fixed
before any route shipped, and it is the number other routes will be measured against.
Playwright drives the **packaged** `.app` directly through `playwright-core`, needing no
browser download, and reads the interface the way an operator would. The only coupling is a
naming convention - panels carry `data-fleet-scope` - which is a convention the route
follows, not an API the harness calls.

Two caveats stated plainly:

- The Presentation Check runs **while the application is live**, and the State Oracle runs
  **after the quit**. An earlier version of the runner measured presentation after teardown
  and reported `0/2 (0%)` for a route that is in fact fully automatable. That would not have
  been a neutral omission: automation reach feeds the rubric, so under-reporting it biases
  the comparison this harness exists to make fair.
- 100% reach means every assertion *ran*, not that every requirement is proven. Step 5 was
  automated and **failed**; automation reach and correctness are different axes.

---

## 4. SDK binding path and its cost

**Path:** `CopilotClient` from the SDK that ships inside the platform package, over a
**stdio** connection to the runtime binary that ships in that same package.

**Pinned version: `1.0.80`** (`@github/copilot@1.0.80`), inside the range measured stable for
the four load-bearing surfaces - `pendingRequests()`, the typed `subagent.*` events,
caller-supplied `SessionConfig.sessionId`, and `session.title_changed` - across 1.0.80
through 1.0.81-5.

The binding works, and Maestro writes **no** permission layer of its own. The cost is that
getting there took four distinct, non-obvious failures, every one of which presented as
something other than what it was:

1. **The SDK is not where the export map says.** `CopilotClient` lives in `copilot-sdk/`,
   which the package does **not** export - requiring it fails with
   `ERR_PACKAGE_PATH_NOT_EXPORTED`. The exported `./sdk` subpath is a *different* SDK that
   resolves cleanly and has no `CopilotClient` on it, so trusting the export map produces a
   confident load of the wrong module. It must be loaded by file URL.
2. **It is ESM, inside a CommonJS main bundle.** A literal `import()` is rewritten to
   `require()` by esbuild, reintroducing failure 1. The import must be hidden behind
   `new Function`.
3. **The `RunAsNode` fuse cannot be disabled.** The SDK starts its runtime by re-spawning the
   host binary in Node mode. With that fuse off the spawn does not fail cleanly - **it
   launches another copy of the application**, which starts its own runtime, recursively.
   This produced **952 live processes in a single process group** before a watchdog stopped
   it, and it presented as the far more innocent `CLI server exited unexpectedly with code 0`.
   This route therefore **cannot adopt the `RunAsNode` hardening fuse** while consuming the
   SDK this way.
4. **Electron's environment breaks the runtime child.** Even with the fuse enabled, the
   inherited `ELECTRON_*` variables made the CLI server exit immediately with status 0 - a
   clean exit that reads like success. The fix is to pin `connection.path` to the runtime
   binary in the platform package and hand it a sanitised environment.

**Cost summary:** the SDK path is viable and permission-native, but it is **not**
drop-in inside Electron. None of the four failures is documented, three of them look like
success or like an unrelated fault, and all four were found by measurement.

A fifth cost is architectural rather than incidental: because this route ships **no**
permission handler - which is what leaves requests pending so Attention can exist at all -
`sendAndWait` can never resolve for a turn that needs permission. Prompting must therefore be
fire-and-forget, or the interface hangs at exactly the moment the operator most needs it.

---

## 5. Process-ownership measurements

This is the requirement the product exists for, and the one v1.0 failed.

| Measurement | Result |
| --- | --- |
| Surviving processes after quit, by recorded process group | **0**, across 2 groups, every run |
| Durable state after quit | Both Fleets kept Worktree, branch, and Session |
| Fleet intent after clean quit | Both auto-Parked behind an acknowledged pre-close summary |
| Instance storm during development | 952 processes, **all in one process group**, terminated by a single `killpg` |

Design consequences, each measured rather than assumed:

- **Spawn detached.** A non-detached child is not a process-group leader and cannot be
  signalled as a group, so grandchildren are unreachable. Detachment plus recorded process
  groups is the only arrangement that works.
- **`SIGTERM` is not enough.** Teardown escalates to `SIGKILL` and then *verifies* against
  `ps`, rather than trusting the polite signal.
- **Reap on launch.** Force Quit leaves survivors no shutdown hook can catch; the next launch
  is the only place to catch them. An orphaned `Maestro` process with `ppid 1` was observed
  during development, confirming this path is real and not theoretical.
- **One instance only.** Two instances would own overlapping groups and the same store, so
  neither could honestly report zero survivors. Enforced with a single-instance lock.

The 952-process incident is included deliberately: it is the strongest evidence in this
report that **process-group ownership is the right primitive**. A pid-based supervisor could
not have cleaned it up; one `killpg` did.

---

## Packaging

Unsigned, ad-hoc re-signed `Maestro.app`, Electron **43.4.0**, `asar: false`.
`enableNodeCliInspectArguments` is left **enabled** - discovery scoped fuse hardening out of
the MVP, and Playwright drives this exact build. Flipping fuses invalidates the code
signature, and macOS kills an invalidly signed build on launch rather than failing gracefully,
so the app is ad-hoc re-signed after every fuse change.

## Open items

- **Step 5 (Attention) is unmet** and is the one thing standing between this route and a
  complete MVP. Next probe: a runtime configuration that genuinely withholds approval, rather
  than a hook that asks for it.
- The route has been judged on a scratch repository, not a real monorepo, so the 8-Fleet
  ceiling and worktree cost remain untested here.
- `listSessions()` did not include a session created with a caller-supplied id, though the
  session's state directory was created immediately. Noted, not investigated.
