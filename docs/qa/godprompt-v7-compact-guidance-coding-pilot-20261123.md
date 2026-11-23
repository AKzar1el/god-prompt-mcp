# GodPrompt V7 — opt-in compact guidance and fresh coding A/B checks

**Date:** 23 November 2026
**Status:** Review-only experimental update. No established population coding-productivity improvement. No release/merge/deployment authorization.

## Why V7

The previous frozen V6 first-party 10-task/30-arm pilot showed correct-fix rates of baseline 9/10, pre-injected GodPrompt 9/10 and live GodPrompt 8/10. On the fully correct matched subsets, guidance added **10.73%** (pre-injected) and **15.22%** (live) aggregate elapsed time, and substantially increased model-reported context. Those unfavorable outcomes remain unchanged in PR #250.

V7 tests a narrowly scoped hypothesis: **for a small, bounded routine task, opt-in condensed execute/verify guidance may use fewer input tokens without dropping real verification and scope boundaries.**

## Surgical code change

- New `src/compact-guidance.ts` provides distinct concise content for nine task types and four phases. It retains explicit scope, untrusted-content boundaries, evidence-before-claims and phase-specific instructions. SHIP and AUTOMATE still require approval for external actions.
- `get_tailored_guidance` now accepts the **optional** `compact: true` flag. The original full guidance remains the default. Compact calls should use `max_chars=600`; execute suggests the exact matching compact verify call, which agents still make **only after real tests**. It does not edit code or independently verify work.
- For compact results, the `source` field accurately identifies the curated guidance source, and optional suggested-tool lists are omitted to avoid needless adjacent tool calls. Full mode's content, pagination and existing response shape remain unchanged.
- The tool description documents this **low-risk, bounded task opt-in**; it does **not** automatically switch complex, shipping or security-sensitive tasks to compact mode.

### Measured serialized MCP response size

Both execute and verify JSON responses together, excluding transport overhead or model-tool schema tokens:

| Route | Original full JSON | Compact JSON | Reduction |
| --- | ---: | ---: | ---: |
| DEBUG | 5,276 B | 1,762 B | **66.60%** |
| BUILD | 5,050 B | 1,762 B | 65.11% |
| REFACTOR | 4,314 B | 1,759 B | 59.23% |
| ANALYZE | 3,473 B | 1,726 B | 50.30% |
| SHIP | 4,543 B | 1,729 B | 61.94% |
| PLAN | 3,616 B | 1,739 B | 51.91% |
| AUTOMATE | 4,811 B | 1,751 B | 63.60% |
| CONTENT | 5,233 B | 1,760 B | 66.37% |
| DESIGN | 5,099 B | 1,761 B | 65.46% |

**Bytes saved are not the same as billed tokens or agent runtime saved.** This table includes the tool's JSON result content, not all MCP initialization/tool discovery, model reasoning or cache effects.

## Fresh model-driven replication

To avoid replaying V4, V5 or V6 attempts, the new V7 suite was frozen **before** model work: three independent first-party **seeded standalone bugs** based on JSON Pointer, RFC4180 CSV record parsing and relative path normalization. These are not actual defects patched in the user's production repositories.

**Frozen manifest SHA-256:** `7ad4641a2fa1d92e21ecadbd45ef087e71b5420635be6e04626efed3e4ace912`.

Three modes used distinct clean source-matched Git clones in a different counterbalanced order per task: ordinary baseline, live MCP full guidance and live MCP compact guidance. Requested GPT-6.1 Sol / High, same 205-second session cap, authenticated local CLI, Windows unelevated workspace-write, no paid API keys, no direct shell network, no installs. The *first-run* raw transcripts and hidden grader implementations are saved locally in ignored benchmark paths, not Git.

| New seeded task | Baseline | Full live GodPrompt | Compact live GodPrompt |
| --- | ---: | ---: | ---: |
| Safe JSON Pointer | 200.83 s, 29/29 | **135.21 s, 29/29** | 139.88 s, 29/29 |
| RFC4180 CSV record | **97.65 s, 32/32** | 115.82 s, 32/32 | 105.97 s, 32/32 |
| Safe repository-relative path | **131.53 s, 32/32** | 147.44 s, 32/32 | **Invalid**: 221.01 s, 32/32 code independently correct, but original execution exceeded its 205 s cap |

**Strict first-run result:** baseline **3/3 valid correct**, full live **3/3 valid correct**, compact live **2/3 valid correct + 1 invalid**. All six live MCP sessions called the correct pinned server and retrieved execute and verify guidance with the intended `compact` value; the timeout case remains invalid regardless.

The path-safe compact agent's first automated grader process returned no result. An **independent offline rerun of the original unchanged SHA-pinned grader** on that preserved source confirmed **32/32 code checks** and a successful public-test run, but **did not make the timed-out agent a valid result**. There was no model replay, cap extension, grader alteration, or altered task statement.

### Speed and token comparison

- On **two tasks with both full and compact valid/correct**, compact was faster once and slower once; aggregate time **2.06% faster**, model-reported input tokens **3.27% fewer** than full. With n=2 there is no meaningful evidence of general speed advantage.
- Across all three valid/correct **full versus baseline** pairs, full live guidance was **7.33% faster** in aggregate, but the three task-to-task effects vary substantially. V6's unfavorable outcome remains unchanged.
- The compact timeout case was excluded from the strict two-pair speed result; including it as a fast/correct success would be invalid. Conversely, a 66.6% reduction in DEBUG JSON bytes **did not** produce an equally large overall model input-token reduction in these two matches.

These are **small first-party synthetic tests**, not externally blinded production coding tasks. The model's effective server-side effort, actual billing and out-of-workspace read isolation cannot be independently attested. Windows unelevated sandbox isolation remains weaker than a fully restricted independent container.

## Independent QA and public verification

The full original V7 manifest, three pre-model source Git commits, private grader SHA-256 hashes, original model transcripts and terminal conditions were independently checked. The separate audit recovered all **nine** first-run receipts, reran the three private graders against preserved code, and checked Git changed-file allowlists, test command events, real execute/verify tool-call phases, model-provided usage and transcript SHA-256 identities.

Public inspectable artifacts in this draft PR:

- `benchmarks/agent-ab/real-repos/v7-compact-guidance-suite-20261123.json`: original broken sources, visible tests, source hashes, hidden grader hashes and arm order (no hidden cases)
- `benchmarks/agent-ab/real-repos/v7-compact-guidance-results-20261123.json`: all nine sanitized statuses, elapsed times, independently rerun hidden grades, usage and payload measurements
- `benchmarks/agent-ab/real-repos/v7-verify-public.mjs`: source/test hash checks and paired time/token calculations
- `tests/tailored-guidance-compact.test.mjs`, `tests/real-repo-v7-public.test.mjs`: bounds, legacy compatibility, safety semantics, tamper detection and result math; plus an actual stdio MCP call in `tests/stdio.test.mjs`

The new compact tests were deliberately RED before the feature existed and GREEN after. The TypeScript build and real stdio MCP contract passed. A preserved **ordinary full npm test rerun passed 344/344**, and a separate **serial-scheduled complete run passed 344/344**. Other parallel runs on this loaded Windows machine had **343/344** passing with intermittent pre-existing child-startup/host-observer timing failures, not failures in compact-guidance tests. Temporary changes to unrelated legacy test timeouts were investigated, then **reverted before commit** to keep the PR focused; no audit or security assertion was weakened. The occasional local timing flake is not claimed permanently fixed. Exact-head GitHub CI still must pass before the draft is described as green.

## Decision and remaining work

**Keep this as opt-in and experimental.** The compact feature clearly reduces MCP response payload while preserving tested basic safeguards, but first-run coding evidence is mixed and one attempt exceeded the time cap. Do **not** claim a general coding-speed advantage, merge the draft PR stack, or automatically turn compact mode on for production tasks.

The next meaningful independent experiment should use *genuine frozen public GitHub issues* or independently prepared hidden graders on realistic larger source projects; require identical environment and evaluate the entire denominator, not only successfully solved pairs. Focus on saved cost per **accepted correct** fix, not response bytes alone.
