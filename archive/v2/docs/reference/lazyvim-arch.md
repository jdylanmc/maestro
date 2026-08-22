# LazyVim - Architecture Reference

**Evidence:** `LazyVim/LazyVim@459a4c3b1059671e766a46c7cc223827dc67e3d0` (2026-06-02). Version `16.0.0`, state schema `8`. Companion repositories `LazyVim/starter` and `folke/lazy.nvim` were read unpinned.

Tags: **[V]** verified · **[I]** interpreted · **[U]** unknown.

## Scope and Orientation

Repository-depth map of units, boundaries, entry points, ownership, flows, extension seams, substitutability, constraints, and tests.

Neovim internals and lazy.nvim internals beyond LazyVim's called or patched surfaces are excluded.

LazyVim is neither an application nor a Neovim fork. It is a Lua library plus curated lazy.nvim plugin specifications loaded into an existing Neovim process.

Its root `init.lua` prints "Do not use this repository directly" and exits. The actual entry is a plugin specification:

```lua
{ "LazyVim/LazyVim", import = "lazyvim.plugins" }
```

Neovim 0.11.2 or later is enforced during specification evaluation.

## Observed Vocabulary

- **spec:** lazy.nvim plugin table.
- **extra:** optional module under `plugins/extras/**`.
- **default:** selected member of the picker, completion, or explorer group.
- **managed:** toggleable through `:LazyExtras`.
- **recommended:** boolean or context-sensitive recommendation.
- **LazyFile:** LazyVim event combining buffer read, creation, and pre-write.
- **VeryLazy:** lazy.nvim post-startup event.
- **`User LazyVim<Name>[Defaults]`:** domain configuration hooks.
- **root/root_spec/detector:** project-root strategies.
- **LazyFormatter:** formatter registration contract.
- **LazyPicker:** picker registration contract.
- **LazyKeysLspSpec:** Language Server Protocol keymap with method gate.
- **`lazyvim.json`:** LazyVim-owned state.
- **`_G.LazyVim`:** service facade.
- **`Snacks`:** foundational utility/plugin integration surface.
- **safe keymap:** mapping that defers to lazy handlers.
- **`set_default`:** non-destructive option defaulting.

## Architecture at a Glance

```text
User config
  init.lua -> config/lazy.lua -> lazy.setup(spec)
       |
       v
lazy.nvim
  patched Spec.import, Meta.add, Event.mappings, package loader
       |
       v
LazyVim
  plugins/init.lua -> config/** -> core/extras specs -> util/**
       |                                      |
       +--------------> _G.LazyVim            +-- lazyvim.json
       v
snacks.nvim -> _G.Snacks
       v
Neovim/LuaJIT -> LSP, Tree-sitter, diagnostics, filesystem
```

External processes include Git, Mason, language servers, formatters, linters, the Tree-sitter compiler, search/fuzzy-finder tools, and lazygit.

## Runnable Units and Process Boundaries

Only the user configuration, normally derived from `LazyVim/starter`, is runnable. The LazyVim repository itself refuses direct use.

A second runnable unit is the headless test invocation:

```text
nvim -l tests/minit.lua --minitest
```

LazyVim, lazy.nvim, snacks.nvim, user configuration, and Neovim execute in one operating-system process. There is no LazyVim daemon, socket, or remote-procedure-call boundary.

LazyVim crosses rather than merely consumes the plugin-manager boundary: `LazyVim.plugin.setup()` patches four lazy.nvim internals using a compact veto wrapper.

## Modules and Responsibilities

| Module | Owns | Called by | Calls |
|---|---|---|---|
| `plugins/init.lua` | Version gate, configuration initialization, three eager specs | lazy.nvim | `lazyvim.config` |
| `config/init.lua` | Initialization phases, options, defaults, JSON state | Entry, extras, utilities | lazy.nvim internals, health, utilities |
| Configuration modules | Options, globals, autocommands, keymaps | `config.load()` | Neovim and Snacks |
| `util/init.lua` | `_G.LazyVim` facade and common helpers | Most modules | lazy.nvim utilities, Snacks |
| `util/plugin.lua` | lazy.nvim patches, LazyFile, renames, deprecations | Initialization and extras | lazy.nvim private modules |
| `plugins/xtras.lua`, `util/extras.lua` | Extras selection, ordering, persistence, UI | lazy.nvim and setup | Defaults, JSON, lazy.nvim views |
| Format/picker/root utilities | Registries and arbitration | Config, LSP, keymaps, extras | Conform, Neovim LSP, Snacks |
| LSP modules | Server setup, Mason arbitration, method-aware keymaps | lazy.nvim | Neovim LSP, lazy handlers, Snacks |

Dependency direction is primarily:

```text
config/** -> util/** -> lazy.core / Snacks / vim
plugins/** -> util/**
plugins/** -> read-only config
```

There is generally no reverse `util/** -> plugins/**` dependency.

## Main Execution and Data Flow

### Import Order

lazy.nvim discovers modules and sorts them lexicographically:

```text
plugins/init -> coding -> colorscheme -> editor -> formatting -> linting
-> lsp -> treesitter -> ui -> util -> xtras
```

The extras directory has no root initializer, preventing roughly 130 optional modules from loading automatically **[I]**.

### Bootstrap

The entry specification checks Neovim's version, then `config.init()` adds LazyVim to runtime paths, installs deprecation shims, temporarily buffers notifications, loads options before plugin installation, snapshots indentation and folding options, temporarily clears clipboard behavior, patches lazy.nvim, and loads `lazyvim.json`.

### Deferred Initialization

The main LazyVim specification is eager and high priority. `config.setup()` decides whether autocommands load immediately or at `VeryLazy`.

At `VeryLazy`, LazyVim loads autocommands and keymaps, restores clipboard behavior, initializes formatting, news, and root detection, registers health and extras commands, and checks import ordering. Colorscheme loading falls back to `habamax`.

### Group Defaults

Picker, completion, and explorer defaults are data-driven. Selection precedence is:

```text
vim.g override -> first already-imported extra -> first positional default
```

Nonselected members are disabled and rejected by the patched specification importer. Older installation cohorts retain earlier defaults, so "the default" depends partly on installation history.

### Formatting

On `BufWritePre`, formatting checks buffer-local and global enablement, then resolves candidate formatters in priority order. A formatter is active when it has sources and no higher-priority primary formatter is already active. Conform is primary at priority 100; Language Server Protocol formatting is primary at priority 1. Conform therefore wins when applicable **[I]**.

### LSP Keymaps and Extras

Language Server Protocol keymaps are declarative data under wildcard server options. A `has` value becomes a `textDocument/*` capability filter, and Snacks owns attachment lifecycle.

`:LazyExtras` discovers both built-in and user extras, parses modules twice to distinguish direct from inherited plugins, and writes toggles to `lazyvim.json`. Restart is required because extras resolve during specification import.

## Callers, Consumers, Integrations, and Persistence

Inbound callers are lazy.nvim, Neovim events and expression bridges, user configuration, optional extras, and tests.

Outbound dependencies include lazy.nvim core and view modules, Snacks namespaces, Neovim LSP/Tree-sitter/diagnostics/snippets/filesystem, conform, nvim-lint, Mason, nvim-treesitter, which-key, trouble, noice, lualine, and mini modules.

LazyVim writes exactly one file: `lazyvim.json`, normally under the Neovim configuration directory. Its schema contains state version, installation version, news state, and enabled extras. A deterministic encoder sorts keys for stable dotfile diffs. Migrations cover schema versions zero through seven. The file contains module names, versions, and size hashes, not credentials.

Externally owned persistence includes `lazy-lock.json`, lazy.nvim's data directory, Mason installations, undo files, and sessions.

## Distinctive Mechanisms

- Configuration is composed as specification modules discovered from the filesystem.
- Module order is lexical rather than manifest-driven.
- LazyVim patches the plugin manager during bootstrap.
- Extras use nonrecursive single-module imports.
- LazyFile extends lazy.nvim's event vocabulary.
- Initialization is split between bootstrap and deferred setup.
- Every configuration domain has paired user hooks.
- `set_default` avoids overriding options changed outside the standard runtime.
- Safe keymaps defer to lazy handlers.
- Deprecation is runtime infrastructure.
- Versioned state preserves installation cohorts.
- Introspection commands are first-class product surfaces.

## Extension Seams

Open seams include user plugin specifications, `lua/config/*`, LazyVim user events, global flags and options, user extras, formatter/picker/root registries, per-server LSP settings and keymaps, optional nested specs, completion actions, LSP action proxies, conditional linters, lifecycle callbacks, documentation-only branches, and explicit escape hatches.

Closed or guarded seams include Conform save/config ownership, single-picker enforcement, Tree-sitter compiler ownership, and inability to toggle unmanaged extras.

## Foundational Versus Replaceable

**Foundational:** Neovim version floor, lazy.nvim and its patched internals, snacks.nvim, specification-module composition, `_G.LazyVim`, and `lazyvim.json`.

**Replaceable through typed registries:** formatter, root detector, picker, and completion engine.

**Replaceable mostly by convention:** explorer, colorscheme, dashboard, outline, and language-specific toolchains.

**Composable but directly named:** which-key, trouble, gitsigns, noice, lualine, Tree-sitter, LSP configuration, and Mason.

## Test Seams

`tests/minit.lua` creates an isolated standard-path root. The principal architecture test iterates over every extra and checks clean specification parsing, recommendations for language extras, absence of deprecated short repository names, no duplicate Mason installation of LSP servers, no duplicate default Tree-sitter parsers, and no icon collisions.

Additional tests cover memoization and detect stray debug calls. `:checkhealth lazyvim` verifies the Neovim version, required tools, and Tree-sitter prerequisites. CI delegates to a reusable workflow in another repository.

The suite emphasizes specification-shape invariants. Format, root, picker, and LSP-keymap behavior lack direct runtime unit coverage **[I]**.

## Constraints and Risks

### Hard Constraints

- Neovim version floor terminates startup.
- Some Conform configuration overrides are rejected.
- Extras changes require restart.

### Guarded Constraints

- Import-order violations warn.
- Only one primary formatter wins.
- A second picker is rejected, with a post-startup bypass.

### Risks

- Four patches target lazy.nvim private internals.
- JSON state may be written during specification evaluation.
- Snacks is assumed globally available.
- `set_default` can decline silently.
- `_G.LazyVim` is assigned as an import side effect.
- Lua package loaders are mutated.
- Older Neovim support pins Tree-sitter revisions.
- Defaults vary by installation cohort.
- Memoization is unbounded.
- LuaJIT is documented but not checked.
- Debug introspection APIs are part of the patch toolkit.

## Intent Versus Implementation

Documented goals largely hold: configuration files auto-load, most plugin behavior is lazy, Lua dependencies are standalone lazy specs, language extras declare recommendations enforced by tests, and LSP keymaps live under server configuration.

Divergences: "All configurations are overridable" has deliberate enforced exceptions; LuaJIT is required by documentation but not validated; `set_default`'s noninterference policy is undocumented; paired configuration hooks are stronger than documented; and the extras/state model has no substantive in-repository documentation.

## Unknowns

- LazyVim website documentation was not read.
- The delegated CI workflow body was not inspected.
- Starter and lazy.nvim companion revisions were not pinned.
- Some deprecated-module and extras-priority fields are undocumented.
- `root.pretty_path` rationale is unknown.
- `VeryLazy` behavior under embedded/headless operation is unknown.
- Several lower-priority extras were not inspected.
- Complete Vimscript usage across extras was not audited.

## Recommended Reading Order

1. `README.md`
2. Root `init.lua`
3. Starter `config/lazy.lua`
4. `CONTRIBUTING.md`
5. `plugins/init.lua`
6. `config/init.lua`
7. `util/plugin.lua`
8. `plugins/xtras.lua`
9. `util/init.lua`
10. Root, format, and picker utilities
11. Options, autocommands, and keymaps
12. LSP and Tree-sitter modules
13. Extras and JSON utilities
14. One language extra
15. Competing picker extras
16. Explorer extra
17. Extras architecture test

## Pinned Evidence Index

| Evidence | Proves |
|---|---|
| [`init.lua:1-14`](https://github.com/LazyVim/LazyVim/blob/459a4c3b1059671e766a46c7cc223827dc67e3d0/init.lua#L1-L14) | Repository refuses direct use |
| [`plugins/init.lua:1-32`](https://github.com/LazyVim/LazyVim/blob/459a4c3b1059671e766a46c7cc223827dc67e3d0/lua/lazyvim/plugins/init.lua#L1-L32) | Version gate and eager entry specs |
| [`config/init.lua:175-349`](https://github.com/LazyVim/LazyVim/blob/459a4c3b1059671e766a46c7cc223827dc67e3d0/lua/lazyvim/config/init.lua#L175-L349) | Bootstrap, load, setup, and deferred initialization |
| [`config/init.lua:357-454`](https://github.com/LazyVim/LazyVim/blob/459a4c3b1059671e766a46c7cc223827dc67e3d0/lua/lazyvim/config/init.lua#L357-L454) | Group defaults and cohort behavior |
| [`util/plugin.lua:56-173`](https://github.com/LazyVim/LazyVim/blob/459a4c3b1059671e766a46c7cc223827dc67e3d0/lua/lazyvim/util/plugin.lua#L56-L173) | Plugin-manager patches and LazyFile |
| [`util/format.lua:9-48`](https://github.com/LazyVim/LazyVim/blob/459a4c3b1059671e766a46c7cc223827dc67e3d0/lua/lazyvim/util/format.lua#L9-L48) | Formatter registry and arbitration |
| [`util/pick.lua:14-64`](https://github.com/LazyVim/LazyVim/blob/459a4c3b1059671e766a46c7cc223827dc67e3d0/lua/lazyvim/util/pick.lua#L14-L64) | Picker abstraction and first-writer behavior |
| [`tests/extras/extra_spec.lua:1-156`](https://github.com/LazyVim/LazyVim/blob/459a4c3b1059671e766a46c7cc223827dc67e3d0/tests/extras/extra_spec.lua#L1-L156) | Executable extras invariants |

**Status:** approved architecture reference; no secrets reproduced.
