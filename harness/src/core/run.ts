/**
 * Harness entry point. Order is the whole point: the harness proves itself first,
 * and a route is only ever judged by a harness that has just been shown to be
 * capable of failing.
 */

import type { Assertion, CheckResult, OracleContext } from './types.ts';
import {
  HarnessSelfCheckFailed,
  runFalsificationSuite,
  type FalsificationReport,
} from './falsification.ts';

export interface RouteFinding {
  readonly assertionId: string;
  readonly sliceStep: number;
  readonly describe: string;
  readonly result: CheckResult;
}

export interface RouteReport {
  readonly passed: boolean;
  readonly findings: readonly RouteFinding[];
}

export interface HarnessReport {
  readonly falsification: FalsificationReport;
  readonly route: RouteReport;
}

/** Judge a route. Throws `HarnessSelfCheckFailed` before touching the route if the harness is not sound. */
export async function verifyRoute<C = OracleContext>(
  assertions: readonly Assertion<C>[],
  context: C,
): Promise<HarnessReport> {
  const falsification = await runFalsificationSuite(assertions);
  if (!falsification.healthy) throw new HarnessSelfCheckFailed(falsification);

  const findings: RouteFinding[] = [];
  for (const assertion of assertions) {
    const result = await assertion.check(context).catch(
      (cause): CheckResult => ({
        ok: false,
        message: `assertion threw: ${String(cause)}`,
        evidence: [],
      }),
    );
    findings.push({
      assertionId: assertion.id,
      sliceStep: assertion.sliceStep,
      describe: assertion.describe,
      result,
    });
  }

  return {
    falsification,
    route: { passed: findings.every((f) => f.result.ok), findings },
  };
}

export function formatReport(report: HarnessReport): string {
  const lines: string[] = [];
  lines.push('Self-check (paired falsification)');
  for (const f of report.falsification.findings) {
    lines.push(`  ${f.correctlyFailed ? 'sound  ' : 'VACUOUS'}  ${f.assertionId}  - ${f.why}`);
  }
  lines.push('');
  lines.push(`Route verdict: ${report.route.passed ? 'PASS' : 'FAIL'}`);
  for (const f of report.route.findings) {
    lines.push(`  ${f.result.ok ? 'pass' : 'FAIL'}  [step ${f.sliceStep}]  ${f.assertionId}`);
    lines.push(`        ${f.result.message}`);
  }
  return lines.join('\n');
}

export { HarnessSelfCheckFailed };
