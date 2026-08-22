/**
 * Harness entry point. Order is the whole point: the harness proves itself first,
 * and a route is only ever judged by a harness that has just been shown to be
 * capable of failing.
 *
 * The two layers have different contexts - the State Oracle reads a repository,
 * process groups, and event logs; the Presentation Check drives an interface -
 * but they share **one** self-check gate. A single vacuous assertion in either
 * layer stops the whole report, because "9 of 10 assertions are trustworthy"
 * invites someone to read the 9.
 */

import type { Assertion, CheckResult, OracleContext } from './types.ts';
import type { PresentationContext } from '../assertions/slice04-presentation.ts';
import {
  HarnessSelfCheckFailed,
  runFalsificationSuite,
  type FalsificationReport,
} from './falsification.ts';

export interface RouteFinding {
  readonly assertionId: string;
  readonly sliceStep: number;
  readonly layer: string;
  readonly describe: string;
  readonly result: CheckResult;
}

export interface RouteReport {
  readonly passed: boolean;
  readonly findings: readonly RouteFinding[];
  /** Assertions no automation covered here, named so the executive report can disclose them. */
  readonly manualResidue: readonly RouteFinding[];
  /** Automated assertions as a share of all assertions, per layer and overall. */
  readonly automationReach: Readonly<Record<string, string>>;
}

export interface HarnessReport {
  readonly falsification: FalsificationReport;
  readonly route: RouteReport;
}

export interface RouteWorld {
  readonly oracle: OracleContext;
  readonly presentation: PresentationContext;
}

export interface Suites {
  readonly stateOracle: readonly Assertion<OracleContext>[];
  readonly presentationCheck: readonly Assertion<PresentationContext>[];
}

function mergeFalsification(a: FalsificationReport, b: FalsificationReport): FalsificationReport {
  const vacuous = [...a.vacuous, ...b.vacuous];
  const errored = [...a.errored, ...b.errored];
  return {
    healthy: vacuous.length === 0 && errored.length === 0,
    findings: [...a.findings, ...b.findings],
    vacuous,
    errored,
  };
}

/** Run both layers' falsifiers. Exported so `--falsify-only` uses the same gate. */
export async function selfCheck(suites: Suites): Promise<FalsificationReport> {
  return mergeFalsification(
    await runFalsificationSuite(suites.stateOracle),
    await runFalsificationSuite(suites.presentationCheck),
  );
}

async function runSuite<C>(
  assertions: readonly Assertion<C>[],
  context: C,
): Promise<RouteFinding[]> {
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
      layer: assertion.layer,
      describe: assertion.describe,
      result,
    });
  }
  return findings;
}

function reach(findings: readonly RouteFinding[]): string {
  if (findings.length === 0) return 'n/a';
  const automated = findings.filter((f) => f.result.manual !== true).length;
  return `${automated}/${findings.length} (${Math.round((automated / findings.length) * 100)}%)`;
}

/**
 * Judge a route.
 *
 * Throws `HarnessSelfCheckFailed` before touching the route if any assertion in
 * either layer failed to fail against its own falsifier.
 */
export async function verifyRoute(suites: Suites, world: RouteWorld): Promise<HarnessReport> {
  const falsification = await selfCheck(suites);
  if (!falsification.healthy) throw new HarnessSelfCheckFailed(falsification);

  const oracleFindings = await runSuite(suites.stateOracle, world.oracle);
  const presentationFindings = await runSuite(suites.presentationCheck, world.presentation);
  const findings = [...oracleFindings, ...presentationFindings];

  return {
    falsification,
    route: {
      // A manual result does not fail the route; an automated failure does.
      passed: findings.every((f) => f.result.ok),
      findings,
      manualResidue: findings.filter((f) => f.result.manual === true),
      automationReach: {
        'state-oracle': reach(oracleFindings),
        'presentation-check': reach(presentationFindings),
        overall: reach(findings),
      },
    },
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
    const mark = f.result.manual === true ? 'MANUAL' : f.result.ok ? 'pass  ' : 'FAIL  ';
    lines.push(`  ${mark}  [step ${f.sliceStep}] ${f.assertionId}`);
    lines.push(`          ${f.result.message}`);
  }

  lines.push('');
  lines.push('Automation reach');
  for (const [layer, value] of Object.entries(report.route.automationReach)) {
    lines.push(`  ${layer.padEnd(20)} ${value}`);
  }

  lines.push('');
  if (report.route.manualResidue.length === 0) {
    lines.push('Manual residue: none - every assertion was automated.');
  } else {
    lines.push(`Manual residue (${report.route.manualResidue.length}) - the operator must confirm:`);
    for (const f of report.route.manualResidue) {
      lines.push(`  - [step ${f.sliceStep}] ${f.describe}`);
    }
  }

  return lines.join('\n');
}

export { HarnessSelfCheckFailed };
