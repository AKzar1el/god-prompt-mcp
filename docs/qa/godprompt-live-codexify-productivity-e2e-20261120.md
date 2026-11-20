# GodPrompt Preview 10 — live Codexify end-to-end and productivity audit

Date: 2026-11-20 (Europe/Ljubljana). This is a **live connected-tool audit**
with source-level regression work in a separate local feature branch. It is
not a controlled study of model output quality or developer throughput.

## Scope, environment, and boundaries

- Existing Codexify God v5 connection, not a second MCP connector or a
  stand-alone subprocess passed off as live integration.
- Live `mcp_list_sources`: **14/14 connected**, including
  `god_prompt_mcp` version `1.1.1-checkpoint-preview.10` with **10 tools**.
  `get_version` reports GodPrompt content `1.0.0`, underlying MCP `1.1.1`.
- Existing localhost `/health` additionally exposes 18 upstreams. The
  previously installed 15-minute MCP health-watch task remains independent.
- **No service restart, production deployment, PR merge, remote push,
  spending, change to other agents' worktrees or live knowledge mutation.**
  Tests use small, bounded examples and a read-only real host command.

## Tool-by-tool functionality

All ten live GodPrompt tools were discovered and invoked:

| Tool | Live evidence / finding |
| --- | --- |
| `get_version` | Returns server/content version and catalog metadata |
| `get_core_skill` | Returns ~32,498 characters of complete core guidance |
| `get_protocols` | Returns 13,544 characters of reference guidance |
| `get_gates` | Returns 9,517 characters of verification guidance |
| `get_anti_patterns` | Returns 8,745 characters of anti-pattern guidance |
| `get_god_prompt` | Returns a **truncated** 38,928-character display of the 64,568-character source: a real transport/output-size limitation |
| `classify_task` | Routes six timed samples correctly; earlier live coverage included all nine types, negated shipping, ambiguous inputs and Unicode |
| `create_work_contract` | Generates deterministic fingerprint and IDs; missing allowed scope returns `NEEDS_DEFINITION`, not false readiness |
| `review_work_evidence` | Correctly distinguishes caller-reported readiness from independent verification; blocked failed/mismatched receipts |
| `review_codexify_checkpoint` | Live plan → implementation → verification → handoff with a genuine Codexify `exec_command` response reached `REPORTED_READY_FOR_INDEPENDENT_REVIEW` at handoff; never grants authorization |

### Real end-to-end workflow and receipt format

A read-only PowerShell self-test of the existing MCP health monitor was
run using **`mcp__God_v5__exec_command`**. The actual host result had
exit code **0** and a passing self-test line. A scoped ANALYZE contract
was created with one acceptance criterion and one exact command. The
checkpoint progression was:

| Stage | Status | Explanation |
| --- | --- | --- |
| Plan, no receipts | `CONTINUE_WITH_PENDING_ITEMS` | Required check and acceptance are pending |
| Implementation, real receipt | `CONTINUE_WITH_PENDING_ITEMS` | No outstanding recheck |
| Verification, real receipt | `CONTINUE_WITH_PENDING_ITEMS` | No outstanding recheck |
| Handoff, real receipt | `REPORTED_READY_FOR_INDEPENDENT_REVIEW` | Independent verification and completion authorization remain **false** |

The checkpoint adapter requires a **nested Codexify host envelope**,
different from the portable review tool's flat checks:

```json
{
  "id": "VC-01",
  "command": "<exact contracted command>",
  "tool": "mcp__God_v5__exec_command",
  "response": {
    "upstream_result": {
      "exit_code": 0,
      "output": "<bounded, redacted command output>"
    }
  }
}
```

This example describes **shape**, not an authentication signature. The
true payload must come from the actual host tool result. Reusing a flat
`review_work_evidence` receipt here produced `VERIFICATION_FAILED` and
`ACCEPTANCE_EVIDENCE_MISSING`. Poor adapter discoverability caused
unnecessary false-looking HOLD results. The tool description and
instructions were improved in isolated source with a regression test.

## Adversarial effectiveness

- Portable evidence reviewer: **8/9 expected** on the live Preview 10.
  Failed checks, wrong commands, duplicated receipts, out-of-scope paths,
  missing acceptance citations, self-reported success, and missing
  high-risk human review all caused `HOLD`.
- **Reproduced defect:** an ordinary restriction, `Do not deploy or
  publish`, did **not** flag an operation `deploy to production`.
  The legacy matcher handled an atomic `deploy` string but not a
  negated compound sentence. A new test failed against old source (RED).
  The isolated source now extracts only known action verbs from explicit
  negative restrictions, including deploy/publish/restart variants, and
  the targeted test passes (GREEN). This remains **staged, not live**.
- Codexify checkpoint adapter: **8/8 expected** with genuine-shaped or
  deliberately adversarial receipts. Nested MCP error, explicit failed
  status, wrong tool identity, missing host-audit match, failed process
  exit, and missing check all returned `HOLD`. The clean case returned
  `REPORTED_READY_FOR_INDEPENDENT_REVIEW`, never authorization.
- Malformed-input probes: **4/4 rejected** (invalid classifier input,
  missing contract task, invalid checkpoint stage, malformed contract).
  A synthetic private canary was not echoed in failure messages.
- These tools review **caller-supplied evidence**. A forged host-shaped
  success can still look reported-ready without matching local audit
  events; the tool explicitly refuses to call it independently verified.
  The local host-audit correlation is not configured in the live source.

## Real latency and productivity findings

Measurements cover bridge/network/tool round trips on one busy Windows
machine, **not** model generation time or agent code-quality uplift.

| Observation | Actual result |
| --- | ---: |
| Six sequential `classify_task` calls | 14.804 s total |
| Median classification call | 2.444 s |
| Range across those six calls | 1.731–4.228 s |
| Three simultaneous classification calls | 5.530 s wall time |
| One direct real PowerShell self-test | 4.332 s via Codexify |
| Four checkpoint-stage calls, same task | 9.951 s total |
| Reference retrieval calls | ~1.9–3.1 s each |

**Utility:** routing + scoped contracts + evidence checks exposed concrete
gaps before handoff and reliably withheld unverified approval. For a
trivial read-only self-test, however, multiple MCP calls added more time
than the original command. The complete 63 KB payload is also costly and
truncates at the current bridge limit; focused references are better.

**No defensible overall productivity percentage is available.** A valid
claim that GodPrompt increases completed coding tasks/hour or reduces bugs
needs paired, matched, blind agent experiments with and without the tool,
real work products, independent reviewers and equivalent compute budgets.
This audit measures tool overhead and guardrail behavior, not that outcome.

## Local-only staged improvements and release gate

1. Prior isolated commit added backward-compatible `get_god_prompt`
   `start`/`maxChars` chunking, tested lossless in local stdio. **Not yet
   active in Codexify**.
2. Current isolated source fixes natural-language forbidden action
   matching with red/green regression coverage.
3. Current isolated source improves the checkpoint tool's description
   with the correct nested Codexify command envelope. A test failed
   before the description was updated and passes afterward.
4. **Verification completed:** TypeScript build exited 0; targeted
   regressions passed **29/29**; updated full suite passed **199/199**
   on Node 22 and **199/199** on Node 24. Both full runs used
   `NODE_OPTIONS=--max-old-space-size=256` and
   `node --test --test-concurrency=1 tests/*.test.mjs` to prevent memory
   pressure on the shared host. Both had zero failures, skips or
   cancellations. `npm pack --dry-run --ignore-scripts --json` succeeded
   with exactly **13 intended package files**, excluding this report,
   tests and local health-monitor scripts; `git diff --check` passed.
   No live reload during concurrent agents.

## Product gaps and prudent next actions

- **Observer is not active:** only the opt-in MCP checkpoint is running;
  there is no independent observer process and no host-audit environment
  configured for automatic interception. Codexify does not enforce these
  advisory `RECHECK`/`HOLD` outputs on unrelated agents by itself.
- **No automatic tool-level healing:** Codexify PR #11's independent
  targeted reload work is a separate deployment decision. The existing
  health watch detects source disconnections but intentionally never
  interrupts parallel agents or restarts shared services.
- **Adoption guidance:** use lightweight classification and targeted
  references for routine tasks; invoke contracts and checkpoints when
  scoped code edits, risks, or real verification evidence matter. Never
  interpret `REPORTED_READY_FOR_INDEPENDENT_REVIEW` as permission to
  deploy, merge or declare independent verification.
- **Needed productivity study:** instrument reproducible matched coding
  tasks across baseline versus GodPrompt, capture actual tool latency,
  tests, escaped bugs, independent acceptance and total agent time.
  This is **not** implemented by the present ad-hoc smoke tests.

The observed live Preview 10 remains available while changes are
staged locally. No environment-wide restart was attempted during audit.
