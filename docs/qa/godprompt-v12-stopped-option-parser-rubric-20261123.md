# GodPrompt V12: stopped real-repository study — optional CLI flag grader false negative

**Date:** 2026-11-23
**Status:** Review-only, original receipts immutable. Two of six preregistered coding arms executed; four deliberately NOT RUN. **No valid productivity comparison; no release, merge, deployment or runtime restart.**

## Frozen setup

V12 attempted to correct V11's document-layout grading bias by calibrating against two legitimate reference document layouts before the freeze. The genuine open tasks remained TrendPulse [#415](https://github.com/AKzar1el/mcp-trendpulse/issues/415) and [#405](https://github.com/AKzar1el/mcp-trendpulse/issues/405), pinned at exact owner source commit 3a742c73d0bd7b44e3493129412eb2ca40f474cc. Each of six arms had a separate clean, non-hardlinked source checkout.

- Frozen V12 manifest SHA256: 303e8524eadb1049538f73e77d40acba0e19261925a979ed26b993c425dd6bc4.
- Frozen runner SHA256: 71d599470b31a2ec722d7909d27b7799d3179c1fd52a94eafb5cdefa2f246b8a.
- Frozen private grader SHA256: cb46cb42173c8c5be1c2a3b22a6ff9ad5593419330aad17224000a0fd710bb08.
- Original source grades: #415 7/14, #405 4/23.
- Corrected reference A and alternative B: both #415 14/14 and #405 23/23.
- Two deliberately mutated documentation references: each correctly failed 1 of 14 checks (missing one pinned package command or reintroducing a source-only label).
- Independently observed PyPI 0.3.0 installed-package RSS help flows succeeded. Codex CLI 0.171.0 requested gpt-6.1-sol/high using the authorized Windows configuration. Unrelated MCPs were disabled only for experiment model sessions.

Calibration against two correct layouts was **not enough** to cover equivalent command argument structures.

## Original frozen outcomes

| Issue / arm | Original status | Wall time | Grader | Original RSS tests | Model-reported input tokens |
|---|---|---:|---:|---:|---:|
| #415 full GodPrompt MCP | VALID_CORRECT | 142.034 s | 14/14 | 10 passed | 401,171 (356,736 cached) |
| #415 baseline | VALID_INCORRECT | 108.725 s | 13/14 | 10 passed | 230,378 (202,368 cached) |
| #415 compact MCP | NOT RUN | — | — | — | — |
| #405 baseline | NOT RUN | — | — | — | — |
| #405 compact MCP | NOT RUN | — | — | — | — |
| #405 full MCP | NOT RUN | — | — | — | — |

Both real model sessions exited 0, edited only README.md, passed the original ten RSS tests, and encountered **no host policy denial**. Full MCP called classify_task once and get_tailored_guidance three times successfully; baseline used no GodPrompt. Neither arm modified the shared source checkout.

### Why the grader is unsound

The original failed baseline check was 415-release-pinned-command. The hidden test required this *exact* text form for both commands:

    uvx --from mcp-trendpulse==0.3.0 mcp-trendpulse-cli rss-review --help

The baseline instead used an optional supported interpreter selector, for both commands:

    uvx --python 3.11 --from mcp-trendpulse==0.3.0 mcp-trendpulse-cli rss-review --help

The local uvx help independently confirms **both --python and --from are supported**. The baseline preserved all other source-only label corrections and evidence caveats. There was no requirement to avoid an explicit supported Python selection, and this is not an issue-functional failure. The grader's exact substring requirement was a false negative despite the expanded reference calibration.

**Original hidden result stays 13/14.** A same-author manual review suggests the baseline also fulfilled the issue, but there was no blinded independent adjudication. Retroactively changing acceptance, retrying this control, or using the original 14/14 versus 13/14 split to advertise GodPrompt superiority would be invalid.

The 142 versus 109 seconds and input-token totals are actual **descriptive observations** for the two original sessions; they are not a statistically or methodologically valid coding-productivity comparison. Input tokens include cached context and are not bills.

## Preserved public materials

- benchmarks/agent-ab/real-repos/v12-frozen-study-20261123.json — exact frozen study identity, task order and non-secret acceptance calibration evidence.
- benchmarks/agent-ab/real-repos/v12-public-results-20261123.json — complete six-slot record, immutable original two verdicts and four NOT_RUN labels.
- benchmarks/agent-ab/real-repos/v12-verify-public.mjs — refuses fabricated arms, rewritten source IDs, retroactive scores, bogus productivity and release claims.
- tests/v12-public-evidence.test.mjs — six integrity/tamper tests.

Local original raw transcripts, grader source, known-correct references and model trial clones are intentionally ignored and not shipped in npm. Historical V6–V11 evidence, frozen graders, trials and reports remain untouched.

## Next methodology gate

Do not commission another expensive model trial just to find another hand-written documentation regex false negative. First build acceptance checks around executable, observable **behavior** with parseable CLI arguments and semantic comparisons, not exact textual examples or Markdown placement. For documentation tasks require a separate blinded human/agent review of correctness (distinct from test-author and model), and keep those judgments separate from deterministic CLI smoke tests.

For a new coding trial, prefer independently observed genuine repository bugs where acceptance is tied to hidden behavioral tests, immutable source/grader/runner identities, and several independently constructed correct patches plus intentionally broken mutants before freezing. Do not reuse V12 original arms or fill NOT_RUN rows afterward. Score full denominators including timeouts, errors, and missing telemetry. Compact GodPrompt stays opt-in/draft; no accuracy, speed or cost advantage is proven by V12.
