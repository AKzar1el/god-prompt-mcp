# GodPrompt public engineering toolkit: implementation and QA

Date: 2026-11-20. Branch:
`feature/godprompt-public-engineering-toolkit-20261120`.

## Public capability surface

| Tool | Design limit and verification boundary |
| --- | --- |
| `review_code_change` | Unified diffs <=120,000 chars, <=50 parsed files, <=40 findings, 5,000 changed-line limit; all findings heuristic and file/line anchored, never a complete semantic review. |
| `audit_requirements` | Text <=16,000 chars, <=35 requirements; missing acceptance criteria, duplicates, non-measurable terms; source-line traceability. |
| `build_test_matrix` | Same shared requirement normalization; max 80 suggested cases, no executable code or fabricated execution evidence. |
| `get_tailored_guidance` | Existing generated protocol/gate content; <=4,000 chars per chunk (1,800 by default), lossless offsets and phase choice. |
| `diagnose_failure` | <=3,000 symptom chars + <=8,000 log chars; matches bounded categories and suggests differentiating experiments without echoing raw logs. |
| `assess_release_readiness` | <=30 reported checks, source/artifact revision pairing, migration/rollback/approval blockers; never authorizes release. |
| `create_context_handoff` | Bounded entries, only caller-supplied decisions and evidence; best-effort credential/email redaction, no persistent storage. |
| `compare_evaluation_runs` | Up to 200 cases per run, exact case ID pairing, low-sample warnings, only measured time/cost pairs and no significance claims. |

Both `src/index.ts` (hosted Worker) and `src/stdio.ts` (downloadable stdio)
register the *same* eight public functions. The checkpoint-specific optional
Codexify tool remains stdio-only under its existing explicit env opt-in.
No public tool accesses a user repository, host shell, cloud account or storage.

## Dependency assessment

- Reused `@modelcontextprotocol/server` and `zod/v4` for schema validation,
  tool registration and structured responses.
- Added only `parse-diff@0.12.0`, pinned, MIT-licensed and with **zero
  runtime dependencies** to robustly parse unified patches. Do not vendor or
  copy unreviewed third-party code. `src/public-engineering.ts` bounds input
  size/line counts and does not execute diff content.
- OpenSpec observable requirements/scenarios and reviewdog diff-line reporting
  served as design references; no third-party framework code was copied.

References:
https://github.com/Fission-AI/OpenSpec/blob/main/docs/writing-specs.md,
https://github.com/reviewdog/reviewdog,
https://github.com/sergeyt/parse-diff.

## Tests and actual execution evidence

- **Full Node 22 suite:** 221 pass, 0 fail, 0 skipped, 0 cancelled.
  Command: `node --test --test-concurrency=1 tests/*.test.mjs` after
  `npm run build`. The first exploratory pass found obsolete expected-tool
  count/order and dependency-list assertions; those were corrected, and the
  complete second run passed.
- **Hosted integration:** `tests/public-engineering-hosted.test.mjs` invokes
  all eight tools via the real Worker `fetch` handler and also checks malformed
  and oversized inputs. Stdio discovery and legacy/2026 transport integration
  passed through the full repository suite.
- **npm pack dry-run:** `npm pack --dry-run --ignore-scripts --json` returned
  exit 0. Exactly **16 files** included: the `package.json` manifest and the
  15-file explicit allowlist; 0 missing/extra, no local scripts/tests, 103,491
  packed bytes. New compiled modules are explicitly allowlisted.
- **Cloudflare bundling:** Wrangler **4.135.0** `deploy --dry-run` exit 0;
  880.95 KiB uncompressed / 203.27 KiB gzipped (build only, no deployment).
- **Source boundary:** all new modules are read-only/stateless and import no
  `node:fs`, subprocess execution or external network access. Tests verify
  zero independent verification/release authorization and fail-closed cases.
- **Not yet verified:** actual post-release hosted endpoint, a newly published
  npm install, external consumer experience, Node 24 CI (pending draft PR),
  performance uplift in controlled paired real coding tasks.

## Known limits and release safety

- Risk signals, root-cause hypotheses and test cases are **suggestions**, not
  a general-purpose AI reviewer or proof of correctness. For semantic review,
  the calling agent must inspect the supplied change, apply GodPrompt guidance,
  and execute authorized checks with independently inspected receipts.
- Handoff redaction is best effort, not a privacy guarantee; callers must
  sanitize input before sharing. Hosted requests necessarily transit the Worker.
- The benchmark comparison uses caller-supplied paired outcomes and always
  warns about small datasets; it cannot demonstrate causal improvements.
- This source implementation intentionally **does not** update
  `distribution/openai/` or install a combined plugin. No version bump, npm
  publication, GHCR publication, Cloudflare Worker deployment, or Codexify
  restart was performed. Public deployment requires a separately approved
  release, endpoint verification and refreshed approved client schemas.

## Independent PR #233 review and release decision (2026-11-20)

- The first PR commit (`5152ca2`) passed all five GitHub CI workflows, but
  targeted adversarial review found **three reproducible gaps** that the
  original test suite did not cover:
  1. `build_test_matrix` exhausted a small case budget on the first requirement
     and did not report acceptance gaps for later requirements. It now allocates
     proposed cases round-robin, reports uncovered requirement IDs and sets
     `PARTIAL_TEST_PLAN` for truncated output.
  2. `create_context_handoff` could echo common `api_key=...`, Basic-auth and
     PEM private-key shapes. Added best-effort redaction patterns and privacy
     regression cases; never treat redaction as a security guarantee.
  3. `review_code_change` detected removed test assertions but not removed
     authorization guards. It now emits an **unverified** risk signal for
     recognizable deleted access-control guards, not a vulnerability claim.
- The three new regressions **failed before** the fixes and passed afterwards;
  the initial targeted run after the fixes passed **19/19**. A hosted MCP
  regression also covers the budget-fairness behavior.
- **Final independent local gate:** complete Node 22 build and **224/224 full
  tests passed**, no failures/skips. Updated npm dry-run verified **16/16
  intended package files** (0 unexpected/missing, no local scripts, 104,032
  packed bytes). Updated Wrangler 4.135.0 `deploy --dry-run` succeeded
  (882.34 KiB / gzip 203.65 KiB), **without deploying anything**.
- Live read-only MCP `tools/list` on
  `https://god-prompt-mcp.tomi-seregi99.workers.dev/mcp` returned **9 existing
  public tools**, none of the eight new ones. A Cloudflare bot posted a build
  success for the draft branch, but that is **not** proof of a production route
  update. Cloudflare's Git-integrated Workers Builds can deploy `main`
  automatically, independently of the GitHub Actions GHCR publishing guard.
- **Decision:** Do not merge while the repository still labels these new public
  functions as npm version `1.1.1` and while the `main` -> Cloudflare release
  behavior has not been independently reconciled. Finish same-head CI, then
  prepare a deliberate versioned rollout and consumer tests. Keep the combined
  OpenAI Skill/MCP marketplace package as the **last** stage.
