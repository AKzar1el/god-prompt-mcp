# GodPrompt V10: genuine public-repository coding trial — stopped on timeout, host policy and grader defect

**Date:** 23 November 2026
**State:** Review-only, two original first-run coding attempts; four planned arms deliberately unrun. **No accepted fixes or measured productivity uplift. Do not merge, publish, release, deploy or restart services based on V10.**

## Objective and preflight

The goal was to measure whether live full or opt-in compact GodPrompt MCP makes an authenticated coding agent produce more **valid completed source fixes per total time and input tokens**, relative to an unguided baseline. V10 followed V6–V8's first-party seeded task experiments and V9's host-policy blocked real-repository trial. V10 is a **new study ID**, not a replay, regrade or statistical extension of V9's rejected original model attempt.

- Source: [AKzar1el/mcp-trendpulse](https://github.com/AKzar1el/mcp-trendpulse) pinned to `3a742c73d0bd7b44e3493129412eb2ca40f474cc`; six independently cloned, unshared Git object stores in an ignored experimental directory.
- Genuine open issues: [#408, stable URL ordering](https://github.com/AKzar1el/mcp-trendpulse/issues/408) and [#410, old/new retitle details](https://github.com/AKzar1el/mcp-trendpulse/issues/410). Both are owner-created issues, not independently sampled external production bugs. Issue #408 was previously attempted once without tools under V9; V10's new controls are disclosed and distinct.
- Requested model: `gpt-6.1-sol`, high effort through authenticated Codex CLI 0.171.0/ChatGPT, no paid API key. Effective model/effort was **requested, not independently attested**.
- Authenticated native PowerShell command succeeded with **normal user Windows configuration**. The V9 use of `--ignore-user-config` was removed; nine unrelated global MCP sources were disabled **per model process** to avoid broken global source startup and additional tools. This did not modify shared settings or disable security policy.
- Local GodPrompt MCP 1.4.2 pinned at source `e888c9fb2537ca8df6b0ded84abe7d3e4a810765`, built stdio SHA256 `1024943fc2ece7743c5cde9a3b1485396ec37e43fd694d25ae6c6b6ee91fe51b`. A real model successfully called `get_version`, `classify_task` and `get_tailored_guidance` before the study.
- Full GodPrompt repository baseline: **352 passed, 2 skipped, 0 failed**. Frozen TrendPulse original RSS suite: **10/10 passed**, offline.
- Manifest (original frozen bytes): `benchmarks/agent-ab/real-repos/v10-frozen-public-issues-20261123.json`, SHA256 `8070acce25491619ee6c3c2ca3875a7a4dcf486f2c48d7ba59d5b871e0ed08e7`.
- Private sealed acceptance grader: SHA256 `a0ec6abc89b86b865d4591ec62d0b7fac02a166bfdf5f1ad889596ffe4629f52`, **19 independent cases for each issue**, verified RED **4/19 on each clean source before first model execution**. The grader and original raw transcripts remain ignored/private.

Each task had baseline, full-MCP and compact-MCP first-run arms. #408 order: baseline/full/compact. #410 order: compact/baseline/full. Each had a **frozen 360-second cap** and independent hidden tests. No original arm was replayed.

## Original observed outcomes (no retroactive success)

| Genuine issue / arm | Original status | Elapsed | Accepted fix | Hidden checks | Original repo tests | MCP tool evidence |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| #408 baseline | **INVALID — timed out** | 360.019 s | 0 | 18/19 | 29 passed, 0 failed | No GodPrompt calls |
| #408 full GodPrompt | **INVALID — timed out; host-policy denial** | 360.024 s | 0 | 18/19 | 37 passed, 0 failed | classify_task ×1; get_tailored_guidance ×3, all successful |
| #408 compact GodPrompt | **NOT RUN** | — | — | — | — | — |
| #410 compact GodPrompt | **NOT RUN** | — | — | — | — | — |
| #410 baseline | **NOT RUN** | — | — | — | — | — |
| #410 full GodPrompt | **NOT RUN** | — | — | — | — | — |

Both attempted models genuinely executed shell commands and edited `src/mcp_trendpulse/cli.py`, `src/mcp_trendpulse/rss_compare.py` and `tests/test_rss_compare.py` in their own disposable Git clones. Their source changes were never moved to the shared TrendPulse checkout, merged or deployed. The full-guidance transcript contains **four successful MCP calls**, including execute/verify guidance. Neither model completed a `turn.completed` event before the 360-second cap; **model-reported token totals are missing, not zero**.

The full-guidance stderr separately records a model-initiated `Remove-Item -Recurse -Force` against test artifact directories rejected with **`blocked by policy`**. This is a real host permission boundary; we did **not** retry, change permissions, use an alternate shell to evade it or launch another trial under the same frozen conditions. Both models' ordinary pytest suites passed, though some sandbox-created pytest cache directories produced permission warnings.

### Independent post-run defect discovery — grader was not properly calibrated

A read-only rerun of the **unchanged** frozen grader over each unchanged original code output again produced **18/19 for both**. The same single case, `408-duplicates-same-semantics`, was a **false negative**: its helper required a Click CLI exit code of **0**, but duplicate URL evidence correctly triggers the existing review-needed exit code **2**. The pinned repository's ordinary duplicate-input test already asserts that behavior.

This is a defect in the sealed V10 acceptance checker, **not proof that either coding model mishandled duplicates**. We preserve the original grader hash and both initial receipts, **do not revise their 18/19 grades**, and do not backfill an invented accepted 19/19 result. Both are invalid regardless because of their frozen timeouts. The next study must start with a **new grader that has been run against a known-correct reference implementation and against a defective source before its freeze**.

### Post-first-run reporting bug — retained original records

The first baseline receipt included a false out-of-scope path `rc/mcp_trendpulse/cli.py`. The early scoring runner had called `.trim()` on Git porcelain output, stripping the leading space in ` M src/...`; then a three-character slice dropped the `s`. An independent native `git status --porcelain=v1` confirms the actual path was the allowed `src/mcp_trendpulse/cli.py` and all three tracked modified paths were within scope.

The **original receipt and transcript remained unchanged**; later runner-only accounting was hardened to preserve porcelain whitespace and set incomplete interrupted token telemetry to null, not zero. These reporting repairs were made *after* the first original run, are disclosed, and are not used to promote any V10 attempt to accepted.

## Measurement and decision

- **Original first-run slots:** 2 executed (both invalid), 4 deliberately NOT RUN.
- **Time consumed by model attempts:** 720.043 observed seconds in total; **0 accepted fixes**.
- **Seconds per accepted fix, input tokens per accepted fix, full/compact/baseline speed delta, causal coding-productivity benefit:** **UNDEFINED / NOT ESTABLISHED**.
- **Original model-reported input tokens:** missing for interrupted sessions. We do not fill missing values as 0 or infer billed cost.
- **Test counts differ** because the agents added different visible tests. The frozen hidden grader had the same 19 cases for both but was itself defective.
- **Model effective identity/effort** and Windows private-grader read isolation are not independently attested; this remains a small first-party test, not independent benchmark evidence.

**Decision: stop V10, leave V7 compact opt-in, leave V6–V9 and V10 trial evidence immutable, do not merge or publish any unreleased functionality.** Full guidance successfully induced MCP usage but V10 did not show a valid correctness, speed or cost uplift.

## Safe next study gate

Prepare a **new V11 study** with a new unique frozen manifest/attempt identities and preferably fresh, non-overlapping genuine public issues. Before any LLM attempt: test a reference implementation to **19/19 GREEN** on all proposed hidden checks and pinned original source to **RED**, including review-required exit-2 cases; verify source/graders' SHA hashes; separately preflight native coding commands, read/write rights, independent grade process and live MCP under the **same effective authorized policy** as final model runs. Explicitly instruct agents to *leave test-cache directories alone* rather than requesting destructive cleanup; do not evade rejected host commands. Avoid unnecessary pytest cache writes (e.g. explicitly disable pytest cache provider for future runs) only when the same normal test semantics can be retained. Budget for longer legitimate tasks or choose bounded issues, but **never change a frozen per-arm cap after starting**. Score all original attempts with timeouts and missingness intact.

Public reproduction (these do **not** launch models or access private graders):

```sh
node benchmarks/agent-ab/real-repos/v10-verify-public.mjs
node --test tests/v10-public-evidence.test.mjs
npm test
```

Public verifier checks published frozen metadata and consistency of the sanitized outcomes; it **cannot independently rerun** the private 19-case grader or inspect raw original sessions. The hashes allow comparisons with protected originals if made available for authorized independent audit.

**Release effects:** none. No GitHub merge, npm publish, Cloudflare deploy, live MCP restart, changes to shared TrendPulse checkout or paid API-key access.
