# GodPrompt V15 — real coding-agent first-run results (NO-GO)

**Date:** 2026-11-23
**State:** All six frozen first runs accounted for. Review-only. No demonstrated repeatable coding-productivity improvement.

## Question, environment and acceptance

V15 compared baseline coding, full live GodPrompt MCP (`classify_task` and execute/verify guidance), and opt-in single verify-only GodPrompt guidance on two genuine owner-reported open issues in `AKzar1el/mcp-trendpulse`. Both issues had already been examined in earlier research; this is **not** a fresh or independent benchmark. The source was frozen at `3a742c73d0bd7b44e3493129412eb2ca40f474cc`. Each arm used a separate, non-hardlinked clone, ChatGPT-authenticated Codex CLI 0.171.0, requested `gpt-6.1-sol` with high effort, identical 420-second wall ceilings and the same 19 behavioral acceptance checks. Pinned runtime MCP commands were functional.

**Frozen identities** (SHA256):
- Manifest: `c7d148d7b5a68234b94a190b7dd3ee098b16bfabbe8b9c03840e6d6305a809dc`
- Runner: `dc70513dbcad5f67909618ed39b6bc6d0670be35916531ab3bcfa2e41b4456e9`
- Private behavior grader: `b4a44d2d473ae309884c57a0c3cf609f6521324de90eef12b81732b02dcbce23`
- GodPrompt stdio: `1024943fc2ece7743c5cde9a3b1485396ec37e43fd694d25ae6c6b6ee91fe51b`

Before freezing, untouched source was **4/19** for each issue. Two preserved correct implementations of #408 passed **19/19**, and a separate correct #410 reference passed **19/19** while an intentionally wrong-title mutant failed at **18/19**. The grader tests behavior and does not demand a particular patch layout. An independent blinded grader author was not available.

## Actual original results

| Issue | Arm | Original frozen status | Acceptance | Session time | Model-reported input tokens | Native tests |
| --- | --- | --- | --- | ---: | ---: | --- |
| #410 retitle details | Baseline | VALID_CORRECT | 19/19 | 299.272 s | 482,777 | 20 passed |
| #410 retitle details | Verify once | VALID_CORRECT | 19/19 | 292.860 s | 800,885 | 20 passed |
| #410 retitle details | Full MCP | VALID_CORRECT | 19/19 | 247.691 s | 594,923 | 22 passed |
| #408 stable URL sorting | Full MCP | VALID_CORRECT | 19/19 | 309.531 s | 731,005 | 16 passed |
| #408 stable URL sorting | Baseline | VALID_CORRECT | 19/19 | 271.574 s | 511,734 | 20 passed |
| #408 stable URL sorting | Verify once | **INVALID_TIMEOUT** | 19/19 *code checks*, **not accepted** | 420.070 s | **Unknown** | 19 passed *post-run* |

Five of six original agent attempts were accepted. For the timeout, the code left on disk passed the hidden and ordinary tests, and one genuine GodPrompt MCP call was observed. Nevertheless the process was killed at its ceiling without a completed model turn. **It is an invalid attempt, not an accepted fix.** Its input, cached-input and output token counts are missing, never estimated as zero or inferred from adjacent trials. Its 420.070 seconds are included in the denominator.

## Full-denominator efficiency

| Arm | Accepted / attempts | Total original attempt time | Seconds per accepted fix | Known input tokens per accepted fix |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 2/2 | 570.846 s | **285.423** | 497,256 |
| Full MCP | 2/2 | 557.222 s | 278.611 | 662,964 |
| Verify once | 1/2 | 712.930 s | 712.930 | Unknown (one lost usage receipt) |

Full GodPrompt used **13.624 seconds less overall** than baseline across two accepted tasks (2.39% better seconds per accepted fix), but used **331,417 more model-reported input tokens** (33.33% more). Its speed advantage occurred in #410 (51.581 seconds faster), while baseline was faster on #408 (37.957 seconds). Thus the advantage was **not repeated across tasks**.

The verify-once arm was 6.412 seconds faster than baseline on #410 but timed out on #408, making it worse by the actual complete denominator. This directly argues **against promoting an unconditional single-call workflow** from these data. The reported input-token counts include cache hits and are not user billing or normalized metered costs.

## Independent integrity and execution audit

- `v15-secondary-audit.mjs` reads original local first-run receipts, confirms frozen manifest/runner/grader SHA256, separately hashes raw JSONL and stderr, reconstructs native commands/file edits and genuine MCP calls, checks Git clone starting SHAs and allowed changed paths, and independently recomputes the denominator. Five targeted independent-audit tests passed.
- `v15-verify-public.mjs` protects six original outcomes, their 19/19 grader scores, the single true timeout, missing token fields, original time totals, and no claimed productivity uplift or release effects. Eight mutation/tamper tests passed.
- The original V15 Windows study JSON used CRLF and the repository stores JSON as LF. The public verifier deterministically reconstructs the original frozen CRLF byte digest from either representation. This does not change the original study, runner, grader, or raw receipts, and does not authorize replaying historic model attempts.
- Two original benchmark studies were **not retroactively repaired**: V13's file-path parser incorrectly rejected a passing code patch, and V14's MCP transport configuration aborted before any model turn. Their frozen receipts remain separately preserved by `v13-v14-verify-public.mjs`.
- In the #408 verify-once checkout, two sandbox-owned temporary pytest directories return **Permission denied** to an independent Git untracked-file scan. Although the frozen runner reported only three allowed file edits and behavioral checks passed, this audit **cannot independently attest complete absence of additional untracked paths** in that timeout clone. Preserve the private folders and the caveat; do not weaken ownership or destroy evidence.
- Some models initially failed Git's `dubious ownership` validation because native shell commands ran as `CodexSandboxOffline`, not the owner who created the clones. All model conditions encountered that risk, but retries cost time. Future study should preflight native Git ownership under each receiving execution identity, without globally disabling Git checks.

These instruments and SHA digests are reproducible local verification, **not** an independently blinded human evaluation. The requested model, thinking effort and Windows sandbox were not separately attested by a neutral host. No raw transcript, private grader, secrets, sandbox-owned temporary files or provider credentials are included in the public evidence.

## Next direction: targeted, conditional value

The research-only pure `v16-risk-gated-guidance.mjs` is an alternative to always reading generic instructions. Based only on explicit, bounded caller-supplied evidence, it requests extra GodPrompt content **only if a real native test fails**; green tested and scope-checked work gets no extra MCP call. Missing tests, unreviewed diff, empty changed files or outside-scope changes trigger short local checks or scope reconciliation instead of verbose guidance. Eight deterministic unit tests pass. The candidate has **not** undergone live coding-agent A/B trials, so no productivity improvement is attributed to it.

A credible release decision requires fresh independent bugs, objective behavioral tests, two independently developed valid patches, explicit approval for external effects, blinded acceptance review and multiple matched first-run trials per task. Consider a **15%+ replicated improvement in seconds per independently accepted fix with no correctness regression**, with uncertainty reported, a serious candidate, not a guarantee.

**Decision: NO-GO for production behavior changes**. All work is research-only on an isolated branch; no merge, deploy, publication, runtime restart, change of the production default, or shared source edits.
