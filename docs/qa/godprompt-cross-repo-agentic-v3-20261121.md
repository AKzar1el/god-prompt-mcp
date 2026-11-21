# GodPrompt — independent cross-repository tool-using A/B, round V3

**Date:** 2026-11-21
**Status:** Completed two further frozen, fully tool-using coding-agent pairs on **two public repositories different from Searcharis**. Original session receipts and hidden graders are preserved unchanged in local ignored directories. This report is not evidence of a general productivity effect.

## Experimental design

The user asked for further *real effectiveness* testing rather than more code-only unit tests. After the preceding two Searcharis pairs, two new, independent public-repository bugs were selected, with fixed source SHA, instructions, allowed paths, and an offline hidden grader **before either model worked**. Each grader was red on the untouched source.

- **AI Crypto Auditor** — `AKzar1el/ai-crypto-auditor`, frozen `14e39acecd2f20545b02e763b08a115531cd4e14`. Pull-request changed-file retrieval incorrectly supplied `file.path` instead of the GitHub API's `file.filename`, breaking nested and renamed file audits. Original grader: **4/13**.
- **MCP-GSC** — `AKzar1el/mcp-gsc`, frozen `e518db8c9ae99598e3617e52d81bd09de2944be0`. The local launcher accepted certain noncanonical base64 encryption keys with nonzero unused bits. Original grader: **11/15**. The tests used inert sample keys, never real credentials or Wrangler.

Four independent, initially clean Git clones were created. Each arm used its own new, ChatGPT-authenticated **GPT-6.1 Sol / High** Codex CLI session on Ubuntu 24.04 WSL2, with actual filesystem/shell tool use, **workspace-write sandbox**, disabled shell network access, bounded duration, explicit source/test allowlist and no release/merge/provider calls. The same model and effort were used for baseline and candidate. Run order was balanced: baseline-first on Crypto, candidate-first on GSC.

The **baseline** got the frozen engineering task alone. The **candidate** additionally got scoped execution/verification guidance retrieved by real MCP stdio tool calls from unreleased GodPrompt source `ec528e9280cf550d1ef586e33f95c8fedff024ab` (`get_version`, `classify_task`, `get_tailored_guidance`). This was **pre-session injected context**, not in-session dynamic MCP calls; do not claim the latter was benchmarked.

## Measured results

| Measure | Crypto baseline | Crypto + GodPrompt | GSC baseline | GSC + GodPrompt |
| --- | ---: | ---: | ---: | ---: |
| Frozen hidden checks | **13/13** | **13/13** | **15/15** | **15/15** |
| Session wall time | 508 s | 386 s | 207 s | 235 s |
| Model-reported tokens | 626,280 | 596,401 | 338,043 | 656,914 |
| Actual shell commands | 12 | 9 | 12 | 13 |
| Scope violations | 0 | 0 | 0 | 0 |
| Model and reasoning | Sol / High | Sol / High | Sol / High | Sol / High |
| Original GodPrompt route | — | **DEBUG (correct)** | — | **ANALYZE (wrong)** |
| Chosen code for review | — | Candidate | Baseline | — |

**Two-pair totals:** baseline **715 s / 964,323 reported tokens / 24 shell commands**, GodPrompt candidate **621 s / 1,253,315 tokens / 22 shell commands**. Across this tiny new sample, candidate was **13.1% faster** but consumed **30.0% more reported tokens**, with **no additional hidden checks passed** (28/28 versus 28/28). For the individual tasks, the signs differ: GodPrompt helped Crypto on both time and reported tokens but was slower and far more token-heavy on GSC. The sums are not cost-normalized; model usage can include cache effects and does not equal a verified billing invoice.

**All four genuine tool-using pairs to date (including Searcharis V2)** total **59/59 hidden checks per arm**. Baseline used **1,149 s / 1,809,589 reported tokens**, versus GodPrompt **1,044 s / 2,374,401 reported tokens**: approximately **9.1% less session time, 31.2% more reported tokens**, and no hidden-pass advantage. These small, selected samples cannot justify a general causal effectiveness claim. Earlier Searcharis post-hoc review identified one GodPrompt candidate newline-normalization regression despite passing its frozen hidden checks; do not erase that finding when reporting aggregate quality.

## Useful independently verified public code

### AI Crypto Auditor — draft PR #1

[fix(audit): use changed PR filename at its head SHA](https://github.com/AKzar1el/ai-crypto-auditor/pull/1).

- Agent's source and offline regression tests are preserved exactly; both model outputs passed the **13/13** frozen hidden grader, with the candidate selected for review. **5/5** offline Node tests passed on the review checkout.
- The public GitHub Action includes a checked-in compiled `dist/index.js` bundle. Initial CI failed because the Linux build regenerated a different minified bundle, not because the source fix was wrong. The workflow's `pnpm/action-setup@v4` pin conflicted with its existing `packageManager` version and was conservatively repaired first.
- A **temporary diagnostics-only workflow step** emitted a compressed representation/hash of the **public generated bundle**, without storing artifacts or any credentials. The GitHub CI-rebuilt `dist/index.js` SHA-256 was **`4bcf43775a4891a3142bb5a03bfdcd1f22f2fd6333def60108070bec3475cad4`**, exactly matching the locally built, checked-in final review artifact. The debug step was **removed** and the original strict “no dirty dist after build” check preserved.
- Final reviewed commit **`1ea9b753e505630e205fb11bf8b1d4045203e356`** passed **exact-head GitHub CI**. The PR remains **draft, open, unmerged and undeployed**.

### MCP-GSC — draft PR #486

[fix: reject noncanonical 32-byte encryption-key base64](https://github.com/AKzar1el/mcp-gsc/pull/486).

- Both independent agents passed **15/15 frozen hidden checks**. The **baseline patch** was selected as the more conservative/shorter production change; it retains the launcher's existing environment, binding and port protections. Existing and new launcher regression checks passed in its isolated review.
- Upstream `main` moved since the frozen benchmark SHA; before reapplying to a fresh review clone, the two involved files were checked byte-identical against the frozen source. Original arms/graders/receipts were not modified.
- Reviewed commit **`2ecc67fa537fb518dc03a8dbdfa92bcefb221bcb`** passed **exact-head GitHub CI**. The PR remains **draft, open, unmerged and undeployed**.

## New GodPrompt intent-routing defect

The unchanged MCP-GSC task began with **“Harden the MCP-GSC local launcher encryption-key check…”**, but the pinned candidate's real GodPrompt MCP classified it as **ANALYZE**, not **DEBUG**. The Crypto “Fix…” request classified correctly as **DEBUG**. This was measured **before** modifying GodPrompt.

A follow-up, separate stacked GodPrompt branch (above draft PR #245) now recognizes a **primary affirmative “Harden…” repair** as DEBUG while preserving review-only, planning, negated and shipping requests. A retrospective public regression fixture holds the **original, unchanged two task descriptions** plus distinct contrasting examples, clearly marked **not an independent holdout**. This classifier fix does **not** retroactively improve or alter the original A/B measurements.

## Original evidence and limitations

Raw Codex session JSONL, checksum receipts, original pinned task suites, original hidden graders, candidate MCP context receipts, source/trial/review clones and the CI bundle diagnosis remain in the workstation's **ignored local** directory:

`benchmarks/agent-ab/real-runs/replication-v3/`

Raw transcripts and credentials were **not committed**. A portable Node runtime and native Codex CLI were contained in benchmark-only directories, not installed globally. No live Cloudflare/GitHub providers were contacted by the sandboxed coding agents; GitHub connector was used separately for review PRs/CI. The user may incur ordinary ChatGPT plan usage but no separate metered API-key request was authorized.

**Release boundary:** none of these PRs was merged, published, deployed or activated; the connected GodPrompt preview and the independent worker fleet were not restarted. Future claims require more **fresh unrelated tasks**, preferably from different languages/repos with independent graders, broader functional regression review, comparable tool permissions, independent quality adjudication, and explicit token/cost accounting. **No productivity improvement is yet proven.**

## Verification of the follow-up GodPrompt classifier correction

The separate stacked GodPrompt branch builds successfully, and its **real
stdio MCP focused suite passed 2/2**, including the two unchanged public task
prompts and eight deliberate contrasts. A second inspection/maintenance guard
was added after an initial focused test reported that `Review whether to
harden the token parser` was correctly routed to ANALYZE but still marked
ambiguous. The **final** code passes the **297/297 full Windows Node22 tests**.

Repeated actual MCP stdio transport regression stress passed **2,952/2,952
expected routes** across the four previously tuned datasets, with **44/44
malformed calls rejected** and no semantic inconsistencies, JSON-RPC errors,
stderr emissions or canary echoes. These are deterministic regression
fixtures, **not unbiased real-world intent accuracy**. The original V3
baseline/candidate receipts and hidden graders were never rewritten.
