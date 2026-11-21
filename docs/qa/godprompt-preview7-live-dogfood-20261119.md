# GodPrompt preview.7: live dogfooding, robustness and efficiency

Date: 2026-11-19. Worktree:
`feature/codexify-checkpoint-main-mcp-20261118` in the existing
`god-prompt-mcp-publish` workspace.

## Actual live baseline

The connected Codexify source ran `1.1.1-checkpoint-preview.6`, reported
ten connected GodPrompt tools and 14/14 healthy upstream MCP sources.
Six live documentation/version tools returned their expected payloads.
A real `node --version` and `git diff --check` were executed through
Codexify, then passed as command envelopes with a generated contract to a
real live handoff checkpoint. The result was
`REPORTED_READY_FOR_INDEPENDENT_REVIEW`, with
`independently_verified=false` and `completion_authorized=false`.

In a first ten-prompt live classifier probe, two intended task types were
misrouted: `Find why Google traffic collapsed ...` was `UNCLASSIFIED`;
`Implement and test an MCP audit tool` was `ANALYZE` rather than `BUILD`.

## Fixes

1. **Natural-language intent:** recognize `find why`,
   `find the root cause`, and `identify` as analysis signals. Give
   explicit leading `build`/`implement` requests priority over incidental
   QA terms such as `test` and `audit`. Preserve specialized automation,
   mixed debug, and downstream shipping priorities.
2. **Shared host audit isolation:** previously, unrelated agent worker-exit
   events and scoped but irrelevant tool starts could occupy the bounded
   observer call cache and evict pending verifications. Process only scoped,
   relevant starts and known worker exits; discard completed milestone and
   verification calls from that cache.
3. **Unbounded memory:** a persistent observer accumulated all checkpoint
   summaries for its shutdown report. Replace this with counters and the
   latest 32 stage names, while preserving every written local review.
4. **Host provenance:** correlate `tool_start`, `tool_worker_exit`, and
   `tool_finish` in their actual JSONL order, with nondecreasing timestamps.
   A collection of matching but reversed host records cannot masquerade as
   one completed execution.
5. **Audit lookup scaling:** for multiple host references, read a bounded
   audit tail *once*, scan for requested numeric call IDs, then independently
   enforce command, project, conversation, run, session, freshness, exact
   lifecycle, exit status, and contradictory-error checks for each receipt.
   Keep the fast exact-call-ID path for single checks.

## Comparative observations

| Measurement | Installed preview.6 | Patched source |
|---|---:|---:|
| Curated realistic task routing | 15/20 | **20/20** |
| Classified calls in interleaved local stdio benchmark | ~1,116/s | ~1,084/s |
| 30 host audit checks, 7 MiB synthetic audit log | 583 ms | **27.7 ms** |

The two throughputs are within workload/host variance; do **not** claim a
classifier speedup. Audit batching was approximately **21x faster** on this
specific synthetic fixture, without skipping any of the 30 correlation
checks. Initial single-check measurements include cold-start variation.

An automatic-observer regression generated 4,100 unrelated worker exits,
4,100 scoped but irrelevant tool starts, a real-shaped required verification
and 43 milestone summaries. The earlier observer reproducibly missed the
required verification; the revised one retained it, persisted all 43
reviews, and bounded the in-memory stage summary to 32.

## Verification and deployment boundary

| Verification | Observed result |
|---|---|
| Full Node.js 22 suite | **192/192 passed** |
| Full Node.js 24 suite | **192/192 passed** |
| Exact npm package allowlist | **13 files**; no internal tests, scripts or private QA docs |
| Offline installed candidate | **6/6** compiled-module SHA-256 hashes match |
| Default installed MCP | Base version `1.1.1`, **9 tools**, 5/5 realistic routes |
| Local opt-in installed MCP | `1.1.1-checkpoint-preview.7`, **10 tools**, 5/5 realistic routes |
| Actual Codexify command provenance | Correlated genuine command, reported ready for independent review |
| Altered host reference / contradictory error flag | **HOLD** on both, no independent authorization |
| Shared audit noise and observer history test | **8,200** unrelated events, **43** persisted reviews, required check preserved, memory summary bounded to **32** stages |

Verified local candidate directory:
`~/.codexify/local-runtime/god-prompt-mcp-dogfood-preview7-20261119`.

- Audit JSONL is **owner-writable**, not a signed/attested execution record;
  this check never authorizes a deployment or substitutes for independent
  human review.
- The automatic observer remains **off by default** and watches only an
  explicitly selected local conversation/project with a local contract.
- No global observer enablement, Codexify service restart, remote push/merge,
  public npm publication or Cloudflare deployment is part of this pass.
