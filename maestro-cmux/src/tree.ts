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

/** The tool a Session calls to ask the operator a structured question. An open
 *  call to it means the Session is blocked on a human. */
const ELICITATION_TOOL = "ask_user"

/**
 * The Session's own terminal marker.
 *
 * A Session that has shut down is not waiting on anybody, whatever its log left
 * outstanding. This is the only reliable liveness signal in the log: measured
 * across 167 recent Sessions, `session.shutdown` appears 189 times and is the
 * last event of an ended Session, while `session.end` is never emitted at all.
 *
 * It is applied IN ORDER rather than as a whole-file test, because
 * `session.resume` (51 occurrences) appends to the same log. A request raised
 * after a resume is genuinely outstanding again, and clearing in order keeps it
 * that way.
 */
const SHUTDOWN = "session.shutdown"

export type SubagentStatus = "run" | "ok" | "fail"

/** How a skill invocation started. `unknown` is a real, recorded state. */
export type SkillTrigger = "user" | "agent" | "unknown"

export interface Subagent {
  name: string
  kind: string
  status: SubagentStatus
  parent: string | null
  tools: number
  /** Epoch ms the subagent finished, when it has. Used to retire a finished
   *  row from the sidebar after RETAIN_MS rather than the instant it lands. */
  doneAt: number | undefined
  /**
   * The model the subagent was started with, from `subagent.started.data.model`
   * (#41). Absent on a placeholder row, because the spawning tool call does not
   * name a model - only the started event does.
   *
   * There is deliberately NO context-window percentage beside it: no event in
   * the log carries window occupancy, and a number synthesised from hardcoded
   * window sizes would be an estimate wearing a gauge's clothing.
   */
  model: string | undefined
  /**
   * How a SKILL row started, when this node is a skill invocation rather than
   * a subagent (#59).
   *
   * `undefined` on every subagent row, which is what keeps existing rows
   * byte-identical when no skill is invoked. Measured across every session log
   * on disk: 1,107 `skill.invoked` events, of which 1,024 carry a `trigger` -
   * 833 `agent-invoked` and 191 `user-invoked`. The remaining 83 carry none, and
   * those render neutrally rather than being assumed to be either. The ticket
   * asks for the distinction to be DERIVED and not guessed, and a default would
   * be a guess applied 83 times.
   */
  skill: SkillTrigger | undefined
  /**
   * What the subagent is doing right now (#60): the tool name of its most
   * recent `tool.execution_start` that has no matching `tool.execution_complete`.
   *
   * The tool NAME only. Its arguments are never read here - that is the same
   * boundary `detectAttention` holds for `fullCommandText`, and the reason the
   * Copilot status line itself cannot simply be forwarded: it is rendered in
   * the CLI's terminal and is not recorded in the event log at all, so the
   * open tool call is the honest source for "what is happening now".
   */
  activity: string | undefined
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
export const RETAIN_MS = 15 * 1000

/**
 * The retention windows an operator may choose (#56).
 *
 * `never` is `Infinity`, which makes the age comparison in `encodeTree`
 * unconditionally true without a second code path. The one place that needs
 * care is `nextExpiryAt`, which must stay `undefined` for `never` - there is no
 * future moment to wake the watcher for.
 *
 * NOTE ON THE DEFAULT. Issue #56 describes the current window as "15 minutes"
 * and asks for a `15m` default, while also requiring that "the published
 * description is identical to today's for the same event log". Those two cannot
 * both hold, because `RETAIN_MS` is 15 **seconds** - the ticket is wrong about
 * the code. Behaviour preservation is the criterion that can actually be
 * tested, and is the one an operator who never touches this setting will
 * notice, so the default stays at today's value and `15s` is added to the
 * offered list. Every window the ticket asked for is still available.
 */
export const RETENTION_CHOICES: Record<string, number> = {
  "5s": 5 * 1000,
  "15s": 15 * 1000,
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  never: Number.POSITIVE_INFINITY,
}

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
 * `permission` and `question` are both derivable; only a finished turn still
 * arrives through its hook.
 *
 * An elicitation was previously assumed to be underivable. That was wrong. An
 * outstanding `ask_user` is a `tool.execution_start` whose `toolCallId` never
 * receives a `tool.execution_complete`. Measured on a live blocked session: 51
 * `ask_user` calls, 50 completed, exactly 1 outstanding - the one the operator
 * was actually waiting on. The 50 closed calls are the negative control.
 *
 * NEVER read the elicitation `arguments` here. They carry the question text and
 * its option labels; the tool name is the most that is safe to publish.
 *
 * NEVER read `fullCommandText` or the notification `message` here: both are the
 * full command line. The tool name is the most that is safe to publish.
 */
export function detectAttention(logPath: string): Attention | undefined {
  try {
    const open = new Map<
      string,
      { at: number; tool: string | undefined; kind: string | undefined }
    >()
    const toolOf = new Map<string, string>()
    const asks = new Map<string, number>()
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
        if (tc && tn === ELICITATION_TOOL) {
          const ts = Date.parse(e.timestamp ?? "")
          asks.set(tc, Number.isFinite(ts) ? ts : Date.now())
        }
      } else if (e.type === "tool.execution_complete") {
        const tc = d.toolCallId as string | undefined
        if (tc) asks.delete(tc)
      } else if (e.type === "permission.requested") {
        const id = d.requestId as string | undefined
        if (!id) continue
        const pr = (d.permissionRequest ?? d.promptRequest ?? {}) as Record<string, unknown>
        const tc = pr.toolCallId as string | undefined
        const ts = Date.parse(e.timestamp ?? "")
        open.set(id, {
          at: Number.isFinite(ts) ? ts : Date.now(),
          tool: tc ? toolOf.get(tc) : undefined,
          // WHY approval is being asked for. Measured across 40 recent session
          // logs: shell 1671, write 306, read 209, url 28, mcp 13, factory 6.
          // The sibling `intention` and `path` fields are free text and a
          // machine path; neither is read here.
          kind: typeof pr.kind === "string" && pr.kind ? pr.kind : undefined,
        })
      } else if (e.type === "permission.completed") {
        const id = d.requestId as string | undefined
        if (id) open.delete(id)
      } else if (e.type === SHUTDOWN) {
        // A dead Session blocks nobody. Without this, a Session killed while a
        // prompt was open leaves that request outstanding FOREVER - and because
        // derived attention outranks the stored flag and the published
        // description is persistent, the badge sticks with nothing left alive to
        // clear it. Measured: two Sessions, 20.6h and 39.6h dead, both still
        // reporting "Approve bash" / "Approve run_factory".
        open.clear()
        asks.clear()
      }
    }
    if (open.size === 0) {
      // An outstanding elicitation blocks the Session just as a permission does,
      // and it is the only remaining signal once permissions have all resolved.
      if (asks.size === 0) return undefined
      let since: number | undefined
      for (const at of asks.values()) if (since === undefined || at < since) since = at
      return {
        kind: "question",
        label: "Answer question",
        since: since ?? Date.now(),
        detail: undefined,
      }
    }
    // Oldest outstanding request is the one the operator has been waiting on.
    let best: { at: number; tool: string | undefined; kind: string | undefined } | undefined
    for (const v of open.values()) if (!best || v.at < best.at) best = v
    if (!best) return undefined
    return {
      kind: "permission",
      label: best.tool ? `Approve ${best.tool}` : "Permission needed",
      since: best.at,
      detail: best.kind,
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
 *   3. unique `cwd` match - accepted only when one session records that cwd.
 *
 * The old cwd + newest-mtime guess silently bound the wrong Session in a live
 * measurement. Ambiguous cwd fallback therefore fails closed.
 */
export function resolveSessionLog(
  cwd: string,
  sessionId?: string,
  transcriptPath?: string,
  sessionsRoot = SESSIONS,
): string | null {
  try {
    if (transcriptPath && statSync(transcriptPath).isFile()) return transcriptPath
  } catch {
    /* try the next exact identity */
  }
  if (sessionId && /^[A-Za-z0-9._-]+$/.test(sessionId)) {
    const direct = join(sessionsRoot, sessionId, "events.jsonl")
    try {
      if (statSync(direct).isFile()) return direct
    } catch {
      /* no exact match */
    }
  }
  if (transcriptPath !== undefined || sessionId !== undefined) return null
  const dir = findSessionDir(cwd, sessionsRoot)
  return dir ? join(dir, "events.jsonl") : null
}

/** Locate the unique session whose working directory is `cwd`. */
export function findSessionDir(cwd: string, sessionsRoot = SESSIONS): string | null {
  try {
    let match: string | null = null
    for (const entry of readdirSync(sessionsRoot)) {
      const dir = join(sessionsRoot, entry)
      let yaml: string
      try {
        yaml = readFileSync(join(dir, "workspace.yaml"), "utf8")
      } catch {
        continue
      }
      const m = /^cwd:\s*(.+)$/m.exec(yaml)
      if (!m || (m[1] ?? "").trim() !== cwd) continue
      if (match) return null
      match = dir
    }
    return match
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

/** Key prefix for a skill-invocation node, kept out of the subagent id space. */
const SKILL = "skill:"

/**
 * The recorded trigger, mapped to what the wire carries.
 *
 * Measured across every session log on disk: 833 `agent-invoked`, 191
 * `user-invoked`, and 83 events carrying no trigger at all. The third case is
 * `unknown` rather than a default, because #59 asks for the distinction to be
 * derived and not guessed - and a default would be a guess made 83 times.
 */
function triggerOf(value: unknown): SkillTrigger {
  if (value === "user-invoked") return "user"
  if (value === "agent-invoked") return "agent"
  return "unknown"
}

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
  const openTools = new Map<string, { agent: string; tool: string }>()
  const skills = new Map<string, Subagent>()
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
        const tn = d.toolName as string | undefined
        if (tc && !owner.has(tc)) owner.set(tc, e.agentId ?? null)
        // Open tool calls, per agent, in start order. The most recent one still
        // open at the end of the log is that agent's current activity (#60).
        if (tc && tn && e.agentId) openTools.set(tc, { agent: e.agentId, tool: tn })
        if (tc && SPAWN_TOOLS.has(tn ?? "") && !spawns.has(tc)) {
          // The parent names its own delegation with an IDENTIFIER field.
          // `task` carries `name` plus `agent_type`; `execution_subagent`
          // carries only `description`, which is free-text prose the privacy
          // boundary does not publish (#52), so it falls back to the tool name.
          const args = (d.arguments ?? {}) as Record<string, unknown>
          const kind = (args.agent_type as string) || tn || ""
          spawns.set(tc, {
            name: (args.name as string) || kind || "subagent",
            kind,
          })
        }
      } else if (e.type === "tool.execution_complete") {
        const tc = d.toolCallId as string | undefined
        if (tc) openTools.delete(tc)
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
          model: typeof d.model === "string" && d.model ? d.model : undefined,
          skill: undefined,
          activity: undefined,
          // toolCallId is resolved to a parent below.
          ...({ tc: d.toolCallId } as object),
        } as Subagent)
      } else if (e.type === "skill.invoked") {
        // ONLY the name is read. `data.content` is the FULL SKILL MARKDOWN,
        // `data.description` is free text and `data.path` is a machine path -
        // none of the three may be published (#52).
        const name = typeof d.name === "string" ? d.name : ""
        if (!name) continue
        const ts = Date.parse((e as { timestamp?: string }).timestamp ?? "")
        // `agentId` answers the nesting question the ticket left open: a skill
        // invoked inside a subagent carries that subagent's id, so it nests
        // under the agent that invoked it and sits at the root otherwise.
        const parent = e.agentId ?? null
        skills.set(`${SKILL}${parent ?? ""}:${name}`, {
          name,
          kind: "skill",
          status: "ok",
          parent,
          tools: 0,
          doneAt: Number.isFinite(ts) ? ts : Date.now(),
          model: undefined,
          skill: triggerOf(d.trigger),
          activity: undefined,
        })
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
  // Current activity, last writer wins: `openTools` preserves insertion order,
  // so the final surviving entry for an agent is its most recently started
  // tool call that never completed. A FINISHED subagent has no activity, however
  // the log left its tool calls - a completion is the stronger signal.
  for (const { agent, tool } of openTools.values()) {
    const s = subs.get(agent)
    if (s) s.activity = tool
  }
  for (const s of subs.values()) if (s.status !== "run") s.activity = undefined
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
      // A placeholder is a spawn that has not reported itself yet: nothing has
      // named its model, and it has run no tools of its own.
      model: undefined,
      skill: undefined,
      activity: undefined,
    })
  }
  // Skills are merged LAST so a skill can never displace a subagent that shares
  // its key space, and so a log with no skill invocation produces a byte-identical
  // map to before (#59). A skill whose invoking agent is not in the tree - the
  // subagent ended and aged out, say - falls back to the root rather than being
  // dropped, because the invocation still happened.
  for (const [id, skill] of skills) {
    if (skill.parent !== null && !subs.has(skill.parent)) skill.parent = null
    subs.set(id, skill)
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
 *
 * ROW FORMAT v2. A subagent row now carries five fields:
 *
 *     <depth> <glyph> <model> <activity> <name>
 *     0 > gpt-5.6-luna bash folk-lyricist
 *
 * The two new fields sit BEFORE the name, and that position is forced rather
 * than chosen. The name is the only field that may contain spaces, so the
 * sidebar recovers it by dropping a fixed number of leading fields and
 * rejoining the rest - it is greedy-last. Anything appended after it would be
 * swallowed by the name. Both new fields are therefore sanitised to a single
 * space-free token, or the `-` sentinel when unknown.
 *
 * Owner rows (`@ o <surface>`) and attention rows (`! <kind> <label>`) keep
 * their three-field shape; only subagent rows changed. The sidebar reads the
 * name of each with a different helper for exactly that reason.
 *
 * A plugin and a sidebar from different builds will disagree about field count
 * for as long as the skew lasts. That degrades a label; it cannot crash the
 * interpreter, which skips what it cannot parse. `install.sh` installs both
 * halves together.
 */
const GLYPH: Record<SubagentStatus, string> = { run: ">", ok: "v", fail: "x" }

/**
 * Skill rows carry their own glyph in the status position (#59).
 *
 * A skill is not a third subagent state - it is a different kind of thing that
 * happens to sit in the same tree - so it takes over field 1 rather than adding
 * a field. Existing readers keep working: `countOf(d, ">")` and the dismissal
 * tap both match on an exact glyph, so a skill row is simply not counted as
 * running and is not dismissible, which is correct for both.
 */
const SKILL_GLYPH: Record<SkillTrigger, string> = { user: "u", agent: "a", unknown: "s" }

/**
 * The sentinel for an absent fixed-position field.
 *
 * Fields 2 and 3 carry the model and the current activity. Both are frequently
 * unknown - a placeholder row has neither - and an EMPTY field cannot be used
 * because the sidebar recovers fields by splitting on spaces, which collapses
 * a run of them. A single character keeps every row the same shape.
 */
export const FIELD_NONE = "-"

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
 *     ! p shell Permission needed¦0 > - - folk-lyricist
 *
 * Field 2 is the sub-kind and field 1 stays a single character, so the three
 * kinds an operator reacts to differently - approve, answer, your turn - are
 * still read the same way they always were. As on a subagent row the new field
 * goes BEFORE the label, because the label is greedy-last, and an absent value
 * is the `-` sentinel rather than an empty field.
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
 *
 * An optional POSITIONAL tail carries what the Session itself is doing: field 3
 * is the count of tool completions that landed after the hook runtime last
 * wrote state (the issue #63 health signal), field 4 the git worktree, field 5
 * the model, and field 6 the tool call the Session is running right now.
 * Appending is safe here in a way it is not on a subagent row: a surface ID
 * cannot contain a space, so field 2 is recoverable without knowing the field
 * count, and every existing reader takes field 2 by index. The tail is
 * all-or-nothing - omitted entirely when every part of it is absent, emitted
 * whole when any part is present - because a field that sometimes disappears
 * would shift the ones after it.
 */
export const OWNER_MARK = "@"

/** A fixed-position wire field: space-free, bounded, `-` when absent. */
export function fieldToken(value: string | undefined, max: number): string {
  if (!value) return FIELD_NONE
  const cleaned = value.replace(/[\s¦]/g, "").slice(0, max)
  return cleaned.length > 0 ? cleaned : FIELD_NONE
}

/**
 * The git worktree a Session is working out of, or undefined for a normal
 * checkout.
 *
 * Worktrees are how parallel agent work is actually organised here - measured
 * on this machine: 6 for one repository, 6 for another, 4 for a third. Three of
 * those four are on a **detached HEAD**, which is what makes this worth
 * publishing at all: cmux exposes a `branch` binding, and for a detached
 * worktree that binding says nothing. The directory name is then the only thing
 * that identifies which piece of parallel work a Session is doing.
 *
 * Detection is a single file read, deliberately. `git rev-parse
 * --git-common-dir` would answer the same question and would mean spawning a
 * process on the hook path, where the whole design rule is that Maestro cannot
 * be the reason a session stalls. Git's own on-disk contract is enough: in a
 * linked worktree `.git` is a FILE reading `gitdir: <main>/.git/worktrees/<name>`,
 * and in the main working tree it is a directory. Verified against live
 * worktrees and main checkouts of three repositories.
 *
 * Walks upward, because a Session's cwd is often a subdirectory of the worktree
 * root rather than the root itself.
 */
export function resolveWorktree(cwd: string): string | undefined {
  try {
    let dir = cwd
    for (let depth = 0; depth < 24; depth++) {
      const marker = join(dir, ".git")
      let stats: ReturnType<typeof statSync>
      try {
        stats = statSync(marker)
      } catch {
        const parent = join(dir, "..")
        if (parent === dir) return undefined
        dir = parent
        continue
      }
      // A directory means the main working tree, which is not a worktree and
      // has nothing extra worth saying about it.
      if (!stats.isFile()) return undefined
      const pointer = readFileSync(marker, "utf8").trim()
      const match = /\/worktrees\/([^/\s]+)\/?$/.exec(pointer)
      return match?.[1]
    }
    return undefined
  } catch {
    return undefined
  }
}

/**
 * The model the SESSION itself is running, as distinct from its subagents'.
 *
 * Subagent rows have carried a model since wire v2, which left the one agent
 * the operator is actually talking to as the only one whose model was
 * invisible.
 *
 * Read from the log rather than stored, for the same reason attention is: a
 * stored value is only as fresh as the hook that would update it, and the model
 * CHANGES mid-session - `session.model_change` is a real event, observed here
 * switching gpt-5.6-sol to claude-opus-5. The last root event that names a
 * model is therefore the answer, and `agentId` is what makes "root" decidable:
 * a subagent's events carry one, the session's do not. Without that filter this
 * would report whichever subagent happened to run most recently.
 *
 * Measured field coverage in one session log: `assistant.message` 883,
 * `tool.execution_start` 898, `tool.execution_complete` 897 - all carrying
 * `model`, so this is never guesswork on an active Session.
 */
export function detectSessionModel(logPath: string): string | undefined {
  return scanRoot(logPath).model
}

/**
 * The tool call the SESSION itself is running right now.
 *
 * Subagent rows have carried an activity field since #60, which left the one
 * agent the operator is actually talking to as the only one that never said
 * what it was doing.
 *
 * Derivation mirrors #60 - the most recent `tool.execution_start` with no
 * matching completion - with one addition that measurement forced. A root tool
 * call is NOT always completed: across three logs, 6,832 root starts produced
 * 6,830 completions, and the two strays were backgrounded `bash` calls sitting
 * 6,000 and 10,000 events from the end. "Last surviving open call" alone would
 * therefore pin a dead `bash` to an idle Session indefinitely.
 *
 * `assistant.turn_end` is the correction, and it is measured rather than
 * assumed: across 6,831 matched start/complete pairs it appeared between a
 * start and its completion exactly ZERO times. A turn that has ended cannot
 * still be running a tool, so the end of a turn clears every open root call.
 * That also gives the right answer for an idle Session, which is the state an
 * operator sees most often - no activity at all, rather than a stale one.
 */
export function detectSessionActivity(logPath: string): string | undefined {
  return scanRoot(logPath).activity
}

/**
 * One pass over the ROOT events, answering both questions the owner row asks.
 *
 * Kept as a single scan because both callers want both answers at the same
 * moment and the log is already read three times per summarise. `agentId` is
 * what makes "root" decidable: a subagent's events carry one, the Session's do
 * not. Without that filter each of these would confidently report whichever
 * subagent happened to run most recently.
 */
function scanRoot(logPath: string): { model?: string | undefined; activity?: string | undefined } {
  try {
    let model: string | undefined
    // Insertion-ordered, so the last surviving entry is the most recently
    // started root call that never completed.
    const openRoot = new Map<string, string>()
    for (const line of readLines(logPath)) {
      if (!line) continue
      let e: { type?: string; agentId?: string | null; data?: Record<string, unknown> }
      try {
        e = JSON.parse(line)
      } catch {
        continue
      }
      if (e.agentId) continue
      const d = e.data ?? {}
      // An explicit switch wins over the model stamped on surrounding events,
      // which may still be the previous one for a moment.
      if (e.type === "session.model_change" && typeof d.newModel === "string") {
        model = d.newModel
        continue
      }
      if (typeof d.model === "string" && d.model) model = d.model
      if (e.type === "assistant.turn_end") {
        openRoot.clear()
        continue
      }
      const tc = d.toolCallId as string | undefined
      if (!tc) continue
      if (e.type === "tool.execution_start") {
        const tn = d.toolName as string | undefined
        if (tn) openRoot.set(tc, tn)
      } else if (e.type === "tool.execution_complete") {
        openRoot.delete(tc)
      }
    }
    let activity: string | undefined
    for (const tool of openRoot.values()) activity = tool
    return { model, activity }
  } catch {
    return {}
  }
}

export function encodeOwner(surfaceID: string, stalled = 0, session?: SessionFacts): string {
  const id = surfaceID.replace(/[\n\r¦ ]/g, "")
  const worktree = fieldToken(session?.worktree, 20)
  const model = fieldToken(session?.model, 18)
  const activity = fieldToken(session?.activity, 14)
  // The tail is omitted entirely when there is nothing in it, so a healthy
  // Session in a normal checkout encodes exactly as it did before any of these
  // fields existed. When any one is present all of them are emitted, because
  // they are POSITIONAL - a reader takes field 4 by index, and a field that
  // sometimes disappears would shift the ones after it.
  if (stalled <= 0 && worktree === FIELD_NONE && model === FIELD_NONE && activity === FIELD_NONE) {
    return `${OWNER_MARK} o ${id}`
  }
  return `${OWNER_MARK} o ${id} ${stalled > 0 ? stalled : FIELD_NONE} ${worktree} ${model} ${activity}`
}

/** What the owner row says about the Session itself, rather than its tree. */
export interface SessionFacts {
  worktree: string | undefined
  model: string | undefined
  activity: string | undefined
}

/**
 * How many tool completions after the last hook-written state make a Session
 * demonstrably un-published.
 *
 * One is noise: a completion can land between the tool finishing and its
 * `postToolUse` hook writing state, and the two are separate processes. Three
 * consecutive is not a race - it is a hook that is no longer arriving.
 */
export const STALLED_COMPLETIONS = 3

/**
 * Count ROOT tool completions the event log recorded after `sinceMs`.
 *
 * This is the health signal for issue #63, and its shape is forced by what
 * actually went wrong. Copilot CLI changed two hook payload shapes; every
 * affected hook threw, was caught, and exited 0 - the fail-open contract
 * working exactly as designed - and Maestro published nothing for two days
 * while the sidebar kept rendering the last plausible tree.
 *
 * Three cheaper detectors were tried against a deliberately broken parser and
 * measured to fail:
 *
 *  - A heartbeat cannot work, because a plugin with nothing to say and a
 *    plugin that has gone deaf are byte-identical on the wire.
 *  - A log-mtime threshold cannot work: one long `bash` call appends nothing
 *    for minutes.
 *  - `updatedAt` cannot work, and this is the one that had to be measured to
 *    be believed. EVERY hook stamps it, and the outage's own report says the
 *    hooks that still parsed "kept publishing occasionally". Built against
 *    `updatedAt`, this detector sat at zero through four broken tool calls.
 *
 * What works is a PER-HOOK timestamp. `lastToolAt` moves only when a
 * `postToolUse` hook lands, so completions accumulating past it isolate that
 * one pipeline. Counting only what is newer also makes the check immune to
 * history, which comparing `completedTools` against the log is not: a resumed
 * Session keeps its log and resets its counters.
 *
 * Only ROOT completions count. A subagent's tool calls appear in the parent's
 * log - measured, 11,983 completions of which 1,809 were root - and if Copilot
 * does not fire `postToolUse` for them, counting them would badge every long
 * subagent run as a fault. Ignoring them can only make this slower to notice,
 * never wrong.
 *
 * A shutdown resets the count. A dead Session runs no more hooks by
 * definition, and a badge that never clears is one the operator learns to
 * ignore.
 */
export function countStalledCompletions(logPath: string, sinceMs: number): number {
  try {
    let count = 0
    for (const line of readLines(logPath)) {
      if (!line) continue
      let e: { type?: string; timestamp?: string; agentId?: string | null }
      try {
        e = JSON.parse(line)
      } catch {
        continue
      }
      if (e.type === SHUTDOWN) {
        count = 0
        continue
      }
      if (e.type !== "tool.execution_complete") continue
      if (e.agentId) continue
      const ts = Date.parse(e.timestamp ?? "")
      if (Number.isFinite(ts) && ts > sinceMs) count++
    }
    return count
  } catch {
    // Unreadable log is ignorance, not ill health. Reporting a fault we cannot
    // demonstrate is the same lie in the other direction.
    return 0
  }
}

/**
 * The description, split into one block per publishing Session.
 *
 * The workspace description is a single field, but a workspace can hold more
 * than one Copilot Session. Until now each Session rewrote the WHOLE field, so
 * whichever published last won: the other Session's owner row vanished and its
 * tab fell back to rendering as a plain terminal, taking its subagent tree with
 * it (issue #49).
 *
 * No new wire format is needed to fix that, because the owner row already
 * identifies a Session. It is simply promoted to a DELIMITER: an `@ o <surface>`
 * row opens a block, and every row after it belongs to that Session until the
 * next owner row. A single-Session workspace encodes byte-identically to before.
 *
 * Rows appearing BEFORE any owner row are dropped rather than preserved. They
 * cannot be attributed to a Session, so nothing could ever clear them - and this
 * field is Maestro's own, so the only way to produce them is an older build that
 * published without an owner. Dropping them lets one publish clean up after an
 * upgrade; keeping them would strand stale rows on screen forever.
 */
export interface OwnedBlock {
  owner: string
  rows: string[]
}

export function splitOwnedBlocks(published: string): OwnedBlock[] {
  const blocks: OwnedBlock[] = []
  for (const row of published.split(ROW_SEP)) {
    if (!row) continue
    if (row.startsWith(`${OWNER_MARK} o `)) {
      // First token only: the owner row may carry a health field after the
      // surface ID, and the block is keyed on identity alone.
      const owner = row.slice(4).trim().split(" ")[0] ?? ""
      blocks.push({ owner, rows: [row] })
    } else {
      const current = blocks[blocks.length - 1]
      if (current) current.rows.push(row)
    }
  }
  return blocks
}

/** The rows one Session published, as a description fragment of its own. */
export function ownedRows(published: string, surfaceID: string): string {
  const block = splitOwnedBlocks(published).find((b) => b.owner === surfaceID)
  return block ? block.rows.join(ROW_SEP) : ""
}

/**
 * The health field a Session's owner row already carries, or 0.
 *
 * Only the watcher can DERIVE this - the scan is too expensive for a hook and,
 * more to the point, a `postToolUse` hook that has stopped arriving cannot
 * report its own absence. But every hook that still works republishes the owner
 * row, and a publisher that recomputes health as zero because it did not look
 * erases the watcher's finding within a second.
 *
 * That is not hypothetical: measured against a deliberately broken parser, the
 * watcher published `@ o <surface> 10` and the next `agentStop` hook wiped it,
 * over and over, so the badge never survived long enough to be seen. It is also
 * the precise dynamic the outage described - the hooks that still parsed "kept
 * publishing occasionally", which is what kept the tree looking alive.
 *
 * So a hook CARRIES the field forward instead of recomputing it. The one
 * exception is a `postToolUse` hook, which is itself proof that the pipeline
 * works and therefore clears it. That makes recovery self-healing without
 * asking a hook to measure anything.
 */
export function healthOf(published: string, surfaceID: string): number {
  const block = splitOwnedBlocks(published).find((b) => b.owner === surfaceID)
  if (!block) return 0
  const field = (block.rows[0] ?? "").split(" ")[3]
  const value = Number.parseInt(field ?? "", 10)
  return Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * Drop blocks whose surface no longer exists in the workspace.
 *
 * Per-block merging fixes clobbering but introduces a new way to go stale: a
 * Session that is KILLED never runs its end hook, so its block is never removed
 * and no live Session will touch it. The old whole-field overwrite cleaned that
 * up as a side effect of destroying everything.
 *
 * Pruning is therefore explicit, and deliberately conservative - an EMPTY or
 * unavailable surface list prunes nothing, because "I could not enumerate the
 * surfaces" must never be read as "no surfaces exist" and wipe live trees.
 */
export function pruneOwnedBlocks(published: string, liveSurfaceIDs: readonly string[]): string {
  if (liveSurfaceIDs.length === 0) return published
  const live = new Set(liveSurfaceIDs)
  return splitOwnedBlocks(published)
    .filter((b) => live.has(b.owner))
    .flatMap((b) => b.rows)
    .join(ROW_SEP)
}

/**
 * Replace one Session's block, leaving every other Session's block untouched.
 *
 * `mine` is that Session's freshly computed rows, owner row included. An EMPTY
 * `mine` removes the block - which is what a Session end must do now, because
 * clearing the whole field would take every co-resident Session down with it.
 *
 * Block order is preserved so tabs do not reshuffle: an existing block is
 * updated in place, and a new one is appended.
 */
export function mergeOwnedRows(published: string, surfaceID: string, mine: string): string {
  const blocks = splitOwnedBlocks(published)
  const rows = mine.split(ROW_SEP).filter((row) => row.length > 0)
  const index = blocks.findIndex((b) => b.owner === surfaceID)

  if (index >= 0) {
    if (rows.length > 0) blocks[index] = { owner: surfaceID, rows }
    else blocks.splice(index, 1)
  } else if (rows.length > 0) {
    blocks.push({ owner: surfaceID, rows })
  }

  return blocks.flatMap((b) => b.rows).join(ROW_SEP)
}
const ATTENTION_GLYPH: Record<AttentionKind, string> = {
  permission: "p",
  question: "q",
  turn: "t",
}

/**
 * The permission sub-kinds the runtime emits.
 *
 * A CLOSED list on purpose: an unrecognised value is dropped rather than
 * published, because field 2 must stay a short space-free token and an unknown
 * value has no glyph in the sidebar anyway. Measured across 40 recent session
 * logs - shell 1671, write 306, read 209, url 28, mcp 13, factory 6.
 */
const PERMISSION_KINDS = new Set(["shell", "write", "read", "url", "mcp", "factory"])

export function encodeAttention(attention: Attention): string {
  const label = attention.label
    .replace(/[\n\r¦]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 44)
  const detail =
    attention.detail && PERMISSION_KINDS.has(attention.detail) ? attention.detail : FIELD_NONE
  return `${ATTENTION_MARK} ${ATTENTION_GLYPH[attention.kind]} ${detail} ${label}`
}

/** Running sorts before finished. */
function rank(status: SubagentStatus): number {
  return status === "run" ? 0 : 1
}

export function encodeTree(
  subs: Map<string, Subagent>,
  now: number = Date.now(),
  dismissed: ReadonlySet<string> = new Set(),
  retainMs: number = RETAIN_MS,
): string {
  const clean = (v: string, n: number) =>
    v
      .replace(/[\n\r¦]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, n)
  // A fixed-position field must never contain a space or it would shift every
  // field after it. Whitespace is stripped outright rather than collapsed.
  //
  // The bounds are TIGHT on purpose. All three fields share one sidebar row and
  // all three compress, so a long model or tool name steals width from the
  // agent's NAME - which is the field the operator actually reads. Capping the
  // metadata is the only lever available: forcing them to intrinsic width with
  // `.fixedSize()` instead makes the row incompressible, and one long row then
  // widens the whole pane and shifts every other row off its left edge.
  // Measured, on a live sidebar.
  const token = (v: string | undefined, n: number) => {
    if (!v) return FIELD_NONE
    const cleaned = v.replace(/[\s¦]/g, "").slice(0, n)
    return cleaned.length > 0 ? cleaned : FIELD_NONE
  }
  return (
    flatten(subs)
      .filter(([, s]) => s.status !== "ok" || s.doneAt === undefined || now - s.doneAt < retainMs)
      // A dismissed agent stays dismissed. Only FINISHED work can be dismissed -
      // a running agent is never hidden, however emphatically it is clicked.
      .filter(([, s]) => s.status !== "ok" || !dismissed.has(s.name))
      .slice(0, 60)
      .map(
        ([depth, s]) =>
          `${Math.min(depth, 6)} ${s.skill ? SKILL_GLYPH[s.skill] : GLYPH[s.status]} ${token(s.model, 18)} ${token(s.activity, 14)} ${clean(s.name, 44)}`,
      )
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
  nextExpiryAt: number | undefined
  /**
   * Whether a session log was actually found.
   *
   * "I read the log and this Session has no subagents" and "I could not find
   * the log at all" produce identical row sets and must NOT be treated
   * identically. The first is news and should be published, because publishing
   * it is what clears a finished tree. The second is ignorance, and publishing
   * it WIPES a perfectly good tree.
   *
   * Measured: a Session flipped between four rows and none every few seconds.
   * `resolveSessionLog` fails closed when an identity is supplied that does not
   * resolve to a file - `agentStop`'s `sessionId` is documented as not being the
   * session-state directory name - so those hooks summarised to an empty tree
   * and erased the rows the other hooks had just published.
   */
  resolved: boolean
}

/**
 * Everything above, guarded. Returns null ONLY when the tree could not be
 * computed at all.
 *
 * An attention state alone is enough to say something. A session that has
 * never delegated still blocks on a permission prompt, and that is precisely
 * the session an operator most needs pointed out - so zero subagents is NOT a
 * reason to stay silent once `attention` is set.
 *
 * Nor is "nothing to say" a reason to stay silent. The published description is
 * a PERSISTENT field: it is only ever overwritten, never expired. An empty tree
 * that returns null therefore leaves the LAST non-empty description frozen on
 * screen - agents that finished hours ago still rendering as running. So an
 * empty tree is a real state and is summarised as one, with an empty row set
 * that clears the surface back to a plain no-subagents presentation. Null is
 * reserved for failure, where leaving the previous description alone is right.
 */
export function summarize(
  cwd: string,
  attention?: Attention,
  surfaceID?: string,
  dismissed: ReadonlySet<string> = new Set(),
  sessionId?: string,
  transcriptPath?: string,
  now: number = Date.now(),
  stalled = 0,
  retainMs: number = RETAIN_MS,
): TreeSummary | null {
  try {
    const log = resolveSessionLog(cwd, sessionId, transcriptPath) ?? undefined
    const subs = log ? buildTree(log) : new Map<string, Subagent>()

    // What the Session itself is - which model, and which git worktree - as
    // opposed to what its subagents are. Computed here rather than passed in so
    // every caller gets it; the watcher and the hooks would otherwise disagree.
    // This is a third full pass over the log. The watcher gates on log mtime
    // and a hook publishes once per event, so it is bounded by how fast the log
    // grows rather than by a clock.
    const root = log ? scanRoot(log) : {}
    const facts: SessionFacts = {
      worktree: resolveWorktree(cwd),
      model: root.model,
      activity: root.activity,
    }

    // Derived Attention wins over anything a hook stored. A blocking prompt that
    // the log says is still outstanding is true regardless of which hook last
    // ran; a stored flag is only as fresh as its clearing hook.
    const derived = log ? detectAttention(log) : undefined
    // Any kind the log can derive must ignore its stored counterpart, because a
    // stored flag is only as fresh as the hook that would clear it. `turn` is
    // not derivable and still comes from its hook.
    const derivable = attention?.kind === "permission" || attention?.kind === "question"
    const effective = derived ?? (derivable ? undefined : attention)

    if (subs.size === 0 && !effective) {
      return {
        total: 0,
        running: 0,
        failed: 0,
        attention: undefined,
        encoded: surfaceID ? encodeOwner(surfaceID, stalled, facts) : "",
        nextExpiryAt: undefined,
        resolved: log !== undefined,
      }
    }
    let running = 0
    let failed = 0
    let nextExpiryAt: number | undefined
    for (const s of subs.values()) {
      if (s.status === "run") running++
      else if (s.status === "fail") failed++
      else if (s.doneAt !== undefined && !dismissed.has(s.name)) {
        // `never` has no future moment to wake the watcher for, and an
        // infinite deadline would make the mtime gate believe an expiry is
        // always pending.
        const expiresAt = s.doneAt + retainMs
        if (
          Number.isFinite(expiresAt) &&
          expiresAt > now &&
          (nextExpiryAt === undefined || expiresAt < nextExpiryAt)
        ) {
          nextExpiryAt = expiresAt
        }
      }
    }
    const rows = [
      ...(surfaceID ? [encodeOwner(surfaceID, stalled, facts)] : []),
      ...(effective ? [encodeAttention(effective)] : []),
      ...(subs.size > 0 ? [encodeTree(subs, now, dismissed, retainMs)] : []),
      // An aged-out or fully dismissed tree encodes to "". Joining that in
      // would publish a trailing separator and an empty row.
    ].filter((row) => row.length > 0)
    return {
      total: subs.size,
      running,
      failed,
      attention: effective,
      encoded: rows.join(ROW_SEP),
      nextExpiryAt,
      resolved: log !== undefined,
    }
  } catch {
    return null
  }
}
