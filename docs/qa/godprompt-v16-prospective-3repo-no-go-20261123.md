# GodPrompt V16: three-repository prospective first-run benchmark

**Date:** 2026-11-23
**Status:** Complete research pilot; **NO-GO** for changing production guidance defaults
**Branch:** `research/godprompt-v16-prospective-fresh-20261123`
**Parent:** V13–V15 stacked draft research PR #258 (`e91c0f8`)

## Decision

**No repeatable coding-productivity advantage was demonstrated.** The ordinary baseline beat both full and conditional GodPrompt on the primary metric: elapsed wall time per accepted fix, counting every original first-run attempt. All nine attempts completed successfully; three public bug fixes per arm were accepted. This makes the efficiency comparison directly observable, but three tasks remain far too few to generalize to all coding work.

| Real public issue | Baseline | Full GodPrompt MCP | Evidence-triggered MCP |
|---|---:|---:|---:|
| [Tenacity #780](https://github.com/jd/tenacity/issues/780) — positional wait strategy | 104.930 s | 176.161 s | 195.299 s |
| [Requests #7648](https://github.com/psf/requests/issues/7648) — digest auth qop whitespace | 172.486 s | 288.074 s | 268.383 s |
| [Rich #4250](https://github.com/Textualize/rich/issues/4250) — `FileProxy.write` length | 112.785 s | 273.405 s | 104.145 s |
| **Total time / three accepted fixes** | **390.201 s** | **737.640 s** | **567.827 s** |
| **Seconds / accepted fix** | **130.067 s** | **245.880 s** | **189.276 s** |
| Accepted first runs | 3/3 | 3/3 | 3/3 |
| Model-reported input tokens (including cached) | 656,921 | 1,925,943 | 1,187,750 |
| Model-reported cached input tokens | 567,552 | 1,799,424 | 1,094,784 |

Relative to baseline, **conditional guidance took 45.5% longer** and **full guidance took 89.0% longer** in aggregate. Conditional beat baseline by 8.640 seconds on Rich, but lost the other two tasks. Full GodPrompt lost each task. Total model-reported input tokens were also higher for both GodPrompt variants; these are not verified billable costs.

## Why this experiment is more credible than V11–V15

- Three fresh, unrelated, externally reported Python defects from **Tenacity, Requests and Rich**, rather than a repeat of previously tested TrendPulse issues.
- Frozen source SHAs, agent prompts, Codex CLI version, requested model and effort, 300-second ceiling, independent non-hardlinked trial checkout per arm, grader and runner SHAs.
- Hidden *behavioral* acceptance checked actual Python execution, not README exact-text placement.
- Before freezing, untouched source failed known behavior checks (Tenacity **5/9**, Requests **6/10**, Rich **2/10**). Two valid reference variants passed **9/9, 10/10, 10/10**, while deliberately wrong variants failed (**7/9, 8/10, 7/10**).
- Each trial was run exactly once, in a preregistered rotated order: Tenacity conditional/baseline/full; Requests full/conditional/baseline; Rich baseline/full/conditional.
- The conditional treatment was specifically allowed a compact GodPrompt verification call **only after an observed post-edit native pytest failure**. It made zero calls for Tenacity and Rich (clean post-edit tests) and one for Requests. Full guidance made five successful MCP calls on each task; baseline none.
- After the full study, `v16-secondary-audit.mjs` independently checked all **nine original transcripts**, stderr hashes, native command/edit observations, real tool-call chronology, changed-file inventories, correct source SHAs, test exit codes and full-denominator statistics. All nine original accepted; all nine untracked-file inventory checks complete, without inaccessible directories.
- The portable `v16-verify-public.mjs` independently verifies the sanitized results; eight unit tests include tampered times, source hashes, original receipts, statuses, study arms and claims.

## Remaining methodological limits

1. Sample **n=3 tasks**, only one original attempt per arm; no statistical significance or independent replication. The task narratives were public, and several contained strong repair hints.
2. The same researcher built the frozen grader and reference/mutant solutions. **No blinded independent reviewer** assessed the semantics or potential loopholes.
3. Agent treatments had the same requested Codex CLI, model and sandbox, but effective underlying model identity/effort, Windows sandbox details and metered billing cannot be independently attested.
4. The conditional strategy is **prompt-mediated research logic**, not an integrated production GodPrompt MCP route. It cannot be claimed to have measured a newly deployed implementation.
5. The trial compares end-to-end behavior including tool-use and agent choices, not isolated MCP-only latency. Avoid attributing the timing gap solely to guidance-token overhead.
6. Original raw JSONL, stderr, private grader and calibration checkouts live in the ignored `benchmarks/agent-ab/real-runs/replication-v16/` tree and are deliberately **not** committed to GitHub. Public evidence holds SHA-256 receipts and sanitized metrics only.

## Protected system boundaries

- **No** production guidance default, service process, shared source checkout, npm release, deployment, issue response, upstream pull request or GitHub merge was changed.
- The repository's publish package must remain free of study manifests, transcript hashes, private grader and raw sessions.
- The earlier research PR chain (#250-#258) stays draft and unmerged. A new V16 PR is for **review-only** evidence.
- Unrelated untracked `benchmarks/public-toolkit/results/` and `docs/qa/godprompt-v15-postflight-qa-20261123.md` were left untouched.

## Next falsifiable research question

For simple bugs where baseline already succeeds, adding a guidance protocol did **not** improve performance in this trial. A promising *different* target is **failure recovery**: match agents on fresh, materially difficult public defects with a genuine post-edit failing test, and test whether a brief, specifically diagnostic GodPrompt call improves eventual independently accepted correctness enough to pay for its overhead. This must be a new frozen preregistered study with multiple independent references, deliberate mutants and separate blinded human adjudication.

**Do not promote an automatic or unconditional GodPrompt tool call to production from V16.** A predeclared meaningful improvement (for example at least 15% less time per accepted fix without correctness regression) should first be repeated on a new independent cohort; no such evidence is presently available.
