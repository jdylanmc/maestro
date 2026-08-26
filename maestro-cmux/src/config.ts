import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { STALL_THRESHOLD_MS } from "./stall.js"
import { MAX_WIRE_DEPTH, RETAIN_MS, RETENTION_CHOICES } from "./tree.js"
import type { PluginConfig, TransportMode } from "./types.js"

const TRUE_VALUES = new Set(["1", "true", "yes", "on"])
const FALSE_VALUES = new Set(["0", "false", "no", "off"])

/**
 * Every setting the config file may carry.
 *
 * Issue #43 opens with the real complaint: settings are split across two
 * mechanisms and neither is reachable from the UI. The file half is now
 * complete - every boolean in `PluginConfig` can be set here, and the two
 * watcher intervals too. Environment variables remain the override, so an
 * operator can still change one setting for one session without editing a file.
 *
 * `cmuxBin`, `statusKey` and `transport` are deliberately NOT here. They select
 * how to reach cmux at all, so a bad value in a file read by every hook would
 * silence the plugin everywhere at once, with the file itself as the only way
 * back. An environment variable is scoped to one session and is the safer home
 * for them.
 */
interface MaestroFileConfig {
  progressEnabled: boolean | undefined
  keepDoneStatus: boolean | undefined
  notifyOnSessionEnd: boolean | undefined
  notifyOnErrors: boolean | undefined
  watcherEnabled: boolean | undefined
  publishRawText: boolean | undefined
  retainFinished: string | undefined
  maxDepth: number | undefined
  attentionOnTurn: boolean | undefined
  markUnreadOnAttention: boolean | undefined
  stallThresholdMs: number | undefined
  stallBadge: boolean | undefined
  logPrompts: boolean | undefined
  logToolCalls: boolean | undefined
  logSessionLifecycle: boolean | undefined
  logFileEdits: boolean | undefined
  debug: boolean | undefined
  watcherIntervalMs: number | undefined
  watcherIdleMs: number | undefined
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback

  const normalized = value.trim().toLowerCase()
  if (TRUE_VALUES.has(normalized)) return true
  if (FALSE_VALUES.has(normalized)) return false
  return fallback
}

function parseTransport(value: string | undefined, fallback: TransportMode): TransportMode {
  if (!value) return fallback

  const normalized = value.trim().toLowerCase()
  if (normalized === "cli" || normalized === "socket" || normalized === "auto") {
    return normalized
  }

  return fallback
}

/** A malformed interval falls back rather than throwing: the watcher is an
 *  enhancement, and a typo in it must never take the hooks down with it. */
function parseInterval(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value.trim(), 10)
  if (!Number.isFinite(parsed) || parsed < 250) return fallback
  return parsed
}

function configPath(env: NodeJS.ProcessEnv): string {
  const explicitPath = env.MAESTRO_CONFIG_PATH?.trim()
  if (explicitPath) return explicitPath

  const home = env.HOME?.trim() || homedir()
  const configHome = env.XDG_CONFIG_HOME?.trim() || join(home, ".config")
  return join(configHome, "maestro", "config.json")
}

function optionalBoolean(
  source: Record<string, unknown>,
  key: keyof MaestroFileConfig,
  path: string,
): boolean | undefined {
  const value = source[key]
  if (value === undefined) return undefined
  if (typeof value !== "boolean") {
    throw new Error(`Invalid Maestro config at ${path}: "${key}" must be a boolean`)
  }
  return value
}

/**
 * An interval read from the file.
 *
 * Unlike the environment path, which falls back silently on a typo, a bad
 * value HERE throws. The two are not inconsistent: an environment variable is
 * ambient and may be set by something the operator did not write, so failing
 * open is right, whereas a config file is a deliberate statement and a value
 * that was quietly ignored would leave the operator believing a setting had
 * taken effect. The throw is caught by `hook-runner`, so it still cannot break
 * a session.
 */
function optionalInterval(
  source: Record<string, unknown>,
  key: keyof MaestroFileConfig,
  path: string,
): number | undefined {
  const value = source[key]
  if (value === undefined) return undefined
  if (typeof value !== "number" || !Number.isFinite(value) || value < 250) {
    throw new Error(
      `Invalid Maestro config at ${path}: "${key}" must be a number of milliseconds >= 250`,
    )
  }
  return value
}

/**
 * How long a finished subagent stays on screen (#56).
 *
 * A CLOSED vocabulary rather than a free duration string. The value is only
 * useful at a handful of scales, and an unrecognised one has to fall back to
 * something - which would mean an operator who typed "30min" would see the
 * default and conclude the setting does nothing.
 *
 * Rejected loudly for the same reason the intervals are: an ambient environment
 * variable may be set by something the operator did not write, so that path
 * falls back, but a config file is a deliberate statement.
 */
function optionalRetention(source: Record<string, unknown>, path: string): string | undefined {
  const value = source.retainFinished
  if (value === undefined) return undefined
  if (typeof value !== "string" || !(value in RETENTION_CHOICES)) {
    throw new Error(
      `Invalid Maestro config at ${path}: "retainFinished" must be one of ${Object.keys(
        RETENTION_CHOICES,
      ).join(", ")}`,
    )
  }
  return value
}

/** The environment override. Falls back rather than throwing - see above. */
function parseRetention(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const choice = RETENTION_CHOICES[value.trim().toLowerCase()]
  return choice === undefined ? fallback : choice
}

/**
 * The deepest subagent generation to publish.
 *
 * Rejected loudly for the same reason the intervals are, and bounded at both
 * ends: `0` would publish an empty tree, which looks exactly like a broken
 * plugin, and anything past the wire's own ceiling of 6 cannot be drawn
 * distinctly anyway.
 */
function optionalDepth(source: Record<string, unknown>, path: string): number | undefined {
  const value = source.maxDepth
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > MAX_WIRE_DEPTH) {
    throw new Error(
      `Invalid Maestro config at ${path}: "maxDepth" must be a whole number from 1 to ${MAX_WIRE_DEPTH}`,
    )
  }
  return value as number
}

/** The environment override for depth. Falls back rather than throwing. */
function parseDepth(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value.trim(), 10)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_WIRE_DEPTH) return fallback
  return parsed
}

const EMPTY_FILE_CONFIG: MaestroFileConfig = {
  progressEnabled: undefined,
  keepDoneStatus: undefined,
  notifyOnSessionEnd: undefined,
  notifyOnErrors: undefined,
  watcherEnabled: undefined,
  publishRawText: undefined,
  retainFinished: undefined,
  maxDepth: undefined,
  attentionOnTurn: undefined,
  markUnreadOnAttention: undefined,
  stallThresholdMs: undefined,
  stallBadge: undefined,
  logPrompts: undefined,
  logToolCalls: undefined,
  logSessionLifecycle: undefined,
  logFileEdits: undefined,
  debug: undefined,
  watcherIntervalMs: undefined,
  watcherIdleMs: undefined,
}

function readFileConfig(env: NodeJS.ProcessEnv): MaestroFileConfig {
  const path = configPath(env)
  let raw: string
  try {
    raw = readFileSync(path, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return EMPTY_FILE_CONFIG
    }
    throw error
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`Invalid Maestro config at ${path}: expected JSON`, { cause: error })
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid Maestro config at ${path}: expected a JSON object`)
  }

  const source = parsed as Record<string, unknown>
  return {
    progressEnabled: optionalBoolean(source, "progressEnabled", path),
    keepDoneStatus: optionalBoolean(source, "keepDoneStatus", path),
    notifyOnSessionEnd: optionalBoolean(source, "notifyOnSessionEnd", path),
    notifyOnErrors: optionalBoolean(source, "notifyOnErrors", path),
    watcherEnabled: optionalBoolean(source, "watcherEnabled", path),
    publishRawText: optionalBoolean(source, "publishRawText", path),
    retainFinished: optionalRetention(source, path),
    maxDepth: optionalDepth(source, path),
    attentionOnTurn: optionalBoolean(source, "attentionOnTurn", path),
    markUnreadOnAttention: optionalBoolean(source, "markUnreadOnAttention", path),
    stallThresholdMs: optionalInterval(source, "stallThresholdMs", path),
    stallBadge: optionalBoolean(source, "stallBadge", path),
    logPrompts: optionalBoolean(source, "logPrompts", path),
    logToolCalls: optionalBoolean(source, "logToolCalls", path),
    logSessionLifecycle: optionalBoolean(source, "logSessionLifecycle", path),
    logFileEdits: optionalBoolean(source, "logFileEdits", path),
    debug: optionalBoolean(source, "debug", path),
    watcherIntervalMs: optionalInterval(source, "watcherIntervalMs", path),
    watcherIdleMs: optionalInterval(source, "watcherIdleMs", path),
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): PluginConfig {
  const file = readFileConfig(env)

  return {
    cmuxBin: env.COPILOT_CMUX_BIN?.trim() || "cmux",
    statusKey: env.COPILOT_CMUX_STATUS_KEY?.trim() || "copilot",
    transport: parseTransport(env.COPILOT_CMUX_TRANSPORT, "auto"),
    progressEnabled: parseBoolean(env.COPILOT_CMUX_PROGRESS, file.progressEnabled ?? true),
    keepDoneStatus: parseBoolean(env.COPILOT_CMUX_KEEP_DONE_STATUS, file.keepDoneStatus ?? true),
    logPrompts: parseBoolean(env.COPILOT_CMUX_LOG_PROMPTS, file.logPrompts ?? true),
    logToolCalls: parseBoolean(env.COPILOT_CMUX_LOG_TOOLS, file.logToolCalls ?? true),
    logSessionLifecycle: parseBoolean(
      env.COPILOT_CMUX_LOG_SESSION_LIFECYCLE,
      file.logSessionLifecycle ?? true,
    ),
    notifyOnSessionEnd: parseBoolean(
      env.COPILOT_CMUX_NOTIFY_SESSION_END,
      file.notifyOnSessionEnd ?? true,
    ),
    notifyOnErrors: parseBoolean(env.COPILOT_CMUX_NOTIFY_ERRORS, file.notifyOnErrors ?? true),
    logFileEdits: parseBoolean(env.COPILOT_CMUX_LOG_FILE_EDITS, file.logFileEdits ?? true),
    // Defaults to FALSE. See PluginConfig.publishRawText - the shipped
    // configuration must not be able to publish prompt or argument text.
    publishRawText: parseBoolean(env.COPILOT_CMUX_PUBLISH_RAW_TEXT, file.publishRawText ?? false),
    retainFinishedMs: parseRetention(
      env.MAESTRO_RETAIN_FINISHED,
      // `optionalRetention` has already rejected anything not in the table, so
      // a present key always resolves; the fallback satisfies the type checker
      // rather than covering a reachable case.
      file.retainFinished === undefined
        ? RETAIN_MS
        : (RETENTION_CHOICES[file.retainFinished] ?? RETAIN_MS),
    ),
    maxDepth: parseDepth(env.MAESTRO_MAX_DEPTH, file.maxDepth ?? MAX_WIRE_DEPTH),
    attentionOnTurn: parseBoolean(env.MAESTRO_ATTENTION_ON_TURN, file.attentionOnTurn ?? true),
    markUnreadOnAttention: parseBoolean(
      env.MAESTRO_MARK_UNREAD,
      file.markUnreadOnAttention ?? true,
    ),
    stallThresholdMs: parseInterval(
      env.MAESTRO_STALL_THRESHOLD_MS,
      file.stallThresholdMs ?? STALL_THRESHOLD_MS,
    ),
    stallBadge: parseBoolean(env.MAESTRO_STALL_BADGE, file.stallBadge ?? false),
    debug: parseBoolean(env.COPILOT_CMUX_DEBUG, file.debug ?? false),
    watcherEnabled: parseBoolean(env.MAESTRO_WATCHER, file.watcherEnabled ?? true),
    watcherIntervalMs: parseInterval(
      env.MAESTRO_WATCHER_INTERVAL_MS,
      file.watcherIntervalMs ?? 2_000,
    ),
    watcherIdleMs: parseInterval(env.MAESTRO_WATCHER_IDLE_MS, file.watcherIdleMs ?? 30 * 60_000),
  }
}
