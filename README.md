# Maestro

Maestro turns WezTerm, [Herdr](https://herdr.dev), and the coding agent of your
choice into a dedicated macOS orchestration app.

It installs:

- `/Applications/Maestro.app`, a locally signed WezTerm-based app with its own icon and identity
- the Nord terminal and Herdr presentation used by Maestro
- `maestro` and `ai` launch commands
- adapters for GitHub Copilot CLI, Claude Code, Codex, Gemini CLI, and a plain shell
- an optional GitHub Copilot fleet-status integration for Herdr

No coding agent, authentication state, or credential is bundled.

## Install

```sh
git clone https://github.com/jdylanmc/maestro.git
cd maestro
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

Each file in `agents/` is a small executable adapter. Add another agent by
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

## Dotfiles

Personal shell and terminal integration lives separately in
[jdylanmc/dotfiles](https://github.com/jdylanmc/dotfiles). Maestro does not
need that repository to run.

## Security

Credentials and runtime state are deliberately out of scope. Before every
commit and push:

```sh
./scripts/check-public.sh
```

`install.sh` configures versioned pre-commit and pre-push hooks that run this
check. Hooks are defense in depth, not permission to stage unreviewed files.

## Platform

macOS is supported. The repository layout intentionally keeps adapters and
configuration separate from app-bundle construction so another contributor
can add a Windows launcher later.
