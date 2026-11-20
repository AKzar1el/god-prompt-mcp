const a=[];const put=(id,tool,input,expect,category="normal")=>a.push({id,tool,input,expect,category});
function patch(path,lines) {
  const old=lines.filter(x=>x[0]!=="+").length;
  const now=lines.filter(x=>x[0]!=="-").length;
  return ["diff --git a/"+path+" b/"+path,"--- a/"+path,"+++ b/"+path,
    "@@ -1,"+old+" +1,"+now+" @@",...lines].join("\n");
}
const t="review_code_change";
put("DIFF-01",t,{diff:patch("src/auth.ts",["-if (!context.isAdmin) throw new Error('Forbidden');"," return user;"])},{codes:["REMOVED_SECURITY_GUARD"],eq:{"independently_verified":false}},"incident");
put("DIFF-02",t,{diff:patch("src/runner.js",[" function run(input) {","+  eval(input);"," }"])},{codes:["DYNAMIC_CODE_EXECUTION"]});
put("DIFF-03",t,{diff:patch("src/client.ts",[" const request = {","+  rejectUnauthorized: false,"," };"])},{codes:["DISABLED_TLS_VERIFICATION"]});
put("DIFF-04",t,{diff:patch("web/app.ts",[" const out = document.body;","+out.innerHTML = value;"])},{codes:["DANGEROUS_HTML_SINK"]});
put("DIFF-05",t,{diff:patch("src/job.ts",[" const live = true;","+// TODO: add production validation"])},{codes:["UNFINISHED_MARKER"]});
put("DIFF-06",t,{diff:patch("src/auth.ts",[" function handle() {","+  const token = readToken();"," }"])},{codes:["SENSITIVE_BEHAVIOR_CHANGE"]});
put("DIFF-07",t,{diff:patch("tests/user.test.mjs",["-assert.equal(login(), 200);"," assert.ok(true);"])},{codes:["REMOVED_TEST_ASSERTION"]},"incident");
put("DIFF-08",t,{diff:patch("tests/new.test.ts",[" import { test } from 'node:test';","+test('arithmetic', () => assert.equal(1+1,2));"])},{noCodes:["DYNAMIC_CODE_EXECUTION","NO_TEST_CHANGES_IN_PATCH"]},"negative");
put("DIFF-09",t,{diff:patch("src/math.ts",[" export function add(a,b){","+  return a + b;"," }"])},{noCodes:["NO_TEST_CHANGES_IN_PATCH"]},"negative");
put("DIFF-10",t,{diff:patch("src/doc.ts",[" // Example:","+// Documentation mentions eval(input) but does not run it."])},{noCodes:["DYNAMIC_CODE_EXECUTION"]},"negative");
put("DIFF-11",t,{diff:patch(".github/workflows/publish-container.yml",["-if: github.event_name == 'workflow_dispatch'","+if: github.event_name != 'pull_request'"])},{codes:["WEAKENED_RELEASE_GATE"]},"incident");
put("DIFF-12",t,{diff:"Binary files a/logo.png and b/logo.png differ"},{eq:{"status":"UNPARSEABLE_PATCH"}},"negative");
put("DIFF-13",t,{diff:patch("src/feature.ts",["-if (!hasPermission(request)) throw forbidden();"," return true;"])},{codes:["REMOVED_SECURITY_GUARD"]});
put("DIFF-14",t,{diff:patch("tests/feature.test.js",["-it('denies unauthorized users', () => {});"," test('works',()=>{});"])},{codes:["REMOVED_TEST_ASSERTION"]});
const r="audit_requirements";
const openSpec=["## Requirements","### Requirement: Session timeout","The system SHALL expire sessions after 30 minutes of inactivity.","#### Scenario: Inactive user","- GIVEN a logged in user","- WHEN they are inactive for 30 minutes","- THEN the session expires"].join("\n");
put("REQ-01",r,{specification:"- The dashboard must be fast and user-friendly."},{codes:["UNMEASURABLE_LANGUAGE","MISSING_ACCEPTANCE_EVIDENCE"],eq:{"requirements.length":1}});
put("REQ-02",r,{specification:"- Dashboard requests must complete within 200 ms.\nAcceptance: returns under 200 ms at p95."},{noCodes:["UNMEASURABLE_LANGUAGE","MISSING_ACCEPTANCE_EVIDENCE"],eq:{"requirements.length":1}},"negative");
put("REQ-03",r,{specification:"- The customer must log in.\n- The customer must log in."},{codes:["DUPLICATE_REQUIREMENT"],eq:{"requirements.length":2}});
put("REQ-04",r,{specification:openSpec},{eq:{"requirements.length":1,"requirements.0.scenarios.length":4},noCodes:["MISSING_ACCEPTANCE_EVIDENCE"]},"incident");
put("REQ-05",r,{specification:"## Scope\n## Dependencies"},{eq:{"status":"NO_REQUIREMENTS_FOUND","requirements.length":0}},"negative");
const fence=String.fromCharCode(96).repeat(3);
put("REQ-06",r,{specification:"## Examples\n"+fence+"js\n- Dangerous behavior must execute.\n"+fence},{eq:{"status":"NO_REQUIREMENTS_FOUND","requirements.length":0}},"negative");
put("REQ-07",r,{specification:"- The service must optionally offer exports."},{codes:["MIXED_OBLIGATION"]});
put("REQ-08",r,{specification:"- Every user must have access to the report.\n- No user must have access to the report."},{codes:["CONTRADICTORY_REQUIREMENTS"]},"semantic-holdout");
put("REQ-09",r,{specification:"- Authenticated users must receive HTTP 429 after ten failed attempts.\nAcceptance: the eleventh call returns HTTP 429."},{noCodes:["MISSING_ACCEPTANCE_EVIDENCE"]});
put("REQ-10",r,{specification:"The API must reject invalid refresh tokens."},{eq:{"requirements.length":1},codes:["MISSING_ACCEPTANCE_EVIDENCE"]});
export const codeCases=a;
export const sharedOpenSpec=openSpec;
