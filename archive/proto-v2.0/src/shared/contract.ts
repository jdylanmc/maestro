/**
 * The contract between the main process and the renderer.
 *
 * Authority lives in main; the renderer gets a narrow, preload-mediated API and
 * no Node integration. Every type here crosses that boundary, so it is
 * deliberately plain data - no handles, no functions, nothing the renderer could
 * use to reach past the bridge.
 */

export type FleetIntent = 'Running' | 'Parked' | 'Interrupted';

/**
 * Observed process evidence, recomputed every launch and never persisted.
 *
 * `Ambiguous` is a real answer, not a placeholder: a recorded process group whose
 * id may have been recycled by the OS cannot honestly be called alive or dead.
 */
export type Liveness = 'Alive' | 'Dead' | 'Ambiguous';

export interface SubagentView {
  readonly agentId: string;
  readonly agentName: string;
  readonly status: 'running' | 'completed' | 'failed';
  readonly children: readonly SubagentView[];
}

export interface FleetView {
  readonly name: string;
  readonly sessionId: string;
  readonly worktreePath: string;
  readonly branch: string;
  readonly intent: FleetIntent;
  readonly liveness: Liveness;
  /** True when this Fleet wants its human. Always this Fleet's own evidence. */
  readonly attention: boolean;
  readonly pendingPermissions: readonly string[];
  readonly subagents: readonly SubagentView[];
  readonly eventCount: number;
  readonly createdAt: string;
  readonly lastEventAt?: string;
}

export interface AppState {
  readonly repoRoot: string;
  readonly fleets: readonly FleetView[];
  readonly selectedFleet: string | null;
  readonly sdkVersion: string;
  readonly sdkStarted: boolean;
  readonly notices: readonly string[];
}

/** What the pre-close summary presents, and what quitting is blocked on. */
export interface CloseSummary {
  readonly fleets: readonly {
    readonly name: string;
    readonly intent: FleetIntent;
    readonly attention: boolean;
    readonly subagentCount: number;
  }[];
  readonly willPark: number;
}

export interface MaestroApi {
  getState(): Promise<AppState>;
  createFleet(name: string): Promise<AppState>;
  selectFleet(name: string): Promise<AppState>;
  promptFleet(name: string, prompt: string): Promise<AppState>;
  requestClose(): Promise<CloseSummary>;
  confirmClose(): Promise<void>;
  cancelClose(): Promise<void>;
  onState(listener: (state: AppState) => void): () => void;
}

export const CHANNELS = {
  getState: 'maestro:getState',
  createFleet: 'maestro:createFleet',
  selectFleet: 'maestro:selectFleet',
  promptFleet: 'maestro:promptFleet',
  requestClose: 'maestro:requestClose',
  confirmClose: 'maestro:confirmClose',
  cancelClose: 'maestro:cancelClose',
  stateChanged: 'maestro:stateChanged',
} as const;
