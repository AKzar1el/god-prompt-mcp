# GodPrompt V13 / V14: preserved exploratory benchmark failures

**Date:** 2026-11-23
**Status:** Stopped original attempts; **no causal productivity improvement claim**. This note is a research-audit artifact, not a production change.

## Research question

Can a single, short GodPrompt verification call at the end of an ordinary coding task preserve correctness while reducing the time and tokens needed per accepted fix, compared with (a) no GodPrompt and (b) the full execute-and-verify MCP workflow?

Both V13 and V14 studied existing, real public TrendPulse RSS issues #410 (offline same-URL headline retitle details) and #408 (opt-in URL sort ordering), at source revision `3a742c73d0bd7b44e3493129412eb2ca40f474cc`. The issues had been examined in older studies and are **not an unseen third-party benchmark**.

## Why the old grader was unreliable

V10 had required an exit code of 0 on a duplicated RSS capture even though the valid offline CLI returns exit code 2 for evidence requiring human review. V11 and V12 documentation graders rejected semantically equivalent but lexically different correct command examples. **The old frozen outcomes were never rewritten.**

For V13, the independent new 19-check behavioral grader was calibrated before execution:

| Task | Untouched baseline | Correct variants | Bad mutant |
| --- | --- | --- | --- |
| #408 URL sort | 4/19 | Two preserved distinct V10 patches each 19/19 | Not recorded |
| #410 retitle details | 4/19 | Separately authored reference 19/19 | Wrong newer title: 18/19 |

The V13 research-only semantic CLI checker tests supported `uvx --from` / `--python` permutations, alternative valid Markdown positions, and rejects unpinned, missing or compound shell commands without executing untrusted text. It accepts **both original V12 README command variants**. Six targeted regression cases passed.

## V13 stopped after one authentic coding-agent attempt

Original private manifest SHA256: `4af95231f98d8cc25aad67a0672f1f7656d4d713dd06131e84af6bb69e9d2fdb`
Original private runner SHA256: `864fc69bf1d36f2052308369a3fb413f2615480b1e86fa08aacb5f0afe0d836c`
Original private grader SHA256: `b4a44d2d473ae309884c57a0c3cf609f6521324de90eef12b81732b02dcbce23`

The original first attempt was `#410 verify_once_mcp`, with model `gpt-6.1-sol` and requested high effort. It made successful native tool edits and one actual successful GodPrompt verification call, passed **19/19 hidden behavioral checks** and **20 existing and newly added tests**, reported **313.001 seconds**, **630,912 input tokens** (590,848 cached), and no host policy refusal.

However, the frozen original runner reported **INVALID_OTHER**, because `git status --porcelain=v1` was prematurely `.trim()`-ed and then parsed with `.slice(3)`. That destroyed the leading status column of its first line: ` M src/mcp_trendpulse/cli.py` became `M src/mcp_trendpulse/cli.py`, and consequently the runner incorrectly perceived an out-of-scope `rc/mcp_trendpulse/cli.py` path. An independent `git diff --name-only` confirmed the actual edits were entirely inside the allowlist.

**Original INVALID_OTHER stays unchanged**. V13 stopped with **1/6 first runs** and **5/6 NOT_RUN**. No retcon of the efficiency denominator or silent rerun. The observed correct code is not represented as a frozen accepted fix.

## V14 stopped after a startup configuration failure

Original V14 manifest SHA256: `2d970150dc7de67c6b4e6d0198248f2b1f59c1dbe9df24d1db5327d53a5179df`
Original runner SHA256: `cd638f4fd3737b2c0005e6ed1bb3661149e065948697ca4bdf774f554b08c51b`

A NUL-delimited Git changed-file reader (`v14-git-paths.mjs`) fixed the V13 parser's lost-leading-space defect. It passed dedicated tests for staged, unstaged, untracked and space-containing paths, and independently found the three proper V13 paths.

V14 nevertheless stopped at its first `#410 baseline` attempt after **0.614 seconds**, with exit code 1 and **zero model turns**. Its CLI stderr read: `Error loading config.toml: invalid transport in mcp_servers.godprompt`. The original runner disabled an existing MCP source via configuration without supplying a valid transport. Ordinary tests on the unchanged source passed 10; behavioral grader remained at 4/19. This is an **invalid harness execution**, not a model failure. The other **5/6 arms were NOT_RUN**.

V14's original receipt remains immutable. Its failure motivated a separate V15 ID with a model-free MCP configuration preflight and independent clones; this is not a retry of the original V14 attempt.

## Integrity and limitations

The public V13 and V14 record files and `v13-v14-verify-public.mjs` preserve exactly two original attempts across 12 planned slots. The verifier enforces original failures, SHA256 manifest identities, incomplete arms and no published/release/deploy changes. Eight tamper/integrity tests passed. Local raw outputs and graders remain in ignored private storage; npm should not package them.

**Cross-platform archival detail:** The original V14 Windows JSON manifest used CRLF line endings, whereas this repository's Git attributes store JSON with LF. The public verifier reconstitutes the original CRLF bytes solely for the historic SHA256 check, and separately tests both line-ending representations. The original runner and attempt remain frozen; this is not a replay recipe.

There is **no repeatable efficiency advantage established by V13/V14**, and their results must never be pooled with a later corrected study as interchangeable accepted outcomes. The owner-authored issues, same-team grader and requested (not independently attested) Windows model settings remain material limitations.

**No deployment, merge, publication, restart, default-guidance change, or shared checkout modification** was authorized or performed in these two studies. The unrelated untracked `benchmarks/public-toolkit/results/` directory is deliberately untouched.
