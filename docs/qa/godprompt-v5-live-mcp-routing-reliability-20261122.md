# GodPrompt V5 readiness — classifier and live coding guidance

**Date:** 22 November 2026. **Review-only follow-up**, stacked after V4 draft PR #248. No merge, release, deployment, service restart or global Codex configuration change.

## Motivation and frozen prior evidence

The original nine-arm V4 report (`docs/qa/godprompt-v4-independent-productivity-results-20261122.md`) found **six valid correct coding arms** but **zero valid full two-phase live GodPrompt coding arms**. Typical failures: agent requests `get_tailored_guidance` with `max_chars` of 5,000–6,000 despite a 4,000 cap, substitutes other connected MCP apps, omits verify guidance, or never edits the code. Three DEBUG task descriptions containing supporting test requests were misrouted to BUILD. We did **not** alter, regrade, or cherry-pick any V4 source SHA, first-run task, hidden grader or raw transcript.

The original classifier regression datasets remain frozen at **76 cases**, **50 holdout**, **50 forward**, and **70 adversarial** (all 246/246 correct before changes). The twelve *post-V4* hand-labeled diagnostics are a known regression set, not an unbiased holdout. Before the patch: **5/12 surprising results**; after: **1/12**. The remaining case asks to build a GitHub Actions workflow and routes to AUTOMATE rather than its hand label BUILD; both could be defensible. Do not force that label to improve a score.

## Source changes

- `src/server.ts`: broaden primary debugging verbs to include **repair**, **patch**, **correct**, **resolve**, and **address ... bug/defect/error**, with guards against incidental address nouns and negated review-only requests. Supporting requests such as **add mocked SDK/AI fetch regression tests** no longer override the primary bug fix as an independent feature BUILD. Distinct follow-up API/feature creation still routes to BUILD; real shipping still routes to SHIP.
- `classify_task`: add additive `structuredContent` for machine-reading clients and a concrete, bounded execute/verify guidance next-step instead of the generic “load all protocols” recommendation.
- MCP `initialize.instructions` and `get_version`: teach the **same-server two-phase coding workflow** and exact safe defaults. Do not substitute similarly named connected apps. Guidance is never an execution or test receipt.
- `src/tailored-guidance.ts`: response includes `recommended_next_call` on execute with actual `task_type`, `phase=verify`, `max_chars=1800` and an evidence-oriented next step. Verify responses emphasize actual command receipts. Existing schemas, 200–4,000 input bound, pagination, and read-only behavior are preserved.
- Regression assertions in `tests/stdio.test.mjs` and `tests/tailored-guidance.test.mjs` verify misroutings, negative mixed-intent controls, tool descriptions, phase handoff and returned machine-readable structure.

The two targeted tests were independently confirmed **RED before the implementation** and **GREEN after**. Full classifier sets continue at **246/246** without modifications to their fixture files.

## Fresh first-run, genuinely authenticated coding-agent verification

A **new** offline exercise, not one of the V4 tasks, was frozen before any model run: repair a JavaScript `Cache-Control` **max-age** parser to handle exact directive names, numbers, quoted numeric values, syntax errors and safe-integer overflow, preserving the public function. A tiny disposable, locally committed Git checkout and first-party hidden grader were created **before** launching the model.

| Fresh trial property | Independent receipt |
| --- | --- |
| Source commit | `535ce727de0d5e389565e2e27762b1c3b0b2631e` |
| Hidden grader SHA-256 | `4b76a750e2ff42a9477c251a7fafd122dc8959a178329db8a27447ec7f5b277f` |
| Updated local GodPrompt stdio SHA-256 | `1024943fc2ece7743c5cde9a3b1485396ec37e43fd694d25ae6c6b6ee91fe51b` |
| Original hidden red grade | **20/36** |
| First model-run hidden green grade | **36/36** |
| Independent visible test rerun | **10/10** |
| Actual successful shell tool events | **7** |
| Successful real Codex file-change events | **2** |
| Pinned `godprompt` MCP tool successes | **7** |
| Execute guidance successfully invoked | **Yes**, max_chars **1800**, twice |
| Verify guidance successfully invoked | **Yes**, max_chars **1800**, twice, **after a successful test command** |
| Unrelated connected MCP calls | **0** |
| Model-reported usage | 388,847 input, 353,792 cached input, 3,986 output tokens |
| Agent duration | About **2.6 minutes**, approximated from original stdout-file timestamps, **not an independently clocked measurement** |

The real Codex child session used **GPT-6.1 Sol / High requested**, authenticated via existing local ChatGPT subscription; no paid API keys were provided. It ran with restricted Windows `unelevated` sandbox, workspace-write, no elevation and no direct shell network. The prompt asked it to follow the pinned server's own instructions but did **not** tell it the individual `execute`/`verify` arguments; it learned these from the MCP content. Its first real operation had a failed command and it recovered. One optional `review_work_evidence` call also failed and was retried successfully, providing a separate resilience signal.

**Strict provenance:** the one-shot model completed and its raw JSONL/stderr receipts were written intact, but the *post-model reporting script* initially failed when parsing the pre-run grader report saved by Windows PowerShell 5.1 as UTF-16LE. The grader was not changed and the model was **not restarted**. An offline finalizer handled the BOM, regraded the exact saved first run, inspected its actual per-event tool identities/phases, reran visible tests and checked the two allowed Git file changes. Final receipt: `benchmarks/agent-ab/real-runs/replication-v5/private/live-agent-run.summary.json` (ignored/private), including SHA-256 digests of the raw stdout/stderr. The entire disposable checkout, hidden grader and raw model transcript remain outside version control.

## Independent regression verification

After the implementation, all four existing source-pinned classifier benchmark sets passed unchanged (**76/76 + 50/50 + 50/50 + 70/70**). Focused stdio and guidance tests passed with the new red-then-green cases. The first full Windows `npm test` attempt had **328/329** passing, with one failure in a pre-existing Codexify host-observer test unrelated to the changed source. That observer suite passed **7/7** when rerun alone, and the next ordinary, unmodified `npm test` command passed **329/329**. No host-observer implementation was changed to mask the intermittent result. The passing rerun is evidence of regression compatibility, **not** proof that the intermittent Windows scheduling issue is permanently fixed.

The measured result demonstrates **one successful real live-MCP coding workflow with both phases**, after three failed-protocol V4 trials. It is **not** a valid causal pre/post comparison, not proof of general robustness, not independently verified billing, and not evidence that GodPrompt improves coding productivity over baseline. The next defensible reliability rate requires multiple *fresh* projects with frozen tasks and outcome-agnostic evaluation.

## Remaining gaps and next checks

The GodPrompt MCP is guidance-only; it cannot independently confirm that a user's external coding session executed real tests. It can only offer next-step hints and bounded evidence review of caller-supplied receipts. `max_chars` remains 200..4,000; do not loosen it merely because a model requested larger outputs. Codex's `features.apps=false` switch hides the pinned GodPrompt MCP too, so connector isolation still depends on exact-server identity and fail-closed transcript auditing.

Recommended next research: independently collect 10–20 **new, pre-frozen** coding tasks with precommit correctness graders and matched baseline/pre-injection/live-MCP arms, controlling host concurrency. Require execute+verify phases and separately authenticated command/file receipts for all live arms. Keep the completed V4 evaluation and its unfavorable pre-injection result unchanged. No automatic production shipping or PR merge is implied.
