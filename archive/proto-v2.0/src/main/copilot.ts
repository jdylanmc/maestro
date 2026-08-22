import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
/**
 * The Copilot seam.
 *
 * Settled in discovery cycle c-0014, reversing an earlier choice of the Agent
 * Client Protocol: a route drives a Fleet through `CopilotClient` from the SDK
 * that ships **inside the platform package**, not through a protocol Maestro
 * re-implements.
 *
 * Three consequences worth stating, because each replaced something Maestro would
 * otherwise have had to build:
 *
 * - **Maestro builds no permission-mediation layer.** Omitting
 *   `onPermissionRequest` leaves requests pending, and `pendingRequests()`
 *   documents its own return as reconstructing pending requests from the
 *   session's event history - which is the Attention predicate, in the runtime's
 *   own words. Attention becomes a query, not an invention.
 * - **Maestro chooses the session id.** `SessionConfig.sessionId` is documented
 *   "Optional custom session ID. If not provided, the server generates one." So a
 *   Fleet binds to an identifier Maestro minted, and the display name stays
 *   Maestro's own - there is no rename API and none is needed.
 * - **The version is pinned.** The permission surface changed shape three times
 *   across observed versions. Measured stable across 1.0.80 through 1.0.81-5;
 *   this route pins 1.0.80.
 */

/**
 * The SDK version this route pins.
 *
 * Measured identical in shape across 1.0.80 through 1.0.81-5, which is the bound
 * that makes pinning a decision rather than a guess.
 */
export const PINNED_SDK_VERSION = '1.0.80';

/**
 * Load the SDK from the platform package.
 *
 * Three constraints, every one of them found by measurement rather than assumed:
 *
 * 1. **`CopilotClient` lives in `copilot-sdk/`, which the package does not
 *    export.** Requiring `@github/copilot-<platform>/copilot-sdk/index.js` fails
 *    with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
 * 2. **The exported `./sdk` subpath is a different SDK.** It resolves, imports
 *    cleanly, and has no `CopilotClient` on it - so trusting the export map would
 *    have produced a confident load of the wrong module.
 * 3. **`copilot-sdk/index.js` is ESM.** It must be loaded by file URL with a real
 *    dynamic `import()`, which also sidesteps the exports map entirely.
 *
 * The import is hidden behind `new Function` deliberately: this module is bundled
 * to CommonJS, and esbuild would otherwise rewrite a literal `import()` into a
 * `require()` and reintroduce constraint 1.
 */
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<Record<string, unknown>>;

declare const __dirname: string;

const PLATFORM_PACKAGES = [
  '@github/copilot-darwin-arm64',
  '@github/copilot-darwin-x64',
];

/** Walk up from the bundle looking for a file inside the platform package. */
function findInPlatformPackage(...relative: readonly string[]): string | undefined {
  let dir = __dirname;
  for (let depth = 0; depth < 8; depth += 1) {
    for (const pkg of PLATFORM_PACKAGES) {
      const candidate = join(dir, 'node_modules', ...pkg.split('/'), ...relative);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

function findSdkEntry(): string | undefined {
  return findInPlatformPackage('copilot-sdk', 'index.js');
}

/** The runtime executable that ships with the platform package. */
function findRuntimeBinary(): string | undefined {
  return findInPlatformPackage('copilot');
}

/**
 * The environment handed to the spawned runtime.
 *
 * Electron exports a set of `ELECTRON_*` variables into its own process, and the
 * runtime child inherits them by default. In a packaged application that made the
 * CLI server exit immediately with status 0 - a clean exit that reads like success
 * and is anything but. Stripping them, and pinning `path` to the runtime that ships
 * in the platform package, is what makes the seam behave in Electron the way it
 * already behaved under plain Node.
 */
function runtimeEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (key.startsWith('ELECTRON_')) continue;
    env[key] = value;
  }
  delete env['NODE_OPTIONS'];
  return env;
}

async function loadSdk(): Promise<Record<string, unknown>> {
  const entry = findSdkEntry();
  if (entry === undefined) {
    throw new Error(
      `could not find copilot-sdk under any node_modules above ${__dirname}. ` +
        `Looked for: ${PLATFORM_PACKAGES.map((p) => `${p}/copilot-sdk/index.js`).join(', ')}`,
    );
  }
  return dynamicImport(pathToFileURL(entry).href);
}

export interface BoundSession {
  readonly sessionId: string;
  send(prompt: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * One client for the whole application, with one Session per Fleet beneath it.
 *
 * The client owns a runtime child process. That process is exactly the kind of
 * thing that became an orphan in v1.0, so the supervisor - not this class - owns
 * its lifetime, and `stop()` is called on the quit path before the window closes.
 */
export class CopilotSeam {
  private client: unknown;
  private started = false;
  private readonly sessions = new Map<string, { readonly handle: unknown }>();
  /**
   * Resolves once `start()` has settled, successfully or not.
   *
   * The window is deliberately shown before the runtime is up, so a Fleet can be
   * created while the seam is still starting. Without this, that Fleet would be
   * created with no Session at all and the failure would be silent - the Fleet
   * looks fine, and only the acceptance harness notices its Session never existed.
   */
  private startSettled: Promise<void> | undefined;
  /** Why the seam failed to start, when it did. Reported, never thrown twice. */
  private startError: string | undefined;

  /** Wait for the seam to finish starting, bounded so it can never hang a caller. */
  async whenReady(timeoutMs = 30_000): Promise<boolean> {
    if (this.started) return true;
    if (this.startSettled === undefined) return false;
    await Promise.race([
      this.startSettled,
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
    return this.started;
  }

  async start(): Promise<void> {
    if (this.started) return;
    if (this.startSettled !== undefined) {
      await this.startSettled;
      return;
    }
    // Settles, never rejects. A shared promise that rejects would throw again for
    // every later `whenReady()` caller - producing unhandled rejections long after
    // the original failure was already reported.
    this.startSettled = this.startInternal().catch((cause: unknown) => {
      this.startError = String(cause);
    });
    await this.startSettled;
    if (this.startError !== undefined) throw new Error(this.startError);
  }

  get lastStartError(): string | undefined {
    return this.startError;
  }

  private async startInternal(): Promise<void> {
    const sdk = await loadSdk();
    const CopilotClient = sdk['CopilotClient'] as
      | (new (options?: unknown) => unknown)
      | undefined;
    if (CopilotClient === undefined) throw new Error('CopilotClient missing from the SDK export');

    const runtimePath = findRuntimeBinary();
    this.client = new CopilotClient({
      connection: {
        kind: 'stdio',
        ...(runtimePath !== undefined ? { path: runtimePath } : {}),
        env: runtimeEnv(),
      },
    });
    await (this.client as { start(): Promise<void> }).start();
    this.started = true;
  }

  get isStarted(): boolean {
    return this.started;
  }

  /**
   * Create a Session bound to a Maestro-chosen id.
   *
   * No `onPermissionRequest` handler is supplied, deliberately. That is what
   * leaves requests pending so Attention can be observed at all; supplying one
   * would answer them invisibly and make slice step 5 unreachable.
   */
  async createSession(sessionId: string, cwd: string): Promise<void> {
    if (!this.started) throw new Error('seam not started');
    /**
     * Acceptance scaffolding, off by default.
     *
     * This operator runs with broad permissions, so the runtime approves tool
     * calls without ever asking - which means a real Fleet is almost never
     * blocked, and acceptance-slice step 5 has nothing to observe. That is a true
     * finding about the environment, not a defect in the route, so it is recorded
     * rather than engineered around.
     *
     * To *verify* that Attention surfaces when a Fleet is genuinely blocked, the
     * harness run sets `MAESTRO_FORCE_ASK=1`, which installs the runtime's own
     * pre-tool-use hook and returns `ask` for shell tools. Maestro still mediates
     * nothing: the request is raised by the runtime, left unanswered because this
     * route ships no permission handler, and observed through the event log like
     * any other.
     */
    const forceAsk = process.env['MAESTRO_FORCE_ASK'] === '1';
    const hooks = forceAsk
      ? {
          onPreToolUse: (input: { readonly toolName?: string }) => {
            const name = String(input?.toolName ?? '').toLowerCase();
            return name.includes('bash') || name.includes('shell') || name.includes('execute')
              ? {
                  permissionDecision: 'ask' as const,
                  permissionDecisionReason: 'Maestro acceptance run: verifying Attention surfaces.',
                }
              : {};
          },
        }
      : undefined;

    const handle = await (
      this.client as { createSession(config: unknown): Promise<unknown> }
    ).createSession({
      sessionId,
      cwd,
      ...(hooks !== undefined ? { hooks } : {}),
    });
    this.sessions.set(sessionId, { handle });
  }

  async resumeSession(sessionId: string): Promise<boolean> {
    if (!this.started) throw new Error('seam not started');
    try {
      const handle = await (
        this.client as { resumeSession(id: string, config: unknown): Promise<unknown> }
      ).resumeSession(sessionId, {});
      this.sessions.set(sessionId, { handle });
      return true;
    } catch {
      return false;
    }
  }

  async listSessions(): Promise<readonly { readonly sessionId: string }[]> {
    if (!this.started) return [];
    try {
      const list = await (
        this.client as { listSessions(filter?: unknown): Promise<readonly unknown[]> }
      ).listSessions();
      return list.map((s) => ({
        sessionId: String((s as Record<string, unknown>)['sessionId'] ?? ''),
      }));
    } catch {
      return [];
    }
  }

  async send(sessionId: string, prompt: string): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (entry === undefined) throw new Error(`no bound Session ${sessionId}`);
    const handle = entry.handle as {
      sendAndWait?(message: unknown): Promise<unknown>;
      send?(message: unknown): Promise<unknown>;
    };
    if (typeof handle.sendAndWait === 'function') await handle.sendAndWait({ prompt });
    else if (typeof handle.send === 'function') await handle.send({ prompt });
    else throw new Error('the SDK session exposes neither sendAndWait nor send');
  }

  /** Stop the client and report anything it could not shut down. */
  async stop(): Promise<readonly string[]> {
    if (!this.started) return [];
    try {
      const errors = await (this.client as { stop(): Promise<Error[]> }).stop();
      this.started = false;
      this.sessions.clear();
      return errors.map((e) => e.message);
    } catch (cause) {
      this.started = false;
      return [String(cause)];
    }
  }
}
