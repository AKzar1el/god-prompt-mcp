# GodPrompt Task Contracts: scope -> execution -> evidence

> **Version 1.1.0 feature.** This document describes the two stateless
> contract tools that extend the original seven tools to nine. Version-pinned
> installations stay on their own schedule; inspect the live tool catalog.

## Why this exists

The original seven tools distribute workflow guidance and classify tasks.
They do not maintain a task-specific scope or check an agent's completion
report. Task contracts make the intended scope and evidence requirements
portable across agents and context resets, with deterministic fail-closed
checks. This is **not** an autonomous executor, secure attestation, or a
replacement for source verification.

## Tool 1: `create_work_contract`

Use `classify_task` first, then supply its task type only after resolving
ambiguity. Set exact scope, outcome-level acceptance criteria, forbidden
actions, and repository-appropriate verification commands. No values are
inferred from the task and no commands are executed.

Example input:

```json
{
  "task": "Add explicit validation for the CSV parser",
  "task_type": "BUILD",
  "risk_level": "medium",
  "allowed_paths": ["src/parser/", "tests/parser.test.ts"],
  "forbidden_actions": ["merge", "deploy"],
  "success_criteria": [
    "Malformed CSV rows fail with a documented validation error",
    "Valid CSV rows preserve the prior output"
  ],
  "verification_commands": ["npm test", "npm run build"]
}
```

It returns a versioned `contract` with stable `AC-xx` and `VC-xx`
identifiers and a SHA-256 content fingerprint, plus definition gaps and a
six-phase workflow. A contract is `DEFINED` only if scope, task type,
acceptance criteria and verification commands are all supplied.

**Path syntax:** exact repository-relative POSIX file names
(`tests/parser.test.ts`) or directory prefixes ending with `/`
(`src/parser/`). No globs, absolute paths, `..`, or drive paths. This
deliberate restriction prevents permissive assumptions about path scope.
Paths are case-sensitive. A contract does not give the agent permission to
write those paths; host and user permissions still govern actions.

## Tool 2: `review_work_evidence`

After the actual agent/CI tools run, supply the exact returned contract and
bounded, **redacted** evidence. Never paste tokens, full private logs, or
personal information. The caller is responsible for truthful provenance.

Example input (abbreviated):

```json
{
  "contract": { "schema": "...", "contract_id": "...", "task": "...",
                "task_type": "BUILD", "risk_level": "medium",
                "allowed_paths": ["src/parser/"],
                "forbidden_actions": ["deploy"],
                "success_criteria": [{"id": "AC-01", "text": "..."}],
                "verification_commands": [{"id": "VC-01", "command": "npm test"}] },
  "changed_files": ["src/parser/parser.ts"],
  "operations_performed": ["edited files"],
  "checks": [
    {
      "id": "VC-01",
      "command": "npm test",
      "exit_code": 0,
      "evidence_excerpt": "All parser tests passed (redacted)",
      "source": "tool_output"
    }
  ],
  "acceptance": [
    {"id": "AC-01", "status": "met", "evidence_refs": ["VC-01"]}
  ],
  "observations": [],
  "human_review_reported": false
}
```

The example contract object above is **schematic**: use the full exact
`create_work_contract` response's `contract`, not ellipses.

The reviewer checks:

- Accidental contract drift (SHA-256; **not** a signature or authorization).
- Missing definitions or receipts, mismatched or failed commands.
- Invalid, traversing, or out-of-scope changed paths.
- Explicitly reported forbidden actions and duplicate receipt IDs.
- Missing acceptance results or evidence references.
- Missing reported human review for high/critical-risk tasks.

It returns one of:

- `HOLD`: requirements are missing, inconsistent, or failed.
- `REPORTED_READY_FOR_INDEPENDENT_REVIEW`: the submitted fields are
  internally consistent, but **all are still untrusted claims**.

The result **always** includes `independently_verified: false` and
`completion_authorized: false`. No read-only MCP tool can know whether
the claimed command actually ran, whether the diff is complete, whether
evidence is genuine, or whether a human really approved it. Inspect original
tool outputs, the actual diff, CI, and exact approvals before claiming
completion. A clean report is *never* permission to deploy or merge.

## High-value interoperability workflow

This is deliberately **client-orchestrated**, not MCP-to-MCP privileged
network access:

1. Use the existing GitHub MCP, Codexify, or your coding-agent host to
   inspect the current repository and determine scope and actual commands.
2. Call GodPrompt `classify_task`, then `create_work_contract`.
3. Run authorized implementation and verification in the existing host.
4. Collect original command outputs and changed-file paths from the host
   or GitHub CI. For web changes, optionally add authorized Playwright
   observations or bounded Web Validator results. These are evidence sources,
   not execution powers granted to GodPrompt.
5. Call `review_work_evidence`. Fix every `HOLD` finding.
6. Independently inspect authoritative evidence and approvals. Hand the
   exact contract and evidence links to another agent/session if needed.

No accounts, external data sources, new API keys, storage or billable
providers are required in GodPrompt MCP. The hosted endpoint is public:
pass only sanitized task metadata and redacted excerpts.

### Optional local evidence bridge

A source-branch **godprompt-proof** Node CLI now provides bounded read-only GitHub CI reads, offline GitHub connector snapshots, parsed Codexify exec_command exports, and a tiny local JSONL lessons file. It does not call a public MCP with user data automatically and does not change the reviewer's trust boundary. See [local proof bridge](local-proof-bridge.md) for usage and security limits.

## Evaluation strategy

This addition is a **hypothesis**, not a proven quality improvement.
Use [GodPrompt Bench](https://github.com/AKzar1el/god-prompt/tree/main/bench)
to compare baseline and treatment on locked-out, outcome-level tasks. Add
measured workflow conditions in a separately reviewed Bench change; do not
quietly modify the frozen 40-task baseline, invent results, or claim
superiority based on deterministic tool unit tests.

Keep exact Git SHA, fixture versions, model, tools, budget and output artifacts
for honest paired comparisons. Security regression cases should specifically
probe forged receipts, out-of-scope paths, denied deployments and false
completion. A stable `HOLD` on false evidence is a functional safety check,
not a measured agent-success uplift.

## Status and release guards

The feature stays on a review branch until the exact-head Node 22/24 build,
stdio and hosted MCP tests, dependency review, distribution packaging, human
review and downstream release effects have been verified. Do not assume a
merged PR automatically updates a hosted Worker or version-pinned package.
