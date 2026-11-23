# GodPrompt V8 — full-denominator productivity efficiency audit

**Date:** 23 November 2026
**Status:** Review-only retrospective analysis of frozen V6 and V7 evidence. **No new model-driven coding attempts. No release, merge, deploy or live-server reload.**

## Decision

Do **not** make compact guidance the default or claim a general speed advantage. V7's small matched-success subset slightly favored compact on speed, but this excluded a timed-out attempt. Counting every original attempt and the actual resource use changes the practical outcome substantially.

The new independent scorer is `benchmarks/agent-ab/real-repos/v8-denominator-efficiency.mjs`, with tamper/edge-case tests in `tests/v8-denominator-efficiency.test.mjs`. It first invokes the existing V6/V7 public verifiers, then computes accepted fixes per original attempt and reported seconds/tokens per **accepted valid correct** fix. Failed/invalid attempts count in the denominator and in resource totals if those resources were recorded. Missing telemetry is not zero-filled.

## V7: complete telemetry, 3 new seeded tasks per arm

| Arm | Accepted / attempts | Total observed wall time | Seconds / accepted fix | Model-reported input tokens / accepted fix |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 3 / 3 | 430.01 s | 143.34 s | 161,140 |
| Live full GodPrompt | 3 / 3 | 398.47 s | 132.82 s | 265,353 |
| Live compact GodPrompt | 2 / 3 | 466.86 s | 233.43 s | 461,678 |

- Compact versus full: **75.74% more observed seconds per accepted fix** and **73.99% more model-reported input tokens per accepted fix**, including the original compact timeout (221.01 s).
- Full versus baseline: **7.33% fewer seconds per accepted fix** but **64.67% more model-reported input tokens per accepted fix** on these same three tasks.
- V7's previously reported compact-versus-full **2.06% speed improvement** was computed *only* for the two tasks both solved validly; it is not a contradiction. This new measure includes the failed-timing task and preserves all original outcomes.
- The timed-out compact output passed hidden code checks after offline regrading, but is **not** counted as an accepted success. The 205 s limit was not revised.

These are very small, first-party seeded fixes rather than genuine unmodified public issue fixes. None of the above estimates establishes population-level model performance or causality.

## V6: 10 tasks per arm, one missing-time baseline receipt

| Arm | Accepted / attempts | Known wall time | Seconds / accepted fix | Model-reported input tokens / accepted fix |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 9 / 10 | 1,034.96 s **plus unknown** | **Unknown** (known lower bound 115.00 s) | **Unknown** (known lower bound 155,449) |
| Pre-injected | 9 / 10 | 1,247.75 s | 138.64 s | 239,058 |
| Live MCP | 8 / 10 | 1,365.02 s | 170.63 s | 432,514 |

The interrupted baseline arm has `elapsed_seconds: null` and null token counts. Treating that record as a zero-second / zero-token run would create a spurious baseline efficiency comparison. The exact all-attempt baseline time and token cost are **not identified** by public records; they are deliberately null in the new scorer. V6's originally published matched-success comparisons remain unchanged.

## Reproduction and integrity

```sh
node benchmarks/agent-ab/real-repos/v6-verify-public.mjs
node benchmarks/agent-ab/real-repos/v7-verify-public.mjs
node benchmarks/agent-ab/real-repos/v8-denominator-efficiency.mjs
node --test tests/v8-denominator-efficiency.test.mjs
npm test
```

The new tests check the complete original denominator, the V6 missing-telemetry case, no accepted fixes, duplicate/missing task arms, impossible cached-token ratios, out-of-cap valid successes and status tampering. A missing scorer module made the first targeted run fail before implementation; after implementation all four new tests passed. Existing experiments, source fixtures, transcript hashes and V7 guidance implementation are untouched.

## Interpretation and next experimental gate

This audit improves **measurement correctness**, not GodPrompt's coding speed. Model-reported input tokens include cached context and cannot be converted into a billed cost without provider pricing/actual usage receipts. Wall times are observed agent-session times, not CPU usage or isolated network latency.

The next release-relevant experiment requires an actually available authenticated coding runner with fixed model and effort, consistent permissions and environment, preregistered genuine public issue tasks, sealed independent graders, and original first-run receipts for baseline/full/compact. Score *all attempts* and compare correctness, wall-time per accepted fix, input/output tokens per accepted fix, verification protocol completion and regressions. Keep V7 compact optional until that evidence is positive. An absent/free-only coding runner must be reported as a blocker, not bypassed with fabricated or unpaired completions.
