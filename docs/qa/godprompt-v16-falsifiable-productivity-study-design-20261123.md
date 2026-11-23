# GodPrompt V16: falsifiable repeatable coding-productivity test (draft)

**Research only — 2026-11-23.** The goal is better **independently accepted code fixes per unit of elapsed time and compute**, not a shorter prompt by itself. This plan is not a model trial, a release authorization or a claim of proven speedup.

## Lessons that change the next experiment

- Earlier small seeded bug studies showed GodPrompt can preserve correctness, but speed advantage was inconsistent and often negative.
- V11/V12 documentation acceptance used brittle exact strings and formatting; semantically valid baseline solutions were falsely marked incorrect.
- V13 real coding arm achieved 19/19 and 20 project tests, but frozen Git status parser incorrectly categorized an allowed path.
- V14 failed before any model turn because the CLI MCP config had invalid transport.
- V15 uses a new study ID, independent clones, NUL-delimited changed-path discovery and a model-free startup/configuration preflight. Its results should be interpreted only after all original arm receipts are checked.

## Core product hypothesis

A generic full execute-and-verify workflow is expensive on routine coding tasks where the model already knows what to do. A *targeted* GodPrompt intervention **only when there is a concrete evidence gap** (failing or missing regression test, unresolved diff-scope risk, repeated error, or unverified release decision) may improve the number of accepted fixes without incurring unconditional MCP context overhead.

The candidate must not act as an excuse to skip real tests or approvals. A clean native test run plus a verified diff should not need another verbose checklist; a failing check should trigger a small, specific diagnostic protocol.

### Research-only prototype available

`benchmarks/agent-ab/real-repos/v16-risk-gated-guidance.mjs` provides a bounded **pure decision function**, not a production MCP tool. It recommends **NO_EXTRA_GUIDANCE** when the caller reports passing native checks, actual changed files, exact allowed paths and a reviewed diff. It reserves an extra GodPrompt guidance call **only for an actual failing native check**; missing test receipts prompt native testing, no-change attempts prompt investigation, unreviewed diffs prompt inspection and out-of-scope paths prompt reconciliation without extra MCP context. It refuses absolute/traversal paths and never echoes untrusted error text or executes commands. Eight unit tests pass. The inputs remain *caller-supplied and not independently attested*, so it must not be used to certify a change or infer an efficiency improvement; agent-facing integration and controlled model trials remain future work.

## Predeclared measurement and gates

1. **Pick independent work:** 12–20 previously unused public code issues from at least three repositories, each with a reproducible untouched-source RED test and a bounded, exact scope. Exclude issues previously solved in the research sessions, docs-placement graders and auto-generated synthetic bugs from the primary analysis.
2. **Calibrate correctness before freeze:** use external native tests and hidden behavior cases, at least two *independently authored* equivalent passing patches, and deliberately flawed mutants. A blinded reviewer who did not write the grader must adjudicate any questionable failures; lack of reviewer is a declared hard limit.
3. **Freeze environment:** match model, effective effort, tool permissions, package versions, source SHA, timeout and root directory; validate all three complete MCP configurations with a zero-model preflight before any attempt. Never silently change API-provider authorization, native sandbox or MCP connection policy.
4. **Compare three predeclared arms:** (A) ordinary engineering baseline, (B) targeted just-in-time evidence-based GodPrompt, (C) full GodPrompt. Randomize ordering across tasks; do not give models the hidden graders or alternate solutions. Hold system instructions and task acceptance text constant except for treatment.
5. **Record authentic first runs:** unique non-hardlinked checkouts, exact original SHA256 prompts, stdout/stderr, actual Git diff, successful native edit/test events, MCP calls, elapsed wall time, complete model-reported cached and uncached tokens, denial/timeouts and post-check acceptance. Invalid attempts are counted; no replays to replace the denominator.
6. **Primary efficiency metric:** total elapsed time across *all* attempts per independently accepted fix, with timeouts/invalids included. Secondary: accepted fixes per task, total model-reported input/output tokens per accepted fix, uncached and cached token splits, protocol violations, failed test handling, and actual host-billed cost **only if verifiable**.
7. **Claim threshold:** require a prospective experiment showing an improvement larger than typical run noise: for example, at least 15% fewer seconds per accepted fix **with no material correctness regression**, and verify the direction on new independent tasks in a second batch. Report task-paired results and uncertainty; a few favorable cases alone do not qualify.
8. **Fail-closed:** stop on another unfair grader, uncertain CLI execution identity, duplicate active agent, host permission denial, mismatched tool set, missing original logs or unexpected out-of-scope writes. Preserve the rejected original and start a *new* study after repair; never retroactively grade a failed frozen study as accepted.

### Observed Windows sandbox Git friction

V15 raw transcripts show some Git commands initially failing with **dubious ownership** because the benchmark clones were created under the user's Windows identity but Codex native commands execute under a separate offline sandbox identity. This cost failed tool calls in *both* control and treatment arms. For any new frozen study, establish a read-only native Git preflight in the **actual model execution identity** against each exact trusted, independently verified clone before the first model trial. Do not globally set `safe.directory=*`, change user ownership, weaken the sandbox, or treat a Git security error as permission to bypass it. If an exact, scope-approved per-command trust override is necessary, validate the canonical root and authorization separately and apply it consistently to all arms, not just GodPrompt. Never rewrite the original V15 results to remove these real overheads.

## Why the V15 results are not enough by themselves

V15 has only two already-studied TrendPulse owner-reported issues. It can establish whether the repaired *test harness* and three MCP modes are executable and potentially useful, not a general repeatable advantage. An isolated faster successful run does not prove that GodPrompt caused the improvement. The proposed targeted intervention also must be implemented and evaluated separately before comparing it.

**Non-goals:** no merging the research PR stack, npm publication, Cloudflare deployment, production server restart, change of default guidance mode, live trading or unrelated worker modification.

The next release decision is **NO-GO unless there is independently verified replicated improvement**. Until then, leave full guidance as the existing default and keep compact/experimental modes opt-in.
