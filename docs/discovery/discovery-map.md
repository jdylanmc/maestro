---
schema-version: 1
state-root: docs/discovery
sessions: 1
last-updated-cycle: maestro-graphical-agent-orchestrator/c-0018
---

# Primary Discovery Map - Maestro

## Product Idea and Destination

Select and validate a daily-driver macOS graphical agent orchestrator. Maestro
should make named Fleets, their Worktrees, their primary agent windows, and
their delegated subagent trees visible and controllable while preserving durable
restart behavior.

## Verticals and Cross-Cutting Domains

| Session | Kind | Priority | Maturity | Active fog | Major blockers | Package |
| --- | --- | --- | --- | --- | --- | --- |
| maestro-graphical-agent-orchestrator | vertical | P0 | researched | **The constraint has moved above the routes, and route scope was split by route in c-0018.** Two routes are committed to complete MVPs - **v2 Electron then v1.1 WezTerm, strictly one at a time** - and two are reduced to bounded feasibility probes with one decisive question each: **v3 Tauri/Rust** and **v4 native macOS Swift**. All four execute against the same six-step acceptance slice, are verified by one shared route-agnostic Acceptance Harness, and produce a per-stack executive report, feeding a terminal comparative evaluation. | **The two MVP leaves are ready and cannot be published.** As of c-0017, n-0003 (v2 Electron MVP) and n-0009 (Acceptance Harness) both pass the full eleven-condition leaf gate at fog `cleared` and maturity `promotion-ready` - but the promotion gate also requires the **branch** node to be at those values, and both branches fail: n-0000 at `decision-ready`/`researched`, n-0001 at `decision-ready`/`decision-ready`. Three things now stand between this session and real MVP work items: n-0001's unanswered product question about what makes four executive reports comparable; n-0000's maturity, never re-raised after c-0011 moved its questions down to children; and Issue #1's stale "Isolation" section, seventh cycle carried and now load-bearing because it is the tracker parent the work would hang beneath. **No priority debt remains.** Both provider-level blockers are settled: the seam is the Copilot SDK (c-0014) and the Acceptance Harness is a State Oracle plus a Presentation Check (c-0015), whose Presentation Check now has a **measured** automation path - acceptance-slice step 4, the only step with no external ground truth, was asserted 3/3 against a packaged Electron `.app` (c-0016) - and whose own verification seam was settled in c-0017 as a paired-falsification suite. Accepted unknowns: the SDK permission callback has not been observed firing (exhausted monthly quota), and whether the `enableNodeCliInspectArguments` fuse blocks Playwright, which c-0017 demoted from a blocker to an accepted unknown because the MVP ships fuse-enabled and Playwright is measured against exactly that build. | [discovery.md](./sessions/maestro-graphical-agent-orchestrator/discovery.md) |

## Typed Session Links

| From | Link | To | Why |
| --- | --- | --- | --- |

## Shared Actors and Constraints

- Human operator - needs a visible, controllable daily-driver experience, is keyboard-first with settled muscle memory, and treats learning a new keymap as a real adoption cost.
- Fleet - the structural unit: one feature, one Worktree, one Copilot Session, its subagent tree, and its durable state.
- Copilot Session - the runtime's own nameable, resumable conversation; exactly one per Fleet, presented as that Fleet's primary agent window.
- subagent - a delegated unit of work with observable lifecycle, activity, outcome, and control state.
- macOS is the supported platform for current prototypes.
- No process may outlive the application; durable state persists, processes do not. Measured under packaging in c-0012, where `launchd` reparenting proved harmless but graceful `SIGTERM` alone failed against a live Copilot Session and `SIGKILL` escalation was required.
- Fleets are **fully isolated**: exactly one Worktree each, enforced, which implies one branch each, and no cross-Fleet awareness of any kind. The human is the only integration point. (c-0010; this bullet still carried the superseded "preferring" wording until c-0011.)
- Vocabulary is reconciled against the Copilot runtime rather than competing with it, and is **confirmed** in the repository root `CONTEXT.md` with `docs/adr/0001` recording the `Fleet` naming decision and `docs/adr/0002` recording the decision to consume the runtime's permission model rather than build a mediation layer.
- **Attention** is a confirmed Fleet condition: a Fleet observed to *want its human* - blocked on an unanswered permission request, stopped by an error or an abort, or finished and unacknowledged. Observed per Fleet, never persisted, and never inferred from another Fleet. It is a third independent axis alongside the durable lifecycle and Liveness. The cross-Fleet ranking that consumes it is presentation, not domain. (c-0016)
- File surfaces are read-only viewers with an "open in Visual Studio Code" action; no in-app editor is built.
- Closing the application auto-Parks every Fleet behind an acknowledged pre-close summary.
- Credentials, authentication state, employer configuration, and runtime state stay outside the repository.
- A route that cannot build the app is **rejected**, and the reason is an input to the comparative evaluation rather than an absence from it.
- A Fleet is driven through the **Copilot SDK**, settled in c-0014: `CopilotClient` shipped inside the platform package, with permissions as first-class callbacks and `permissions.pendingRequests()` returning the Attention predicate as the runtime defines it. ACP is a measured fallback that surfaces no permissions and accepts no session name; non-interactive `-p` mode is excluded outright, because it auto-denies.
- Route completion is judged by one shared Acceptance Harness asserting external ground truth, never by a route reporting on itself. Its State Oracle needs no cooperation from the route; its Presentation Check is automated as far as each stack allows.
- **Verification is machine-first: there are no human testers.** A manual step is a stopgap, and its survival is a cost recorded against the route.
- **User-interface automation capability is a fixed criterion of the stack selection**, measured by how far each route automates its own Presentation Check. The criterion is deliberately not neutral between stacks. Measured so far: Electron reaches step 4 through Playwright; a WezTerm route can automate roughly **40-50%** of on-screen verification and has **no macOS accessibility tree at all**, which closes XCTest, Appium, and AppleScript together.
- **Every Presentation Check assertion is paired with a negative control**, because an auto-retrying assertion that passes cannot otherwise be distinguished from one that never tested anything. (c-0016)
- The MVP ships an **unsigned, fuse-enabled** application; signing and notarization are excluded from the acceptance slice and deferred until first distribution beyond the author. (c-0016)
- A route **pins its SDK version**, and the pinned version appears in its executive report: the permission surface changed shape across three observed versions. (c-0016)
- **The Acceptance Harness verifies itself before it verifies a route:** every assertion in both layers ships with a fixture it must fail on, the negative suite runs first, and a passing negative case fails the *harness*, not the route. Per assertion, not per slice step. (c-0017)
- **An empirical question can stop being load-bearing without anyone re-deriving it.** c-0016 recorded the `enableNodeCliInspectArguments` question and the unsigned, fuse-enabled build decision in the same cycle, and the second retires the first. Inherited open questions are re-tested against decisions made since. (c-0017)
- **A grounded question must change what the product is or does.** Two of the last three cycles spent a question on this loop's own machinery and got nothing back. If the answer only changes how the loop verifies something, the loop owns it. (c-0015, c-0017)
- **Playwright cannot drive a Tauri application on macOS**, and `tauri-driver` excludes macOS by Tauri's own documentation: `WKWebView` exposes no Chrome DevTools Protocol. The working path embeds a WebDriver server *inside the application binary*, so a Tauri route must modify the product under test to make it testable. This **falsified** the c-0015 claim that "Tauri reaches Playwright through WebDriver". (c-0018)
- **Copilot SDK language bindings differ per route, and that is a second rubric axis.** Official bindings exist for TypeScript, Python, Go, **Rust**, Java, and .NET, and **none for Swift** - so Tauri gains a native seam and Swift pays for a sidecar. Combined with `XCUITest` being the strongest automation story of the four, this partly inverts the ranking c-0015's criterion implied. (c-0018)
- **A question may exist in only one place.** c-0018 found one question recorded three times across two nodes and `requirements.md`, two of the three still phrased against a seam superseded four cycles earlier. (c-0018)
- **The Active Frontier must carry every open question of every node**, because the deterministic selection rules read the frontier rather than the node blocks; a question missing from a row is invisible to selection. (c-0018)
- **A stale current-state field can silently become a constraint.** n-0000's maturity was lowered in c-0005 for a reason that expired in c-0011, went unmaintained for twelve cycles, and in c-0017 became the thing blocking promotion of two ready leaves. (c-0018)
- Desktop push notifications are a strong **P1** and explicitly carry **no weight** in the stack comparison, because every candidate stack is expected to handle them. (c-0016)
