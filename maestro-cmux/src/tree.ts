import { readdirSync, readFileSync, statSync } from "node:fs"
import { openSync, readSync, closeSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/**
 * Reconstruct a Copilot session's subagent tree and render it for cmux.
 *
 * The Copilot CLI hook surface carries no subagent events at all - there is no
 * `subagentStarted` hook - so a tree cannot be assembled from hooks. It is read
 * instead from the session's own durable event log.
 *
 * Nothing here throws. This runs inside a hook, and a hook that fails takes the
 * whole session's tool calls down with it.
 */

const SESSIONS = join(homedir(), ".copilot", "session-state")

/** Read at most this much of the tail of an event log. One local session was
 *  195 MB; hooks have a 10 second budget and run on every tool call. */
const TAIL_BYTES = 8 * 1024 * 1024

export type SubagentStatus = "run" | "ok" | "fail"

export interface Subagent {
  name: string
  kind: string
  status: SubagentStatus
  parent: string | null
  tools: number
}

/** Locate the session whose working directory is `cwd`, most recent first. */
export function findSessionDir(cwd: string): string | null {
  try {
    let best: { dir: string; mtime: number } | null = null
    for (const entry of readdirSync(SESSIONS)) {
      const dir = join(SESSIONS, entry)
      let yaml: string
      try {
        yaml = readFileSync(join(dir, "workspace.yaml"), "utf8")
      } catch {
        continue
      }
      const m = /^cwd:\s*(.+)$/m.exec(yaml)
      if (!m || (m[1] ?? "").trim() !== cwd) continue
      let mtime = 0
      try {
        mtime = statSync(join(dir, "events.jsonl")).mtimeMs
      } catch {
        /* a session with no log yet is still a candidate */
      }
      if (!best || mtime > best.mtime) best = { dir, mtime }
    }
    return best ? best.dir : null
  } catch {
    return null
  }
}

function readTail(path: string): string {
  const fd = openSync(path, "r")
  try {
    const size = statSync(path).size
    const start = size > TAIL_BYTES ? size - TAIL_BYTES : 0
    const length = size - start
    const buf = Buffer.allocUnsafe(length)
    readSync(fd, buf, 0, length, start)
    return buf.toString("utf8")
  } finally {
    closeSync(fd)
  }
}

/**
 * Build the tree.
 *
 * A subagent's parent is the `agentId` on the tool event whose `toolCallId`
 * spawned it; a null owner means the primary agent spawned it.
 *
 * `parentId` is never used. It is a pointer to the chronologically preceding
 * event, not a parent-agent link: in a measured 41,928-event session it held
 * 41,927 distinct values and none resolved to an agent, so consecutive parallel
 * siblings appear as parent and child. Building on it yields a plausible and
 * entirely fictional tree.
 */
export function buildTree(logPath: string): Map<string, Subagent> {
  const subs = new Map<string, Subagent>()
  const owner = new Map<string, string | null>()
  let text: string
  try {
    text = readTail(logPath)
  } catch {
    return subs
  }

  let first = true
  for (const line of text.split("\n")) {
    // A tailed read almost certainly starts mid-line.
    if (first) {
      first = false
      if (text.length >= TAIL_BYTES) continue
    }
    if (!line) continue
    let e: {
      type?: string
      agentId?: string | null
      data?: Record<string, unknown>
    }
    try {
      e = JSON.parse(line)
    } catch {
      continue
    }
    const d = e.data ?? {}
    if (e.type === "tool.execution_start") {
      const tc = d.toolCallId as string | undefined
      if (tc && !owner.has(tc)) owner.set(tc, e.agentId ?? null)
    } else if (e.type === "subagent.started") {
      const aid = e.agentId
      if (!aid) continue
      subs.set(aid, {
        name: (d.agentDisplayName as string) || (d.agentName as string) || "subagent",
        kind: (d.agentName as string) || "",
        status: "run",
        parent: null,
        tools: 0,
        // toolCallId is resolved to a parent below.
        ...({ tc: d.toolCallId } as object),
      } as Subagent)
    } else if (e.type === "subagent.completed" || e.type === "subagent.failed") {
      const aid = e.agentId
      const s = aid ? subs.get(aid) : undefined
      if (s) {
        s.status = e.type === "subagent.completed" ? "ok" : "fail"
        s.tools = (d.totalToolCalls as number) ?? 0
      }
    }
  }

  for (const s of subs.values()) {
    const tc = (s as unknown as { tc?: string }).tc
    s.parent = tc && owner.has(tc) ? (owner.get(tc) ?? null) : null
  }
  return subs
}

/** Depth-first order, so indentation reads as a tree. */
export function flatten(subs: Map<string, Subagent>): Array<[number, Subagent]> {
  const kids = new Map<string | null, string[]>()
  for (const [id, s] of subs) {
    const list = kids.get(s.parent) ?? []
    list.push(id)
    kids.set(s.parent, list)
  }
  const rows: Array<[number, Subagent]> = []
  const seen = new Set<string>()
  const walk = (parent: string | null, depth: number) => {
    for (const id of kids.get(parent) ?? []) {
      if (seen.has(id)) continue
      seen.add(id)
      const s = subs.get(id)
      if (!s) continue
      rows.push([depth, s])
      walk(id, depth + 1)
    }
  }
  walk(null, 0)
  // Anything unreachable from the root is still worth showing.
  for (const [id, s] of subs) if (!seen.has(id)) rows.push([0, s])
  return rows
}

/**
 * `<depth>|<status>|<name>|<kind>` per line.
 *
 * cmux's interpreted sidebars bind only to cmux's own model - they cannot read
 * files or start processes - so the tree travels through the workspace
 * description, which is the widest free-text field available.
 */
export function encodeTree(subs: Map<string, Subagent>): string {
  const clean = (v: string, n: number) =>
    v.replace(/[|\n\r]/g, " ").trim().slice(0, n)
  return flatten(subs)
    .slice(0, 60)
    .map(([depth, s]) => `${depth}|${s.status}|${clean(s.name, 48)}|${clean(s.kind, 24)}`)
    .join("\n")
}

export interface TreeSummary {
  total: number
  running: number
  failed: number
  encoded: string
}

/** Everything above, guarded. Returns null when there is nothing to say. */
export function summarize(cwd: string): TreeSummary | null {
  try {
    const dir = findSessionDir(cwd)
    if (!dir) return null
    const subs = buildTree(join(dir, "events.jsonl"))
    if (subs.size === 0) return null
    let running = 0
    let failed = 0
    for (const s of subs.values()) {
      if (s.status === "run") running++
      else if (s.status === "fail") failed++
    }
    return { total: subs.size, running, failed, encoded: encodeTree(subs) }
  } catch {
    return null
  }
}
