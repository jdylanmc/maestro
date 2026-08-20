/**
 * The paired-falsification suite: the harness's own verification seam.
 *
 * "What verifies the verifier" is circular unless it is stated, so it is stated
 * here. Before the harness is allowed to judge any route, every assertion is run
 * against a world built to make it fail. An assertion that *passes* there has
 * stopped testing anything, and one vacuous assertion is enough to invalidate the
 * whole report - so the harness declares itself broken and refuses to report on
 * the route at all, rather than emitting a result that looks like a pass.
 *
 * This is deliberately not a warning. A harness that reports "9 of 10 assertions
 * are trustworthy" invites someone to read the 9.
 */

import type { Assertion, CheckResult } from './types.ts';

export interface FalsificationFinding {
  readonly assertionId: string;
  readonly sliceStep: number;
  readonly layer: string;
  /** True when the assertion correctly failed against its falsifier. */
  readonly correctlyFailed: boolean;
  readonly why: string;
  readonly result: CheckResult;
  readonly error?: string;
}

export interface FalsificationReport {
  readonly healthy: boolean;
  readonly findings: readonly FalsificationFinding[];
  readonly vacuous: readonly string[];
  readonly errored: readonly string[];
}

/**
 * Run every assertion against its own falsifier.
 *
 * An assertion is trustworthy here only if it returns `ok: false`. Two other
 * outcomes are both failures of the harness, not of the route:
 *   - it returned `ok: true`  -> the assertion is vacuous;
 *   - it threw               -> the assertion cannot be evaluated, so it cannot be relied on.
 */
export async function runFalsificationSuite<C>(
  assertions: readonly Assertion<C>[],
): Promise<FalsificationReport> {
  const findings: FalsificationFinding[] = [];

  for (const assertion of assertions) {
    let falsifier;
    try {
      falsifier = await assertion.falsifier();
    } catch (cause) {
      findings.push({
        assertionId: assertion.id,
        sliceStep: assertion.sliceStep,
        layer: assertion.layer,
        correctlyFailed: false,
        why: '(falsifier could not be constructed)',
        result: { ok: false, message: 'falsifier construction threw', evidence: [] },
        error: String(cause),
      });
      continue;
    }

    try {
      const result = await assertion.check(falsifier.context);
      findings.push({
        assertionId: assertion.id,
        sliceStep: assertion.sliceStep,
        layer: assertion.layer,
        correctlyFailed: result.ok === false,
        why: falsifier.why,
        result,
      });
    } catch (cause) {
      findings.push({
        assertionId: assertion.id,
        sliceStep: assertion.sliceStep,
        layer: assertion.layer,
        correctlyFailed: false,
        why: falsifier.why,
        result: { ok: false, message: 'check threw', evidence: [] },
        error: String(cause),
      });
    } finally {
      await falsifier.cleanup().catch(() => {
        /* cleanup failure must not mask a falsification finding */
      });
    }
  }

  const vacuous = findings.filter((f) => !f.correctlyFailed && !f.error).map((f) => f.assertionId);
  const errored = findings.filter((f) => f.error !== undefined).map((f) => f.assertionId);

  return {
    healthy: vacuous.length === 0 && errored.length === 0,
    findings,
    vacuous,
    errored,
  };
}

/** Thrown when the harness cannot vouch for itself. */
export class HarnessSelfCheckFailed extends Error {
  readonly report: FalsificationReport;

  constructor(report: FalsificationReport) {
    const vacuous = report.vacuous.length > 0 ? `vacuous: ${report.vacuous.join(', ')}` : '';
    const errored = report.errored.length > 0 ? `errored: ${report.errored.join(', ')}` : '';
    super(
      'Acceptance Harness declared itself broken and refused to report on the route. ' +
        [vacuous, errored].filter(Boolean).join('; '),
    );
    this.name = 'HarnessSelfCheckFailed';
    this.report = report;
  }
}
