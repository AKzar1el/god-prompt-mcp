# GodPrompt public engineering toolkit (2026-11-20)

## Decision and boundaries

**Build public MCP functionality first.** Delay OpenAI Skill + MCP Plugin
combination, marketplace packaging and any release until the capabilities have
been implemented, verified and reviewed together.

All new MCP tools must work in **both** the hosted Worker and downloaded stdio
server from the same source. Keep tools read-only, stateless, bounded, explicit
about uncertainty and independent verification. Do not read repositories,
execute tests, fetch remote resources or store client payloads from inside a
tool. The caller supplies evidence through its own authorized tools.

## Implementation order (one completed and tested stage before the next)

| Stage | Tool | Acceptance criterion |
| --- | --- | --- |
| P1.1 | `review_code_change` | Parse bounded unified diffs into file/line-anchored review hints; distinguish observable changes from unverified risk, reject malformed and oversized diffs. |
| P1.2 | `audit_requirements` | Find missing acceptance/scenarios, subjective terms, risky omitted constraints and ambiguous identifiers; preserve sources and avoid invented requirements. |
| P1.3 | `build_test_matrix` | Produce a bounded requirement-to-case map with positive/negative/boundary/regression suggestions and uncovered requirements, never claim tests were run. |
| P2 | `get_tailored_guidance` | Return a focused protocol for one task type and phase without loading the complete skill; bounded response and deterministic phase selection. |
| P3.1 | `diagnose_failure` | Rank explicit testable hypotheses from caller-supplied symptoms/logs without asserting root cause. |
| P3.2 | `assess_release_readiness` | Report release blockers based on supplied build, CI, artifacts, migration, rollback, approval evidence; never authorize deploy. |
| P3.3 | `create_context_handoff` | Produce a compact redacted state transfer with verified/unverified evidence distinctions and size caps. |
| P3.4 | `compare_evaluation_runs` | Compare paired prompt/agent results using matched test IDs and explicit non-comparability and sample-size warnings. |
| LAST | OpenAI Skill + MCP Plugin | Only after new public MCP functions are ready, tested on hosted and stdio and their workflows documented. |

## Code and library reuse

- Continue using the existing `@modelcontextprotocol/server` and `zod/v4` for
  shared bounded tool schemas; do not create another MCP handler framework.
- Use the MIT-licensed zero-dependency `parse-diff` library to parse unified
  patches safely in P1.1, with additional input limits and explicit unsupported
  cases. Do not copy code from unrelated repositories or import their runtime.
- Reuse the same requirement normalization and risk signals for P1.2/P1.3.
  Draw on OpenSpec's observable requirement/scenario model, not its CLI.
- Reuse bundled protocol content for P2 rather than copying and maintaining
  independent protocol text.

## Verification and release gate

For each stage: positive, negative, malformed, oversized, privacy and
determinism tests; hosted and stdio `tools/list` and `tools/call` checks; no
unexpected remote accesses/writes. Before a PR: Node 22 and 24 tests, build,
package allowlist, tool-discovery compatibility and exact source diff review.

**No CI passing, merge, npm publication, GHCR push or Cloudflare deployment
is implied by implementing a tool.** Public hosted users retain the currently
deployed tool catalog until a deliberate reviewed release.

## Progress snapshot — 2026-11-20

- **P1.1–P1.3: implemented** and validated by unit and hosted transport tests.
  Shared normalization covers common bullet specs and OpenSpec-style
  requirement/scenario headings; real diff parsing uses pinned `parse-diff`.
- **P2: implemented** with bounded, phase-specific retrieval from the existing
  generated protocol/quality-gate content. Server instructions prefer narrow
  retrieval instead of always loading the core/full prompt.
- **P3.1–P3.4: implemented** as deterministic and stateless decision helpers.
  These report unverified caller evidence, not authenticated root causes,
  release authorization or statistically proven agent improvement.
- **Local verification:** TypeScript build, all **221/221 Node 22 tests**,
  package allowlist (16/16 expected files) and Wrangler Worker **dry-run** all
  passed. The Worker was not deployed.
- **LAST: not started**, pending user decision, external review, release plan,
  live MCP schema verification and OpenAI marketplace packaging.

Full QA evidence: [`docs/qa/godprompt-public-toolkit-20261120.md`](../qa/godprompt-public-toolkit-20261120.md).
