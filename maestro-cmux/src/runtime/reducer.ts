import type { Attention, AttentionKind, RuntimeState } from "../types.js"
import type { CopilotHookEvent } from "./events.js"

export function createRuntimeState(
  cwd: string,
  workspaceID?: string,
  timestamp: number = Date.now(),
): RuntimeState {
  return {
    version: 1,
    cwd,
    workspaceID,
    updatedAt: timestamp,
    startedAt: undefined,
    source: undefined,
    phase: "idle",
    lastPrompt: undefined,
    toolInvocations: 0,
    completedTools: 0,
    lastToolName: undefined,
    lastToolSummary: undefined,
    lastResultType: undefined,
    filesEdited: 0,
    lastEditedFile: undefined,
    lastError: undefined,
    lastSessionEndReason: undefined,
    attention: undefined,
    surfaceID: undefined,
    sessionId: undefined,
    transcriptPath: undefined,
    dismissed: [],
  }
}

/**
 * Map a Copilot `notificationType` onto an attention kind.
 *
 * Measured values, one session: `permission_prompt` (135), `agent_idle` (7),
 * `elicitation_dialog` (2), `shell_completed` (1),
 * `shell_detached_completed` (1).
 *
 * Only the two that BLOCK the session are attention. `agent_idle` is a
 * subagent going quiet, which the tree already shows, and the two `shell_*`
 * values are completions the operator did not ask to be told about. An
 * unrecognised value returns undefined and is ignored rather than guessed at.
 */
export function attentionKindForNotification(notificationType: string): AttentionKind | undefined {
  if (notificationType === "permission_prompt") return "permission"
  if (notificationType === "elicitation_dialog") return "question"
  return undefined
}

/**
 * The label for the tool the session most recently touched.
 *
 * Maestro no longer registers `preToolUse`, so there is no in-flight tool to
 * count: `postToolUse` reports a tool that has already finished. The status
 * pill therefore names the LAST tool rather than the CURRENT one, which lags
 * reality by one tool's latency and is the price of not holding veto authority
 * over tool execution.
 */
export function describeCurrentTool(state: RuntimeState): string | undefined {
  return state.lastToolSummary ?? state.lastToolName
}

export function reduceRuntimeState(
  currentState: RuntimeState,
  event: CopilotHookEvent,
  workspaceID?: string,
): RuntimeState {
  switch (event.type) {
    case "session.start": {
      return {
        version: 1,
        cwd: event.cwd,
        workspaceID,
        updatedAt: event.timestamp,
        startedAt: event.timestamp,
        source: event.source,
        phase: event.initialPrompt ? "thinking" : "idle",
        lastPrompt: event.initialPrompt,
        toolInvocations: 0,
        completedTools: 0,
        lastToolName: undefined,
        lastToolSummary: undefined,
        lastResultType: undefined,
        filesEdited: 0,
        lastEditedFile: undefined,
        lastError: undefined,
        lastSessionEndReason: undefined,
        attention: undefined,
        surfaceID: currentState.surfaceID,
        sessionId: currentState.sessionId,
        transcriptPath: currentState.transcriptPath,
        dismissed: [],
      }
    }

    case "user.prompt": {
      return {
        ...currentState,
        cwd: event.cwd,
        workspaceID,
        updatedAt: event.timestamp,
        startedAt: currentState.startedAt ?? event.timestamp,
        phase: "thinking",
        lastPrompt: event.prompt,
        lastSessionEndReason: undefined,
        lastError: undefined,
        attention: undefined,
      }
    }

    case "tool.post": {
      const isFileEdit =
        (event.toolName === "edit" || event.toolName === "create") && event.resultType === "success"
      const filePath =
        typeof event.parsedToolArgs?.path === "string" ? event.parsedToolArgs.path : undefined
      return {
        ...currentState,
        cwd: event.cwd,
        workspaceID,
        updatedAt: event.timestamp,
        startedAt: currentState.startedAt ?? event.timestamp,
        // A finished tool means the turn is still in progress: Copilot runs
        // tools mid-turn and reports the end of the turn through `agentStop`,
        // which is what returns the session to idle. Without `preToolUse` this
        // is the only per-tool evidence Maestro receives, so it has to carry
        // the "working" signal that the start hook used to carry.
        phase: "working",
        toolInvocations: currentState.toolInvocations + 1,
        completedTools: currentState.completedTools + 1,
        lastToolName: event.toolName,
        lastToolSummary: event.summary,
        lastResultType: event.resultType,
        filesEdited: isFileEdit ? currentState.filesEdited + 1 : currentState.filesEdited,
        lastEditedFile: isFileEdit && filePath ? filePath : currentState.lastEditedFile,
        attention: undefined,
      }
    }

    case "session.end": {
      return {
        ...currentState,
        cwd: event.cwd,
        workspaceID,
        updatedAt: event.timestamp,
        phase: event.reason === "complete" ? "done" : event.reason === "error" ? "error" : "idle",
        lastSessionEndReason: event.reason,
        attention: undefined,
      }
    }

    case "error.occurred": {
      return {
        ...currentState,
        cwd: event.cwd,
        workspaceID,
        updatedAt: event.timestamp,
        phase: "error",
        lastError: {
          message: event.error.message,
          name: event.error.name,
        },
      }
    }

    case "notification": {
      const kind = attentionKindForNotification(event.notificationType)
      if (!kind) return { ...currentState, cwd: event.cwd, workspaceID }
      const attention: Attention = {
        kind,
        // The hook's own `title` is a safe, already-human label ("Permission
        // needed", "Information requested"). `message` is NOT - for a
        // permission prompt it is the full command line.
        label: event.title ?? (kind === "permission" ? "Permission needed" : "Question"),
        since: event.timestamp,
      }
      return {
        ...currentState,
        cwd: event.cwd,
        workspaceID,
        updatedAt: event.timestamp,
        attention,
      }
    }

    case "agent.stop": {
      // Do not let a finished turn overwrite a live blocking prompt. agentStop
      // and notification can both be outstanding, and `permission`/`question`
      // outrank `turn` because only they cost anything by being missed.
      if (currentState.attention && currentState.attention.kind !== "turn") {
        return { ...currentState, cwd: event.cwd, workspaceID, updatedAt: event.timestamp }
      }
      return {
        ...currentState,
        cwd: event.cwd,
        workspaceID,
        updatedAt: event.timestamp,
        phase: "idle",
        attention: { kind: "turn", label: "Your turn", since: event.timestamp },
      }
    }
  }
}
