# proto-v2.0 - the Electron route

The first of four candidate stacks driven to a working Maestro MVP. See
[EXECUTIVE-REPORT.md](./EXECUTIVE-REPORT.md) for the verdict and the measurements.

## Run it

```sh
npm install
npm start                       # dev run
npm run package                 # unsigned, fuse-configured Maestro.app in dist/
MAESTRO_REPO=/path/to/repo npm start
```

Environment inputs (inputs only - nothing the route reports travels through them):

| Variable | Purpose |
| --- | --- |
| `MAESTRO_REPO` | The git repository Fleets are created in |
| `MAESTRO_USER_DATA` | Overrides `userData`, so an acceptance run does not touch real Fleets |
| `MAESTRO_FORCE_ASK` | Acceptance scaffolding: asks permission for shell tools so Attention can be observed |

## Judge it

The route is judged by the shared harness at [`../harness`](../harness), never by itself:

```sh
cd ../harness
node --experimental-strip-types src/routes/run-electron.ts \
  --app ../proto-v2.0/dist/Maestro-darwin-arm64/Maestro.app/Contents/MacOS/Maestro \
  --repo /tmp/some-git-repo
```

## Shape

- `src/main` - all authority: git worktrees, process groups, durable state, the Copilot seam
- `src/preload` - the only bridge; the renderer has no Node integration
- `src/renderer` - three columns, one global Fleet selection that re-scopes every panel
- `src/shared/contract.ts` - the plain-data contract across that bridge

Durable state lives in `app.getPath('userData')`, deliberately outside every worktree.
Liveness is **never** persisted - it is recomputed each launch from `ps`, because persisting
it is how v1.0 came to believe dead Sessions were alive for two days.

## Things that will bite the next route

Recorded here because each one cost real time and none is documented upstream:

1. `CopilotClient` lives in `copilot-sdk/`, which the platform package does **not** export.
   The exported `./sdk` is a different SDK with no `CopilotClient` on it.
2. That module is ESM. In a CommonJS bundle a literal `import()` becomes `require()` and
   fails, so it must be hidden behind `new Function`.
3. The `RunAsNode` fuse **must stay enabled**. With it off, the SDK's runtime spawn launches
   another copy of the app, recursively - 952 processes before a watchdog stopped it.
4. Electron's `ELECTRON_*` variables make the runtime child exit with status 0. Pin
   `connection.path` and hand it a sanitised environment.
5. `import.meta.url` becomes `undefined` in an esbuild CommonJS bundle, so
   `fileURLToPath(import.meta.url)` throws at load - the app starts, logs nothing, and never
   opens a window. Use `__dirname`.
