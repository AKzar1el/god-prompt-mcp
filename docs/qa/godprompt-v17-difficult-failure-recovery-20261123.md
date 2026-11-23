# GodPrompt V17: difficult-bug failure recovery, first-run study

**Date:** 2026-11-23
**Status:** Complete research pilot. **NO-GO for changing production.**
**Branch:** `research/godprompt-v17-failure-recovery-20261123`
**Parent:** Research-only draft PR #259, `a121756811d88090c560aadd4603d9b22472e6a8`

## Research question

Does conditional GodPrompt diagnostic help improve coding correctness per unit of time when it is allowed only after **two separate native regression-test failures with a source-code repair edit between them**? Both arms use genuine public upstream bugs, pinned source, Codex CLI 0.171.0, requested `gpt-6.1-sol` high reasoning, the same offline workspace-write sandbox and 420-second first-run limit. The condition is **prompt-mediated research behavior, not a new deployed MCP feature**.

## Original first-run evidence

| Public issue | Ordinary baseline | Strict conditional policy | Actual treatment MCP calls |
|---|---|---|---:|
| [AnyIO #1498](https://github.com/agronholm/anyio/issues/1498) - cancelled condition waiter loses notification | **INVALID_TIMEOUT** after 420.150 s, 3/4 hidden checks, 4 post-run native tests | **VALID_CORRECT** in 261.641 s, 4/4 hidden, 4 native tests | **0** |
| [Rich #4255](https://github.com/Textualize/rich/issues/4255) - text and syntax tab-width measurements | **VALID_CORRECT** in 210.499 s, 15/15 hidden, 5 native tests | **INVALID_OTHER** after 256.296 s: original grader returned no result; 4 native tests passed | **0** |
| [pytest #15287](https://github.com/pytest-dev/pytest/issues/15287) - restoring lazily-created MagicMock children | **VALID_CORRECT** in 200.091 s, 10/10 hidden, 10 native tests | **VALID_CORRECT** in 246.676 s, 10/10 hidden, 10 native tests | **0** |

Original frozen totals, counting every attempt including timeout and invalid grader receipt:

| Metric | Baseline | Strict conditional |
|---|---:|---:|
| First runs recorded | 3/3 | 3/3 |
| Independently accepted fixes | **2/3** | **2/3** |
| Total original wall time | **830.740 s** | **764.613 s** |
| Seconds per accepted fix (complete denominator) | **415.370 s** | **382.307 s** |
| Known model-reported input tokens (includes cached) | 613,787 | 1,363,898 |
| Missing model token reports | 1 (timed-out AnyIO) | 0 |
| Actual GodPrompt MCP calls | 0 | 0 |

The conditional-policy arm used **7.96% less aggregate time per accepted fix**, but **not a single treatment model invoked GodPrompt**. It therefore cannot demonstrate any benefit caused by the tool. Both arms had the same acceptance count, the small aggregate difference is below the proposed 15% win threshold, and the Rich grader anomaly further undermines a clean causal comparison. More model input tokens were reported by the conditional arm, but missing tokens in the timed-out baseline and token caching prevent a credible billed-cost comparison.

## Investigation of the Rich grader anomaly

- The original treatment process exited normally after 256.296 s and left changes only in the allowed Rich source and test files. It had four passing self-authored native tests.
- Its frozen *independent* hidden grading process returned **no parseable result / null exit status**. The original receipt was and remains `INVALID_OTHER`, **not accepted**, regardless of the model's claim.
- A separate **read-only postflight** with the **unchanged private grader** against the original trial checkout later returned **15/15 hidden checks passed in about 2.3 seconds**. This is a diagnostic, not a new original run or retrospective acceptance.
- The cause of the original grader non-result is not conclusively proven. The original runner's receipt lacks the grader process error/stdout/stderr details; possible transient subprocess timeout/launch contention cannot be distinguished. Do not claim known root cause.
- An objective future runner should record grader process error/status/stderr and use a separately calibrated, fixed grader process timeout before model attempts. This correction belongs in a **new** study, not a rewrite of V17.

## Calibration completed before trials

Pinned independent upstream source revisions:

- AnyIO: `37ba52b9137d72764d3bcbd31842b58a1e1ea992`
- Rich: `3a109ccdffe5b2d0e30684a304fbd388e99ce57b`
- pytest: `718929265449ca33040264152ba5e7022e766a52`

For each issue: untouched source had demonstrably RED hidden behavior (AnyIO **2/4**, Rich **2/15**, pytest **5/10**); two distinct researcher-authored reference patches passed every check (**4/4**, **15/15**, **10/10**); intentionally wrong mutants failed (AnyIO **2/4**, Rich **6/15**, pytest **8/10**). AnyIO two references and one mutant were each repeated seven times with unchanged outcomes. The stdlib unittest calibration tests (AnyIO 2, Rich 3, pytest 2) passed for each valid reference and rejected the mutant.

A narrower stdlib unittest regression test file was required because the upstream broad pytest suites were not reproducibly usable with existing, unmodified local dependencies: AnyIO required missing `trustme`, pytest's source checkout lacked generated `_pytest._version`, and Rich's Syntax snapshot tests disagreed with installed Pygments. None of those setup failures was counted as a coding failure. The hidden grader ran separately on every original attempt.

## Independent evidence integrity

- Immutable private study freeze: **manifest** SHA-256 `2498f08d453cb198cecfb40e22862783c40c6d9713ff8059afa43d3db682bb3d`; **runner** SHA-256 `d0787490034d7b24cb31422556af7761aaacf5273d3a12ed235bb0037a95a9c8`; **hidden grader** SHA-256 `1011879a7e13c39784e7f5c5c57ffca09a0edb22646ff1c6e6045411689a2535`.
- All six independently cloned original checkouts, source heads, permitted changed-file inventories, original JSONL, stdio/stderr SHA-256 hashes, native tool observations, GodPrompt-call chronology and complete-denominator arithmetic were validated by `v17-secondary-audit.mjs`. No inaccessible untracked file inventories were found.
- Portable `v17-verify-public.mjs` checks the sanitized original rows, original receipt SHA-256 identities, unchanged frozen manifest and no causal uplift claim; its tests reject tampering with timestamps, acceptance, timeouts, missing arms and fabricated MCP calls.
- Original JSONL, stderr, private hidden grader, independent calibration patches and source checkouts are retained under **gitignored** `benchmarks/agent-ab/real-runs/replication-v17/`; they are **not** shipped to GitHub or npm.
- **No** changes to production GodPrompt guidance, default configuration, live MCP runtime, shared servers, Cloudflare, npm release or upstream repositories. Prior research PRs remain draft/unmerged.

## Actual decision and next falsifiable experiment

**NO-GO.** The strict threshold avoided unnecessary guidance context, but it **never reached the trigger**. The AnyIO treatment's superior correctness and the modest 8% aggregate timing difference are not attributable to GodPrompt because **zero GodPrompt calls occurred**. V17 did prove that difficult tasks can separate correctness (the baseline AnyIO timeout), while exposing grader-process fragility that must be fixed in a separately preregistered study.

For V18, use **randomized interventions at a real, externally observable failing checkpoint** instead of waiting for a self-managed agent to choose whether to call a tool. Freeze a coding state with a real failing regression after an edit and a common independent clone; then randomize the continuation into (A) no GodPrompt and (B) a concise GodPrompt diagnostic. Record both first continuation outcomes. Use multiple *fresh* failure checkpoints across at least three repositories, ensure the grader is reliable and independent blinded human reviewers adjudicate controversial cases. Keep primary metric accepted recoveries per complete-denominator wall time and publish both successes and failures. Do not promote guidance or claim productivity improvement until a substantial positive effect repeats in a second unseen cohort.

This V17 report documents a completed **pilot**; it does not authorize or announce a production release.
