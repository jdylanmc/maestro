/**
 * The Presentation Check: what only appears on screen.
 *
 * Two rules shape this layer.
 *
 * **Every assertion is paired with a negative control**, because an auto-retrying
 * assertion that passes is indistinguishable from one that never tested anything.
 * The control here is a driver that ignores selection and keeps returning the
 * previous screen - "observes stale state" - which is the realistic failure a
 * re-scoping assertion has to be able to catch.
 *
 * **Pass or fail never depends on automation reach.** A route the operator has to
 * check by hand still passes if it behaves correctly. What changes is what its
 * executive report must disclose, so an unautomatable assertion is recorded as
 * manual residue and named, never silently treated as a pass.
 */

import type { Assertion, CheckResult, Falsifier } from '../core/types.ts';
import { fail, pass } from '../core/types.ts';

/** What the interface is showing at one moment. */
export interface PanelSnapshot {
  readonly selectedFleet: string | null;
  /** Panel name -> the Fleet that panel is currently scoped to. */
  readonly panels: Readonly<Record<string, string | null>>;
  /** The Fleet whose primary agent window is presented. */
  readonly primaryAgentWindowFleet: string | null;
}

/**
 * How the harness drives one route's interface. A route supplies an
 * implementation - Playwright against a packaged Electron `.app`, `wezterm cli`
 * against a terminal route, `XCUITest` against a Swift one - and the assertions
 * below are identical across all of them.
 */
export interface PresentationDriver {
  /** Reported in the executive report as this route's automation path. */
  readonly name: string;
  selectFleet(fleet: string): Promise<void>;
  snapshot(): Promise<PanelSnapshot>;
}

export interface PresentationContext {
  readonly fleets: readonly string[];
  /** Absent when this route has no automation for the Presentation Check. */
  readonly driver?: PresentationDriver;
}

/** Record that an assertion could not be automated here, without calling it a pass. */
function manual(message: string): CheckResult {
  return { ok: true, manual: true, message, evidence: [] };
}

/**
 * Poll until `predicate` holds or the budget expires.
 *
 * Auto-retrying is required against a live interface - the screen settles
 * asynchronously - and is exactly what makes a negative control mandatory: this
 * function is equally happy to retry something that will never be tested.
 */
async function eventually<T>(
  read: () => Promise<T>,
  predicate: (value: T) => boolean,
  options: { readonly timeoutMs?: number; readonly intervalMs?: number } = {},
): Promise<{ readonly ok: boolean; readonly last: T }> {
  const timeoutMs = options.timeoutMs ?? 2000;
  const intervalMs = options.intervalMs ?? 50;
  const deadline = Date.now() + timeoutMs;
  let last = await read();
  while (!predicate(last)) {
    if (Date.now() >= deadline) return { ok: false, last };
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    last = await read();
  }
  return { ok: true, last };
}

/**
 * A driver that renders correctly. Used only to build the falsifier's *positive*
 * half; the falsifier itself uses the stale variant below.
 */
export function fakeDriver(options: { readonly stale: boolean }): PresentationDriver {
  let selected: string | null = null;
  let rendered: string | null = null;
  return {
    name: options.stale ? 'fake/stale-state' : 'fake/correct',
    async selectFleet(fleet) {
      selected = fleet;
      // The stale driver accepts the selection but never re-scopes the panels,
      // which is precisely the defect this assertion exists to catch.
      if (!options.stale) rendered = fleet;
    },
    async snapshot() {
      return {
        selectedFleet: selected,
        panels: { files: rendered, activity: rendered, subagents: rendered },
        primaryAgentWindowFleet: rendered,
      };
    },
  };
}

async function stalePanelFalsifier(why: string): Promise<Falsifier<PresentationContext>> {
  const driver = fakeDriver({ stale: true });
  await driver.selectFleet('fleet-a');
  return {
    why,
    context: { fleets: ['fleet-a', 'fleet-b'], driver },
    cleanup: async () => {},
  };
}

export const everyPanelReScopes: Assertion<PresentationContext> = {
  id: 'slice4.every-panel-rescopes',
  sliceStep: 4,
  layer: 'presentation-check',
  describe: 'Selecting a different Fleet re-scopes every panel to that Fleet.',

  async check(context) {
    const { driver } = context;
    if (driver === undefined) {
      return manual(
        'no Presentation Check automation for this route: an operator must confirm that ' +
          'selecting a Fleet re-scopes every panel',
      );
    }
    if (context.fleets.length < 2) {
      return fail('fewer than two Fleets, so re-scoping cannot be observed');
    }

    const [first, second] = context.fleets;
    await driver.selectFleet(first!);
    const before = await eventually(
      () => driver.snapshot(),
      (s) => Object.values(s.panels).every((p) => p === first),
    );
    if (!before.ok) {
      return fail(
        `panels never scoped to "${first}" before the selection under test: ${JSON.stringify(before.last.panels)}`,
        [{ source: driver.name, detail: JSON.stringify(before.last) }],
      );
    }

    await driver.selectFleet(second!);
    const after = await eventually(
      () => driver.snapshot(),
      (s) =>
        s.selectedFleet === second &&
        s.primaryAgentWindowFleet === second &&
        Object.values(s.panels).every((p) => p === second),
    );

    const evidence = [{ source: driver.name, detail: JSON.stringify(after.last) }];
    if (!after.ok) {
      const stale = Object.entries(after.last.panels)
        .filter(([, scopedTo]) => scopedTo !== second)
        .map(([panel, scopedTo]) => `${panel}=${scopedTo ?? 'null'}`);
      return fail(
        `selecting "${second}" left ${stale.length} panel(s) showing stale state: ${stale.join(', ')}`,
        evidence,
      );
    }

    return pass(
      `Selecting "${second}" re-scoped all ${Object.keys(after.last.panels).length} panels and the primary agent window.`,
      evidence,
    );
  },

  falsifier() {
    return stalePanelFalsifier(
      'the driver accepts the selection but never re-scopes the panels, so the assertion must fail',
    );
  },
};

export const primaryAgentWindowFollowsSelection: Assertion<PresentationContext> = {
  id: 'slice4.primary-window-follows-selection',
  sliceStep: 4,
  layer: 'presentation-check',
  describe: "The selected Fleet's own primary agent window is always the one presented.",

  async check(context) {
    const { driver } = context;
    if (driver === undefined) {
      return manual(
        "no Presentation Check automation for this route: an operator must confirm the selected Fleet's " +
          'primary agent window is the one shown',
      );
    }
    if (context.fleets.length < 2) return fail('fewer than two Fleets to switch between');

    const problems: string[] = [];
    const seen: string[] = [];
    for (const fleet of context.fleets) {
      await driver.selectFleet(fleet);
      const result = await eventually(
        () => driver.snapshot(),
        (s) => s.primaryAgentWindowFleet === fleet,
      );
      seen.push(`${fleet}=>${result.last.primaryAgentWindowFleet ?? 'null'}`);
      if (!result.ok) {
        problems.push(
          `selecting "${fleet}" presented "${result.last.primaryAgentWindowFleet ?? 'null'}"`,
        );
      }
    }

    const evidence = [{ source: driver.name, detail: seen.join(', ') }];
    return problems.length === 0
      ? pass(`The primary agent window followed every selection: ${seen.join(', ')}.`, evidence)
      : fail(problems.join('; '), evidence);
  },

  falsifier() {
    return stalePanelFalsifier(
      'the driver never updates the presented window, so it cannot follow the selection',
    );
  },
};

export const slice4Assertions: readonly Assertion<PresentationContext>[] = [
  everyPanelReScopes,
  primaryAgentWindowFollowsSelection,
];
