/**
 * State Oracle probes that read git directly.
 *
 * Everything here shells out to git and parses its output. Nothing asks the
 * application under test what it believes, which is the property that stops a
 * route from being advantaged by being easy to instrument, and stops any route
 * from asserting its own success.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Evidence } from '../core/types.ts';

const run = promisify(execFile);

export interface WorktreeEntry {
  readonly path: string;
  /** Absent for a detached HEAD. */
  readonly branch?: string;
  readonly head?: string;
  readonly bare: boolean;
}

export interface GitProbe {
  readonly entries: readonly WorktreeEntry[];
  readonly evidence: Evidence;
}

/**
 * Parse `git worktree list --porcelain`.
 *
 * Porcelain output is a blank-line-delimited record set, which is why it is used
 * here in preference to the human-readable form: the columns of the latter are
 * not stable enough to assert on.
 */
export async function probeWorktrees(repoRoot: string): Promise<GitProbe> {
  const { stdout } = await run('git', ['worktree', 'list', '--porcelain'], { cwd: repoRoot });

  const entries: WorktreeEntry[] = [];
  let current: { path?: string; branch?: string; head?: string; bare: boolean } = { bare: false };

  const flush = (): void => {
    if (current.path !== undefined) {
      entries.push({
        path: current.path,
        ...(current.branch !== undefined ? { branch: current.branch } : {}),
        ...(current.head !== undefined ? { head: current.head } : {}),
        bare: current.bare,
      });
    }
    current = { bare: false };
  };

  for (const line of stdout.split('\n')) {
    if (line === '') {
      flush();
      continue;
    }
    if (line.startsWith('worktree ')) current.path = line.slice('worktree '.length);
    else if (line.startsWith('HEAD ')) current.head = line.slice('HEAD '.length);
    else if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
    } else if (line === 'bare') current.bare = true;
  }
  flush();

  return {
    entries,
    evidence: {
      source: `git worktree list --porcelain (cwd=${repoRoot})`,
      detail: stdout.trim() || '(no output)',
    },
  };
}

/** Read every local branch name. */
export async function probeBranches(repoRoot: string): Promise<{
  readonly branches: readonly string[];
  readonly evidence: Evidence;
}> {
  const { stdout } = await run(
    'git',
    ['for-each-ref', '--format=%(refname:short)', 'refs/heads/'],
    { cwd: repoRoot },
  );
  const branches = stdout.split('\n').map((s) => s.trim()).filter(Boolean);
  return {
    branches,
    evidence: {
      source: `git for-each-ref refs/heads/ (cwd=${repoRoot})`,
      detail: branches.join(', ') || '(none)',
    },
  };
}

/**
 * Worktrees that belong to a Fleet, excluding the primary checkout and any bare
 * entry. A Fleet's worktree is identified by its directory name matching the
 * Fleet name, which is the only coupling the oracle accepts: a naming convention
 * the route must follow, not an API it must expose.
 */
export function worktreesForFleet(
  entries: readonly WorktreeEntry[],
  fleet: string,
): readonly WorktreeEntry[] {
  return entries.filter((e) => !e.bare && basename(e.path) === fleet);
}

function basename(p: string): string {
  const parts = p.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1]! : p;
}
