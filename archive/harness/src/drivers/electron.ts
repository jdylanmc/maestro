/**
 * The Presentation Check driver for an Electron route.
 *
 * This is the piece that turns slice step 4 from named manual residue into a
 * measurement. It drives a **packaged** `.app` through Playwright's Electron
 * support, reading the interface the way an operator would - by looking at what
 * is on screen - and never by asking the application what it believes.
 *
 * The one coupling it accepts is a naming convention the route must follow:
 * panels carry `data-fleet-scope`, and Fleet buttons carry
 * `data-testid="fleet-<name>"`. That is a convention, not an API: the route
 * exposes no method the harness calls, and cannot report its own success.
 *
 * Playwright is used through `playwright-core`, deliberately: it needs no browser
 * download, because it drives the application's own Electron binary.
 */

import type { PanelSnapshot, PresentationDriver } from '../assertions/slice04-presentation.ts';

export interface ElectronDriverOptions {
  /** Path to the packaged `.app`'s executable, or to the electron binary. */
  readonly executablePath: string;
  /** Arguments passed to the application - the app directory in a dev run. */
  readonly args?: readonly string[];
  readonly env?: Record<string, string>;
  readonly timeoutMs?: number;
}

interface ElectronApp {
  firstWindow(): Promise<Page>;
  close(): Promise<void>;
  process(): { readonly pid?: number };
}

interface Page {
  waitForSelector(selector: string, options?: { timeout?: number }): Promise<unknown>;
  $$eval<T>(selector: string, fn: (elements: Element[]) => T): Promise<T>;
  click(selector: string, options?: { timeout?: number }): Promise<void>;
  fill(selector: string, value: string, options?: { timeout?: number }): Promise<void>;
  screenshot(options: { path: string }): Promise<unknown>;
  locator(selector: string): { count(): Promise<number> };
}

export class ElectronPresentationDriver implements PresentationDriver {
  readonly name = 'playwright/electron';
  private app: ElectronApp | undefined;
  private page: Page | undefined;
  private readonly options: ElectronDriverOptions;

  constructor(options: ElectronDriverOptions) {
    this.options = options;
  }

  async launch(): Promise<void> {
    // Imported lazily so the harness runs with no Playwright installed at all -
    // a route that cannot be automated must still be judgeable.
    const { _electron } = (await import('playwright-core')) as unknown as {
      _electron: { launch(options: Record<string, unknown>): Promise<ElectronApp> };
    };

    this.app = await _electron.launch({
      executablePath: this.options.executablePath,
      args: [...(this.options.args ?? [])],
      env: { ...process.env, ...(this.options.env ?? {}) },
      timeout: this.options.timeoutMs ?? 30_000,
    });
    this.page = await this.app.firstWindow();
    await this.page.waitForSelector('[data-testid="fleet-rail"]', {
      timeout: this.options.timeoutMs ?? 30_000,
    });
  }

  /** The pid of the application's main process, for process-ownership evidence. */
  get pid(): number | undefined {
    return this.app?.process().pid;
  }

  private requirePage(): Page {
    if (this.page === undefined) throw new Error('driver not launched');
    return this.page;
  }

  async selectFleet(fleet: string): Promise<void> {
    await this.requirePage().click(`[data-testid="fleet-${fleet}"]`, { timeout: 10_000 });
  }

  async createFleet(fleet: string): Promise<void> {
    const page = this.requirePage();
    await page.fill('[data-testid="new-fleet-name"]', fleet);
    await page.click('[data-testid="create-fleet"]');
    await page.waitForSelector(`[data-testid="fleet-${fleet}"]`, { timeout: 30_000 });
  }

  async promptFleet(prompt: string): Promise<void> {
    const page = this.requirePage();
    await page.fill('[data-testid="prompt-input"]', prompt);
    await page.click('[data-testid="prompt-send"]');
  }

  /**
   * Read the whole screen state in one pass.
   *
   * Every panel reports the Fleet it is currently scoped to, which is what makes
   * "every panel re-scoped" checkable rather than a claim about one panel that
   * happened to update.
   */
  async snapshot(): Promise<PanelSnapshot> {
    const page = this.requirePage();

    const panels = await page.$$eval<Record<string, string | null>>(
      '[data-fleet-scope]',
      (elements) => {
        const result: Record<string, string | null> = {};
        for (const element of elements) {
          const id = element.getAttribute('data-testid') ?? 'unnamed';
          const scope = element.getAttribute('data-fleet-scope');
          result[id] = scope === null || scope === '' ? null : scope;
        }
        return result;
      },
    );

    const selectedFleet = await page.$$eval<string | null>(
      '[data-testid^="fleet-"][aria-current="true"]',
      (elements) => {
        const first = elements[0];
        if (first === undefined) return null;
        return (first.getAttribute('data-testid') ?? '').replace(/^fleet-/, '') || null;
      },
    );

    const primaryAgentWindowFleet = panels['primary-agent-window'] ?? null;

    return { selectedFleet, panels, primaryAgentWindowFleet };
  }

  /** Subagent names currently rendered, for the live-tree check. */
  async visibleSubagents(): Promise<readonly string[]> {
    return this.requirePage().$$eval<string[]>('[data-testid="panel-subagents"] .agent', (els) =>
      els.map((e) => e.textContent?.trim() ?? ''),
    );
  }

  /** Whether Attention is surfaced on a specific Fleet, read from that Fleet's own row. */
  async attentionOn(fleet: string): Promise<boolean> {
    return (await this.requirePage().locator(`[data-testid="attention-${fleet}"]`).count()) > 0;
  }

  /**
   * Quit the way the slice specifies: **through the pre-close summary**.
   *
   * Closing the window is not quitting. The route deliberately intercepts the
   * close and asks for acknowledgement, so a driver that only closed the window
   * would hang forever waiting for a human - and would never exercise the
   * auto-Park path that step 6 is actually about.
   */
  async quitThroughSummary(): Promise<void> {
    const page = this.requirePage();
    await page.waitForSelector('[data-testid="close-summary"]', { timeout: 15_000 });
    await page.click('[data-testid="close-confirm"]');
  }

  /** Ask the route to close, which surfaces the pre-close summary. */
  async requestClose(): Promise<void> {
    const app = this.app;
    if (app === undefined) return;
    // Playwright's close would force the window down; the slice needs the app's
    // own close path, so it is triggered from inside the renderer instead.
    await (this.page as unknown as { evaluate(fn: string): Promise<unknown> }).evaluate(
      'window.close()',
    ).catch(() => undefined);
  }

  async screenshot(path: string): Promise<void> {
    await this.requirePage().screenshot({ path });
  }

  async close(): Promise<void> {
    await this.app?.close().catch(() => undefined);
    this.app = undefined;
    this.page = undefined;
  }
}
