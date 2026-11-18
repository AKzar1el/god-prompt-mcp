# Codexify mid-run checkpoint test kit (DRAFT - no release)

**Scope:** source-only experimental work on a draft branch. The checkpoint
engine now lives in `src/codexify-checkpoint.ts`; the receipt adapter lives in
`src/codexify-evidence.ts`. The main local stdio MCP and this compatibility
pilot call those same implementations. Neither module is imported by the
hosted Cloudflare Worker or the OpenAI/ChatGPT skill. None of these changes
has been merged or published in the currently released npm binary.
No deployments, cloud database, plugins, hooks, scheduled jobs, telemetry,
remote storage or new API credentials are created by this kit.

## Why and how

The shipped GodPrompt review_work_evidence tool reports HOLD for missing
contract evidence. Codexify can call that check **at multiple milestones**,
not just at the end. An MCP cannot independently interrupt an agent:
the Codexify agent must invoke the checkpoint and obey its result.

The optional local runner and main stdio tool share a single Codexify receipt
adapter, checkpoint evaluator, and the existing `reviewWorkEvidence`
function. They add no new dependencies, network, automatic writes or
background services.

The runner does NOT independently authenticate execution, verify the diff,
or approve work. Even an internally consistent report is only
REPORTED_READY_FOR_INDEPENDENT_REVIEW, never permission to ship.

## Offline demonstration - no Codexify call

From an independent test checkout of this **draft branch**, after verifying
its origin, HEAD and source instructions:

~~~powershell
npm ci
npm run build
node experiments/codexify-checkpoints/demo.mjs
node --test tests/codexify-checkpoints.test.mjs
~~~

The demo prints synthetic planning, verification and handoff stages.
It deliberately uses a FAKE successful receipt at handoff to illustrate
that reported readiness is not independent verification. No feedback file
is written by this demo.

## Later: opt-in real Codexify pilot

1. Use the existing authorized Codexify session to call the GodPrompt
   create_work_contract tool with real scoped allowed_paths, forbidden
   actions, observable success_criteria and exact verification_commands.
2. Save only the exact returned contract object, not the full MCP envelope.
3. Capture a redacted export of real Codexify mcp__God_v5__exec_command
   receipts as documented in docs/local-proof-bridge.md. The CLI does not
   run verification commands by itself.
4. Prepare a PRIVATE local JSON input. Its shape is:

~~~json
{
  "stage": "verification",
  "contract": {
    "schema": "godprompt.work_contract.v1",
    "contract_id": "SHA256_ID_RETURNED_BY_THE_REAL_TOOL",
    "task": "A real task",
    "task_type": "BUILD",
    "risk_level": "medium",
    "allowed_paths": ["src/"],
    "forbidden_actions": ["deploy"],
    "success_criteria": [{"id": "AC-01", "text": "Observable result"}],
    "verification_commands": [{"id": "VC-01", "command": "npm test"}]
  },
  "codexify_export": {
    "changed_files": ["src/parser.mjs"],
    "operations_performed": ["edited source files"],
    "checks": []
  },
  "acceptance": [],
  "observations": [],
  "human_review_reported": false
}
~~~

The contract above is SCHEMATIC ONLY. Always use the exact real
create_work_contract response, including the genuine contract hash.
Keep the input file private and do not include secrets or raw source.

5. In the same authorized checkout, with Node.js 22+:

~~~powershell
node experiments/codexify-checkpoints/checkpoint.mjs --input checkpoint-input.json
~~~

Inspect the JSON status, recheck and pending entries. RECHECK and HOLD
are VALID tool evaluations and intentionally exit zero: Codexify may
otherwise wrap nonzero terminal results as errors and hide the report.

| Stage | Missing checklist items | Unsafe or failed evidence |
|---|---|---|
| plan | Pending for later stages | RECHECK |
| implementation | Tests and acceptance pending | RECHECK immediately |
| verification | Missing/failed tests -> RECHECK; acceptance may be pending | RECHECK |
| handoff | HOLD | HOLD |

Even the final REPORTED_READY_FOR_INDEPENDENT_REVIEW requires original
source evidence, CI, diff and actual human authorization inspection.

### Optional agent instruction for a future supervised test

> At the start of authorized coding, create and preserve a task contract.
> Before editing, after implementation, after running verification, and
> before claiming completion, call the local checkpoint runner with the
> latest redacted real receipts. If RECHECK or HOLD appears, reconcile
> those codes, correct the work and repeat the checkpoint. Pending items
> must be revisited at their due stage. The runner provides advice, not
> extra permission. Never auto-merge, deploy, submit, spend, or claim
> independent verification based on it.

This is agent-driven opt-in guidance, **not** a host-enforced lifecycle hook.
The current God v5 tool inventory does not advertise generic mid-run hook
registration. A server instruction alone cannot forcibly interrupt an
agent; start with explicitly supervised calls and verify each live result.

## Preferred next integration: one local opt-in tool in the main MCP

This **draft-only** integration is the recommended target instead of running
two separate MCP implementations. The existing main MCP keeps all nine
published tools with the flag absent. In a NEW local session, start its
Node stdio entrypoint with the exact opt-in:

~~~powershell
$env:GODPROMPT_CODEXIFY_CHECKPOINT = '1'
node dist/stdio.js
~~~

For a future Codexify source configuration, supply that environment variable
to the **existing** GodPrompt stdio source and pin its Node command to a
reviewed checkout that includes this branch. Then inspect the **live**
model-visible tool catalog before using it: exactly ten tools means the
opt-in has loaded. The new tool is `review_codexify_checkpoint`, read-only
with phases `plan`, `implementation`, `verification`, and `handoff`.
The MCP instructions tell cooperative agents to call it at those milestones,
including after receiving a failed verification receipt. This remains a
cooperative workflow, not automatic interception or permission escalation.
Malformed/error-marked receipts cannot turn an exit_code of zero into success.

Do not modify or restart another agent's active MCP process or checkout.
For rollback, omit the opt-in flag or restore the previously backed-up local
Codexify config; the default server always exposes the original nine tools.
No global skill, hook, scheduled task, or production configuration needs to
be changed for the isolated verification.

## Legacy local stdio MCP pilot (compatibility only, not the public Worker)

`mcp-stdio.mjs` retains the existing pilot identity and exactly one
**read-only** MCP tool, `review_codexify_checkpoint`. It now registers the
same checkpoint tool and receipt adapter as the opt-in main MCP,
and reports `RECHECK` / `HOLD` as ordinary results so agents can correct
missing work without treating a checklist finding as a transport failure.

For a supervised one-shot local Codexify run with a redacted input file:

~~~powershell
node experiments/codexify-checkpoints/pilot-call.mjs --input private-checkpoint.json
~~~

The one-shot client starts its own child MCP process and closes **only that
child** when finished. It does not touch other Codexify workers, agents,
sessions, Git branches, global configuration, or remote services.

The old `[mcp_servers."godprompt-checkpoint-pilot"]` source remains usable
for existing sessions. Prefer a single main source with opt-in for new
supervised trials once its exact checkout and catalog have been verified.
An already-running agent may keep its cached tool catalog; a configuration
edit is **not** proof of a live refresh and must not trigger a forced restart.

At plan / implementation / verification / handoff, have Codexify call the
pilot tool explicitly with the exact task contract and redacted Codexify
`exec_command` receipt envelopes. `RECHECK` means fix/check and repeat;
`HOLD` means do not finish; reported-ready never means verified.

The pilot source is not packaged in the published npm `files[]`, and
requires its isolated checkout's Node 22+ dependencies. Do not remove
that test checkout while the Codexify pilot configuration refers to it.

### MCP protocol verification

~~~powershell
node --test tests/codexify-checkpoint-stdio.test.mjs
npm test
~~~

This includes a real JSON-RPC initialization, tool discovery, simultaneous
calls with independent data, invalid-input handling and the one-shot caller.

## Cloud persistence - future interface ONLY

The pure cloudSafeCheckpointSummary function emits an allowlisted record
of stage/status, fixed issue codes and counts. It DOES NOT save or
transmit data. It excludes full contracts, commands, code, diffs, private
paths, raw logs and notes.

In the future, a cloud adapter could store those summaries per
authenticated user and task with server-verified tenant isolation,
short TTL, encryption, quotas, access controls and deletion handling.
Cloudflare KV or R2 might be suitable after investigating the exact
consistency/security/cost needs. Do not attach unauthenticated
per-user storage to the public anonymous MCP endpoint.
A SHA of a project name is NOT user authentication.

## No-publish boundary

This `experiments/` folder is not in package.json published files[] and is
not imported by the hosted Worker. Two new compiled modules are listed in
the draft npm files[] for a possible *future* release, but the local MCP
entrypoint only registers its extra tool when explicitly enabled. Keep the
PR as a DRAFT. Do NOT merge, tag,
publish npm or MCP Registry, deploy Cloudflare, or refresh ChatGPT tools
as part of this test preparation.
