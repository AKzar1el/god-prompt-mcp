#!/usr/bin/env node
/**
 * V16 research candidate: choose when GodPrompt guidance might add value.
 *
 * Pure, bounded, no command execution and no automatic MCP calls. Outputs a
 * recommendation from untrusted caller-supplied evidence, not verified proof.
 * Intentionally not registered with production GodPrompt or enabled by default.
 */
const ACTIONS = Object.freeze({
  SCOPE_HOLD: "HOLD_SCOPE",
  NO_CHANGE: "NO_CHANGE_EVIDENCE",
  EXPECTED_RED: "EXPECTED_RED_IMPLEMENT_FIX",
  INVESTIGATE: "DIAGNOSE_FAILED_CHECK",
  RUN_TEST: "RUN_REAL_TEST",
  REVIEW_DIFF: "REVIEW_DIFF",
  NONE: "NO_EXTRA_GUIDANCE",
});
const SHORT = Object.freeze({
  HOLD_SCOPE: "Found changed files outside declared allowed paths. Stop additional edits and reconcile scope before proceeding.",
  NO_CHANGE_EVIDENCE: "No changed files were supplied. Confirm whether the requested coding fix exists before claiming a result.",
  EXPECTED_RED_IMPLEMENT_FIX: "A reproduced failure before the fix is expected. Implement the scoped fix and run the regression again before requesting more guidance.",
  DIAGNOSE_FAILED_CHECK: "Inspect the first actual failing check and its exit status. Reproduce and isolate cause; fix only in scope, then rerun the affected test.",
  RUN_REAL_TEST: "Run the relevant native test command, capture its real exit code and output. Do not present guidance as execution evidence.",
  REVIEW_DIFF: "Inspect the actual changed-file diff and paths. Confirm only intended code changed; report any unresolved scope risk.",
  NO_EXTRA_GUIDANCE: "",
});

function boundedString(x, max) {
  return typeof x==="string" && x.length>0 && x.length<=max &&
    !/[\x00-\x1f\x7f]/u.test(x);
}
function safePath(path) {
  if(!boundedString(path,260))return false;
  if(path.startsWith("/")||path.startsWith("\\")||/^[A-Za-z]:/u.test(path)||
     path.includes("\\")||path.split("/").some(x=>x==="."||x===".."||!x))return false;
  return true;
}

export function adviseFromEvidence(input) {
  if(!input || typeof input!=="object" || Array.isArray(input))
    throw new TypeError("Bounded evidence object required");
  const {allowed_paths:allowed,changed_paths:changed,test_results:runs,
    diff_reviewed:reviewed,stage="post-fix"}=input;
  if(!Array.isArray(allowed)||!allowed.length||allowed.length>50||
     !Array.isArray(changed)||changed.length>50 ||
     !allowed.every(safePath)||!changed.every(safePath))
    throw new TypeError("Safe, exact repository-relative changed/allowed paths required");
  if(!Array.isArray(runs)||runs.length>20 ||
     !runs.every(r=>r && typeof r==="object" &&
       boundedString(r.name,100) &&
       (r.exit_code===null||Number.isInteger(r.exit_code)&&
         r.exit_code>=0&&r.exit_code<=255)))
    throw new TypeError("Bounded native-test exit receipts required");
  if(typeof reviewed!=="boolean")
    throw new TypeError("diff_reviewed must be explicit boolean");
  if(stage!=="pre-fix" && stage!=="post-fix")
    throw new TypeError("stage must be pre-fix or post-fix");
  const outside=changed.some(p=>!allowed.includes(p));
  const noChanges=changed.length===0;
  const failing=runs.some(r=>r.exit_code!==null&&r.exit_code!==0);
  const noEvidence=!runs.length||runs.some(r=>r.exit_code===null);
  const code=outside?ACTIONS.SCOPE_HOLD:
    stage==="pre-fix" && failing?ACTIONS.EXPECTED_RED:
    noChanges?ACTIONS.NO_CHANGE:
    failing?ACTIONS.INVESTIGATE:
    noEvidence?ACTIONS.RUN_TEST:
    !reviewed?ACTIONS.REVIEW_DIFF:ACTIONS.NONE;
  return {
    schema:"godprompt.research.adaptive-evidence-gate.v1",
    decision:code,
    guidance:SHORT[code],
    // Native tests, diff inspection and scope reconciliation are caller
    // actions; reserve extra MCP context for a concrete observed test failure.
    consult_godprompt:code===ACTIONS.INVESTIGATE,
    requires_scope_reconciliation:code===ACTIONS.SCOPE_HOLD,
    evidence_is_independently_verified:false,
    automatic_execution:false,
    note:"Caller-supplied signals do not prove successful native tests, scope, permissions, or readiness."
  };
}
