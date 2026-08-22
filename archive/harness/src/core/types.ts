/**
 * Core contracts for the Acceptance Harness.
 *
 * The whole design turns on one rule: an assertion is only trustworthy if it is
 * shipped together with a situation it is *required to fail against*. An
 * auto-retrying check that passes is indistinguishable from a check that stopped
 * testing anything, and nothing inside a passing test run can tell the two apart.
 */

/** Where a claim came from. Every result carries its own provenance. */
export interface Evidence {
  /** The external source consulted, e.g. `git worktree list` or `ps -o pgid=`. */
  readonly source: string;
  /** What that source actually returned, trimmed for reporting. */
  readonly detail: string;
}

export interface CheckResult {
  readonly ok: boolean;
  /**
   * True when this assertion could not be automated for the route under test and
   * an operator must confirm it by hand.
   *
   * Pass or fail never depends on automation reach - a route checked only by the
   * operator still passes if it behaves correctly - so a manual result does not
   * fail the route. It is disclosed instead, and every disclosure lands in the
   * route's executive report as named manual residue.
   */
  readonly manual?: boolean;
  /** Human-readable statement of what was observed, pass or fail. */
  readonly message: string;
  readonly evidence: readonly Evidence[];
}

export function pass(message: string, evidence: readonly Evidence[] = []): CheckResult {
  return { ok: true, message, evidence };
}

export function fail(message: string, evidence: readonly Evidence[] = []): CheckResult {
  return { ok: false, message, evidence };
}

/**
 * What a route *claims* about one Fleet.
 *
 * This is the one thing the route supplies, and it is deliberately not an answer
 * to "did you succeed?". It is a set of identifiers - which Copilot Session this
 * Fleet is bound to, which process group it owns - that the oracle then checks
 * against external ground truth. A route that lies here fails harder, not softer,
 * because every identifier is resolvable outside the application.
 */
export interface FleetClaim {
  readonly name: string;
  /** The Copilot `sessionId` the route claims is bound to this Fleet. */
  readonly sessionId?: string;
  /** The process-group id the route recorded when it spawned this Fleet's processes. */
  readonly processGroupId?: number;
}

/**
 * A world the harness can inspect. The State Oracle reads external ground truth
 * only: git, `ps`, the runtime's own event log, and the SDK. It never asks the
 * application under test what it believes.
 */
export interface OracleContext {
  /** Absolute path to the git repository the route operates on. */
  readonly repoRoot: string;
  /** The Fleet names the route claims to have created. */
  readonly fleets: readonly string[];
  /** Per-Fleet identifier claims, required by slice steps 2, 3, 5, and 6. */
  readonly claims?: readonly FleetClaim[];
  /** Root of the runtime's session state, normally `~/.copilot/session-state`. */
  readonly sessionStateRoot?: string;
  /**
   * Whether the Fleets are expected to be torn down. Step 6 asserts zero
   * survivors after a quit; before the quit the same process groups must be alive,
   * and an assertion that cannot tell those apart is not testing teardown.
   */
  readonly phase?: 'running' | 'after-quit';
}

/** Look up a Fleet's claim, or `undefined` when the route made none. */
export function claimFor(
  context: OracleContext,
  fleet: string,
): FleetClaim | undefined {
  return context.claims?.find((c) => c.name === fleet);
}

/** A situation an assertion must fail against, plus the means to tear it down. */
export interface Falsifier<C> {
  /** Why this context should make the assertion fail. Reported when it does not. */
  readonly why: string;
  readonly context: C;
  readonly cleanup: () => Promise<void>;
}

export interface Assertion<C = OracleContext> {
  /** Stable identifier, unique across the whole harness. */
  readonly id: string;
  /** Which acceptance-slice step (1-6) this assertion serves. */
  readonly sliceStep: number;
  /** One sentence: what must be true. */
  readonly describe: string;
  /** Which layer this belongs to. */
  readonly layer: 'state-oracle' | 'presentation-check';

  check(context: C): Promise<CheckResult>;

  /**
   * Build a world in which `check` MUST return `ok: false`.
   *
   * Granularity is per assertion, not per slice step: a step can pass with four
   * assertions of which three are vacuous, so each one earns its own falsifier.
   */
  falsifier(): Promise<Falsifier<C>>;
}
