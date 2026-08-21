/**
 * State Oracle probes that read live process state.
 *
 * Slice step 6 asserts that quitting leaves **zero** surviving processes. The
 * only trustworthy evidence for that is the operating system's own process
 * table, queried by the process-group identifiers the route recorded when it
 * spawned the Fleet - not a shutdown hook's opinion, and not an exit code.
 *
 * Process groups, rather than pids, because c-0009 measured the thing that
 * actually works: a non-detached child is not a process-group leader and cannot
 * be signalled as a group at all, so a supervisor owns its Fleets by spawning
 * them detached, recording the resulting pgid, and signalling the group. A probe
 * that checked single pids would miss every grandchild - which is precisely the
 * shape of the v1.0 orphan defect that produced this requirement.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Evidence } from '../core/types.ts';

const run = promisify(execFile);

export interface ProcessRow {
  readonly pid: number;
  readonly pgid: number;
  readonly command: string;
}

export interface ProcessProbe {
  readonly rows: readonly ProcessRow[];
  readonly evidence: Evidence;
}

/**
 * Every process currently belonging to any of the given process groups.
 *
 * `ps -o pid=,pgid=,comm=` is used rather than `pgrep -g` because it returns the
 * evidence and the identity together, so a failure can name what survived instead
 * of only counting it.
 */
export async function probeProcessGroups(
  processGroupIds: readonly number[],
): Promise<ProcessProbe> {
  if (processGroupIds.length === 0) {
    return {
      rows: [],
      evidence: { source: 'ps (no process groups claimed)', detail: '(nothing to check)' },
    };
  }

  let stdout = '';
  try {
    const result = await run('ps', ['-A', '-o', 'pid=,pgid=,comm=']);
    stdout = result.stdout;
  } catch (cause) {
    return {
      rows: [],
      evidence: { source: 'ps -A -o pid=,pgid=,comm=', detail: `failed: ${String(cause)}` },
    };
  }

  const wanted = new Set(processGroupIds);
  const rows: ProcessRow[] = [];
  for (const line of stdout.split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
    if (match === null) continue;
    const pid = Number(match[1]);
    const pgid = Number(match[2]);
    if (!wanted.has(pgid)) continue;
    rows.push({ pid, pgid, command: match[3] ?? '' });
  }

  return {
    rows,
    evidence: {
      source: `ps -A -o pid=,pgid=,comm= filtered to pgid in {${[...wanted].join(', ')}}`,
      detail:
        rows.length === 0
          ? 'no surviving processes in any claimed process group'
          : rows.map((r) => `pid=${r.pid} pgid=${r.pgid} ${r.command}`).join('; '),
    },
  };
}
