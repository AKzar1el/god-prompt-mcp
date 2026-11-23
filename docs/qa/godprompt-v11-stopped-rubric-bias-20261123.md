# GodPrompt V11: STOPPED because of a frozen grader false negative

**Date:** 2026-11-23
**Status:** One original coding attempt preserved; five planned attempts NOT RUN. No merge, release, deployment, service restart or live-code changes.

## Scope and frozen identities

Two real open TrendPulse issues were selected at pinned source commit 3a742c73d0bd7b44e3493129412eb2ca40f474cc:

- [#415](https://github.com/AKzar1el/mcp-trendpulse/issues/415): fix stale README source-only labels for published PyPI 0.3.0 offline RSS CLI.
- [#405](https://github.com/AKzar1el/mcp-trendpulse/issues/405): opt-in title-filtered offline RSS comparison.

The six arms were isolated, clean, independently cloned Git repositories. Authenticated Codex CLI 0.171.0 requested gpt-6.1-sol/high; normal authorized Windows sandbox configuration was inherited, nine unrelated MCP systems were disabled per-session, and no API keys or shell network access were required. Tool configuration was preflighted, but the requested effective model and Windows isolation are not independently attested.

Frozen study manifest SHA256: e5006a6fa97a227c0879f6f3d947cde44a78f8a29540f66bf815afc2202a6750.
Frozen runner SHA256: a7bd2062d566de8422f59582ab2fcb0a9757331050f42a65c76f096d5f37a3ac.
Frozen hidden grader SHA256: e29e67afda3b457cc265eaad6b1d83abfe79b6c5e24586671381c06e5f2e2846.

Before freezing, the original sources scored RED (#415: 7/14, #405: 4/23) and a single locally authored correct reference per issue scored GREEN (#415: 14/14, #405: 23/23). The corrected #405 reference passed all 10 existing RSS tests. Independently executed installed-package help commands from PyPI mcp-trendpulse 0.3.0 both exited successfully. The private graders/reference code were not shared with any model clone.

## Frozen original first-run evidence

| Issue / arm | Outcome under original grader | Seconds | Hidden grade | Original tests |
|---|---|---:|---:|---:|
| #415 baseline | VALID_INCORRECT | 122.736 | 11/14 | 10 passed |
| #415 compact MCP | NOT RUN | — | — | — |
| #415 full MCP | NOT RUN | — | — | — |
| #405 full MCP | NOT RUN | — | — | — |
| #405 baseline | NOT RUN | — | — | — |
| #405 compact MCP | NOT RUN | — | — | — |

Original baseline: model process exited 0, 6 successful native commands, one completed model turn, README.md changed, zero changes outside scope, no host policy rejection, no GodPrompt calls. Model-reported input tokens 170,417 (127,616 cached); output tokens 2,214. Raw transcript SHA256 726c12ec89940767dc49dffcffbf3de222dc52083f3e938a426d412c84af4097.

The three failed hidden cases were:

- 415-release-pinned-command
- 415-explicit-installed-wheel-boundary
- 415-does-not-change-earlier-readme

The model wrote a truthful heading about the PyPI 0.3.0 RSS commands with the **two exact pinned uvx package examples placed immediately BEFORE the existing first RSS paragraph**. It corrected all five source-only qualifiers, retained evidence/market-growth caveats, and touched no other file. The grader was calibrated to a different valid placement: it searched only AFTER that paragraph and required the earlier README text to remain byte-identical.

A human-readable diff review therefore found a plausible correct implementation rejected for a presentation choice rather than missing functionality. That review was performed by the same experiment author, not an independent blind reviewer; it does not retroactively change the original frozen result to 14/14. Instead V11 was immediately STOPPED, leaving 5 arms unrun, to avoid misleading accuracy or productivity results.

**No baseline-vs-GodPrompt speed, cost, or correctness effect is established by V11.**

## Public audit artifacts

- benchmarks/agent-ab/real-repos/v11-frozen-study-20261123.json — public-safe exact preregistration.
- benchmarks/agent-ab/real-repos/v11-public-results-20261123.json — sanitized original six-slot outcome.
- benchmarks/agent-ab/real-repos/v11-verify-public.mjs — fails closed on doctored completions, source/grader identities and release claims.
- tests/v11-public-evidence.test.mjs — six tamper/integrity tests.

The public verifier returned VERIFIED_STOPPED_RUBRIC_BIAS_NO_PRODUCTIVITY_CLAIM; all six focused tests passed. Original raw transcripts, trial clones, private reference and grader remain ignored/local.

## Next gate for V12

Grading must assess the externally observable issue contract, not exact paragraph placement or one author-selected solution. Before a new freeze, verify more than one independently structured correct reference (including both heading placements for documentation), mutation variants that should fail, and unchanged source RED. Preserve an entirely new study identity and first-run receipts; do not replay V9, V10 or V11 attempts. Keep baseline/full/compact permissions, timeouts and environment matched within each task, score the full denominator, and report input tokens as model-reported rather than billed. No experimental evidence justifies making compact guidance the default or merging these stacked research drafts.
