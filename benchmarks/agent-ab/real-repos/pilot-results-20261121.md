# GodPrompt public-repository paired coding pilot — 2026-11-21

## Scope and exact source

This report records the first real paired model output trial and the
subsequently completed **three-pair pilot** on the frozen
`public-mcp-repairs-pilot-20261121` suite. It does **not** establish a broad
productivity improvement.

- Target repository: `AKzar1el/auvrora-webmcp`, public, source
  `87b012a0bca53517b73927b9ee9babb7aabe05bf`.
- Task: fix false SEO findings caused by nested inert `<template>` HTML;
  include regression tests. Allowed files:
  `src/lib/audit/analyze-page.ts` and `test/analyze-page.test.ts`.
- Two independent Git clones, distinct Codex sessions, no shared solution
  context, model **`gpt-6.1-sol`**, reasoning effort **high**, baseline first
  as specified by the frozen plan.
- Both sessions received **identical, SHA-256-matched source snapshots**. The
  only content treatment was: baseline received no GodPrompt content;
  candidate received real, pinned GodPrompt MCP `get_version`,
  `classify_task` and scoped execution/verification outputs.
- Codex CLI v0.171.0 was installed only in the ignored experiment directory.
  `codex login status` confirmed **ChatGPT authentication**, not an API key.
  No additional API-key billing was authorized or used. Plan capacity/credits
  may still apply; no account-billing record was independently inspected.

## Tool-using agent prerequisite: attempted, but invalid

A first genuine tool-enabled baseline Codex session launched, but it made
**zero edits and zero tool calls**. Its own output said even `git rev-parse HEAD`
was rejected by the Windows workspace policy. The host is Windows 10 build
19045, and its configured legacy elevated Windows sandbox was not usable.
A separate unelevated sandbox probe also hung and was stopped by targeting
only the exact owned test process.

**Do not score the invalid first agent attempt as a baseline failure or claim
that GodPrompt affected autonomous tool use.** No full autonomous agent
coding A/B trial passed the sandbox prerequisite. The safety boundary was
not bypassed.

## Successful narrower paired experiment: read-only code proposals

To proceed safely, two **new, independent** authenticated Codex sessions
received the complete, identical source/test snapshots and proposed complete
revised code/test contents **without filesystem or shell tools**. Codexify
validated those proposals, applied each only to its independently pinned
clone, then ran the hidden behavioral grader. Neither coding model received
the hidden grader nor the other model's patch.

| Measure | Baseline without GodPrompt | GodPrompt-assisted candidate |
| --- | ---: | ---: |
| Model | GPT-6.1 Sol / High | GPT-6.1 Sol / High |
| Distinct Codex thread | `01a1fc4d-af08-7a12-909d-2331f3d83f81` | `01a1fc51-478a-73f2-a2d7-7c8e620971be` |
| Elapsed wall time | 170.17 s | 231.85 s |
| Codex-reported input + output tokens | 27,442 | 40,373 |
| Hidden behavior checks | **8/8 pass** | **8/8 pass** |
| Out-of-scope files changed | 0 | 0 |
| Regression test included | Yes | Yes |
| Actual GodPrompt MCP called before model | No | **Yes** |
| In-model Codex tool use | No | No |

Candidate-minus-baseline: **+36.2% wall time** and **+47.1% tokens**,
with **no difference in the 8/8 hidden-pass result**. This is not proof
that GodPrompt generally reduces productivity: one non-blinded task, an
`ANALYZE` misrouting in the candidate, model stochasticity and the fact
that the agent could not execute tools all limit interpretation. The
candidate consumed a longer prompt containing real MCP guidance; these
reported token counts are model-use measurements, not a verified invoice.

The original production source differences are compact (23 additions/
1 deletion baseline; 25 additions/1 deletion candidate) and each includes
regression test cases. Both passed `git diff --check`; TypeScript parsing
reported **zero syntax diagnostics** for either modified production or test
file. A full repository Vitest run remains **unverified**: the baseline
clone's local `npm ci --ignore-scripts --no-audit --no-fund` had not
completed after more than ten minutes and its exact owned npm process was
stopped; no local Vitest run was claimed. Subsequently **GitHub CI for the
actual review patch passed** at commit `f1b9f1dcd8c97651ca178cb352e4b30c2d514c3d`,
providing an independent repository workflow check without relying on the
stalled local install. The patch remains a draft for review.

The more concise baseline fix was copied from its trial arm into a fresh
independent review clone and committed as `f1b9f1d` on branch
`fix/auvrora-inert-template-audit-20261121`. Its **draft, unmerged** public
review is [Auvrora PR #5](https://github.com/AKzar1el/auvrora-webmcp/pull/5).
No model-generated edits were merged into production.

## Evidence and boundaries

- Local ignored trial checkouts:
  `benchmarks/agent-ab/real-runs/trials/public-mcp-repairs-pilot-20261121/`.
- Machine-only per-session JSONL, proposal, timing/token and checksummed
  receipts:
  `benchmarks/agent-ab/real-runs/receipts/public-mcp-repairs-pilot-20261121/`.
- Model candidate's MCP code is pinned to GodPrompt source `ea72ac0`;
  that candidate misclassified the Auvrora **bug fix** task as `ANALYZE`
  instead of `DEBUG`. Preserve this finding rather than tuning it away.
- The independent grader is
  `benchmarks/agent-ab/real-repos/grader.mjs`.
- No public repo branches were merged, no live Codexify service was
  reloaded, no app was deployed, no registries were published and no
  unrestricted sandbox exception was made for the model.
- This report belongs to **stacked draft PR #243**. Unreleased
  classifier PR #242 remains separate.

## Interpretation and next milestone

**Three real paired model-output comparisons have been executed and objectively
graded, but the desired full *agentic* productivity A/B remains blocked by
Windows native sandbox execution.** Next either establish a sandbox with
working commands on this host or use independent ChatGPT/Codexify coding
sessions with trusted workstation tool access. Then repeat the frozen
bug/feature tasks as full tool-using agents, grade independently, collect
exact model/session/tool/time/token receipts and expand beyond three tasks
before drawing general conclusions.

## Final frozen three-pair results

After the first pair, the same model, reasoning effort, independent-session
policy, source-snapshot equality checks and outside-agent hidden grading were
applied to the two remaining tasks. No model saw another arm's output or the
hidden grader. Randomized execution order was preserved: baseline first for
both Auvrora tasks, **GodPrompt candidate first** for MCP-GEO.

| Task (real public code) | Baseline elapsed / tokens | GodPrompt elapsed / tokens | Hidden checks (each arm) | Actual MCP used by candidate |
| --- | ---: | ---: | ---: | --- |
| Auvrora inert template bug | 170.17 s / 27,442 | 231.85 s / 40,373 | **8/8 both** | Yes |
| Auvrora bot-specific noindex feature | 122.36 s / 25,177 | 113.81 s / 34,469 | **6/6 both** | Yes |
| MCP-GEO bounded domain error bug | 111.18 s / 32,391 | 115.16 s / 34,019 | **10/10 both** | Yes |
| **Total across three tasks** | **403.7 s / 85,010** | **460.8 s / 108,861** | **24/24 per arm** | **3/3 candidates** |

Across these three **read-only coding-output** trials, candidate-minus-baseline
was **+14.1% elapsed model-session time** and **+28.1% model-reported tokens**,
with **zero additional independent checks passed** by either arm. Per-task
timing differences ranged from candidate 7% faster (bot feature) to 36.2%
slower (inert-template bug). This is an early, small, task-specific result,
not evidence of a population-wide effect or a true autonomous agent A/B.

The exact model identity was `gpt-6.1-sol`, reasoning effort `high`, using
ChatGPT-authenticated Codex CLI for all six valid proposal sessions. The
baseline sessions used no GodPrompt; each candidate was supplied actual
guidance obtained via the pinned, unreleased GodPrompt stdio MCP. Pinned
source-snapshot SHA-256 and model/effort checks matched for every pair;
six independent session IDs and event/token receipts are preserved in the
ignored local `real-runs/receipts` directory. The permanent benchmark
controller's `score` command confirmed **3/3 modified, scope-valid matched
pairs**, **zero wins** and **zero regressions**, but correctly retains
`GRADER_RESULTS_ONLY_AWAIT_AGENT_PROVENANCE` because that generic scorer
does not independently authenticate the separate Codex session receipts.

### Useful public-repository changes from the trial

- **Auvrora inert-template false positives:** draft, unmerged
  [PR #5](https://github.com/AKzar1el/auvrora-webmcp/pull/5), commit
  `f1b9f1d`, hidden **8/8**; exact-head GitHub CI **success**.
- **Auvrora Googlebot/Bingbot-specific noindex support:** draft, unmerged
  [PR #6](https://github.com/AKzar1el/auvrora-webmcp/pull/6), commit
  `12eb098`, hidden **6/6**; exact-head GitHub CI **success**. Both models
  independently proposed the same small production-code change.
- **MCP-GEO sanitized, bounded domain error previews:** draft, unmerged
  [PR #535](https://github.com/AKzar1el/mcp-geo/pull/535), commit
  `b97d0c3`, hidden **10/10**. Public `main` had advanced since the
  experiment's frozen commit; the two relevant files were verified
  byte-identical, and the patch was applied to a separate clone of the
  newer `main` (`e3e2656`). Its **12/12 actual Node domain-normalization
  tests passed locally** (including new regressions). Exact-head GitHub
  CI **success**.

The patches were copied into **independent review clones and branches**;
both original A/B arms and their source/metadata receipts were left
unaltered. Auvrora's two PRs target `main` independently. The reviewed
MCP-GEO patch preserved normal invalid-domain error messages while bounding
untrusted input and replacing control/format characters. All three are
**drafts only**, with no merges, releases or production deployments.

### Key unresolved product-quality finding

The unreleased GodPrompt candidate classified two real Auvrora requests
incorrectly as `ANALYZE` instead of `DEBUG` (bug) or `BUILD` (feature).
The MCP-GEO request correctly classified as `DEBUG`. These independent
first-pass misroutes should become follow-up regression cases, **without
editing the original frozen task prompts or rewriting this benchmark**.
Whether correcting that routing changes real model productivity remains
an untested hypothesis.
