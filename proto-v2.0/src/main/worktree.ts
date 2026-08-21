/**
 * Worktree-per-Fleet, enforced.
 *
 * This is a hard rule rather than a strong default: every Fleet gets exactly one
 * worktree of its own and Fleets never share a checkout. Branch-per-Fleet follows
 * as a *verified consequence* rather than a second policy, because git will not
 * let two worktrees check out the same branch - which is why the harness's
 * falsifier for that assertion has to use a detached HEAD instead.
 *
 * Isolation is not total, and pretending otherwise would be a lie the interface
 * later has to pay for: the git stash and the object store are shared across
 * worktrees, so any feature touching the stash is a cross-Fleet interaction.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

const run = promisify(execFile);

export interface WorktreeEntry {
  readonly path: string;
  readonly branch?: string;
  readonly bare: boolean;
}

export async function isGitRepo(repoRoot: string): Promise<boolean> {
  try {
    await run('git', ['rev-parse', '--git-dir'], { cwd: repoRoot });
    return true;
  } catch {
    return false;
  }
}

export async function listWorktrees(repoRoot: string): Promise<readonly WorktreeEntry[]> {
  const { stdout } = await run('git', ['worktree', 'list', '--porcelain'], { cwd: repoRoot });
  const entries: WorktreeEntry[] = [];
  let current: { path?: string; branch?: string; bare: boolean } = { bare: false };

  const flush = (): void => {
    if (current.path !== undefined) {
      entries.push({
        path: current.path,
        ...(current.branch !== undefined ? { branch: current.branch } : {}),
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
    else if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
    } else if (line === 'bare') current.bare = true;
  }
  flush();
  return entries;
}

/**
 * Where a Fleet's worktree lives.
 *
 * Sibling to the repository rather than inside it, so a Fleet's checkout never
 * appears as untracked content in another Fleet's working tree.
 */
export function worktreePathFor(repoRoot: string, fleet: string): string {
  return join(repoRoot, '..', `${basename(repoRoot)}-fleets`, fleet);
}

function basename(p: string): string {
  const parts = p.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1]! : p;
}

export interface CreatedWorktree {
  readonly worktreePath: string;
  readonly branch: string;
}

/**
 * Create this Fleet's worktree and its branch in one step.
 *
 * `git worktree add -b <branch> <path>` fails if the branch already exists, which
 * is the enforcement: a second Fleet cannot quietly land on an existing branch.
 */
export async function createWorktree(
  repoRoot: string,
  fleet: string,
): Promise<CreatedWorktree> {
  const worktreePath = worktreePathFor(repoRoot, fleet);
  const branch = fleet;
  await run('git', ['worktree', 'add', '-b', branch, worktreePath], { cwd: repoRoot });
  return { worktreePath, branch };
}

/**
 * Remove a Fleet's worktree and its branch.
 *
 * Only used when a Fleet is deleted outright. Quitting must never reach this:
 * durable state persisting across a quit is the whole requirement, and a quit
 * that removed worktrees would pass "zero survivors" enthusiastically while
 * destroying the work.
 */
export async function removeWorktree(
  repoRoot: string,
  worktreePath: string,
  branch: string,
): Promise<void> {
  await run('git', ['worktree', 'remove', '--force', worktreePath], { cwd: repoRoot }).catch(
    () => undefined,
  );
  await run('git', ['branch', '-D', branch], { cwd: repoRoot }).catch(() => undefined);
}

/** Prune worktree bookkeeping for directories that no longer exist. */
export async function pruneWorktrees(repoRoot: string): Promise<void> {
  await run('git', ['worktree', 'prune'], { cwd: repoRoot }).catch(() => undefined);
}
