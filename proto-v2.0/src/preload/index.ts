/**
 * The preload bridge.
 *
 * The renderer has no Node integration and no direct access to anything. This
 * file exposes a fixed, named surface over `contextBridge` - every entry a
 * request the main process may refuse - and nothing else crosses.
 */

import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS, type AppState, type CloseSummary } from '../shared/contract.ts';

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke(CHANNELS.getState),
  createFleet: (name: string): Promise<AppState> =>
    ipcRenderer.invoke(CHANNELS.createFleet, name),
  selectFleet: (name: string): Promise<AppState> =>
    ipcRenderer.invoke(CHANNELS.selectFleet, name),
  promptFleet: (name: string, prompt: string): Promise<AppState> =>
    ipcRenderer.invoke(CHANNELS.promptFleet, name, prompt),
  requestClose: (): Promise<CloseSummary> => ipcRenderer.invoke(CHANNELS.requestClose),
  confirmClose: (): Promise<void> => ipcRenderer.invoke(CHANNELS.confirmClose),
  cancelClose: (): Promise<void> => ipcRenderer.invoke(CHANNELS.cancelClose),

  onState: (listener: (state: AppState) => void): (() => void) => {
    const handler = (_event: unknown, state: AppState): void => listener(state);
    ipcRenderer.on(CHANNELS.stateChanged, handler);
    return () => ipcRenderer.removeListener(CHANNELS.stateChanged, handler);
  },

  /** Main asks the renderer to present the pre-close summary. */
  onCloseRequested: (listener: () => void): (() => void) => {
    const handler = (): void => listener();
    ipcRenderer.on(CHANNELS.requestClose, handler);
    return () => ipcRenderer.removeListener(CHANNELS.requestClose, handler);
  },
};

contextBridge.exposeInMainWorld('maestro', api);

export type PreloadApi = typeof api;
