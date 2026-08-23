import { closeSync, openSync, readdirSync, readFileSync, readSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { StringDecoder } from "node:string_decoder"
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

/**
 * Attention, DERIVED from the event log rather than stored.
 *
 * The predicate is the runtime's own: a `permission.requested` with no
 * `permission.completed` sharing its `requestId`. Measured firing and clearing
 * in c-0012, again on cmux in c-0024, and documented verbatim by the SDK's
 * `pendingRequests()`.
 *
 * Deriving it matters for a structural reason, not a stylistic one. A hook
 * cannot report a blocked Session: measured ordering was
 * `tool.execution_start` -> `preToolUse` -> `permission.requested`, so even the
 * tool-start hook fired BEFORE the request existed, and while the operator is
 * being waited on no hook fires at all. That ordering is now moot - Maestro no
 * longer registers `preToolUse` - which only strengthens the point: a stored
 * flag depends on a clearing hook that may never run. The log does not have
 * that problem - whichever hook happens to fire next recomputes the truth.
 *
 * Only `permission` is derivable. An elicitation and a finished turn are not
 * permission events, so they still arrive through their hooks.
 *
 * NEVER read `fullCommandText` or the notification `message` here: both are the
 * full command line. The tool name is the most that is safe to publish.
 */
export function detectAttention(logPath: string): Attention | undefined {
  try {
    const open = new Map<string, { at: number; tool: string | undefined }>()
    const toolOf = new Map<string, string>()
    for (const line of readLines(logPath)) {
      if (!line) continue
      let e: { type?: string; data?: Record<string, unknown>; timestamp?: string }
      try {
        e = JSON.parse(line)
      } catch {
        continue
      }
      const d = e.data ?? {}
      if (e.type === "tool.execution_start") {
        const tc = d.toolCallId as string | undefined
        const tn = d.toolName as string | undefined
        if (tc && tn) toolOf.set(tc, tn)
      } else if (e.type === "permission.requested") {
        const id = d.requestId as string | undefined
        if (!id) continue
        const pr = (d.permissionRequest ?? d.promptRequest ?? {}) as Record<string, unknown>
        const tc = pr.toolCallId as string | undefined
        const ts = Date.parse(e.timestamp ?? "")
        open.set(id, {
          at: Number.isFinite(ts) ? ts : Date.now(),
          tool: tc ? toolOf.get(tc) : undefined,
        })
      } else if (e.type === "permission.completed") {
        const id = d.requestId as string | undefined
        if (id) open.delete(id)
      }
    }
    if (open.size === 0) return undefined
    // Oldest outstanding request is the one the operator has been waiting on.
    let best: { at: number; tool: string | undefined } | undefined
    for (const v of open.values()) if (!best || v.at < best.at) best = v
    if (!best) return undefined
    return {
      kind: "permission",
      label: best.tool ? `Approve ${best.tool}` : "Permission needed",
      since: best.at,
    }
  } catch {
    return undefined
  }
}

/**
 * Resolve the Session's event log exactly, falling back to the heuristic only
 * when the runtime gave us nothing to be exact with.
 *
 * Order matters and is measured:
 *   1. `transcriptPath` - `agentStop` names the log file outright.
 *   2. `sessionId` - every other hook carries it, and it IS the directory name.
 *   3. `cwd` + newest mtime - the original guess, kept only as a last resort.
 *
 * Step 3 alone silently bound the wrong Session in a live measurement, because
 * `workspace.yaml` can record a cwd the Session is not actually running in.
 */
export function resolveSessionLog(
  cwd: string,
  sessionId?: string,
  transcriptPath?: string,
): string | null {
  try {
    if (transcriptPath && statSync(transcriptPath).isFile()) return transcriptPath
  } catch {
    /* fall through */
  }
  if (sessionId && /^[A-Za-z0-9._-]+$/.test(sessionId)) {
    const direct = join(SESSIONS, sessionId, "events.jsonl")
    try {
      if (statSync(direct).isFile()) return direct
    } catch {
      /* fall through */
    }
  }
  const dir = findSessionDir(cwd)
  return dir ? join(dir, "events.jsonl") : null
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

const READ_CHUNK_BYTES = 64 * 1024

/** Iterate a JSONL file without retaining the whole session log in memory. */
function* readLines(path: string): Generator<string> {
  const fd = openSync(path, "r")
  const decoder = new StringDecoder("utf8")
  const buffer = Buffer.allocUnsafe(READ_CHUNK_BYTES)
  let pending = ""
  try {
    while (true) {
      const bytesRead = readSync(fd, buffer, 0, buffer.length, null)
      if (bytesRead === 0) break
      const text = pending + decoder.write(buffer.subarray(0, bytesRead))
      let lineStart = 0
      for (
        let newline = text.indexOf("\n");
        newline !== -1;
        newline = text.indexOf("\n", lineStart)
      ) {
        yield text.slice(lineStart, newline)
        lineStart = newline + 1
      }
      pending = text.slice(lineStart)
    }
    pending += decoder.end()
    if (pending) yield pending
  } finally {
    closeSync(fd)
  }
}

/**
 * Tool calls that spawn a subagent.
 *
 * Measured across every session log on disk: 2,202 of 2,289 `subagent.started`
 * events resolve to an earlier `tool.execution_start`, and that tool is ONLY
 * ever `task` (1,926) or `execution_subagent` (276). The unmatched remainder
 * are spawns whose tool event is not in the same file.
 */
const SPAWN_TOOLS = new Set(["task", "execution_subagent"])

/** Key prefix for a delegation that has started but has no subagent yet. Never
 *  an `agentId`, so it can never collide with a real subagent. */
const PENDING = "pending:"

/**
 * Build the tree.
 *
 * A subagent's parent is the `agentId` on the tool event whose `toolCallId`
 * spawned it; a null owner means the primary agent spawned it.
 *
 * A delegation is rendered from `tool.execution_start`, not from
 * `subagent.started`. Both events carry the same `toolCallId`, and the tool
 * event is always the earlier of the two - measured gap 3.170s to 110.887s
 * across 35 delegations in one session, and over ten minutes in a batched
 * case. That gap is a blind window: the operator has delegated work and the
 * tree shows nothing. So each unclaimed spawn contributes a PLACEHOLDER row,
 * and a spawn whose `subagent.started` has arrived contributes nothing extra -
 * the real subagent replaces it rather than doubling it. The claim is resolved
 * after the whole file is read, so it does not matter which event was written
 * first.
 *
 * `tool.execution_complete` is deliberately NOT a finish signal, and not a
 * placeholder-retirement signal either: in 5 of those 35 cases it fired BEFORE
 * `subagent.started`. For a BACKGROUND delegation that ordering is structural,
 * not incidental - the tool call returns at once while the subagent runs on.
 * Measured live: four background workers completed their tool call 0.7s-0.9s
 * after starting it and did not emit `subagent.started` for another 130.8s to
 * 185.1s. Replaying that log truncated to the moment the operator looked, the
 * previous reducer produced an empty tree and the four running workers were
 * invisible; this one renders all four. A spawn that truly never produces a
 * subagent therefore lingers, which measurement says is rare - 8 of 2,240
 * spawn tool calls in the entire history on disk, 0.36%.
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
  const spawns = new Map<string, { name: string; kind: string }>()
  const claimed = new Set<string>()
  try {
    for (const line of readLines(logPath)) {
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
        if (tc && SPAWN_TOOLS.has((d.toolName as string) ?? "") && !spawns.has(tc)) {
          // The parent names its own delegation. `task` carries `name` plus
          // `agent_type`; `execution_subagent` carries only `description`.
          const args = (d.arguments ?? {}) as Record<string, unknown>
          const kind = (args.agent_type as string) || (d.toolName as string) || ""
          spawns.set(tc, {
            name: (args.name as string) || (args.description as string) || kind || "subagent",
            kind,
          })
        }
      } else if (e.type === "subagent.started") {
        const tc = d.toolCallId as string | undefined
        if (tc) claimed.add(tc)
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
  } catch {
    return subs
  }

  for (const s of subs.values()) {
    const tc = (s as unknown as { tc?: string }).tc
    s.parent = tc && owner.has(tc) ? (owner.get(tc) ?? null) : null
  }
  // Unclaimed spawns only. A claimed one is already in `subs` as the real
  // subagent, so emitting it here too is exactly the double-count to avoid.
  for (const [tc, spawn] of spawns) {
    if (claimed.has(tc)) continue
    subs.set(PENDING + tc, {
      name: spawn.name,
      kind: spawn.kind,
      status: "run",
      parent: owner.get(tc) ?? null,
      tools: 0,
      doneAt: undefined,
    })
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
    // Running siblings sort above finished ones. This MUST happen per sibling
    // group rather than on the flattened rows: flattening emits a parent
    // immediately followed by its children, so re-ordering the flat list would
    // silently re-parent a child under whatever row sorted above it.
    const group = [...(kids.get(parent) ?? [])].sort(
      (a, b) => rank(subs.get(a)?.status ?? "ok") - rank(subs.get(b)?.status ?? "ok"),
    )
    for (const id of group) {
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

/** Running sorts before finished. */
function rank(status: SubagentStatus): number {
  return status === "run" ? 0 : 1
}

export function encodeTree(
  subs: Map<string, Subagent>,
  now: number = Date.now(),
  dismissed: ReadonlySet<string> = new Set(),
): string {
  const clean = (v: string, n: number) =>
    v
      .replace(/[\n\r¦]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, n)
  return (
    flatten(subs)
      .filter(([, s]) => s.status !== "ok" || s.doneAt === undefined || now - s.doneAt < RETAIN_MS)
      // A dismissed agent stays dismissed. Only FINISHED work can be dismissed -
      // a running agent is never hidden, however emphatically it is clicked.
      .filter(([, s]) => s.status !== "ok" || !dismissed.has(s.name))
      .slice(0, 60)
      .map(([depth, s]) => `${Math.min(depth, 6)} ${GLYPH[s.status]} ${clean(s.name, 44)}`)
      .join(ROW_SEP)
  )
}

/**
 * Finished agents that were computed but are absent from `published`.
 *
 * The sidebar dismisses a row by rewriting the workspace description, because
 * it has no state of its own. Reading the description back is therefore the
 * only way to learn what the operator dismissed. Running agents are never
 * treated as dismissed: an absent running agent means a stale or truncated
 * description, not an intent to hide live work.
 */
export function detectDismissed(subs: Map<string, Subagent>, published: string): string[] {
  const out: string[] = []
  for (const s of subs.values()) {
    if (s.status !== "ok") continue
    if (!published.includes(s.name)) out.push(s.name)
  }
  return out
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
  dismissed: ReadonlySet<string> = new Set(),
  sessionId?: string,
  transcriptPath?: string,
): TreeSummary | null {
  try {
    const log = resolveSessionLog(cwd, sessionId, transcriptPath) ?? undefined
    const subs = log ? buildTree(log) : new Map<string, Subagent>()

    // Derived Attention wins over anything a hook stored. A blocking prompt that
    // the log says is still outstanding is true regardless of which hook last
    // ran; a stored flag is only as fresh as its clearing hook.
    const derived = log ? detectAttention(log) : undefined
    const effective = derived ?? (attention?.kind === "permission" ? undefined : attention)

    if (subs.size === 0 && !effective) return null
    let running = 0
    let failed = 0
    for (const s of subs.values()) {
      if (s.status === "run") running++
      else if (s.status === "fail") failed++
    }
    const rows = [
      ...(surfaceID ? [encodeOwner(surfaceID)] : []),
      ...(effective ? [encodeAttention(effective)] : []),
      ...(subs.size > 0 ? [encodeTree(subs, Date.now(), dismissed)] : []),
    ]
    return { total: subs.size, running, failed, attention: effective, encoded: rows.join(ROW_SEP) }
  } catch {
    return null
  }
}
