/**
 * Durable Fleet state.
 *
 * Two rules the whole product rests on:
 *
 * **State persists; processes do not.** Everything here survives a quit, a crash,
 * and a relaunch. Nothing here records whether anything is *running*.
 *
 * **Liveness is never persisted.** It is observed evidence about the world, not a
 * fact about a Fleet, so it is recomputed on every launch. Persisting it is how
 * v1.0 came to believe dead Sessions were alive for two days.
 *
 * The store lives under `app.getPath('userData')`, deliberately outside any
 * worktree: a Fleet's state must not live inside the checkout that Fleet is about
 * to rewrite, and it has to be shared across all the worktrees of one repository
 * rather than trapped in one of them.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Why a Fleet stopped. `Parked` is deliberate; `Interrupted` is not. */
export type FleetIntent = 'Running' | 'Parked' | 'Interrupted';

export interface FleetRecord {
  readonly name: string;
  /** The Copilot Session bound 1:1 to this Fleet. Chosen by Maestro, not the runtime. */
  readonly sessionId: string;
  readonly worktreePath: string;
  readonly branch: string;
  readonly intent: FleetIntent;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  /**
   * The process group this Fleet's processes were spawned into, recorded so that
   * teardown can be verified - and reaped on a later launch if the application
   * died before it could clean up.
   */
  readonly processGroupId?: number;
}

export interface StoreShape {
  readonly version: 1;
  readonly repoRoot: string;
  readonly fleets: readonly FleetRecord[];
}

const EMPTY: StoreShape = { version: 1, repoRoot: '', fleets: [] };

export class FleetStore {
  readonly path: string;
  private data: StoreShape;

  constructor(path: string) {
    this.path = path;
    this.data = EMPTY;
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.path, 'utf8');
      const parsed = JSON.parse(raw) as StoreShape;
      // An unreadable or future-versioned store is reported by refusing to
      // silently reinterpret it, rather than by quietly starting empty.
      if (parsed.version !== 1) throw new Error(`unsupported store version ${parsed.version}`);
      this.data = parsed;
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
        this.data = EMPTY;
        return;
      }
      throw cause;
    }
  }

  /** Write atomically: a torn store is indistinguishable from a lost Fleet. */
  private async persist(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temp = `${this.path}.tmp`;
    await writeFile(temp, JSON.stringify(this.data, null, 2), 'utf8');
    await rename(temp, this.path);
  }

  get repoRoot(): string {
    return this.data.repoRoot;
  }

  async setRepoRoot(repoRoot: string): Promise<void> {
    this.data = { ...this.data, repoRoot };
    await this.persist();
  }

  list(): readonly FleetRecord[] {
    return this.data.fleets;
  }

  get(name: string): FleetRecord | undefined {
    return this.data.fleets.find((f) => f.name === name);
  }

  async add(record: FleetRecord): Promise<void> {
    if (this.get(record.name) !== undefined) {
      throw new Error(`a Fleet named "${record.name}" already exists`);
    }
    this.data = { ...this.data, fleets: [...this.data.fleets, record] };
    await this.persist();
  }

  async update(name: string, patch: Partial<FleetRecord>): Promise<FleetRecord> {
    const existing = this.get(name);
    if (existing === undefined) throw new Error(`no Fleet named "${name}"`);
    const updated: FleetRecord = { ...existing, ...patch, name: existing.name };
    this.data = {
      ...this.data,
      fleets: this.data.fleets.map((f) => (f.name === name ? updated : f)),
    };
    await this.persist();
    return updated;
  }

  async remove(name: string): Promise<void> {
    this.data = { ...this.data, fleets: this.data.fleets.filter((f) => f.name !== name) };
    await this.persist();
  }

  /**
   * Mark every Fleet as `Parked` - the auto-Park performed on a clean quit.
   *
   * Any Fleet still `Running` when the application *next starts* was therefore
   * not parked by a quit, which is exactly what makes `Interrupted` detectable
   * rather than guessed at.
   */
  async parkAll(): Promise<void> {
    const at = new Date().toISOString();
    this.data = {
      ...this.data,
      fleets: this.data.fleets.map((f) => ({ ...f, intent: 'Parked' as const, lastSeenAt: at })),
    };
    await this.persist();
  }

  /** On launch, a Fleet left `Running` by a crash is `Interrupted`, not `Parked`. */
  async reconcileOnLaunch(): Promise<readonly string[]> {
    const interrupted = this.data.fleets.filter((f) => f.intent === 'Running').map((f) => f.name);
    if (interrupted.length > 0) {
      this.data = {
        ...this.data,
        fleets: this.data.fleets.map((f) =>
          f.intent === 'Running' ? { ...f, intent: 'Interrupted' as const } : f,
        ),
      };
      await this.persist();
    }
    return interrupted;
  }
}

export function defaultStorePath(userDataDir: string): string {
  return join(userDataDir, 'fleets.json');
}
