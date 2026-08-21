/**
 * The three-column Fleet-scoped interface.
 *
 * One rule governs the layout: **selection is global and every panel is scoped to
 * it.** Selecting a Fleet re-scopes the rail, the primary agent window, and every
 * inspector panel together. There is no per-panel selection, because a panel
 * showing one Fleet while another panel shows a different one is precisely the
 * confusion this product exists to remove.
 *
 * `data-fleet-scope` attributes are on every panel deliberately: they are what
 * the Acceptance Harness's Presentation Check reads to assert re-scoping from
 * outside, without the application having to report its own success.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppState, CloseSummary, FleetView, SubagentView } from '../shared/contract.ts';

declare global {
  interface Window {
    maestro: {
      getState(): Promise<AppState>;
      createFleet(name: string): Promise<AppState>;
      selectFleet(name: string): Promise<AppState>;
      promptFleet(name: string, prompt: string): Promise<AppState>;
      requestClose(): Promise<CloseSummary>;
      confirmClose(): Promise<void>;
      cancelClose(): Promise<void>;
      onState(listener: (state: AppState) => void): () => void;
      onCloseRequested(listener: () => void): () => void;
    };
  }
}

function SubagentTree({ nodes }: { readonly nodes: readonly SubagentView[] }) {
  if (nodes.length === 0) {
    return <p className="empty">No subagents yet.</p>;
  }
  return (
    <ul className="tree">
      {nodes.map((node) => (
        <li key={node.agentId}>
          <span className={`agent ${node.status}`}>
            <span className="dot" aria-hidden="true" />
            {node.agentName}
            <span className="agent-id">{node.agentId.slice(0, 8)}</span>
          </span>
          {node.children.length > 0 ? <SubagentTree nodes={node.children} /> : null}
        </li>
      ))}
    </ul>
  );
}

function FleetRail({
  fleets,
  selected,
  onSelect,
  onCreate,
}: {
  readonly fleets: readonly FleetView[];
  readonly selected: string | null;
  readonly onSelect: (name: string) => void;
  readonly onCreate: (name: string) => void;
}) {
  const [draft, setDraft] = useState('');

  return (
    <aside className="rail" data-testid="fleet-rail">
      <header>
        <h1>Fleets</h1>
      </header>
      <ul>
        {fleets.map((fleet) => (
          <li key={fleet.name}>
            <button
              type="button"
              data-testid={`fleet-${fleet.name}`}
              className={fleet.name === selected ? 'fleet selected' : 'fleet'}
              aria-current={fleet.name === selected}
              onClick={() => onSelect(fleet.name)}
            >
              <span className="fleet-name">{fleet.name}</span>
              <span className={`badge ${fleet.intent.toLowerCase()}`}>{fleet.intent}</span>
              <span className={`badge liveness-${fleet.liveness.toLowerCase()}`}>
                {fleet.liveness}
              </span>
              {/* Attention is this Fleet's own evidence, never another's. */}
              {fleet.attention ? (
                <span className="badge attention" data-testid={`attention-${fleet.name}`}>
                  Attention
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="create"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim() === '') return;
          onCreate(draft.trim());
          setDraft('');
        }}
      >
        <input
          value={draft}
          data-testid="new-fleet-name"
          placeholder="new-fleet"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" data-testid="create-fleet">
          Create
        </button>
      </form>
    </aside>
  );
}

function CloseDialog({
  summary,
  onConfirm,
  onCancel,
}: {
  readonly summary: CloseSummary;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <div className="scrim" role="dialog" aria-modal="true" data-testid="close-summary">
      <div className="dialog">
        <h2>Before Maestro closes</h2>
        <p>
          {summary.willPark} Fleet{summary.willPark === 1 ? '' : 's'} will be Parked. Durable state
          is kept; every process is stopped.
        </p>
        <ul>
          {summary.fleets.map((fleet) => (
            <li key={fleet.name}>
              <strong>{fleet.name}</strong> — {fleet.intent}
              {fleet.subagentCount > 0 ? `, ${fleet.subagentCount} subagent(s)` : ''}
              {fleet.attention ? ' — wants your attention' : ''}
            </li>
          ))}
        </ul>
        <div className="actions">
          <button type="button" onClick={onCancel} data-testid="close-cancel">
            Keep working
          </button>
          <button type="button" className="primary" onClick={onConfirm} data-testid="close-confirm">
            Park all and quit
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [summary, setSummary] = useState<CloseSummary | null>(null);
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    void window.maestro.getState().then(setState);
    const offState = window.maestro.onState(setState);
    const offClose = window.maestro.onCloseRequested(() => {
      void window.maestro.requestClose().then(setSummary);
    });
    return () => {
      offState();
      offClose();
    };
  }, []);

  const selected = useMemo<FleetView | null>(() => {
    if (state === null || state.selectedFleet === null) return null;
    return state.fleets.find((f) => f.name === state.selectedFleet) ?? null;
  }, [state]);

  const select = useCallback((name: string) => {
    void window.maestro.selectFleet(name).then(setState);
  }, []);

  const create = useCallback((name: string) => {
    void window.maestro.createFleet(name).then(setState);
  }, []);

  if (state === null) return <div className="loading">Starting Maestro…</div>;

  // Every panel derives its scope from this one value, so re-scoping is
  // structurally impossible to get partially right.
  const scope = selected?.name ?? '';

  return (
    <div className="app">
      <FleetRail
        fleets={state.fleets}
        selected={state.selectedFleet}
        onSelect={select}
        onCreate={create}
      />

      <main className="primary" data-testid="primary-agent-window" data-fleet-scope={scope}>
        <header>
          <h2>{selected === null ? 'No Fleet selected' : selected.name}</h2>
          {selected !== null ? (
            <span className="subtitle">
              {selected.branch} · session {selected.sessionId.slice(0, 8)} · {selected.eventCount}{' '}
              events
            </span>
          ) : null}
        </header>

        {selected === null ? (
          <p className="empty">Create or select a Fleet to see its primary agent window.</p>
        ) : (
          <>
            {selected.attention ? (
              <div className="attention-banner" data-testid="attention-banner">
                This Fleet is waiting on you: {selected.pendingPermissions.length} unanswered
                permission request(s).
              </div>
            ) : null}
            <form
              className="prompt"
              onSubmit={(event) => {
                event.preventDefault();
                if (prompt.trim() === '') return;
                void window.maestro.promptFleet(selected.name, prompt.trim()).then(setState);
                setPrompt('');
              }}
            >
              <input
                value={prompt}
                data-testid="prompt-input"
                placeholder={`Prompt ${selected.name}…`}
                onChange={(event) => setPrompt(event.target.value)}
              />
              <button type="submit" data-testid="prompt-send">
                Send
              </button>
            </form>
          </>
        )}
      </main>

      <aside className="inspector">
        <section data-testid="panel-subagents" data-fleet-scope={scope}>
          <h3>Subagents</h3>
          {selected === null ? (
            <p className="empty">—</p>
          ) : (
            <SubagentTree nodes={selected.subagents} />
          )}
        </section>

        <section data-testid="panel-worktree" data-fleet-scope={scope}>
          <h3>Worktree</h3>
          {selected === null ? (
            <p className="empty">—</p>
          ) : (
            <dl>
              <dt>Path</dt>
              <dd className="mono">{selected.worktreePath}</dd>
              <dt>Branch</dt>
              <dd className="mono">{selected.branch}</dd>
            </dl>
          )}
        </section>

        <section data-testid="panel-activity" data-fleet-scope={scope}>
          <h3>Activity</h3>
          {selected === null ? (
            <p className="empty">—</p>
          ) : (
            <dl>
              <dt>Intent</dt>
              <dd>{selected.intent}</dd>
              <dt>Liveness</dt>
              <dd>{selected.liveness}</dd>
              <dt>Last event</dt>
              <dd className="mono">{selected.lastEventAt ?? '—'}</dd>
            </dl>
          )}
        </section>

        <section className="notices">
          <h3>Notices</h3>
          <p className="mono small">
            SDK {state.sdkVersion} {state.sdkStarted ? '(running)' : '(not running)'}
          </p>
          {state.notices.length === 0 ? (
            <p className="empty">Nothing to report.</p>
          ) : (
            <ul>
              {state.notices.map((notice, index) => (
                <li key={index}>{notice}</li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      {summary !== null ? (
        <CloseDialog
          summary={summary}
          onConfirm={() => {
            setSummary(null);
            void window.maestro.confirmClose();
          }}
          onCancel={() => {
            setSummary(null);
            void window.maestro.cancelClose();
          }}
        />
      ) : null}
    </div>
  );
}
