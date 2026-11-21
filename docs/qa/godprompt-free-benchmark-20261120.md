# GodPrompt v1.2.0 — controlled free tool-quality benchmark

Date: 2026-11-20. Benchmark PR: #234. GitHub Actions uses standard
public-repository Ubuntu 24.04 runners. No paid model/API, user credentials,
Docker/GHCR publication, Cloudflare deployment or OpenAI plugin modification.

## Design and evidence

- **Frozen set:** 74 pre-labeled engineering scenarios, stored in
  benchmarks/public-toolkit/cases-{code,quality,safety}.mjs, seed 20261120.
  These include known PR #232/#233 failure classes, routine engineering
  tasks, negative controls, authorization gates, and privacy canaries.
- **Scoring:** explicit observable case-level assertions; no LLM judge,
  cherry-picked prompt outputs, post-hoc fixture deletion, or claims that
  a heuristic signal proves a vulnerability.
- **Clients:** source-built local helpers, fresh published npm v1.2.0 stdio MCP,
  and existing public Cloudflare hosted MCP, with eight canonical matched
  tool responses and repeated bounded live requests.
- **Cost:** Standard GitHub-hosted runners are free for public repositories.
  Actions artifact retention is three days; permanent, redacted summary
  is below. GitHub billing rules: https://docs.github.com/en/actions/concepts/billing-and-usage

## Measured first pass (published v1.2.0 source)

Evidence: https://github.com/AKzar1el/god-prompt-mcp/actions/runs/44789393169

| Tool | Passing cases |
| --- | ---: |
| review_code_change | 11/14 |
| audit_requirements | 8/10 |
| build_test_matrix | 7/7 |
| get_tailored_guidance | 7/7 |
| diagnose_failure | 9/9 |
| assess_release_readiness | 8/9 |
| create_context_handoff | 9/9 |
| compare_evaluation_runs | 9/9 |
| **Total** | **68/74 (91.89%)** |

The **six frozen failures** were:
- DIFF-09: unhelpful no-test-files hint for a trivial safe math addition.
- DIFF-10: a comment quoting eval(input) was flagged as dynamic execution.
- DIFF-11: a changed GitHub release condition from manual-only to
  non-PR was not identified as a weakened publishing gate.
- REQ-07: mandatory + "optionally" wording was not flagged as mixed obligation.
- REQ-08: obvious opposing every-user vs no-user requirements were missed.
- REL-08: duplicate passing check names were accepted as if independent.

These are **quality/semantic and guardrail misses**, not six observed
security vulnerabilities. No privacy-canary fixture failed.

## Candidate refinement and re-test (unreleased branch, same 74 cases)

Evidence: https://github.com/AKzar1el/god-prompt-mcp/actions/runs/44789844612

After scoped source changes and six added regression tests, the **identical
frozen fixture set** scored **74/74 (100%)**, with 0 failed cases. This is
a candidate-branch result, **not an assertion that the public v1.2.0 endpoint
now contains the fixes**.

| Metric | First pass | Candidate rerun | Interpretation |
| --- | ---: | ---: | --- |
| Primary fixtures | 68/74 | 74/74 | All previously missed labeled cases now pass |
| Installed stdio/hosted parity | 100% | 100% | Only 8 canonical shared scenarios compared |
| Invalid inputs rejected (hosted) | 8/8 | 8/8 | Schema and error handling of live v1.2.0 |
| Hosted tool-call p50 | 35.55 ms | 32.57 ms | 24 hosted requests per run; not statistically conclusive |
| Hosted tool-call p95 | 86.33 ms | 87.24 ms | Same deployed endpoint both runs |
| Stdio tool-call p50 | 2.27 ms | 2.34 ms | Fresh-installed published v1.2.0, not candidate |
| Median first-chunk payload reduction | 97.78% | 97.78% | 9 paired guidance requests; bytes, not tokens |

Both benchmark workflows returned success, and neither reported protocol
errors or unverified release approval. Stdio and hosted matched on a limited
8-tool canonical subset **only**; candidate-only fixes are not deployed, so
full parity on those fixes must be rechecked after a versioned release.

### Candidate changes

- Ignore dynamic-execution signatures in added comment-only lines, but still
  warn about TODO markers.
- Suppress generic no-test-file reminders for trivial one-line code additions.
- Recognize a broadened release gate in publish/release/deploy workflows.
- Flag the exact common explicit contradiction "every/all" versus "no".
- Detect "optionally" when mixed with mandatory terms.
- Reject duplicate CI-check names (case/whitespace insensitive) as blockers.

New regressions were added to the existing Node test suite.
These rules remain **heuristic** and are not guaranteed to detect all
semantic or security defects.

## Honesty about productivity

We verified substantially smaller first-chunk guidance content and fast
response times. That can reduce context and waiting, but cannot prove
additional tasks solved, reduction in developer hours, improved patch
correctness, or causal agent productivity. This is a **real MCP transport,
reproducible software scenario benchmark**, not an equal-model coding-agent
A/B. The available Windows host had no installed/running Ollama model, and
paid model calls were excluded. Do not attach a fabricated productivity %.

A true developer productivity test still requires 10–20 real bug/feature
tasks with runnable reference tests, paired random assignment to the same
model with and without GodPrompt, identical compute budgets, blinded grading,
and repeated runs. The existing 74 frozen assertions and benchmark runner
are reusable as supporting checks, not a substitute for that evaluation.

## Release and parallel-agent safety

The benchmark branch is **draft and not merged**. The code-level fixes must
be shipped under a new patch version (for example, **v1.2.1**) with a
regenerated immutable MCPB SHA and coherent npm/Cloudflare/MCP Registry
release. Never merge into v1.2.0 as if its published artifact were mutable.

GHCR/Docker remains last. Existing Codexify live services and other agents'
worktrees have not been restarted or modified. OpenAI Skill + remote MCP
combination is reviewed separately as the next feature stage, not yet
implemented or published.
