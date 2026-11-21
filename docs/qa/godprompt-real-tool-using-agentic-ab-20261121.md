# GodPrompt — genuine paired coding-agent pilot (21 November 2026)

## Status

**Two frozen, genuinely tool-using A/B pairs completed through Codexify and sandboxed Linux Codex CLI.** These are distinct from the earlier **three read-only code-proposal pairs** documented in `benchmarks/agent-ab/real-repos/pilot-results-20261121.md`. No broad productivity improvement has been established.

Both arms worked on real, previously unused defects in the user's **public** `AKzar1el/searcharis` repository, based on commit `c8cd398ec642b348f5b526cfb60b1fb23840e6f9`. This record was written *after* the trials; the frozen task instructions and raw trial receipts have not been rewritten.

### Isolation and the first genuine tool-use proof

- A native official **Codex CLI 0.171.0** Linux binary was installed into the local **ignored** GodPrompt benchmark directory, not globally. Ubuntu 24.04 under WSL2 provided the Linux runtime; no global Windows/WSL configuration was changed.
- A controlled `codex sandbox` probe created a file inside its allowed test workspace and **denied a write to its parent directory**. A subsequent authenticated **GPT-6.1 Sol / High** Codex session actually invoked two shell commands successfully.
- `codex login status` verified **ChatGPT subscription login**, not API-key authentication. API-key variables were stripped from test sessions. These sessions may consume the user's ChatGPT plan usage; no separate metered API-key calls or external provider requests from the coding shells were authorized.
- Every scored arm used a **new independent Codex thread**, its **own fresh Git checkout** pinned to the same public commit, `workspace-write` sandbox, **disabled direct network access in the sandbox**, and a narrow allowlist of two code/test paths.
- Both used the same model (`gpt-6.1-sol`), reasoning effort (**high**), task text, source SHA, and explicit prohibited actions. Baseline received **no GodPrompt content**. Candidate received independently pinned `get_version`, `classify_task`, scoped execute/verify guidance from the actual unreleased `dist/stdio.js` GodPrompt MCP at source SHA `f2ea9b679c90ad8d94eb4684d234b1bc4a054ef6`. The candidate received MCP guidance **before** its session; the agent itself did not dynamically call the MCP during coding.
- The independently authored hidden graders were outside both checkouts and **unavailable to either model**. Agents genuinely ran shell commands, inspected files, applied edits, and attempted verification. The resulting real code was graded **only afterward**. The order was balanced: baseline-first on task 1, candidate-first on task 2.
- Original task prompts are copied unchanged into `benchmarks/agent-ab/real-repos/tool-using-public-tasks-20261121.json` solely for later classifier regression coverage. This published fixture is *not* a new unbiased holdout.

## Frozen task results

| Metric | 1. Invisible Unicode URL controls | 2. Contract CLI bounded-byte reader |
| --- | --- | --- |
| Source | Searcharis `contract_ci.py` | Searcharis `contract_cli.py` |
| Original red grader | 9/17 | 11/14 |
| Baseline hidden result | **17/17** | **14/14** |
| GodPrompt hidden result | **17/17** | **14/14** |
| Baseline wall time | 220 sec | 214 sec |
| GodPrompt wall time | 228 sec | 195 sec |
| Baseline model-reported total tokens | 515,903 | 329,363 |
| GodPrompt model-reported total tokens | 690,014 | 431,072 |
| Baseline shell calls | 10 | 11 |
| GodPrompt shell calls | 13 | 12 |
| Baseline focused pytest | 1,107 passed | 926 passed |
| GodPrompt focused pytest | 1,127 passed | 929 passed |
| Original GodPrompt intent route | **BUILD** (expected DEBUG) | **SHIP** (expected DEBUG) |
| Production-compatible review selection | GodPrompt candidate | **Baseline** (candidate newline regression) |
| Public draft PR | [Searcharis #329](https://github.com/AKzar1el/searcharis/pull/329) | [Searcharis #330](https://github.com/AKzar1el/searcharis/pull/330) |

**Aggregate for these two pairs:** baseline **434 sec / 845,266** reported tokens / **21 commands**, GodPrompt-assisted **423 sec / 1,121,086** reported tokens / **25 commands**. Thus candidate was **2.5% faster in total**, but used **32.6% more reported tokens**, with **zero extra hidden successes (31/31 versus 31/31)**. These token totals are Codex session usage measures, not verified billing amounts or normalized inference costs.

### Independent review uncovered a miss in the frozen grader

The second task's original **14/14 hidden grader** checked byte bounds, stale-`stat()`, exact-size acceptance, Unicode/invalid-UTF-8 behavior, and scope. **Both agents passed it.** During separate review, an additional compatibility check compared behavior against the original Python `Path.read_text(encoding="utf-8")`.

- Original code: CRLF and standalone CR normalize to LF.
- Baseline fix: **same normalization** preserved.
- GodPrompt-guided candidate: returned **raw CRLF and CR**, a real compatibility regression in the old CLI.

This was saved **separately** as a *post-hoc* receipt, **not secretly added** to the frozen 14-case score. For the production review, the baseline patch was selected; source and tests were copied to a **new clean review clone**, leaving the original candidate and baseline arms untouched.

The first task's original baseline model session was mistakenly marked `INVALID_RUN` by the experiment controller. Its initial Git porcelain status line began with the normal leading space for an unstaged change, but the receipt parser called `trim()` and dropped that first character, corrupting the first path. Independent Git status and the 17/17 grader confirmed both files were in scope. The original faulty receipt remains unchanged, and a **separate signed-by-context erratum JSON** records the correction. The controller's parser was fixed **before** task 2.

### Public deliverables, verified independently

- [Searcharis draft PR #329 — reject raw Unicode format and control characters in declared SEO URL identities](https://github.com/AKzar1el/searcharis/pull/329), review commit `d1007a7d732cabba59e2383455386fd8683d8f2b`. **17/17 hidden** checks, **1,127 pytest** cases on review checkout, **exact-head GitHub CI success**. Only existing `src/searcharis/contract_ci.py` and `tests/unit/test_contract_ci.py` changed.
- [Searcharis draft PR #330 — bounded byte reads preserving existing newline semantics](https://github.com/AKzar1el/searcharis/pull/330), review commits `7775196` and follow-up lint-only `cee700c428c5116fefa5b4288f9b2eb8e8f6584f`. **14/14 hidden** checks in original independently graded baseline arm; the review checkout passed **926 pytest** cases and CRLF compatibility. First GitHub CI failed solely on **two Ruff UP012 warnings in tests**, which were corrected; **exact-final-head GitHub CI success**.
- Both changes target the same unchanged `main` SHA but touch **disjoint production and test files**. Both remain **DRAFT / OPEN / UNMERGED**, no registry publication or production deployment.

## New GodPrompt product-quality findings

The actual MCP classified these naturally expressed **bug fixes** as **BUILD** and **SHIP**, respectively. Task 1 includes the requested supporting phrase `add focused regression tests`, which the previous heuristics incorrectly interpreted as a separate feature build. Task 2 includes `Do not change site policy rules, deploy anything, call providers, or install dependencies`; the comma before `deploy anything` was mistakenly interpreted as **authorization to deploy**. These first-pass errors were preserved, not cleaned up in the original candidate sessions.

A **new separate stacked classifier fix** is being tested against the two unchanged published task prompts and distinguishing requests (including positive authorized deployments), not the frozen hidden graders. Any success on these cases is a *tuned regression check*, **not independent evidence** that the original GodPrompt-guided runs would have improved.

## Interpretation, cautions and next threshold

The real-agent harness gap is **resolved**: Codexify can now run the same GPT-6.1 Sol / High model with actual shell tools, filesystem isolation and no separate API key. But only **two fresh defects from one Python repository** were compared, and the GodPrompt candidate received additional context that can change prompt length, behavior and reported tokens. Two trials with equal hidden success cannot establish a causal productivity benefit, and the candidate had one post-hoc compatibility regression.

Before claiming productivity gains, perform **fresh, independently selected work on other public repositories**, keep identical model/effort/tool permissions, preserve balanced run order, grade hidden behavior and production compatibility, and compare latency, token use, command attempts, real bugs, maintainability, and review acceptance. Avoid rerunning these same two tuned prompts as an unbiased benchmark.

### Evidence custody

Original raw CodeX session JSONL, controller scripts, ignored Linux test binary, original and post-hoc grade receipts, measured time/tokens, and code proposals remain in the user's **local ignored** directories:

- `benchmarks/agent-ab/real-runs/replication-v2/`
- `benchmarks/agent-ab/real-runs/replication-v2b/`
- `benchmarks/agent-ab/real-runs/linux-codex/`

These raw materials were deliberately **not pushed**. The stable public record is this report, the unchanged prompt fixture, and the reviewable code/tests in the two draft Searcharis PRs. **No live GodPrompt reload, Codexify worker restart, package release, GitHub merge, or cloud/provider action was performed.**
