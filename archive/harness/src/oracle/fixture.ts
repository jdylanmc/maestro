/**
 * Disposable git repositories used to falsify State Oracle assertions.
 *
 * These build real repositories in a temp directory and run real git commands.
 * A falsifier built from mocks would only prove that the mock disagrees with the
 * assertion, which is not the same as proving the assertion can fail.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = promisify(execFile);

export interface FleetSpec {
  readonly name: string;
  /** How this Fleet's worktree should be created. `none` omits it entirely. */
  readonly mode: 'own-branch' | 'detached' | 'none';
}

export interface Fixture {
  readonly repoRoot: string;
  readonly fleets: readonly string[];
  readonly cleanup: () => Promise<void>;
}

/** Build a repository in which the named Fleets exist in the requested shape. */
export async function buildRepo(specs: readonly FleetSpec[]): Promise<Fixture> {
  const base = await mkdtemp(join(tmpdir(), 'maestro-harness-'));
  const repoRoot = join(base, 'repo');

  await run('git', ['init', '-q', '-b', 'main', repoRoot]);
  await run('git', ['config', 'user.email', 'harness@example.invalid'], { cwd: repoRoot });
  await run('git', ['config', 'user.name', 'Acceptance Harness'], { cwd: repoRoot });
  await writeFile(join(repoRoot, 'README.md'), '# fixture\n', 'utf8');
  await run('git', ['add', '.'], { cwd: repoRoot });
  await run('git', ['commit', '-q', '-m', 'root'], { cwd: repoRoot });

  for (const spec of specs) {
    const path = join(base, spec.name);
    if (spec.mode === 'own-branch') {
      await run('git', ['worktree', 'add', '-q', '-b', spec.name, path], { cwd: repoRoot });
    } else if (spec.mode === 'detached') {
      await run('git', ['worktree', 'add', '-q', '--detach', path], { cwd: repoRoot });
    }
  }

  return {
    repoRoot,
    fleets: specs.map((s) => s.name),
    cleanup: async () => {
      await rm(base, { recursive: true, force: true });
    },
  };
}
