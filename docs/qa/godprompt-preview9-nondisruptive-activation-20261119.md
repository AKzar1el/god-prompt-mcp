# GodPrompt preview.9 — non-disruptive activation and direct MCP dogfooding

Date: 2026-11-19. Existing isolated branch:
`feature/codexify-checkpoint-main-mcp-20261118`.

## Activation boundary

The shared Codexify service reported GodPrompt
`1.1.1-checkpoint-preview.7` (10 tools) and 14/14 healthy upstream MCP
sources before and after these tests. Codexify 2.4.0 exposed no supported
source-scoped hot-reload action; restarting its shared service would
disconnect other agents. **No shared service restart was performed.**

Instead, the existing `~/.codex/config.toml` GodPrompt stdio args path was
changed atomically to the separately installed preview.9 package, affecting
only that single setting. A rollback backup was created. This prepares
preview.9 for the **next normal Codexify source start**, not for the
currently running GodPrompt source. The optional checkpoint environment
flag remained enabled, and all other MCP settings were preserved.

The actual preview.9 package was started as a separate local stdio MCP
process, initialized through the JSON-RPC MCP protocol, tested, and
shut down afterwards. This provides non-disruptive execution evidence,
**not** an assertion that the shared live source has switched versions.

## Independent installed-package tests

First ran the installed preview.8 candidate, which passed all real
checkpoint workflows but classified one natural investigative request,
`Tell me why Google impressions fell`, as `UNCLASSIFIED` (15/16 realistic
routes). Added a narrow investigation intent expansion for `tell me why`,
`why did`, `why are`, and `why is`, with regression cases and a
content-writing guard example. Bumped the opt-in preview to **.9**.

| Verification | Preview.9 result |
|---|---|
| Full Node.js 22 suite | **196/196 passed** |
| Full Node.js 24 suite | **196/196 passed** |
| npm package allowlist | **13 expected files**, no internal QA/test/watch files |
| Installed source-to-package integrity | **6/6** compiled module SHA-256 matches |
| Default installed local stdio | Base version `1.1.1`, **9 tools** |
| Opt-in installed local stdio | `1.1.1-checkpoint-preview.9`, **10 tools** |
| Realistic intent routing | **16/16 correct** |
| 48 concurrent checkpoint requests | **48/48** passed; 61 ms local batch |
| 60 sequential classifier requests | Median **0.83 ms**, p95 **1.32 ms** local stdio round trip |
| Actual Codexify host exit 0 | `REPORTED_READY_FOR_INDEPENDENT_REVIEW` |
| Actual Codexify host exit 7 | `RECHECK`, with `VERIFICATION_FAILED` |
| Fabricated host reference | `HOLD` |
| Contradictory reported error for successful execution | `HOLD` |
| Invalid private checkpoint field | Redacted error; subsequent valid call succeeds |
| Completion authorized / independently verified | **False** throughout |

The 48-call throughput (~792 calls/sec in this run) and sub-2 ms local
median exclude Codexify transport and model time. They are not an
agent-productivity benchmark or a production latency commitment.

## Trust and concurrency safeguards

- Audit evidence comes from the actual local Codexify JSONL file and is
  still owner-writable, not a cryptographically signed attestation.
- The observer remains off by default. No watcher was left running.
- No unrelated repository, Codexify process, tunnel, Cloudflare
  deployment, GitHub branch or npm release was changed.
- The shared GodPrompt source remained on preview.7 with 14/14 healthy
  upstream sources; after the next approved *normal* source restart,
  verify live preview.9 metadata and repeat the real MCP workflow.
