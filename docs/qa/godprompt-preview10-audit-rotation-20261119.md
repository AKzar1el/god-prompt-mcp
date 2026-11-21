# GodPrompt preview.10 — host audit rotation safety

Date: 2026-11-19. Existing isolated development branch:
`feature/codexify-checkpoint-main-mcp-20261118`.

## Live-state verification

The connected Codexify GodPrompt source still reported
`1.1.1-checkpoint-preview.7`, with ten tools, zero reported failures,
and 14/14 healthy upstream sources. Its bridge listener PID 14160 began
at 21:03:46, earlier than preview.9 startup-path staging. The
`~/.codex/config.toml` GodPrompt entry had correctly pointed to preview.9
for the **next** source launch. No global Codexify restart, per-source
reload, or parallel-agent process modification was attempted in this pass.

## Reproduced defect

The opt-in `codexify-audit-checkpoint-observer.mjs` watcher maintained a
byte cursor into a single audit JSONL pathname. When Codexify truncated
the file in place, the watcher set its cursor to the **new file size**
and skipped all newly written records. When rotation replaced the file
with a new inode whose size exceeded the previous cursor, the watcher
resumed at an obsolete offset and skipped early records. A temporary
`ENOENT` gap during rotation could terminate the watcher entirely.

These were reproducible silent checkpoint misses, not authorization
failures. The observer is advisory and remains opt-in.

## Surgical correction

- Capture the audit file identity (device, inode, birth time) when the
  observer starts, without replaying historical audit records.
- On file-identity change or truncation, reset the read cursor to zero,
  clear any partial-line buffer, and consume the **new** file from its
  beginning. Existing same-file incremental reads retain their cursor.
- If the audit pathname temporarily disappears between rotation and
  reopen, retry on a subsequent poll rather than exiting. Unexpected I/O
  errors still surface normally.
- Preserve the original bounded reads, scoped event filtering,
  missing-host-evidence fail-closed behavior, local-only output, and
  no-completion-authorization safety invariants.

## Red/green verification

Before the fix, a new watcher regression reported zero checkpoints after
audit truncation (expected one). With an added temporary rotation gap,
the original implementation exited before finishing the test.

After the fix, all three real filesystem scenarios passed:

1. In-place audit truncation followed by fresh scoped verification.
2. File rotation/replacement followed by fresh scoped verification.
3. File rotation with a temporary absent pathname before recreation.

Each case produced exactly one scoped verification review, retained the
receipt count, and never authorized completion.

| Check | Observed result |
|---|---|
| Focused filesystem rotation/truncation regression | **3/3 passed** |
| Full Node.js 22 test suite | **197/197 passed** |
| Full Node.js 24 test suite | **197/197 passed** |
| npm package allowlist | **13 files**, no local QA, observer script or secret data |
| Offline installed candidate | **6/6** compiled-module SHA-256 hashes match |
| Installed default / opt-in MCP | **9 / 10** tools, respectively |
| Installed realistic task routing | **16/16** correct |
| Installed checkpoint concurrency | **48/48** passed (~51 ms local batch) |
| Installed actual host exit 0 | `REPORTED_READY_FOR_INDEPENDENT_REVIEW` |
| Installed actual host exit 7 | `RECHECK` and `VERIFICATION_FAILED` |
| Fabricated audit ref / contradictory flag | `HOLD` |
| Invalid input privacy / post-error usability | Passed; no private canary leaked |

This release is a correctness/survivability improvement. No claims of
increased MCP throughput or agent productivity are made. The 48-call local
batch throughput and sub-2 ms isolated stdio classification latencies
exclude Codexify transport and model work.

## Remaining limits

The local observer does not intercept or authorize Codexify operations.
It relies on owner-writable audit JSONL rather than signed provenance,
and cannot guarantee catching every write when an audit log is truncated
and rewritten past its old cursor between two polls with identical file
identity. The newly added tests cover ordinary truncate/rotate workflows
and temporary missing-path recovery.

The version bump is for an isolated `preview.10` candidate. The
independently installed test package resides under
`~/.codexify/local-runtime/god-prompt-mcp-dogfood-preview10-20261119`.
Shared Codexify runtime activation still requires a separate authorized
safe lifecycle or future source-scoped reload; isolated tests do not imply
the already-connected MCP has changed versions.
