/**
 * Command line entry point.
 *
 *   node --experimental-strip-types src/cli.ts --falsify-only
 *   node --experimental-strip-types src/cli.ts --repo <path> --fleet a --fleet b
 *
 * Exit codes are named rather than positional, because a route's executive report
 * has to distinguish "the route failed" from "the harness could not vouch for
 * itself", and a single non-zero exit collapses that difference.
 */

import { parseArgs } from 'node:util';
import { slice1Assertions } from './assertions/slice01-worktrees.ts';
import { runFalsificationSuite } from './core/falsification.ts';
import { formatReport, verifyRoute, HarnessSelfCheckFailed } from './core/run.ts';

export const EXIT = {
  ok: 0,
  routeFailed: 1,
  harnessBroken: 3,
  usage: 64,
} as const;

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      repo: { type: 'string' },
      fleet: { type: 'string', multiple: true },
      'falsify-only': { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  const assertions = slice1Assertions;

  if (values['falsify-only']) {
    const report = await runFalsificationSuite(assertions);
    for (const f of report.findings) {
      console.log(`${f.correctlyFailed ? 'sound  ' : 'VACUOUS'}  ${f.assertionId}  - ${f.why}`);
    }
    if (!report.healthy) {
      console.error('\nHarness is NOT sound. It must not be used to judge a route.');
      return EXIT.harnessBroken;
    }
    console.log(`\nHarness is sound: ${report.findings.length} assertions each failed as required.`);
    return EXIT.ok;
  }

  const repo = values.repo;
  const fleets = values.fleet ?? [];
  if (repo === undefined || fleets.length === 0) {
    console.error('usage: cli.ts --repo <path> --fleet <name> [--fleet <name> ...]');
    console.error('       cli.ts --falsify-only');
    return EXIT.usage;
  }

  try {
    const report = await verifyRoute(assertions, { repoRoot: repo, fleets });
    console.log(formatReport(report));
    return report.route.passed ? EXIT.ok : EXIT.routeFailed;
  } catch (cause) {
    if (cause instanceof HarnessSelfCheckFailed) {
      console.error(cause.message);
      console.error('\nNo route verdict was produced, and none should be inferred.');
      return EXIT.harnessBroken;
    }
    throw cause;
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (cause: unknown) => {
    console.error(cause);
    process.exitCode = EXIT.harnessBroken;
  },
);
