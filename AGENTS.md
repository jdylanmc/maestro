# Maestro repository instructions

Maestro is exploring a terminal, multiplexer, and agent-orchestration architecture.
The original launcher implementation is retained under `proto-v1/` as a working
prototype, not the target architecture for v2.

- Never add secrets, credentials, tokens, session data, personal identifiers, employer configuration, internal endpoints, or machine-specific runtime state.
- Keep coding-agent integrations optional. The v1 prototype must work with any executable adapter under `proto-v1/agents/`.
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
