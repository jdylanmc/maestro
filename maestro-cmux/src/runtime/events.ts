import { basename } from "node:path"
import { summarizeText } from "../text.js"
import type {
  AgentStopHookInput,
  ErrorOccurredHookInput,
  HookName,
  NotificationHookInput,
  PostToolUseHookInput,
  SessionEndHookInput,
  SessionEndReason,
  SessionStartHookInput,
  SessionStartSource,
  ToolResult,
  ToolResultType,
  UserPromptSubmittedHookInput,
} from "../types.js"

export type CopilotHookEvent =
  | ({ type: "session.start" } & SessionStartHookInput)
  | ({ type: "session.end" } & SessionEndHookInput)
  | ({ type: "user.prompt" } & UserPromptSubmittedHookInput)
  | ({
      type: "tool.post"
      summary: string
      parsedToolArgs: Record<string, unknown> | undefined
      resultType: ToolResultType
      resultText: string | undefined
    } & Omit<PostToolUseHookInput, "toolArgs" | "toolResult">)
  | ({ type: "error.occurred" } & ErrorOccurredHookInput)
  | ({ type: "notification" } & NotificationHookInput)
  | ({ type: "agent.stop" } & AgentStopHookInput)

function expectObject(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be a JSON object`)
  }

  return value as Record<string, unknown>
}

function expectString(object: Record<string, unknown>, key: string, context: string): string {
  const value = object[key]
  if (typeof value !== "string") {
    const presentKeys = Object.keys(object).join(", ")
    throw new Error(`${context}.${key} must be a string (present keys: ${presentKeys})`)
  }
  return value
}

function optionalString(object: Record<string, unknown>, key: string): string | undefined {
  const value = object[key]
  return typeof value === "string" ? value : undefined
}

function expectNumber(object: Record<string, unknown>, key: string, context: string): number {
  const value = object[key]
  if (typeof value !== "number" || !Number.isFinite(value)) {
    const presentKeys = Object.keys(object).join(", ")
    throw new Error(`${context}.${key} must be a finite number (present keys: ${presentKeys})`)
  }
  return value
}

function parseJsonObjectString(raw: string): Record<string, unknown> | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return undefined
  }

  return undefined
}

function parseSessionStartSource(value: string): SessionStartSource {
  if (value === "new" || value === "resume" || value === "startup") {
    return value
  }
  throw new Error(`Unsupported session start source: ${value}`)
}

function parseSessionEndReason(value: string): SessionEndReason {
  if (
    value === "complete" ||
    value === "error" ||
    value === "abort" ||
    value === "timeout" ||
    value === "user_exit"
  ) {
    return value
  }
  throw new Error(`Unsupported session end reason: ${value}`)
}

function parseToolResult(value: unknown): ToolResult | undefined {
  if (value === undefined) return undefined

  const object = expectObject(value, "toolResult")
  const resultType = object.resultType
  if (resultType !== "success" && resultType !== "failure" && resultType !== "denied") {
    throw new Error("toolResult.resultType must be success, failure, or denied")
  }

  return {
    resultType,
    textResultForLlm: optionalString(object, "textResultForLlm"),
  }
}

/**
 * A short label for a tool call.
 *
 * `publishRawText` is the privacy boundary (#52), and it defaults to FALSE on
 * purpose: this summary is published to cmux as a status pill and a sidebar
 * log line, and both the `description` argument and a file path are text the
 * operator never agreed to put on a screen that may be screenshotted. With the
 * default the tool NAME is the whole label, which is the identifier the runtime
 * chose itself. The richer label is available behind an explicit opt-in.
 */
export function describeToolCall(
  toolName: string,
  parsedToolArgs?: Record<string, unknown>,
  publishRawText: boolean = false,
): string {
  if (!publishRawText) return toolName

  const description =
    typeof parsedToolArgs?.description === "string"
      ? summarizeText(parsedToolArgs.description, 48)
      : undefined
  if (description) {
    return `${toolName}: ${description}`
  }

  const path = typeof parsedToolArgs?.path === "string" ? parsedToolArgs.path : undefined
  if (path) {
    return `${toolName} ${basename(path)}`
  }

  return toolName
}

/**
 * Session identity, as the runtime supplies it.
 *
 * EVERY hook payload carries `sessionId`, and `agentStop` additionally carries
 * `transcriptPath`. Maestro previously discarded both and guessed the session
 * from `cwd` plus newest mtime, which is wrong whenever a `workspace.yaml`
 * records a cwd that is not the Session's actual cwd - measured live, one
 * Session recorded `/Users/dylan/git/atlas`, a path that does not exist, while
 * its hook reported the real repository path. The guess then bound a stale
 * Session with zero subagents and published nothing.
 *
 * `agentStop.sessionId` is NOT the session-state directory name, so
 * `transcriptPath` outranks it when present.
 */
export interface SessionIdentity {
  sessionId: string | undefined
  transcriptPath: string | undefined
}

export function parseSessionIdentity(rawInput: string): SessionIdentity {
  try {
    const o = JSON.parse(rawInput || "{}") as Record<string, unknown>
    return {
      sessionId: typeof o.sessionId === "string" ? o.sessionId : undefined,
      transcriptPath: typeof o.transcriptPath === "string" ? o.transcriptPath : undefined,
    }
  } catch {
    return { sessionId: undefined, transcriptPath: undefined }
  }
}

export function parseHookInput(
  hookName: HookName,
  rawInput: string,
  publishRawText: boolean = false,
): CopilotHookEvent {
  const context = `${hookName} input`

  let raw: unknown
  try {
    raw = JSON.parse(rawInput || "{}")
  } catch (cause) {
    const preview = rawInput.length > 120 ? `${rawInput.slice(0, 120)}…` : rawInput
    throw new Error(
      `Failed to parse ${hookName} input as JSON: ${cause instanceof Error ? cause.message : String(cause)}. Received: ${preview}`,
    )
  }
  const parsed = expectObject(raw, context)

  switch (hookName) {
    case "sessionStart": {
      return {
        type: "session.start",
        timestamp: expectNumber(parsed, "timestamp", context),
        cwd: expectString(parsed, "cwd", context),
        source: parseSessionStartSource(expectString(parsed, "source", context)),
        initialPrompt: optionalString(parsed, "initialPrompt"),
      }
    }

    case "sessionEnd": {
      return {
        type: "session.end",
        timestamp: expectNumber(parsed, "timestamp", context),
        cwd: expectString(parsed, "cwd", context),
        reason: parseSessionEndReason(expectString(parsed, "reason", context)),
      }
    }

    case "userPromptSubmitted": {
      return {
        type: "user.prompt",
        timestamp: expectNumber(parsed, "timestamp", context),
        cwd: expectString(parsed, "cwd", context),
        prompt: expectString(parsed, "prompt", context),
      }
    }

    case "postToolUse": {
      const toolName = expectString(parsed, "toolName", context)
      const toolArgs = expectString(parsed, "toolArgs", context)
      const parsedToolArgs = parseJsonObjectString(toolArgs)
      const toolResult = parseToolResult(parsed.toolResult)

      return {
        type: "tool.post",
        timestamp: expectNumber(parsed, "timestamp", context),
        cwd: expectString(parsed, "cwd", context),
        toolName,
        parsedToolArgs,
        summary: describeToolCall(toolName, parsedToolArgs, publishRawText),
        resultType: toolResult?.resultType ?? "success",
        resultText: toolResult?.textResultForLlm,
      }
    }

    case "errorOccurred": {
      const error = expectObject(parsed.error, `${context}.error`)
      return {
        type: "error.occurred",
        timestamp: expectNumber(parsed, "timestamp", context),
        cwd: expectString(parsed, "cwd", context),
        error: {
          message: expectString(error, "message", `${context}.error`),
          name: optionalString(error, "name"),
          stack: optionalString(error, "stack"),
        },
      }
    }

    case "notification": {
      // `title` is optional on purpose. An unrecognised notificationType must
      // degrade to "no attention", never to a thrown error - this hook shares a
      // runner with every other hook, and a throw here is a diagnostic, not a
      // denial, only because the runner forces exit 0.
      return {
        type: "notification",
        timestamp: expectNumber(parsed, "timestamp", context),
        cwd: expectString(parsed, "cwd", context),
        notificationType: expectString(parsed, "notificationType", context),
        title: optionalString(parsed, "title"),
      }
    }

    case "agentStop": {
      return {
        type: "agent.stop",
        timestamp: expectNumber(parsed, "timestamp", context),
        cwd: expectString(parsed, "cwd", context),
        stopReason: optionalString(parsed, "stopReason"),
      }
    }

    // A hook name this plugin does not handle - `preToolUse` above all, which
    // is deliberately not registered. Throwing here is safe precisely because
    // the runner forces exit 0 and writes nothing: an unknown hook becomes a
    // no-op with a diagnostic, never a denied tool call.
    default:
      throw new Error(`Unsupported hook: ${String(hookName)}`)
  }
}
