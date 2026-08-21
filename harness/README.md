# Acceptance Harness

The route-agnostic verification apparatus every Maestro candidate stack is judged
by. Tracked as [#30](https://github.com/jdylanmc/maestro/issues/30).

It lives at the repository root rather than inside `proto-v2.0/` or any other
route directory **on purpose**. A harness that ships inside the thing it judges
gets shaped by that thing, which is the exact bias it exists to prevent.

## The rule that makes it trustworthy

Every assertion ships with a fixture it **must fail against**, and the whole
negative suite runs *before* any route is judged. If a single assertion passes
against its own falsifier, the harness declares **itself** broken and refuses to
report on the route at all.

That refusal is deliberate and total. A harness that reported "9 of 10 assertions
are trustworthy" would invite someone to read the 9.

Granularity is **per assertion, not per slice step**: a step can pass with four
assertions of which three are vacuous, so each assertion earns its own falsifier.

Falsifiers build **real** worlds: git repositories built with real `git`
commands, `events.jsonl` files in the runtime's own shape, and — for teardown —
genuine detached process groups that `ps` can see. A falsifier built from mocks
only proves that the mock disagrees with the assertion, which is not the same as
proving the assertion can fail.

The one falsifier that is deliberately synthetic is the Presentation Check's: it
uses a driver that accepts a selection and then never re-scopes, which is exactly
the "observes stale state" control the requirement calls for.

## Two layers

**State Oracle** — asserts acceptance-slice steps 1 through 6 from external
ground truth only: `git worktree list`, `git for-each-ref`, `ps` against recorded
process-group identifiers, `~/.copilot/session-state/<id>/events.jsonl`, and the
Copilot SDK's `listSessions()`, `resumeSession()`, and
`permissions.pendingRequests()`. It asks the route under test for nothing, so no
route can assert its own success and no route is advantaged by being easy to
instrument. It is buildable before any route exists — which is why it is built
first.

**Presentation Check** — covers what only appears on screen. Automated as far as
each stack allows, beginning with Playwright against a packaged Electron `.app`.
Pass or fail never depends on automation reach: a route verified only by the
operator still passes if it behaves correctly. What changes is what its executive
report must disclose.

## Usage

```sh
npm run falsify   # prove the harness can fail; judges no route
npm run verify -- --world world.json
npm test
```

A route declares itself in a `world.json`. Those are **identifiers, not results**
— every one is resolved against external ground truth, and there is deliberately
no field through which a route can report success:

```json
{
  "repoRoot": "/path/to/repo",
  "fleets": ["fleet-a", "fleet-b"],
  "claims": [
    { "name": "fleet-a", "sessionId": "…", "processGroupId": 4242 },
    { "name": "fleet-b", "sessionId": "…", "processGroupId": 4243 }
  ],
  "sessionStateRoot": "/Users/you/.copilot/session-state",
  "phase": "after-quit"
}
```

Exit codes are distinct because an executive report has to tell "the route
failed" apart from "the harness could not vouch for itself":

| Code | Meaning |
| ---: | --- |
| `0` | Route passed |
| `1` | Route failed |
| `3` | **Harness is broken.** No route verdict was produced, and none should be inferred |
| `64` | Usage error |

## Status

**All six slice steps are implemented**, as 13 assertions each with its own
falsifier — 11 in the State Oracle and 2 in the Presentation Check.

| Step | Assertions | Layer |
| ---: | --- | --- |
| 1 | worktree-per-Fleet, branch-per-Fleet | State Oracle |
| 2 | Session-per-Fleet (1:1), claimed Sessions exist | State Oracle |
| 3 | subagent delegated, parentage resolves, parentage is not the event chain | State Oracle |
| 4 | every panel re-scopes, primary window follows selection | Presentation Check |
| 5 | Attention surfaces on the blocked Fleet, Attention is per-Fleet | State Oracle |
| 6 | zero survivors, durable state survives | State Oracle |

### The parentage rule

Step 3 is the step most easily built on a false model. `parentId` **looks** like a
parent-agent link and is not one — the runtime's own typings call it "ID of the
chronologically preceding event in the session, forming a linked chain", and one
measured session held 41,927 distinct values across 41,928 events. A tree built
from it is plausible and wholly fictional, with parallel *siblings* rendered as
parent and child.

The real edge is `subagent.started.data.toolCallId` joined to the `agentId` of
whichever agent emitted that tool call; an absent `agentId` means the main agent.
Revalidated in discovery cycle c-0020 across 36,517 events in two sessions: 85
subagents, 100% resolved, zero unresolved, max depth 2.

`src/oracle/events.ts` therefore never reads `parentId`, and `assertNoParentIdUse`
scans its own module so a future edit reintroducing it fails a **test** rather
than a demo.

### Two things that must not be free passes

A route that records **no** process group fails step 6 rather than passing it
vacuously — otherwise recording nothing would be the easiest way to prove zero
survivors. And teardown is only assertable when the world declares
`phase: "after-quit"`, so an assertion cannot be satisfied by a Fleet that was
never running.

### Automation reach

Un-automated assertions are reported as **manual residue** and named individually,
never skipped. With no Presentation Check driver the harness reports
`presentation-check 0/2 (0%)` and lists both items for the operator — and the
route can still pass, because pass or fail never depends on automation reach.

The branch assertion's falsifier uses a **detached HEAD** rather than two Fleets
sharing a branch, because git will not permit the latter: two worktrees cannot
check out the same branch. That constraint is the reason branch-per-Fleet follows
from worktree-per-Fleet as a verified consequence rather than a policy choice, so
the realistic way for the assertion to be wrong is a Fleet on no branch at all.

**Known limitations, carried from discovery:**

- This harness has never judged a **real** route. It has been run end to end
  against a route-shaped fixture, which is what it was designed to allow, but its
  first honest test is `proto-v2.0/`.
- No Presentation Check driver exists yet. The layer, its assertions, and its
  stale-state control are implemented and tested; the Playwright binding to a
  packaged Electron `.app` arrives with the first route.
- The State Oracle reads `events.jsonl` rather than subscribing to the SDK. The
  typed `subagent.*` events and the `'primary'` agent-scope filter make a live
  subscription possible, and the confirmed requirement is that the tree updates
  live — so the live path is a route concern the Presentation Check asserts,
  while the durable path is what the oracle checks after a quit.

## Requirements

Node 22.6+ for native TypeScript type stripping. No dependencies. Note that
TypeScript *parameter properties* are unsupported in strip-only mode, so fields
are declared explicitly.
