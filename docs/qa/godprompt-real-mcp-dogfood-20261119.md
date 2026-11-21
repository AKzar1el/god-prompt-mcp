# GodPrompt: live MCP dogfooding and classifier refinement

Date: 2026-11-19. Workspace: isolated existing Codexify
`god-prompt-mcp-publish` worktree. No edits to other agents' checkouts.

## Why this change was needed

The previous QA focused on unit, schema, error, and load tests. This pass
instead **called the live GodPrompt MCP** with actual engineering requests
(DigestSEO search forensics, quant risk reviews, Codexify transport fixes,
MCP feature work, release planning, and publishing).

On 16 deliberately varied realistic prompts:

| Implementation | Correct routes |
|---|---:|
| Current installed `1.1.1-checkpoint-preview.4` | **8/16** |
| Patched, freshly built stdio MCP (before preview.5 packaging) | **16/16** |

Observed real issues:

- `Investigate`, `find out`, `look into`, `determine whether`, `examine`,
  and `compare` were missing as analysis intent, sometimes leaving tasks
  UNCLASSIFIED or routing a comparison of releases to SHIP.
- Incidental `broken` could misroute a request to **investigate** a broken
  system into DEBUG, even without authorization to change the system.
- Requests for a release **proposal** could route to BUILD because they
  mentioned a new feature.
- A genuine **fix** request with `and add tests` could route to BUILD.
- Creating/editing release **notes** could route to BUILD instead of CONTENT;
  reviewing or publishing those notes has a different workflow.

## Actual tool-chain check

A real `mcp__God_v5__exec_command` call returned `node --version` and exit
code 0. Its structured result was passed as a caller-supplied receipt into a
real `review_codexify_checkpoint` handoff with a generated
`create_work_contract`. The checkpoint returned
`REPORTED_READY_FOR_INDEPENDENT_REVIEW` with
`independently_verified=false` and `completion_authorized=false`.
This is intentional: a plausible receipt is not independently authenticated
evidence or authority to deploy or merge.

## Changes and optimizations

- Add natural investigation verbs and phrases to ANALYZE routing; use its
  trigger list for the inspection guard to eliminate a duplicated keyword list.
- Distinguish release nouns and planning proposals from requested shipping,
  while preserving explicit multi-action build/deploy instructions.
- Treat supportive tests/logging added during debugging as part of DEBUG,
  not an independent feature build.
- Cache regexes **only by internal static trigger strings** rather than
  compiling duplicate boundary/global patterns for every classification.
  `matchAll` clones the cached global RegExp, avoiding shared `lastIndex`
  mutation across requests.

## Performance interpretation

Live tool-call timing includes connector/host overhead; standalone stdio
comparisons avoid most of that overhead but remain subject to CPU contention
and process warm-up. One interleaved workload
after caching returned **335 vs. 267 classifications/second** for the patched
and installed versions (1,600 calls each). Earlier short runs varied, so
this is a local observation, **not a stable production speed guarantee**.
Prioritize correctness and maintainability over a single throughput number.

## Verification of the actual installed candidate

| Check | Result |
|---|---|
| Node 22 full `npm test` | **184/184 passed** |
| Node 24 full test suite | **184/184 passed** |
| Local npm pack dry-run | **12 files**; no tests, experiments, or internal QA docs |
| Offline installed distribution hashes | **5/5** compiled modules matched the build |
| Fresh default installed stdio server | Base version `1.1.1`, **9 tools**, **12/12** realistic routes |
| Fresh local opt-in installed stdio server | `1.1.1-checkpoint-preview.5`, **10 tools**, **12/12** realistic routes |
| Opt-in checkpoint failure handling | Missing proof returned **HOLD**, independently verified and authorized both false |
| Opt-in malformed/private input | Rejected without reflecting private test keys |

Candidate: `~/.codexify/local-runtime/god-prompt-mcp-dogfood-20261119`.
These are checks against the **new installed candidate**, not a claim that
the existing shared Codexify process has already loaded it.

## Safety and release boundary

- Existing default nine-tool catalog and published/cloud tools are unchanged.
- Local opt-in retains ten read-only tools and advisory checkpoint review.
- No live Codexify restart, Cloudflare changes, push, merge, npm publication,
  or independent-completion claim is part of the development verification.
- Staged preview should be checked with the real live source catalog after
  a later controlled restart, when parallel agents can reconnect safely.
