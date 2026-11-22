# GodPrompt V6 — ten-task controlled coding replication

**Date:** 22 November 2026
**Status:** All 30 original-arm receipts preserved; original private hidden graders independently rerun. **No demonstrable coding-productivity advantage for GodPrompt** on this suite. Review-only findings, not a release.

## Executive outcome

We completed a controlled comparison across **ten different, first-party, deliberately seeded standalone JavaScript defects** representing concerns in our real projects. These are **not** ten discovered and corrected production bugs, nor ten unmodified GitHub issues. The original V4 experiment used three real public-repository tasks; V6 expands sample count and domain variety but uses deliberately smaller, isolated fixtures.

| Arm | Scheduled / preserved | Valid + fully correct | Valid but incorrect | Invalid |
| --- | ---: | ---: | ---: | ---: |
| Baseline (no GodPrompt) | 10/10 | **9/10** | 0 | 1 interrupted |
| Pre-injected real GodPrompt execute/verify guidance | 10/10 | **9/10** | 1 | 0 |
| Live in-session pinned GodPrompt MCP | 10/10 | **8/10** | 1 | 1 without MCP/edits |
| **Total** | **30/30** | **26** | **2** | **2** |

**Do not interpret the baseline's interrupted arm as a completed incorrect coding solution.** The interruption is a host/executor failure and no retry was performed. Counts use all ten scheduled tasks per treatment; all attempted sessions have original first-run receipts.

Among tasks where **both baseline and the treatment** were fully correct and protocol-valid, the paired time comparison is:

| Compared to baseline | Valid correct pairs | Guided faster / slower | Aggregate extra elapsed time | Median per-task time delta | Exact two-sided sign-test p |
| --- | ---: | ---: | ---: | ---: | ---: |
| Pre-injected guidance | 9 | 3 / 6 | **+10.73%** | **+1.14%** | 0.5078 |
| Live GodPrompt MCP | 8 | 3 / 5 | **+15.22%** | **+16.68%** | 0.7266 |

These figures **condition on both agents succeeding**, which introduces selection bias: in particular, the failed live Apify run is omitted from its eight-pair speed statistic. They do **not** establish a statistically significant difference or generalizable superiority/inferiority. The unconditional successful-fix rates and all failed or interrupted arms are therefore reported separately.

**Model-reported input tokens** were **+45.48%** for pre-injected guidance across its nine matched fully correct pairs, and **+111.99%** for live MCP across its eight matched fully correct pairs. Those are **not billed cost measurements**; most reported input tokens were cached and independent provider-side cost accounting is unavailable.

## Complete task-level results

Times are real measured wall-clock seconds per original agent session. A cell is **seconds (hidden passed/total)**; ⚠ denotes incomplete, incorrect or invalid under the frozen protocol. Every hidden test total is from the original pre-run first-party grader, not one written by the coding agent.

| First-party seeded task | Baseline | Pre-injected | Live MCP |
| --- | ---: | ---: | ---: |
| Search Console Gregorian calendar ranges | 120.88 (20/20) | 121.78 (20/20) | 143.39 (20/20) |
| Web Validator UTF-8 byte limits | 125.01 (24/24) | 128.42 (24/24) | **113.67** (24/24) |
| DigestSEO canonical URL query preservation | **112.77** (20/20) | 198.86 (20/20) | 205.00 (20/20) |
| TrendPulse normalized headline deduplication | 174.79 (19/19) | 164.08 (19/19) | **162.92** (19/19) |
| Paper-only quant maximum drawdown | 132.77 (20/20) | **96.01** (20/20) | 152.34 (20/20) |
| Apify dry-run event budget | **78.94** (20/20) | 79.84 (20/20) | ⚠ 149.25 (9/20, invalid) |
| GitHub auditor path-ignore matching | ⚠ Interrupted (10/20 initial) | ⚠ 101.75 (19/20) | ⚠ 114.21 (18/20) |
| GEO hostname trust boundary | **109.86** (20/20) | 139.85 (20/20) | 131.84 (20/20) |
| Robots meta and X-Robots indexability | 93.72 (20/20) | 140.36 (20/20) | **84.50** (20/20) |
| Portfolio heading-anchor normalization | 86.22 (21/21) | **76.80** (21/21) | 107.90 (21/21) |

The first-party path-ignore fixture is the main correctness challenge: neither model-guidance treatment passed every hidden check. It is **not** evidence of a defect in the user's actual AI Crypto Auditor repository. These source fixtures were never merged into the domain projects.

### Live-MCP reliability

**Nine of ten** live-MCP arms used the **correct pinned local GodPrompt MCP server**, requested valid 1,800-character **execute guidance** before editing, and successfully requested **verify guidance after actual test command execution**, with no unrelated connected app calls. The remaining Apify-budget live arm called **no GodPrompt MCP tools**, made **no source edit**, left the frozen grade at **9/20**, and was marked **invalid** even though its CLI session completed.

This indicates a substantial improvement in tool-use reliability over the V4 live arms, which yielded **zero fully valid two-phase treatments**, and is consistent with V5's fresh first-run execute/verify demonstration. However, a comparison against V4 is **not randomized**: tasks, prompts and GodPrompt source changed, so the improvement cannot be causally quantified from these studies alone. Reliability also did **not** translate into a speed advantage across V6.

## Study design and evidence integrity

The V6 study was frozen before any agent execution:

- **Public seeded suite:** `benchmarks/agent-ab/real-repos/v6-public-seeded-suite-20261122.json` contains the ten original broken source files, visible tests, task statements, allowed edit paths, source Git hashes, SHA-256 test hashes, and frozen counterbalanced arm orders, **but not the private hidden grader inputs**.
- **Public scored results:** `benchmarks/agent-ab/real-repos/v6-public-results-20261122.json` contains all thirty outcomes, failure states, reported tokens, time, receipt provenance hashes and matched-pair statistics.
- **Frozen private manifest SHA-256:** `fef56a571bebd902341e0ab3dc892998ceec4aebbd1d634b72931cb25d0341f4`.
- **Pinned post-V5 GodPrompt stdio SHA-256:** `1024943fc2ece7743c5cde9a3b1485396ec37e43fd694d25ae6c6b6ee91fe51b`.
- **Requested agent:** authenticated `gpt-6.1-sol`, `high` thinking, pinned cached Codex CLI `@openai/codex@0.171.0`; no paid API keys were supplied.
- **Execution:** exactly one coding agent at a time, per-task counterbalanced arm order, separate clean precommitted Git clones, Windows `unelevated` / `workspace-write` sandbox, no direct shell network, 220-second arm limit, and edits limited to the fixture's source and public-test files.
- **Original private test evidence:** first-party hidden graders were frozen by SHA before model work and rerun independently against saved modified source. Full transcripts and grader implementations remain **ignored locally** and were not added to this PR.

**Independent after-the-fact audit:** all thirty preserved stdout/stderr transcript hashes matched their receipts, across **167 recorded shell commands** and **45 completed pinned MCP tool calls**. A command-string risk scanner found **zero** indicators of hidden-grader source access, privilege escalation, external networking, or unrelated MCP calls, after resolving two false alarms caused by local `new URL('https://example.com')` parser test strings. This heuristic does **not** prove that all possible side effects or unobserved reads were impossible.

**Windows harness corrections, without altering outcomes:** During the first three arms, the legacy private grader expected the final folder name to equal the task name, but a counterbalanced arm checkout ended in the arm label. Git porcelain parsing also accidentally stripped the leading blank status byte. The raw model transcripts and outcomes were preserved and the **unchanged original hidden grader** was rerun in a private task-named staging directory. Later one quant live grader subprocess failed to report under Windows load; it was separately rerun against the original saved code, with **no model retry**. These incidents are recorded instead of hiding them.

When the original benchmark exec session disappeared, arm **#19** (path-filter baseline) had made two successful shell reads but **no code edit or completed model turn**. The controller was restarted **only after** recording that original trial as interrupted and invalid; it skipped that arm and never reran it. All later arms ran in their original frozen order.

### Reproducing the published checks

From the root of the GodPrompt repository:

```bash
node benchmarks/agent-ab/real-repos/v6-verify-public.mjs
node --test tests/real-repo-v6-public.test.mjs
```

The public verifier rehashes all ten original **source and visible test texts**, checks result/source/hidden-grader identities, validates all 30 statuses, and recomputes paired timings and token deltas. It cannot rerun the private hidden tests or substantiate their contents without the withheld local grader files. Thus results are **first-party inspectable summaries with verifiable public arithmetic**, not independent third-party reproduction.

## Interpretation and release decision

**Observed result:** on these ten small seeded defects, GodPrompt gave **no consistent improvement** in accepted fixes, wall time, or model-reported token consumption versus baseline. It did demonstrate substantially more consistent live execute/verify protocol usage than the prior V4 pilot. A generalized commercial/productivity claim would be premature.

**Important limits:** ten small first-party synthetic bugs are not representative of large real repositories, architecture planning, multi-step debugging or human engineering productivity. The Windows unelevated sandbox allows weaker out-of-workspace read isolation than native MXC; model instructions and tool-event audit are mitigations, **not airtight blindness**. Effective model scheduling, server-side thinking effort and actual billed cost cannot be independently attested. One baseline was host-interrupted, and the source/grade/evidence owner is also the experiment designer. The exact paired sign tests have low statistical power, and their successful-pair subset is selection-biased.

**Next engineering focus:** reduce unnecessary guidance/token overhead for routine scoped fixes (possibly use guidance only when a task complexity gate justifies it); improve the no-MCP-call recovery behavior and successful test/verify discipline without increasing permissions. For persuasive productivity evidence, repeat on **fresh genuine public-repository issues** with externally prepared hidden graders, strict environment equivalence, independent human or third-party review, and predeclared completion/cost metrics.

**Review boundary:** All work lives in a **separate stacked draft PR** over the V5 guidance fix. This report does not authorize merging, release, deployment, service restart, paid provider calls, production quant trading, or modifications to the user's ten referenced project repositories.
