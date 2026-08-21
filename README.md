# Maestro

Maestro is evolving toward a source-controlled orchestration environment where:

1. a terminal emulator renders the workspace,
2. Herdr provides persistent workspaces, tabs, panes, and pseudoterminals, and
3. an agent orchestrator launches and supervises visible worker agents in isolated worktrees.

## maestro-cmux

[`maestro-cmux/`](maestro-cmux/) is a GitHub Copilot CLI plugin that reports session
activity to a [cmux](https://www.cmux.dev/) workspace. It is a fork of
[Attamusc/copilot-cmux](https://github.com/Attamusc/copilot-cmux) (MIT), vendored so
that its failure mode is ours to control: upstream exited non-zero when it could not
parse a hook payload, and Copilot reads a non-zero `preToolUse` exit as a **denial**,
so a decoration plugin was able to refuse every tool call in a live session. This fork
always fails open, and a test suite enforces it.

## Prototype v1

The original branded WezTerm + Herdr launcher is preserved in [`proto-v1/`](proto-v1/).
It is explicitly a prototype: useful and reproducible, but it visualizes internal Copilot
workers through metadata rather than launching every worker as a real terminal process.

Install or refresh the prototype with:

```sh
cd proto-v1
./install.sh
```

The root is reserved for the next architecture. Repository-wide licensing, agent
instructions, ignore rules, and secret-prevention hooks remain at the root.

## Security

Credentials, authentication state, employer configuration, and runtime state never belong
in this repository. Run the public-content gate before every commit or push:

```sh
./scripts/check-public.sh
```
