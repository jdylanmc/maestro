import { closeSync, openSync, readdirSync, readFileSync, readSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { Attention, AttentionKind } from "./types.js"

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
  /** Epoch ms the subagent finished, when it has. Used to retire a finished
   *  row from the sidebar after RETAIN_MS rather than the instant it lands. */
  doneAt: number | undefined
}

/**
 * How long a finished subagent stays visible.
 *
 * A subagent that vanishes the moment it completes is unreadable - the operator
 * looks away for ten seconds and the work is simply gone, with no way to tell
 * whether it succeeded or was never started. Keeping finished rows around
 * briefly makes the tree legible without letting a 29-agent run accumulate
 * forever.
 *
 * This is enforced HERE rather than in the sidebar, which has no clock it can
 * compare timestamps against and no state to remember a dismissal.
 */
export const RETAIN_MS = 15 * 60 * 1000

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
        doneAt: undefined,
        // toolCallId is resolved to a parent below.
        ...({ tc: d.toolCallId } as object),
      } as Subagent)
    } else if (e.type === "subagent.completed") {
      // There is NO `subagent.failed`. Measured across 60 recent sessions: 133
      // `subagent.started`, 132 `subagent.completed`, zero failures. Nor does
      // the completion payload carry a success flag, so a subagent that fails
      // is indistinguishable from one that succeeds.
      const aid = e.agentId
      const s = aid ? subs.get(aid) : undefined
      if (s) {
        s.status = "ok"
        s.tools = (d.totalToolCalls as number) ?? 0
        const ts = Date.parse((e as { timestamp?: string }).timestamp ?? "")
        s.doneAt = Number.isFinite(ts) ? ts : Date.now()
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
 * Render the tree as a single line.
 *
 * cmux's interpreted sidebars bind only to cmux's own model - they cannot read
 * files or start processes - so the tree travels through the workspace
 * description, the widest free-text field available.
 *
 * NEWLINES CANNOT BE USED. The description carries them faithfully - measured,
 * 23 lines and 432 characters stored intact - but the sidebar interpreter has
 * no working way to split on one: the `\n` escape is not interpreted, and
 * `whereSeparator: { $0.isNewline }` renders nothing at all. Every published
 * tree collapsed into a single truncated row.
 *
 * So rows are separated by a literal delimiter and depth is an explicit token
 * rather than indentation, which the sidebar recovers with the same
 * space-splitting that is known to work:
 *
 *     0 > folk-lyricist¦1 v research-scan¦0 x lint-fixer
 *
 * Verified against qucooln/cmux-conductor-sidebar, which likewise never splits
 * a multi-line string - it keeps its state on one line and reads it with
 * `hasPrefix` and `contains`.
 */
const GLYPH: Record<SubagentStatus, string> = { run: ">", ok: "v", fail: "x" }

/** Row separator. Any character a subagent name cannot contain would do; this
 *  one is visually quiet if a stock sidebar renders the description raw. */
export const ROW_SEP = "¦"

/**
 * Attention rows.
 *
 * A row whose depth token is `!` is an attention row, not a subagent. The
 * depth token is used as the discriminator because every existing consumer
 * already splits on spaces and reads field 0 first, so an old sidebar shows
 * the row harmlessly instead of misreading a subagent.
 *
 *     ! p Permission needed¦0 > folk-lyricist
 *
 * The label is the hook's own `title`. The hook's `message` is never encoded:
 * for a permission prompt it is the full command line.
 */
export const ATTENTION_MARK = "!"

/**
 * Owner row.
 *
 * The workspace description is per-WORKSPACE, but subagents belong to one
 * Copilot session running in one SURFACE. Without saying which, the sidebar can
 * only dump the tree at the bottom of the workspace, detached from the session
 * that produced it.
 *
 * cmux tells the plugin its own surface through `CMUX_SURFACE_ID`, and that
 * value is the same UUID the sidebar sees as `t.id` - verified against
 * `cmux list-pane-surfaces --id-format uuids`. So Maestro PUBLISHES the owner
 * rather than the sidebar inferring it from a title suffix.
 *
 *     @ o 06DF8701-7CFD-428E-99D2-85F43C0EEDD2¦0 > probe-agent
 */
export const OWNER_MARK = "@"

export function encodeOwner(surfaceID: string): string {
  return `${OWNER_MARK} o ${surfaceID.replace(/[\n\r¦ ]/g, "")}`
}
const ATTENTION_GLYPH: Record<AttentionKind, string> = {
  permission: "p",
  question: "q",
  turn: "t",
}

export function encodeAttention(attention: Attention): string {
  const label = attention.label
    .replace(/[\n\r¦]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 44)
  return `${ATTENTION_MARK} ${ATTENTION_GLYPH[attention.kind]} ${label}`
}

export function encodeTree(subs: Map<string, Subagent>, now: number = Date.now()): string {
  const clean = (v: string, n: number) =>
    v
      .replace(/[\n\r¦]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, n)
  return flatten(subs)
    .filter(([, s]) => s.status !== "ok" || s.doneAt === undefined || now - s.doneAt < RETAIN_MS)
    .slice(0, 60)
    .map(([depth, s]) => `${Math.min(depth, 6)} ${GLYPH[s.status]} ${clean(s.name, 44)}`)
    .join(ROW_SEP)
}

export interface TreeSummary {
  total: number
  running: number
  failed: number
  attention: Attention | undefined
  encoded: string
}

/**
 * Everything above, guarded. Returns null when there is nothing to say.
 *
 * An attention state alone is enough to say something. A session that has
 * never delegated still blocks on a permission prompt, and that is precisely
 * the session an operator most needs pointed out - so zero subagents is NOT a
 * reason to stay silent once `attention` is set.
 */
export function summarize(
  cwd: string,
  attention?: Attention,
  surfaceID?: string,
): TreeSummary | null {
  try {
    const dir = findSessionDir(cwd)
    const subs = dir ? buildTree(join(dir, "events.jsonl")) : new Map<string, Subagent>()
    if (subs.size === 0 && !attention) return null
    let running = 0
    let failed = 0
    for (const s of subs.values()) {
      if (s.status === "run") running++
      else if (s.status === "fail") failed++
    }
    const rows = [
      ...(surfaceID ? [encodeOwner(surfaceID)] : []),
      ...(attention ? [encodeAttention(attention)] : []),
      ...(subs.size > 0 ? [encodeTree(subs)] : []),
    ]
    return { total: subs.size, running, failed, attention, encoded: rows.join(ROW_SEP) }
  } catch {
    return null
  }
}
