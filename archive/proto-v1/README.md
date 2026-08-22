# Maestro prototype v1

> **Prototype:** This is Maestro's original WezTerm + Herdr launcher implementation.
> It remains runnable and reproducible, but it is archived under `proto-v1/` so the
> repository root can evolve toward a true visible-fleet orchestration architecture.

Maestro turns WezTerm, [Herdr](https://herdr.dev), and the coding agent of your
choice into a dedicated macOS orchestration app.

It installs:

- `/Applications/Maestro.app`, a locally signed WezTerm-based app with its own icon and identity
- the Nord terminal and Herdr presentation used by Maestro
- `maestro` and `ai` launch commands
- adapters for GitHub Copilot CLI, Claude Code, Codex, Gemini CLI, and a plain shell
- an optional GitHub Copilot fleet-status integration for Herdr
- session-aware Herdr tab and pane names

No coding agent, authentication state, or credential is bundled.

## Install

```sh
git clone https://github.com/jdylanmc/maestro.git
cd maestro/proto-v1
./install.sh
```

The installer uses Homebrew to install public dependencies unless
`--no-brew` is passed. It backs up an existing Herdr configuration before
writing Maestro's generated machine-local configuration.

```sh
./install.sh --default-agent claude
./install.sh --no-brew
```

## Use

Launch the configured default agent:

```sh
maestro
```

Override it for one launch:

```sh
maestro claude
maestro copilot
maestro codex
maestro gemini
maestro shell
```

`ai` is an alias for `maestro`. Each command opens a fresh Maestro window in
the current directory.

Change the persistent default:

```sh
maestro --default claude
maestro --list
```

Opening Maestro from Finder or the Dock uses the same persistent default.

## Agent adapters

Each file in `proto-v1/agents/` is a small executable adapter. Add another agent by
creating a file whose name is the command passed to `maestro`.

Machine-local or employer-specific adapters belong in:

```text
~/.config/maestro/agents-local/
```

Local adapters take precedence over repository adapters and are never copied
back into this repository. This is the intended extension point for private
tooling.

## GitHub Copilot fleet status

When GitHub Copilot CLI is installed, `install.sh` installs an additive hook
that shows active task agents as child rows in Herdr. It does not replace
Copilot settings or authentication. The hook no-ops outside Herdr.

## Session-aware tabs

Maestro installs
[`itayo-m/herdr-tab-session-name-sync`](https://github.com/itayo-m/herdr-tab-session-name-sync)
at the reviewed commit recorded in `proto-v1/config/herdr/plugins.lock`. It derives session names
from agent terminal titles and keeps Herdr pane, agent, and focused-tab labels synchronized.
Manual tab renames are respected.

The plugin requires Node.js 18 or newer. Maestro's Brewfile supplies Node.js for fresh
installs. Inspect or manually re-run synchronization with:

```sh
herdr plugin list
herdr plugin action invoke copilot.session-tabs.sync
herdr plugin log list --plugin copilot.session-tabs
```

The default plugin configuration manages Copilot and OpenCode. Add other detected agent
kinds through the plugin's local `config.json`; installer upgrades preserve that file.

## File viewer

Maestro also installs the read-only
[`smarzban/herdr-file-viewer`](https://github.com/smarzban/herdr-file-viewer)
at its reviewed v1.15.0 release commit. Its prebuilt binary is checksum-verified by the
plugin installer. Maestro supplies Bat, Delta, and Glow for syntax, diff, and Markdown
rendering.

Inside Herdr:

- `Ctrl+B`, then `F` opens or toggles the viewer as a right-hand split.
- `Ctrl+B`, then `Shift+F` opens or toggles it in a dedicated tab.

The viewer does not run automatically and does not modify the repository it browses.

## Docked project sidebar

Maestro installs
[`alexarthurs/herdr-sidebar`](https://github.com/alexarthurs/herdr-sidebar)
at the commit recorded in `proto-v1/config/herdr/plugins.lock`. It supplies an automatically docked
project explorer and source-control panel. `Ctrl+B`, then `E` toggles or focuses it.

Unlike the file viewer, the sidebar is an interactive write-capable tool. Its explicit UI
actions can create, rename, and delete files; stage, unstage, discard, and commit changes;
and pull or push Git branches. Its optional commit-message action sends a bounded diff to
the locally installed Claude CLI. Review changes before invoking destructive or remote
actions.

The sidebar is built from its locked Rust sources during installation.

## Dotfiles

Personal shell and terminal integration lives separately in
[jdylanmc/dotfiles](https://github.com/jdylanmc/dotfiles). Maestro does not
need that repository to run.

## Security

Credentials and runtime state are deliberately out of scope. Before every
commit and push:

```sh
../scripts/check-public.sh
```

`proto-v1/install.sh` configures versioned pre-commit and pre-push hooks that run this
check. Hooks are defense in depth, not permission to stage unreviewed files.

## Platform

macOS is supported. The repository layout intentionally keeps adapters and
configuration separate from app-bundle construction so another contributor
can add a Windows launcher later.
