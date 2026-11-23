import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {verifyV18Public} from
  "../benchmarks/agent-ab/real-repos/v18-verify-public.mjs";
import {auditV18} from
  "../benchmarks/agent-ab/real-repos/v18-secondary-audit.mjs";
const here=join(dirname(fileURLToPath(import.meta.url)),
  "..","benchmarks","agent-ab","real-repos");
const frozenBytes=readFileSync(join(here,"v18-frozen-study-20261123.json"));
const study=JSON.parse(frozenBytes);
const original=JSON.parse(readFileSync(join(here,"v18-public-results-20261123.json")));
const clone=x=>structuredClone(x);
function rejects(transform){
 const forged=clone(original);
 transform(forged);
 assert.throws(()=>verifyV18Public(study,forged,frozenBytes));
}
test("V18 public original randomized matched-checkpoint study verifies all six",()=>{
 const verified=verifyV18Public(study,original,frozenBytes);
 assert.equal(verified.original_first_runs,6);
 assert.equal(verified.no_production_change,true);
 assert.equal(original.comparison.replicated_productivity_gain_proven,false);
});
test("V18 verifier rejects missing, duplicated, reordered or renamed original arms",()=>{
 rejects(x=>x.original_rows.pop());
 rejects(x=>x.original_rows[2]=x.original_rows[0]);
 rejects(x=>x.original_rows.reverse());
 rejects(x=>x.original_rows[0].task="nonexistent-issue");
});
test("V18 verifier refuses forged original statuses, time, receipt hashes",()=>{
 rejects(x=>x.original_rows[0].original_status="INVALID_OTHER");
 rejects(x=>x.original_rows[0].accepted=!x.original_rows[0].accepted);
 rejects(x=>x.original_rows[0].model_wall_seconds=1);
 rejects(x=>x.original_rows[0].original_receipt_sha256="0".repeat(64));
});
test("V18 verifier refuses invented successful GodPrompt MCP events",()=>{
 rejects(x=>x.original_rows[0].original_mcp_calls=[{
   server:"godprompt",tool:"get_tailored_guidance",success:true,before_edit:true}]);
 rejects(x=>x.original_rows[1].original_mcp_calls=[]);
 rejects(x=>x.original_rows[1].original_mcp_calls[0].before_edit=false);
 rejects(x=>x.original_rows[1].original_mcp_calls[0].success=false);
 rejects(x=>x.original_rows[1].original_mcp_calls[0].arguments_valid=false);
});
test("V18 verifier refuses doctored source, hidden case totals or native test outcomes",()=>{
 rejects(x=>x.preregistered_tasks[0].upstream_revision="0".repeat(40));
 rejects(x=>x.preregistered_tasks[0].frozen_regression_sha256="wrong");
 rejects(x=>x.original_rows[0].hidden_passed=0);
 rejects(x=>x.original_rows[0].native_tests_exit_code=1);
 rejects(x=>x.original_rows[0].original_changed_paths.push("src/other.py"));
});
test("V18 original denominator and timing aggregates are fail-closed",()=>{
 rejects(x=>x.by_arm.baseline.accepted=2);
 rejects(x=>x.by_arm.guided_mcp.all_original_seconds=10);
 rejects(x=>x.by_arm.guided_mcp.seconds_per_accepted_fix=1);
 rejects(x=>x.comparison.guided_wall_seconds_per_accepted_fix_relative_percent=-95);
 rejects(x=>x.comparison.replicated_productivity_gain_proven=true);
 rejects(x=>x.comparison.production_guidance_change="GO");
});
test("V18 published evidence discloses limitations and keeps private trials private",()=>{
 assert.equal(original.evidence_integrity.private_hidden_grader_committed,false);
 assert.equal(original.evidence_integrity.original_session_jsonl_committed,false);
 assert.equal(original.evidence_integrity.independent_blinded_human_adjudication_completed,false);
 assert.ok(original.limitations.length>=5);
 rejects(x=>x.evidence_integrity.independent_blinded_human_adjudication_completed=true);
});
test("V18 independently reconstructs all original SHA/checkouts and real MCP chronology",()=>{
 const audit=auditV18();
 assert.equal(audit.complete,true);
 assert.equal(audit.observed,6);
 assert.deepEqual(audit.rows.map(x=>x.receipt_sha256),
   original.original_rows.map(x=>x.original_receipt_sha256));
 assert.deepEqual(audit.rows.map(x=>x.jsonl_sha256),
   original.original_rows.map(x=>x.original_jsonl_sha256));
 assert.equal(audit.by_arm.guided_mcp.actual_mcp_calls,3);
 assert.equal(audit.by_arm.baseline.actual_mcp_calls,0);
});
