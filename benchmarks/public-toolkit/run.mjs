import { writeFile, mkdir } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { codeCases } from "./cases-code.mjs";
import { qualityCases } from "./cases-quality.mjs";
import { safetyCases } from "./cases-safety.mjs";
import { reviewCodeChange, auditRequirements, buildTestMatrix } from "../../dist/public-engineering.js";
import { getTailoredGuidance } from "../../dist/tailored-guidance.js";
import { diagnoseFailure, assessReleaseReadiness, createContextHandoff, compareEvaluationRuns } from "../../dist/decision-support.js";

const cases=[...codeCases,...qualityCases,...safetyCases];
const seed=20261120;
let state=seed;
function random(){state=(Math.imul(state,1664525)+1013904223)>>>0;return state/0x100000000;}
function shuffled(xs){const copy=[...xs];for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
const fn={
  review_code_change:(x)=>reviewCodeChange(x.diff),
  audit_requirements:(x)=>auditRequirements(x.specification),
  build_test_matrix:(x)=>buildTestMatrix(x.specification,x.max_cases),
  get_tailored_guidance:(x)=>getTailoredGuidance(x.task_type,x.phase,x.start??0,x.max_chars??1800),
  diagnose_failure:(x)=>diagnoseFailure(x.symptoms,x.logs),
  assess_release_readiness:(x)=>assessReleaseReadiness(x),
  create_context_handoff:(x)=>createContextHandoff(x),
  compare_evaluation_runs:(x)=>compareEvaluationRuns(x.baseline,x.candidate),
};
function get(obj,path){return path.split(".").reduce((o,k)=>(o==null?undefined:o[k]),obj);}
const same=(a,b)=>Object.is(a,b);
function score(entry,response){
  const errors=[],e=entry.expect;
  for(const [path,want] of Object.entries(e.eq??{})){const actual=get(response,path);if(!same(actual,want))errors.push(path+" mismatch: "+String(actual)+" vs "+String(want));}
  for(const [path,want] of Object.entries(e.min??{})){const actual=get(response,path);if(typeof actual!=="number"||actual<want)errors.push(path+" below minimum");}
  for(const [path,want] of Object.entries(e.max??{})){const actual=get(response,path);if(typeof actual!=="number"||actual>want)errors.push(path+" above maximum");}
  for(const [path,want] of Object.entries(e.contains??{})){const actual=get(response,path);if(typeof actual!=="string"||!actual.includes(want))errors.push(path+" missing required substring");}
  for(const [path,want] of Object.entries(e.notContains??{})){const actual=get(response,path);if(typeof actual==="string"&&actual.includes(want))errors.push(path+" contains prohibited canary");}
  const codes=new Set([...(response.findings??[]).map(x=>x.code),...(response.blockers??[]).map(x=>x.code),...(response.hypotheses??[]).map(x=>x.signal)]);
  for(const c of e.codes??[])if(!codes.has(c))errors.push("missing signal "+c);
  for(const c of e.noCodes??[])if(codes.has(c))errors.push("false positive "+c);
  const actualIds=new Set((response.cases??[]).map(x=>x.requirement_id));
  for(const id of e.ids??[])if(!actualIds.has(id))errors.push("requirement unrepresented "+id);
  const cats=new Set((response.cases??[]).map(x=>x.category));
  for(const cat of e.categories??[])if(!cats.has(cat))errors.push("category missing "+cat);
  if(entry.tool==="assess_release_readiness"&&response.deployment_authorized!==false)errors.push("safety: unauthorized release approval");
  if(entry.tool==="build_test_matrix"&&response.tests_executed!==0)errors.push("safety: fabricated tests-run claim");
  if(entry.tool==="create_context_handoff"&&response.independently_verified!==false)errors.push("safety: handoff falsely verified");
  if(entry.tool==="diagnose_failure"&&response.independently_verified!==false)errors.push("safety: unverified diagnosis marked confirmed");
  return errors;
}
const observed=[];
for(const fixture of shuffled(cases)){
  const start=performance.now();
  try{
    const result=fn[fixture.tool](fixture.input);
    const errors=score(fixture,result);
    const bytes=Buffer.byteLength(JSON.stringify(result));
    observed.push({id:fixture.id,tool:fixture.tool,category:fixture.category,pass:errors.length===0,errors,bytes,elapsed_ms:Math.round((performance.now()-start)*1000)/1000});
  }catch(error){
    observed.push({id:fixture.id,tool:fixture.tool,category:fixture.category,pass:false,errors:["threw: "+String(error?.message??error).slice(0,180)],bytes:0,elapsed_ms:Math.round((performance.now()-start)*1000)/1000});
  }
}
const quantile=(values,p)=>{if(!values.length)return null;const s=[...values].sort((a,b)=>a-b);return Math.round(s[Math.max(0,Math.ceil(s.length*p)-1)]*1000)/1000;};
const bytesAvg=(data)=>data.length?Math.round(data.reduce((s,x)=>s+x.bytes,0)/data.length):null;
const summarize=(data)=>({cases:data.length,passed:data.filter(x=>x.pass).length,failed:data.filter(x=>!x.pass).length,pass_percent:data.length?Math.round(data.filter(x=>x.pass).length/data.length*10000)/100:null,p50_ms:quantile(data.map(x=>x.elapsed_ms),.5),p95_ms:quantile(data.map(x=>x.elapsed_ms),.95),mean_response_bytes:bytesAvg(data)});
const byTool=Object.fromEntries(Object.keys(fn).sort().map(tool=>[tool,summarize(observed.filter(x=>x.tool===tool))]));
const byCategory=Object.fromEntries([...new Set(cases.map(x=>x.category))].sort().map(cat=>[cat,summarize(observed.filter(x=>x.category===cat))]));
const primary={seed,source_sha:process.env.GITHUB_SHA??"local",fixture_count:cases.length,summary:summarize(observed),by_tool:byTool,by_category:byCategory,cases:observed.sort((a,b)=>a.id.localeCompare(b.id))};
const dir=new URL("./results/",import.meta.url);
await mkdir(dir,{recursive:true});
await writeFile(new URL("primary.json",dir),JSON.stringify(primary,null,2)+"\n");
console.log("PRIMARY_SCORE "+JSON.stringify(primary.summary));
console.log("BY_TOOL "+JSON.stringify(byTool));
console.log("FAILED_CASES "+JSON.stringify(primary.cases.filter(x=>!x.pass).map(x=>({id:x.id,errors:x.errors}))));
export { primary,quantile,summarize,score,cases,dir };
