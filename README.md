# Maestro

Maestro makes agent work visible inside a terminal you already use.

It runs as a plugin inside [cmux](https://www.cmux.dev/) and renders the thing
the runtime records but presents nowhere: the **subagent tree** of a Copilot
session, live, with parentage and state.

cmux owns the window, workspaces, terminals, file tree, resource meter,
notifications, theme, and process lifetime. Maestro adds only what cmux does
not have, and two independent surveys of 190+ ecosystem projects found nothing
that renders a genuine parent-child agent hierarchy.

macOS only, for now.

## What it is not

Maestro observes. It does not orchestrate.

It does not enforce worktree isolation, own process lifetime, persist durable
run state, sweep leftover processes, provide a command surface, or ship as its
own application. Each of those was specified, evidenced, and then deliberately
cut, because the host already supplied it or the problem turned out smaller
than the contract written for it. The reasoning is preserved in the discovery
checkpoints rather than deleted.

## Components

[`maestro-cmux/`](maestro-cmux/) is the Copilot CLI plugin: hooks that report
session activity, an event-log reader that reconstructs the subagent tree, and
a custom cmux sidebar that renders it. See its
[README](maestro-cmux/README.md), including current limitations.

That plugin is the whole of the live surface. Everything else is history.

[`archive/`](archive/) holds the retired prototypes that preceded it. They are
kept for their evidence, not their code, and nothing in `maestro-cmux/` reads
them. See [archive/README.md](archive/README.md).

## The rule that shapes the design

> **An observer must never be able to veto the thing it observes.**

Copilot treats a non-zero exit from a `preToolUse` hook as a denial. An
unmaintained third-party plugin exited non-zero on a payload it did not
recognise and refused every tool call in a live session, `pwd` included.

Maestro's hooks always exit zero and emit nothing, enforced by tests with a
negative control that fails if the runner never executed.

## Documentation

- [`CONTEXT.md`](CONTEXT.md) - the domain glossary, authoritative over any
  other wording in this repository.
- [`docs/adr/`](docs/adr/) - Architecture Decision Records, including the
  retirement of terms whose referent dissolved.
- [`docs/discovery/`](docs/discovery/) - durable discovery state and immutable
  per-cycle checkpoints. Anything predating cycle c-0025 records what was
  decided at the time, not current intent.
- [Issues](https://github.com/jdylanmc/maestro/issues) - the working backlog,
  including measured defects.

## Security

Credentials, authentication state, employer configuration, personal data, and
runtime state never belong in this repository. Run the public-content gate
before every commit or push:

```sh
./scripts/check-public.sh
```
