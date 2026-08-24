import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { PluginConfig, TransportMode } from "./types.js"

const TRUE_VALUES = new Set(["1", "true", "yes", "on"])
const FALSE_VALUES = new Set(["0", "false", "no", "off"])

interface MaestroFileConfig {
  progressEnabled: boolean | undefined
  keepDoneStatus: boolean | undefined
  notifyOnSessionEnd: boolean | undefined
  notifyOnErrors: boolean | undefined
  watcherEnabled: boolean | undefined
  publishRawText: boolean | undefined
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

function readFileConfig(env: NodeJS.ProcessEnv): MaestroFileConfig {
  const path = configPath(env)
  let raw: string
  try {
    raw = readFileSync(path, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        progressEnabled: undefined,
        keepDoneStatus: undefined,
        notifyOnSessionEnd: undefined,
        notifyOnErrors: undefined,
        watcherEnabled: undefined,
        publishRawText: undefined,
      }
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
    logPrompts: parseBoolean(env.COPILOT_CMUX_LOG_PROMPTS, true),
    logToolCalls: parseBoolean(env.COPILOT_CMUX_LOG_TOOLS, true),
    logSessionLifecycle: parseBoolean(env.COPILOT_CMUX_LOG_SESSION_LIFECYCLE, true),
    notifyOnSessionEnd: parseBoolean(
      env.COPILOT_CMUX_NOTIFY_SESSION_END,
      file.notifyOnSessionEnd ?? true,
    ),
    notifyOnErrors: parseBoolean(env.COPILOT_CMUX_NOTIFY_ERRORS, file.notifyOnErrors ?? true),
    logFileEdits: parseBoolean(env.COPILOT_CMUX_LOG_FILE_EDITS, true),
    // Defaults to FALSE. See PluginConfig.publishRawText - the shipped
    // configuration must not be able to publish prompt or argument text.
    publishRawText: parseBoolean(env.COPILOT_CMUX_PUBLISH_RAW_TEXT, file.publishRawText ?? false),
    debug: parseBoolean(env.COPILOT_CMUX_DEBUG, false),
    watcherEnabled: parseBoolean(env.MAESTRO_WATCHER, file.watcherEnabled ?? true),
    watcherIntervalMs: parseInterval(env.MAESTRO_WATCHER_INTERVAL_MS, 2_000),
    watcherIdleMs: parseInterval(env.MAESTRO_WATCHER_IDLE_MS, 30 * 60_000),
  }
}
