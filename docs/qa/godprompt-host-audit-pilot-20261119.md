# GodPrompt host-audit checkpoint pilot (local opt-in)

Date: 2026-11-19. Branch: isolated existing `god-prompt-mcp-publish`
feature branch. No publication, host-service replacement, or other-agent edit.

## What changed

The existing `review_codexify_checkpoint` now supports an optional
`checks[].host_audit_ref` in addition to its legacy caller-supplied receipts.
When a host-audit reference is present, the local adapter **never falls back**
to a pasted `exit_code: 0`.

A matching receipt needs all three events in the owner-configured Codexify
JSONL audit: `tool_start` with the exact unredacted command, a successful
`tool_worker_exit` with an exit code, and a completed `tool_finish`.
It must also match the pinned run ID, call ID, transport session, conversation,
and project. Missing/ambiguous/mismatched or stale records fail closed with
`HOST_AUDIT_MISSING_OR_MISMATCH` guidance.
Explicitly contradictory caller error flags or a different named tool also
fail closed, even when a matching host execution exists.

Private source output and command previews are never reflected in checkpoint
results. An 8 MiB bounded file tail is read and only relevant run IDs are
parsed; older events outside the window are **not accepted as proof**.
An optional `GODPROMPT_CODEXIFY_AUDIT_NOT_BEFORE` timestamp limits reuse
of old records, and the observer sets it when starting a new watch session.

Local runtime environment configuration (never put these in public Worker
bindings):

| Environment variable | Meaning |
|---|---|
| `GODPROMPT_CODEXIFY_AUDIT_FILE` | Absolute path to a locally configured Codexify audit `.jsonl` |
| `GODPROMPT_CODEXIFY_AUDIT_CONVERSATION_ID` | Exact owner-selected conversation audit hash |
| `GODPROMPT_CODEXIFY_AUDIT_PROJECT_ID` | Exact owner-selected project audit hash |
| `GODPROMPT_CODEXIFY_AUDIT_NOT_BEFORE` | Optional ISO date-time for workflow freshness |

To make automatic *advisory* reviews, the separate opt-in script
`scripts/codexify-audit-checkpoint-observer.mjs --watch` additionally needs
`GODPROMPT_CODEXIFY_CONTRACT_FILE` (absolute v1 contract JSON file) and
`GODPROMPT_CODEXIFY_CHECKPOINT_REPORT_FILE` (private absolute `.jsonl`).
It recognizes completed host `update_plan`/`rollout_update` calls as
planning milestones, `apply_patch` as implementation, contracted
`exec_command` worker exits as verification, and
`goal_finish`/`turn_completed` as handoff. It writes only redacted summary
codes, counts, statuses and stage names. A `--duration-ms 11000` option
restricts watch lifetime for nonpersistent tests.

The observer script is repository-local and intentionally **excluded** from
the distributed npm package. The optional host audit adapter is packaged
only for local stdio usage and the default public MCP catalog stays at nine
tools; the local opt-in catalog has ten.

## Real execution evidence

An actual `mcp__God_v5__exec_command` running `node --version` was found
in Codexify's existing audit (matching start, successful process exit and
tool finish). With a pinned local scope, the independent installed stdio
candidate returned `REPORTED_READY_FOR_INDEPENDENT_REVIEW` and retained
`independently_verified=false` and `completion_authorized=false`.
An altered call ID returned `HOLD` with no fallback to a fabricated success.

The opt-in observer was run for 11 seconds against this live host audit.
A *new* `node --version` command was then run through Codexify; without an
agent calling the checkpoint function, the observer emitted one
`verification` stage report with one matched check. The observer exited
cleanly with zero errors.

## Small paired pilot: observer off vs on

Four harmless host tool calls were performed in each arm, including one
intentionally unsuccessful Node process exit. Measured mean tool-call
round-trip latency:

| Observer | Mean round trip |
|---|---:|
| Off | 3.34 seconds |
| On | 3.24 seconds |

The observed arm had one unrelated/unclassified tool-call error, and only
three matching completion events were recorded. The observer automatically
reported a missing required check and the intentional failure with
`RECHECK` guidance. **This is not a statistically valid claim of a speedup
or higher agent productivity.** It demonstrates automatic detection and
provides an early overhead check.

The current pilot has no independent human evaluator, randomized agents,
matched real project changes, cost/token accounting, or validated rework
measure. A meaningful productivity claim requires a controlled comparison
of first-pass QA success, total task time, tokens, rework and defect escapes.

### Audit lookup overhead and optimization

A first implementation scanned/split the bounded audit tail and took around
112-151 ms per audit-linked review in local trials. An initial search by
run ID performed poorly because many host events share one run ID. The
final implementation searches the raw bounded tail by exact numeric call ID,
then checks run ID, scope, command and complete event lifecycle.

After optimization, a paired *local* 50-call check gave:

| Checkpoint evidence mode | Median | 95th percentile |
|---|---:|---:|
| Caller-supplied legacy envelope | 0.49 ms | 1.43 ms |
| Host audit-correlated receipt | 12.57 ms | 19.46 ms |

Another 60-call audit correlation run matched 60/60 host references, with
21.17 ms median and 34.74 ms p95 (different sample/workload). This is
incremental computation time, not transport/tool-calling latency or a proof
of agent productivity. The additional provenance costs CPU and file I/O,
but avoids asking an agent to paste or reproduce a command's success JSON.

### Final regression and installed-package verification

| Test | Result |
|---|---|
| Node.js 22 complete test suite | **189/189 passed** |
| Node.js 24 complete test suite | **189/189 passed** |
| New focused host audit and observer tests | **5/5 passed** |
| Package dry-run allowlist | **13 files**, no tests/observer/private QA docs |
| Offline installed candidate | **6/6 compiled-module SHA-256 matches** |
| Installed default MCP | `1.1.1`, **9 tools**, 4/4 representative classifications |
| Installed local opt-in MCP | `1.1.1-checkpoint-preview.6`, **10 tools**, 4/4 representative classifications |
| Installed host audit correlation | Real host record accepted; altered call ID returned **HOLD** |
| Invalid MCP input | Rejected without leaking private test markers |

The initial preview.6 candidate was installed separately. After the last
adversarial contradictory-error handling change, the **final** candidate was
repacked into
`~/.codexify/local-runtime/god-prompt-mcp-hostaudit-preview6-final-20261119`
and all six installed compiled-module SHA-256 digests matched the source.
Direct calls to the final installed MCP confirmed 10 opt-in tools, genuine
host-audit correlation, a `HOLD` for a mismatched audit reference, and a
`HOLD` when an otherwise valid host reference had contradictory `isError`
metadata. Both decisions preserved `completion_authorized=false`.
The exact package allowlist was also updated in the distribution regression
test; both full 189-test Node 22 and Node 24 suites passed afterward.

## Critical trust and deployment limits

- Codexify's audit file is host-written but **writable by the local owner**:
  correlation is not a cryptographically signed tool receipt. A sufficiently
  privileged local process could fabricate audit JSONL. Do not label the
  result independently verified.
- The host audit records contain metadata and sometimes redacted command
  previews; protect the log with local ACLs, avoid copying it into the repo,
  and never expose raw records through public MCP or cloud storage.
- The observer reacts to events **after** they occur. It is **not in-band
  host enforcement**, cannot stop an unauthorized action, and cannot supply
  independent acceptance or change-diff evidence.
- The pilot is off by default. Do not enable globally across unrelated
  agents: scopes and audit files must be selected per intended conversation.
- For true enforcement, Codexify itself must bind receipts to authorized
  call/session identities, sign/attest or protect them with host-level
  capabilities, and expose a synchronous pre-action checkpoint hook. That
  requires a separate host-code integration and independent security review.
