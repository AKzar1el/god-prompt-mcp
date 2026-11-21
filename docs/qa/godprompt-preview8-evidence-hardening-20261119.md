# GodPrompt preview.8 — live MCP and host-evidence hardening

Date: 2026-11-19. Isolated existing branch:
`feature/codexify-checkpoint-main-mcp-20261118`.
Live Codexify service, parallel agent worktrees, and all public deployments
were left unchanged.

## What was tested

- The connected `god_prompt_mcp` source was healthy at preview.7:
  10 tools and 13/13 healthy sources at initial check. Eight live realistic
  task descriptions routed correctly across ANALYZE, BUILD, PLAN, AUTOMATE,
  DEBUG, REFACTOR and SHIP.
- A bounded read of the **actual local Codexify audit** confirmed that
  nonzero command exits normally produce ordered `tool_start`,
  `tool_worker_exit` (success=false, exit_code greater than zero), and
  `tool_finish` (status=error) records.
- A fresh `node --version` exit 0 and deliberately failing `node -e`
  exit 7 were invoked through Codexify. The separately installed preview.8
  build correlated both genuine event sequences, without copying output.

## Reproduced bugs and surgical corrections

1. **Silent missing verification event.** The observer previously emitted
   no checkpoint if a contracted `exec_command` had a `tool_finish` but
   no `tool_worker_exit`. The original test reproduced zero checkpoints.
   It now emits a conservative verification `RECHECK` with
   `HOST_AUDIT_MISSING_OR_MISMATCH`, never inventing an exit code.
2. **Incorrect failure diagnosis.** Real nonzero host exits were previously
   classified as missing audit evidence. Correlation now accepts a
   *consistent, explicitly failed* host lifecycle (exit code greater than
   zero, worker success=false, finish status=error) as evidence of a
   **failed command**, returning the actual exit code to the reviewer.
   The checkpoint reports `VERIFICATION_FAILED` and `RECHECK`.
   Inconsistent combinations, unknown scope, missing records and pasted
   fake successes still fail closed. Caller error flags still disqualify a
   supposedly successful exit 0.
3. **Unintended infinite watcher.** `--watch --duration-ms 0`, malformed
   duration values, or a misspelled argument could previously result in an
   unbounded observer session. Explicit durations must now be positive
   integers; unknown/duplicate arguments are rejected with exit status 2.
   Deliberate `--watch` without a duration remains opt-in continuous
   monitoring.

## Final verification

| Check | Result |
|---|---|
| Full Node.js 22 suite | **196/196 passed** |
| Full Node.js 24 suite | **196/196 passed** |
| Focused audit / observer suite | **12/12 passed** |
| npm package allowlist | 13 files; no QA docs, tests, watcher script or private audit logs |
| Isolated offline npm installation | 6/6 compiled-module SHA-256 matches |
| Installed stdio, default | Base `1.1.1`, 9 tools; 4/4 representative classifications |
| Installed stdio, opt-in | `1.1.1-checkpoint-preview.8`, 10 tools; 4/4 classifications |
| Real host exit 0 | `REPORTED_READY_FOR_INDEPENDENT_REVIEW` |
| Real host exit 7 | `RECHECK` and `VERIFICATION_FAILED` |
| Explicit forged / contradictory evidence | Refused by existing tests |

The additional malformed-duration/unknown-argument test was repeated
successfully after the full cross-version suites. Startup under parallel
test load required a realistic 15-second test timeout; the first 2.5-second
test timeout failed intermittently, but not because the product accepted
an invalid duration.

Installed local test candidate:
`~/.codexify/local-runtime/god-prompt-mcp-dogfood-preview8-20261119`.

### Local performance comparison

Each installed version corroborated 35 identical recent genuine successful
host-audit references, with alternating order and no host transport calls.

| Version | Median audit correlation | p95 |
|---|---:|---:|
| Installed preview.7 | 21.34 ms | 24.98 ms |
| Installed preview.8 | 21.13 ms | 36.09 ms |

These small samples show no defensible general speedup or slowdown. The
improvements here are **correctness, diagnostic accuracy, and safer CLI
behavior**, not a throughput claim.

## Deployment and trust limitations

- Audit JSONL is host-written but owner-writable, not cryptographically
  attested. Correlation is advisory evidence and never authorizes task
  completion, publication, deployment, spending or merge.
- The observer is an optional local script, not in-band host enforcement.
  No persistent observer, service restart, global configuration change,
  push, merge or npm publication occurred in this development pass.
- The parallel Codexify Windows restart-guard patch remains in its separate
  isolated branch and was not modified by this work.
