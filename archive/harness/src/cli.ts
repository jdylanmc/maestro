/**
 * Command line entry point.
 *
 *   node --experimental-strip-types src/cli.ts --falsify-only
 *   node --experimental-strip-types src/cli.ts --world <world.json>
 *
 * Exit codes are named rather than positional, because a route's executive report
 * has to distinguish "the route failed" from "the harness could not vouch for
 * itself", and a single non-zero exit collapses that difference.
 */

import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { acceptanceSlice } from './assertions/index.ts';
import { formatReport, selfCheck, verifyRoute, HarnessSelfCheckFailed } from './core/run.ts';
import type { RouteWorld } from './core/run.ts';
import type { FleetClaim } from './core/types.ts';

export const EXIT = {
  ok: 0,
  routeFailed: 1,
  harnessBroken: 3,
  usage: 64,
} as const;

/**
 * What a route declares about itself.
 *
 * These are identifiers, not results. Every one of them is resolved against
 * external ground truth - git, `ps`, the runtime's event log - so a route that
 * misdeclares fails harder rather than softer. There is deliberately no field
 * here through which a route can report success.
 */
interface WorldFile {
  readonly repoRoot: string;
  readonly fleets: readonly string[];
  readonly claims?: readonly FleetClaim[];
  readonly sessionStateRoot?: string;
  readonly phase?: 'running' | 'after-quit';
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      world: { type: 'string' },
      repo: { type: 'string' },
      fleet: { type: 'string', multiple: true },
      'falsify-only': { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  if (values['falsify-only'] === true) {
    const report = await selfCheck(acceptanceSlice);
    for (const f of report.findings) {
      console.log(`${f.correctlyFailed ? 'sound  ' : 'VACUOUS'}  ${f.assertionId}  - ${f.why}`);
    }
    if (!report.healthy) {
      console.error('\nHarness is NOT sound. It must not be used to judge a route.');
      if (report.vacuous.length > 0) console.error(`vacuous: ${report.vacuous.join(', ')}`);
      if (report.errored.length > 0) console.error(`errored: ${report.errored.join(', ')}`);
      return EXIT.harnessBroken;
    }
    console.log(`\nHarness is sound: ${report.findings.length} assertions each failed as required.`);
    return EXIT.ok;
  }

  let world: WorldFile | undefined;
  if (values.world !== undefined) {
    world = JSON.parse(await readFile(values.world, 'utf8')) as WorldFile;
  } else if (values.repo !== undefined && (values.fleet?.length ?? 0) > 0) {
    world = { repoRoot: values.repo, fleets: values.fleet! };
  }

  if (world === undefined) {
    console.error('usage: cli.ts --world <world.json>');
    console.error('       cli.ts --repo <path> --fleet <name> [--fleet <name> ...]');
    console.error('       cli.ts --falsify-only');
    return EXIT.usage;
  }

  const routeWorld: RouteWorld = {
    oracle: {
      repoRoot: world.repoRoot,
      fleets: world.fleets,
      ...(world.claims !== undefined ? { claims: world.claims } : {}),
      ...(world.sessionStateRoot !== undefined ? { sessionStateRoot: world.sessionStateRoot } : {}),
      ...(world.phase !== undefined ? { phase: world.phase } : {}),
    },
    // No driver is supplied here: a route provides one when it exists, and until
    // then the Presentation Check is reported as manual residue rather than
    // silently skipped.
    presentation: { fleets: world.fleets },
  };

  try {
    const report = await verifyRoute(acceptanceSlice, routeWorld);
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
