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

Falsifiers build **real** git repositories in a temp directory and run **real**
git commands. A falsifier built from mocks only proves that the mock disagrees
with the assertion, which is not the same as proving the assertion can fail.

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
npm run verify -- --repo <path> --fleet fleet-a --fleet fleet-b
npm test
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

Slice step 1 is implemented — worktree-per-Fleet and branch-per-Fleet, both with
falsifiers. Steps 2 through 6 are not yet written.

The branch assertion's falsifier uses a **detached HEAD** rather than two Fleets
sharing a branch, because git will not permit the latter: two worktrees cannot
check out the same branch. That constraint is the reason branch-per-Fleet follows
from worktree-per-Fleet as a verified consequence rather than a policy choice, so
the realistic way for the assertion to be wrong is a Fleet on no branch at all.

**Known limitation, carried from discovery:** this harness has never judged a real
route. The falsification rule is settled, and its first honest test is its own
first run against `proto-v2.0/`.

## Requirements

Node 22.6+ for native TypeScript type stripping. No dependencies. Note that
TypeScript *parameter properties* are unsupported in strip-only mode, so fields
are declared explicitly.
