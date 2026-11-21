# GodPrompt P5 — measured local efficiency and integration QA (2026-11-21)

**Scope:** Real local Windows 11/Node 22.22.2 stdio MCP responses, the versioned v1.4.1 release bundle, an isolated source checkout, and one narrow local repository-mapper fix. No coding agent was invoked. **No model success-rate, time-to-fix, or causal productivity improvement has been measured.**

## Real tool-serving measurements (v1.4.1)

The client initialized one pinned MCP stdio process, then sampled all nine task types across four workflow phases. It compared the full core Skill retrieval with the first page of `get_tailored_guidance`, alternating request order for two repetitions per task/phase (72 requests per approach).

| Metric | Full core Skill | Focused phase guidance |
| --- | ---: | ---: |
| Response body, bytes | 32,601 | 1,108 median |
| Local response p50, ms | 5.668 | 3.655 |
| Local response p95, ms | 8.455 | 7.131 |

Median focused output was **96.6% smaller**; local tool response median was approximately **35.5% shorter**. Content scopes are different, so these are I/O metrics, **not** equivalent model answers or measured token/cost savings. The whole protocols document was 13,628 bytes. Each of the 36 focused scenarios fit into one page, and all returned relevant output.

A separate stress pass of **250 read-only MCP calls at four concurrent requests** had **0 failures**, with p50 **9.036 ms**, p95 **19.855 ms**, maximum **92.257 ms**. All **10/10 malformed requests** were rejected; three diagnostic outputs repeated identically over ten calls each; the privacy canary was not returned and the process wrote no stderr. The guidance router produced **54 suggestions over 36 task/phase scenarios** using **12 distinct existing tool names**, with no missing names or routing errors; both optional MCP Apps UI links resolved.

**Limitations:** Local Node stdio timings exclude ChatGPT-to-Codexify overhead, model inference, agent thought, source edits and real programming success. These measurements should not be extrapolated to remote client round trips.

## Benchmark integrity

The **12/12 intentionally broken original microtasks** failed their individually runnable grading tests (as designed), in 13.622 seconds total on the Windows host. The paired ordering plan was deterministic, and the scoring gate rejected mismatched model identities. The scorer correctly labeled synthetic/self-reported input as unverified. No paired independent baseline-vs-GodPrompt model run took place because the available Claude Code CLI was not authenticated and no local Ollama model service was available; no paid API/model execution was authorized or used.

## Windows test suites

- Exact v1.4.1 runtime-only MCPB against the source project's **33 compatible test files:** **258/258 tests passed** in 83.945 seconds with test concurrency capped at two.
- Attempting **all 41 source test files** against that *runtime-only* MCPB gave 275/288 passes and 13 failures, because eight source/hosted tests imported **`dist/index.js`**, which is deliberately absent from the lightweight stdio package. This is a **test setup incompatibility**, not evidence of 13 live runtime defects. Full source and Cloudflare tests have separate GitHub CI validation.
- The local mapper's direct Windows regression suite passed **5/5**, including path traversal/symlink safety and NodeNext `.js` to `.ts` source resolution.

## New real-repository test-selection observation

For a three-file changed-source example (`src/instruction-audit.ts`, `src/agent-trajectory.ts`, `src/change-impact.ts`):

| Item | v1.4.1 mapper | Candidate mapper fix |
| --- | ---: | ---: |
| Static dependency edges | 60 | 104 |
| Candidate test files | 0 | 7 |

The patch conservatively resolves **test-file relative imports** of `../dist/<module>.js` back to a matching, already scanned `src/<module>.ts` (also `.mjs`/`.mts`, etc.). Ordinary source files do not receive that fallback. The mapper still avoids repository writes, raw source output or remote transmission. Seven suggested test files executed **34/34 tests successfully in 6.130 seconds**. The complete runtime-compatible suite ran 258 tests in approximately 84 seconds; these do **not** give equal coverage. Treat the shortlist as a fast first pass, followed by mandatory broader checks.

## Acceptance and next measurement

The deterministic mapping fix is a productivity-support feature, not autonomous test execution or coverage proof. Publishing it requires source CI (Node 22/24, npm, normalized MCPB checksum, registry/preview, nonroot container), a versioned release, and an explicit one-source Codexify hot reload with rollback.

A real agent-productivity claim requires an **authenticated free/approved coding-agent runner**, 12+ paired isolated tasks with randomized baseline/candidate order, the same model and budgets, independently executed hidden or targeted tests and actual runtime/token/step receipts. Until that exists, the correct agent uplift result is **not measured**, not zero or positive.
