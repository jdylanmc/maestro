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
 * A world the harness can inspect. Deliberately minimal: the State Oracle reads
 * external ground truth, so it needs a repository path and the Fleets that are
 * claimed to exist. It never asks the application under test for anything.
 */
export interface OracleContext {
  /** Absolute path to the git repository the route operates on. */
  readonly repoRoot: string;
  /** The Fleet names the route claims to have created. */
  readonly fleets: readonly string[];
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
