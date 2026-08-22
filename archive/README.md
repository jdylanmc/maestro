# Archive

Retired prototypes. Nothing here is built, tested, maintained, or read by
`maestro-cmux/`. They are kept because the discovery tree cites them as
evidence, not because their code has a future.

Do not extend anything in this directory, and do not let its architecture
influence the plugin. Maestro is now a cmux plugin bridging cmux and the
Copilot CLI. Everything below predates that decision.

| Directory | What it was | Retired |
| --- | --- | --- |
| `proto-v1/` | WezTerm + Herdr launcher. Its detached-daemon process model is the founding defect this project was started to understand. | c-0025 |
| `proto-v2.0/` | Electron orchestrator MVP. Built and measured; the application it was a route to will not be shipped. Its `EXECUTIVE-REPORT.md` is the surviving evidence. | c-0025 |
| `harness/` | Route-agnostic acceptance harness that judged the Electron route against external ground truth. Bound to an acceptance slice defined across four routes that no longer exist. | superseded |
| `v2/docs/reference/` | Comparative architecture notes on twelve terminals and orchestrators, written to choose a route. The route was chosen: cmux. | c-0025 |
