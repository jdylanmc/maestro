export type TransportMode = "cli" | "socket" | "auto"
export type LogLevel = "debug" | "info" | "warn" | "error"
export type SidebarLogLevel = "info" | "progress" | "success" | "warning" | "error"
export type RuntimePhase = "idle" | "thinking" | "working" | "done" | "error"
/**
 * The hooks Maestro registers.
 *
 * `preToolUse` is DELIBERATELY absent, and must stay absent. It is the only
 * hook Copilot treats as able to veto a tool call, and an observability plugin
 * has no business holding that authority - the upstream `copilot-cmux` plugin
 * took a live session down through exactly this hook, refusing every tool call
 * including `pwd`. Start-of-work is derived from `userPromptSubmitted`, and
 * per-tool detail from `postToolUse`.
 */
export type HookName =
  | "sessionStart"
  | "sessionEnd"
  | "userPromptSubmitted"
  | "postToolUse"
  | "errorOccurred"
  | "notification"
  | "agentStop"
export type SessionStartSource = "new" | "resume" | "startup"
export type SessionEndReason = "complete" | "error" | "abort" | "timeout" | "user_exit"
export type ToolResultType = "success" | "failure" | "denied"

/**
 * Why a session is waiting on the human.
 *
 * `permission` and `question` are blocking - the session cannot proceed until
 * the operator answers. `turn` is not blocking; the agent simply finished and
 * has nothing else to do. They are ranked in that order when several could
 * apply, because only the first two cost the operator anything by being missed.
 */
export type AttentionKind = "permission" | "question" | "turn"

export interface Attention {
  kind: AttentionKind
  /**
   * A short human label. NEVER the underlying command text: a permission
   * prompt's `message` carries the full command line, which routinely contains
   * tokens, hostnames, and paths that must not be published to a surface that
   * may be screenshotted or committed.
   */
  label: string
  /**
   * WHY, when the runtime says why (#-taxonomy work).
   *
   * For a permission this is `permissionRequest.kind` - measured values, across
   * 40 recent session logs: `shell` 1671, `write` 306, `read` 209, `url` 28,
   * `mcp` 13, `factory` 6. It is a closed vocabulary the runtime chose, not
   * free text, which is what makes it publishable at all. The sibling
   * `intention` and `path` fields on the same request are prose and a machine
   * path, and are never read.
   *
   * Absent for `question` and `turn`, which carry no sub-kind.
   */
  detail: string | undefined
  since: number
}

export interface PluginConfig {
  cmuxBin: string
  statusKey: string
  transport: TransportMode
  progressEnabled: boolean
  keepDoneStatus: boolean
  logPrompts: boolean
  logToolCalls: boolean
  logSessionLifecycle: boolean
  notifyOnSessionEnd: boolean
  notifyOnErrors: boolean
  logFileEdits: boolean
  /**
   * Publish text derived from prompts, tool arguments, and tool results.
   *
   * OFF by default, and that default is the privacy boundary (#52): the
   * shipped configuration publishes only identifiers the runtime names itself
   * - tool names, agent names, counts, phases - and never free-text the
   * operator or a model wrote. Turning this on restores the older, chattier
   * labels and is a deliberate opt-in.
   */
  publishRawText: boolean
  /**
   * How long a FINISHED subagent stays on screen, in milliseconds (#56).
   *
   * `Infinity` is the `never` choice: retention alone never ages a row out.
   * That does not disable tap-to-dismiss, and it does not survive the
   * description clearing that already happens at session end.
   *
   * Enforced in the plugin rather than the sidebar, which has no clock to
   * compare timestamps against and no state with which to remember a dismissal.
   */
  retainFinishedMs: number
  /**
   * The deepest subagent generation to publish (#43).
   *
   * Rows deeper than this are OMITTED, along with their descendants - not
   * clamped onto the last visible depth, which would draw a grandchild as a
   * sibling of its own parent and misstate the shape of the tree.
   *
   * A separate concern from the wire's own depth ceiling of 6, which is a
   * rendering limit on the indent slots the sidebar draws. This is an operator
   * preference about how much of a deep tree is worth seeing.
   */
  maxDepth: number
  /**
   * Whether the end of a turn raises attention (#43).
   *
   * `permission` and `question` are unaffected and cannot be turned off here:
   * they BLOCK the Session, so missing one costs real time, whereas "your turn"
   * is a courtesy an operator watching the window does not need.
   */
  attentionOnTurn: boolean
  /**
   * Whether raised attention also marks the cmux workspace unread (#43).
   *
   * This is cmux's own affordance rather than Maestro's, so it shows up in the
   * stock UI too - which is exactly why some operators will want it and others
   * will find it noisy.
   */
  markUnreadOnAttention: boolean
  debug: boolean
  /**
   * The watcher recomputes attention on a timer, because a blocked Session
   * fires no hook and therefore cannot raise its own badge (#57).
   */
  watcherEnabled: boolean
  watcherIntervalMs: number
  watcherIdleMs: number
}

export interface SidebarStatusPayload {
  text: string
  icon: string
  color: string
}

export interface ProgressPayload {
  value: number
  label: string
}

export interface NotificationPayload {
  title: string
  subtitle?: string
  body?: string
}

export interface SidebarLogPayload {
  level: SidebarLogLevel
  source: string
  message: string
}

export interface PresentationSnapshot {
  status?: SidebarStatusPayload
  progress?: ProgressPayload
}

export interface CmuxClient {
  readonly available: boolean
  readonly transport: "cli" | "socket"
  readonly workspaceID: string | undefined
  notify(payload: NotificationPayload): Promise<void>
  setStatus(key: string, payload: SidebarStatusPayload): Promise<void>
  clearStatus(key: string): Promise<void>
  setProgress(payload: ProgressPayload): Promise<void>
  clearProgress(): Promise<void>
  log(payload: SidebarLogPayload): Promise<void>
}

export interface HookLogger {
  log(level: LogLevel, message: string, extra?: Record<string, unknown>): Promise<void>
}

export interface CmuxEnvironment {
  workspaceID: string | undefined
  surfaceID: string | undefined
  socketPath: string
  isManagedWorkspace: boolean
  hasSocket: boolean
  termProgram: string | undefined
}

export interface RuntimeState {
  version: 1
  cwd: string
  workspaceID: string | undefined
  updatedAt: number
  startedAt: number | undefined
  source: SessionStartSource | undefined
  phase: RuntimePhase
  lastPrompt: string | undefined
  toolInvocations: number
  completedTools: number
  /**
   * When a `postToolUse` hook LAST LANDED, as distinct from when any hook did.
   *
   * `updatedAt` cannot answer that. Every hook stamps it, and during the
   * two-day outage of issue #63 the hooks that were still parsing -
   * `sessionStart`, `agentStop`, `userPromptSubmitted` - kept stamping it
   * while `postToolUse` threw on every single call. A detector reading
   * `updatedAt` therefore sees a perfectly healthy Session; measured, it never
   * fired once against a deliberately broken parser.
   *
   * A per-hook timestamp is what isolates one pipeline. Counting only the
   * completions AFTER it also makes the check immune to history: a resumed
   * Session keeps its log but resets its counters, which is why comparing
   * `completedTools` against the log does not work - measured deltas across
   * four live Sessions were +31, +457, +1143 and -326.
   */
  lastToolAt: number | undefined
  lastToolName: string | undefined
  lastToolSummary: string | undefined
  lastResultType: ToolResultType | undefined
  filesEdited: number
  lastEditedFile: string | undefined
  lastError:
    | {
        message: string
        name: string | undefined
      }
    | undefined
  lastSessionEndReason: SessionEndReason | undefined
  attention: Attention | undefined
  /**
   * Enough identity for something OTHER than this Session's hook to publish on
   * its behalf.
   *
   * A blocked Session fires no hook, so the watcher recomputes attention on a
   * timer instead (issue #57). To do that it must know which surface owns the
   * block and which log to read - neither of which it can rediscover, because
   * `CMUX_SURFACE_ID` lives in the Session's environment and cwd alone is
   * ambiguous (G-21).
   */
  surfaceID: string | undefined
  sessionId: string | undefined
  transcriptPath: string | undefined
  /**
   * Names of finished subagents the operator dismissed from the sidebar.
   *
   * Dismissal happens in the SIDEBAR, which can only rewrite the workspace
   * description - it has no state of its own. So the plugin reads the
   * description back before publishing, and any finished agent it computed but
   * that is no longer present was dismissed. Without this the next hook would
   * resurrect every dismissed row within seconds.
   */
  dismissed: string[]
}

export interface SessionStartHookInput {
  timestamp: number
  cwd: string
  source: SessionStartSource
  initialPrompt: string | undefined
}

export interface SessionEndHookInput {
  timestamp: number
  cwd: string
  reason: SessionEndReason
}

export interface UserPromptSubmittedHookInput {
  timestamp: number
  cwd: string
  prompt: string
}

export interface ToolResult {
  resultType: ToolResultType
  textResultForLlm: string | undefined
}

export interface PostToolUseHookInput {
  timestamp: number
  cwd: string
  toolName: string
  toolArgs: string
  toolResult?: ToolResult
}

export interface ErrorOccurredHookInput {
  timestamp: number
  cwd: string
  error: {
    message: string
    name: string | undefined
    stack: string | undefined
  }
}

/**
 * Copilot's `notification` hook.
 *
 * `notificationType` is the discriminator that matters. Measured values in one
 * session: `permission_prompt` (135), `agent_idle` (7), `elicitation_dialog`
 * (2), `shell_completed` (1), `shell_detached_completed` (1).
 *
 * `message` is deliberately NOT carried through to any published surface. For a
 * permission prompt it is the full command text.
 */
export interface NotificationHookInput {
  timestamp: number
  cwd: string
  notificationType: string
  title: string | undefined
}

/** Copilot's `agentStop` hook. The only measured `stopReason` is `end_turn`. */
export interface AgentStopHookInput {
  timestamp: number
  cwd: string
  stopReason: string | undefined
}
