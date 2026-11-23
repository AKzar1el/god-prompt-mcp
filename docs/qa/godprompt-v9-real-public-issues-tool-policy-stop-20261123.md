# GodPrompt V9 — genuine public-issue coding trial: stopped by host policy

**Date:** 23 November 2026
**State:** Valid preregistration; one failed first-run attempt; five deliberately unrun. **Not a completed A/B test.**

## Purpose and immutable inputs

V9 was designed to replace seeded tasks with real open issues in [AKzar1el/mcp-trendpulse](https://github.com/AKzar1el/mcp-trendpulse) at source SHA **3a742c73d0bd7b44e3493129412eb2ca40f474cc**:

- [Issue #408](https://github.com/AKzar1el/mcp-trendpulse/issues/408): opt-in stable ordering for offline RSS compare.
- [Issue #410](https://github.com/AKzar1el/mcp-trendpulse/issues/410): opt-in old/new retitle details.
- Each issue has baseline, full live GodPrompt MCP, and compact live GodPrompt MCP arms.
- Original arm ordering: #408 baseline/full/compact; #410 compact/baseline/full.
- Model **requested**, not independently attested: gpt-6.1-sol, high effort, official Codex CLI 0.171.0, ChatGPT authentication and workspace-write.
- Frozen hidden independent grader SHA256: **3b4fa7c924b0f7d141e13a1051fa50bdc95c38495bda70b1948e1a21611557cc**; 19 checks per issue.
- Original source RED results: #408 **3/19** passing, #410 **4/19** passing. Existing original RSS tests passed **10/10**.
- The preregistration was committed first (60f7a2e), followed by runner (4838dd6), before the first model trial.

## All original attempts

| Issue / arm | Outcome | Accepted fix | Elapsed | Model-reported input tokens | Output tokens |
| --- | --- | ---: | ---: | ---: | ---: |
| #408 baseline | **INVALID: execution policy blocked** | 0 | 30.856 s | 96,441 (81,792 cached) | 461 |
| #408 full MCP | Not run | — | — | — | — |
| #408 compact MCP | Not run | — | — | — | — |
| #410 compact MCP | Not run | — | — | — | — |
| #410 baseline | Not run | — | — | — | — |
| #410 full MCP | Not run | — | — | — | — |

The Codex model session finished with exit code 0 but reported no ability to inspect HEAD, edit files or execute tests. The original stderr independently records PowerShell 7 and cmd.exe subprocesses **rejected: blocked by policy**. The raw JSONL has **zero successful command/edit events**. Original transcript SHA256: **c83683ae113b0e10dd970402b8771c77d107fd872bd7f5a1c1471303e92a2f80**.

A separate authenticated probe did successfully invoke the actual GodPrompt MCP get_version tool, receiving server version **1.4.2**. An available MCP does not imply native coding permission, so V9 stopped instead of wasting runs or circumventing the restriction.

**Separate runner infrastructure defect:** The original first-run grading subprocess erroneously disabled Python's user site, making the grader and pytest imports unavailable in that subprocess. The original receipt was retained unchanged with grade unavailable. An independent later offline check of the unchanged first-run clone confirmed the original #408 RED **3/19** and its ordinary tests **10/10 passed**. The hidden grader and its frozen SHA were not modified. The post-freeze runner repair removes the user-site suppression for any future work, and adds a hard stop after this recorded host-policy denial.

## Integrity, conclusions and decisions

The public result file preserves all **six preregistered slots**: **one invalid first attempt, five never attempted**. The public verifier fails closed on invented successes, swapped or missing arms, tampered manifest/grader identities, and spurious speed/cost/release claims.

No accepted valid coding fix occurred, and **V9 cannot estimate a full/compact-vs-baseline productivity effect**. Do not divide time or tokens by zero accepted fixes, assign costs to unrun arms, or treat the good MCP readiness result as a coding success. Existing V6–V8 findings remain frozen and compact guidance stays **experimental, opt-in**.

No production or distribution effects were authorized or made: **no merges, npm publish, Cloudflare deploy, GitHub release, live MCP restart or active TrendPulse checkout changes**.

## Correct next step

**The effective Codex host policy must legitimately authorize local shell/file edit execution.** Through normal user-controlled permissions (not alternate shells, disabling host rules, or a proxy that bypasses a rejection), first establish a benign successful native read-only command from an independent authenticated Codex model session. Then freeze a **new study ID and fresh first-run controls**; V9's blocked baseline cannot be replayed and counted as an original first run. Match model, reasoning effort, effective permissions, available tools and workload across all arms. After new clean acceptance graders are frozen, perform complete independently graded A/B runs with original attempt/time/token denominators. Release is conditional on both correctness and credible positive productivity evidence.

## Reproducible read-only checks

~~~powershell
node benchmarks/agent-ab/real-repos/v9-verify-public.mjs
node --test tests/v9-public-evidence.test.mjs
node benchmarks/agent-ab/real-repos/v9-runner.mjs score
npm test
npm pack --dry-run --json --ignore-scripts
~~~

The V9 coding run command now **fails closed** after the explicit policy denial. The hidden private grader and original raw JSONL are in ignored local storage and are not included in npm, GitHub or the public report.
