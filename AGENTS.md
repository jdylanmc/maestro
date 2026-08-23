# Maestro repository instructions

Maestro is a cmux plugin that bridges cmux and the Copilot CLI: it renders a
Copilot session's subagent tree, activity, and attention state inside cmux. It
observes and does not orchestrate. `maestro-cmux/` is the only live surface;
retired prototypes are inert under `archive/` and must not influence new work.

- Never add secrets, credentials, tokens, session data, personal identifiers, employer configuration, internal endpoints, or machine-specific runtime state.
- Keep coding-agent integrations optional and provider-neutral.
- Keep local overrides under `~/.config/maestro/agents-local`; that directory is never sourced from or copied into this repository.
- Run `./scripts/check-public.sh` before every commit and push.
- Generated app bundles and build output are not committed. Source assets and the portable `.icns` resource are committed.
- macOS is the only supported platform for now. Do not block a future Windows implementation with needless assumptions outside macOS-specific scripts.

## Agent skills

### Private instructions

Read and follow the machine-local instructions at `.user/instructions.md` when
present. That path is git-ignored and never committed.

### Issue tracker

Issues, specifications, and Discovery maps are tracked in GitHub Issues for
`jdylanmc/maestro`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five canonical triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses a single domain context: root `CONTEXT.md` and root
`docs/adr/`. See `docs/agents/domain.md`.

### Architecture gaps

`maestro-cmux` is a reference implementation built inside the constraints of an
interpreted cmux sidebar and a fixed Copilot hook surface. When one of those
constraints blocks something we actually wanted, record it in `docs/GAPS.md`
at the moment of impact, with measured evidence, the workaround shipped, and
what would close it. That file is the requirement list for the real plugin.

Record a gap when the architecture prevents it, not merely when it is hard.
