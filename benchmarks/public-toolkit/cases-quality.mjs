import { sharedOpenSpec } from "./cases-code.mjs";
const a=[];const put=(id,tool,input,expect,category="normal")=>a.push({id,tool,input,expect,category});
const threeReq="- The service must authenticate users.\n- The service must limit file uploads.\n- The service must reject repeated requests.";
const matrix="build_test_matrix";
put("MATRIX-01",matrix,{specification:threeReq,max_cases:4},
 {eq:{"status":"PARTIAL_TEST_PLAN","cases.length":4,"gaps.length":3,"uncovered_requirement_ids.length":0,"tests_executed":0},ids:["R-01","R-02","R-03"]},"incident");
put("MATRIX-02",matrix,{specification:"- The service must deny invalid accounts.",max_cases:4},
 {eq:{"status":"DRAFT_TEST_PLAN","cases.length":4,"tests_executed":0},categories:["positive","negative","boundary","regression"]});
put("MATRIX-03",matrix,{specification:"## Scope\n## References",max_cases:4},
 {eq:{"status":"NO_REQUIREMENTS_FOUND","cases.length":0,"tests_executed":0}},"negative");
put("MATRIX-04",matrix,{specification:sharedOpenSpec,max_cases:8},
 {eq:{"cases.length":4,"gaps.length":0},contains:{"cases.0.expected":"Scenario: Inactive user"}});
put("MATRIX-05",matrix,{specification:Array.from({length:35},(_,i)=>"- The service must report event "+i+".").join("\n"),max_cases:80},
 {eq:{"cases.length":80,"truncated":true,"gaps.length":35}});
put("MATRIX-06",matrix,{specification:threeReq,max_cases:12},
 {eq:{"cases.length":12,"truncated":false},ids:["R-01","R-02","R-03"]});
put("MATRIX-07",matrix,{specification:threeReq,max_cases:4},
 {eq:{"cases.0.status":"PROPOSED_NOT_RUN","tests_executed":0}});
const guidance="get_tailored_guidance";
put("GUIDE-01",guidance,{task_type:"BUILD",phase:"plan",max_chars:900},
 {eq:{"task_type":"BUILD","phase":"plan"},contains:{"source":"01-PROTOCOLS"},max:{"content.length":900}});
put("GUIDE-02",guidance,{task_type:"DEBUG",phase:"verify",max_chars:450},
 {eq:{"phase":"verify"},contains:{"source":"02-GATES"},max:{"content.length":450}});
put("GUIDE-03",guidance,{task_type:"REFACTOR",phase:"execute",max_chars:500},
 {min:{"content.length":20},max:{"content.length":500}});
put("GUIDE-04",guidance,{task_type:"SHIP",phase:"handoff",max_chars:200},
 {eq:{"phase":"handoff"},max:{"content.length":200}});
put("GUIDE-05",guidance,{task_type:"ANALYZE",phase:"execute",max_chars:1800},
 {min:{"content.length":100},max:{"content.length":1800}});
put("GUIDE-06",guidance,{task_type:"PLAN",phase:"plan",start:60000,max_chars:500},
 {eq:{"content":"","next_start":null}},"negative");
put("GUIDE-07",guidance,{task_type:"AUTOMATE",phase:"verify",max_chars:1000},
 {min:{"total_chars":200},contains:{"source":"02-GATES"}});
const diag="diagnose_failure";
put("DIAG-01",diag,{symptoms:"Upload failed at start",logs:"Error: EACCES permission denied"},
 {eq:{"hypotheses.0.signal":"PERMISSION","independently_verified":false}});
put("DIAG-02",diag,{symptoms:"API suddenly blocked requests",logs:"HTTP 429 Too Many Requests"},
 {eq:{"hypotheses.0.signal":"RATE_LIMIT"}});
put("DIAG-03",diag,{symptoms:"Login returned an error",logs:"HTTP 401 unauthorized"},
 {eq:{"hypotheses.0.signal":"AUTH"}});
put("DIAG-04",diag,{symptoms:"HTTP request cannot connect",logs:"ENOTFOUND api.example.test"},
 {eq:{"hypotheses.0.signal":"NETWORK_DNS"}});
put("DIAG-05",diag,{symptoms:"Request stalled and failed",logs:"ETIMEDOUT socket"},
 {eq:{"hypotheses.0.signal":"NETWORK_TIMEOUT"}});
put("DIAG-06",diag,{symptoms:"CI container stopped running",logs:"JavaScript heap out of memory"},
 {eq:{"hypotheses.0.signal":"MEMORY_PRESSURE"}});
put("DIAG-07",diag,{symptoms:"Runtime failed to start",logs:"ERR_MODULE_NOT_FOUND in packaged build"},
 {eq:{"hypotheses.0.signal":"VERSION_CONTRACT"}});
put("DIAG-08",diag,{symptoms:"Web form appears in the wrong position"},
 {eq:{"hypotheses.0.signal":"UNCLASSIFIED"}},"negative");
put("DIAG-09",diag,{symptoms:"Deployment request failed",logs:"401 unauthorized secret=FAKE_DIAG_CANARY_0987654321"},
 {notContains:{"warning":"FAKE_DIAG_CANARY_0987654321"},eq:{"independently_verified":false}},"privacy");
export const qualityCases=a;
