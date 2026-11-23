#!/usr/bin/env node
/** V18 independent read-only reconstruction of six original native model logs. */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {execFileSync,spawnSync} from "node:child_process";
import {existsSync,readFileSync} from "node:fs";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const HERE=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(HERE,"../real-runs/replication-v18");
const sha=x=>createHash("sha256").update(x).digest("hex");
const native=/\bpython(?:\.exe)?\s+(?:-B\s+)?-m\s+unittest\s+discover\b/iu;
const decode=b=>b.toString("utf8").split("\0").filter(Boolean).map(x=>x.replaceAll("\\","/"));
export function inspectV18Raw(raw,dir,code){
 const x={turns:0,commands:0,source_edits:0,native_runs:0,native_pass:0,
   native_fail:0,bad_lines:0,usage_turns:0,
   usage:{input_tokens:0,cached_input_tokens:0,output_tokens:0},calls:[]};
 const permitted=code.map(x=>resolve(dir,x).toLowerCase());
 for(const line of raw.split(/\r?\n/u)){
  if(!line.trim())continue;
  let ev;try{ev=JSON.parse(line)}catch{x.bad_lines++;continue;}
  if(ev.type==="turn.completed"){
   x.turns++;
   if(["input_tokens","cached_input_tokens","output_tokens"].every(k=>
      Number.isSafeInteger(ev.usage?.[k])&&ev.usage[k]>=0)){
     x.usage_turns++;
     for(const k of Object.keys(x.usage))x.usage[k]+=ev.usage[k];
   }
  }
  if(ev.type!=="item.completed")continue;
  const o=ev.item??{};
  if(o.type==="file_change"&&o.status==="completed"&&!o.error&&
    Array.isArray(o.changes)&&o.changes.some(c=>
      typeof c?.path==="string"&&permitted.includes(resolve(dir,c.path).toLowerCase())))
      x.source_edits++;
  if(o.type==="command_execution"){
    if(o.status==="completed"&&!o.error&&o.exit_code===0)x.commands++;
    if(native.test(String(o.command||""))&&Number.isInteger(o.exit_code)){
      x.native_runs++;
      if(o.exit_code===0&&!o.error)x.native_pass++;else x.native_fail++;
    }
  }
  if(o.type==="mcp_tool_call")
    {
      let args=o.arguments;
      if(typeof args==="string"){
        try{args=JSON.parse(args)}catch{args=null;}
      }
      const validArgs=!!args&&typeof args==="object"&&!Array.isArray(args)&&
        args.task_type==="DEBUG"&&args.phase==="execute"&&
        args.compact===true&&args.max_chars===600&&
        Object.keys(args).sort().join(",")==="compact,max_chars,phase,task_type";
      x.calls.push({server:o.server,tool:o.tool,
        success:o.status==="completed"&&!o.error,
        before_edit:x.source_edits===0,arguments_valid:validArgs});
    }
 }
 return{turns:x.turns,commands:x.commands,source_edits:x.source_edits,
   native_runs:x.native_runs,native_pass:x.native_pass,native_fail:x.native_fail,
   bad_lines:x.bad_lines,
   usage:x.turns&&x.turns===x.usage_turns?x.usage:null,
   calls:x.calls};
}
function inventory(dir){
 const get=args=>{
  const p=spawnSync("git",args,{cwd:dir,windowsHide:true,timeout:30000,
    maxBuffer:2*1024*1024,encoding:"buffer",env:{...process.env,GIT_TERMINAL_PROMPT:"0"}});
  assert.ok(!p.error,"Git inventory process failed");
  assert.equal(p.status,0,"Git inventory exited with error: "+String(p.stderr).slice(0,280));
  return decode(p.stdout);
 };
 return[...new Set([...get(["diff","HEAD","--name-only","-z"]),
  ...get(["ls-files","--others","--exclude-standard","-z"])])].sort();
}
export function auditV18(){
 const mf=readFileSync(join(HERE,"v18-frozen-study-20261123.json"));
 const study=JSON.parse(mf);
 const frozen=JSON.parse(readFileSync(join(ROOT,"v18-freeze-sha256.json")));
 assert.equal(sha(mf),frozen.manifest_sha256);
 for(const[file,key]of [["v18-runner.mjs","runner_sha256"],
  ["v18-event-audit.mjs","event_helper_sha256"],
  ["v17-git-paths.mjs","git_helper_sha256"]])
   assert.equal(sha(readFileSync(join(HERE,file))),frozen[key],"Frozen "+file+" changed");
 assert.equal(sha(readFileSync(join(ROOT,"v18-grade.py"))),frozen.grader_sha256);
 const rows=[],missing=[];
 for(const id of study.run_order){
  const t=study.tasks.find(x=>x.id===id);
  assert.ok(t);
  for(const arm of t.order){
   const path=join(ROOT,"receipts",id,arm);
   if(!existsSync(path+".json")){
    missing.push(id+"|"+arm);continue;
   }
   const receiptBytes=readFileSync(path+".json");
   const r=JSON.parse(receiptBytes);
   const out=readFileSync(path+".jsonl");
   const err=readFileSync(path+".stderr.txt");
   const dir=join(ROOT,"arms",id,arm);
   assert.equal(r.schema,"godprompt.v18.original-matched-checkpoint.v1");
   assert.equal(r.study_id,study.id);
   assert.equal(r.original_manifest_sha256,frozen.manifest_sha256);
   assert.equal(r.task,id);assert.equal(r.arm,arm);
   assert.equal(r.issue,t.issue);assert.equal(r.repo,t.repo);
   assert.equal(r.checkpoint_source_sha,t.source_sha);
   assert.equal(r.checkpoint_code_sha256,t.code_file_sha256);
   assert.equal(r.checkpoint_native_test_sha256,t.regression_sha256);
   assert.equal(r.raw_stdout_sha256,sha(out));
   assert.equal(r.raw_stderr_sha256,sha(err));
   assert.ok(r.model_wall_seconds>=0&&r.model_wall_seconds<=t.timeout_seconds+10);
   const head=execFileSync("git",["rev-parse","HEAD"],{
    cwd:dir,encoding:"utf8",windowsHide:true,timeout:30000}).trim();
   assert.equal(head,t.source_sha);
   assert.equal(sha(readFileSync(join(dir,t.regression_file))),t.regression_sha256);
   assert.equal(r.original_test_hash_unchanged,true);
   const paths=inventory(dir);
   assert.deepEqual(r.changed_paths?.slice().sort(),paths);
   const outside=paths.filter(x=>![...t.code_paths,t.regression_file].includes(x));
   assert.deepEqual(r.out_of_scope_paths,outside);
   const p=inspectV18Raw(out.toString("utf8"),dir,t.code_paths);
   assert.equal(p.turns,r.model_turns);
   assert.equal(p.commands,r.successful_commands);
   assert.equal(p.source_edits,r.source_edits);
   assert.equal(p.native_runs,r.native_tests_in_transcript);
   assert.equal(p.native_pass,r.successful_native_tests_in_transcript);
   assert.equal(p.bad_lines,r.malformed_jsonl_lines);
   assert.deepEqual(p.usage,r.model_reported_usage);
   assert.equal(p.calls.length,r.intervention_tool_calls.length);
   for(let i=0;i<p.calls.length;i++){
    const a=p.calls[i],b=r.intervention_tool_calls[i];
    assert.deepEqual([a.server,a.tool,a.success,a.before_edit],
     [b.server,b.tool,b.success,b.before_source_edit]);
   }
   const good=p.calls.every(x=>x.server==="godprompt")&&
    (arm==="baseline"?p.calls.length===0:p.calls.length===1&&
      p.calls[0].success&&p.calls[0].before_edit&&
      p.calls[0].tool==="get_tailored_guidance"&&
      p.calls[0].arguments_valid===true);
   // Original runner verifies chronology and name. Independent audit additionally
   // checks exact caller arguments from the original completed MCP JSONL event.
   if(r.accepted)assert.equal(good,true,
    "An accepted treatment must prove exact frozen GodPrompt tool arguments");
   assert.equal(r.intervention_protocol_valid,
     arm==="baseline"?good:good||(!good&&
       p.calls.length===1&&p.calls[0].success&&p.calls[0].before_edit&&
       p.calls[0].tool==="get_tailored_guidance"),
     "Original protocol status inconsistent with raw native chronology");
   assert.deepEqual(r.enabled_mcp_at_preflight,arm==="baseline"?[]:["godprompt"]);
   assert.ok(["VALID_CORRECT","VALID_INCORRECT","INVALID_OTHER",
     "INVALID_TIMEOUT","INVALID_POLICY","INVALID_PROTOCOL"].includes(r.original_status));
   if(r.accepted){
    assert.equal(r.original_status,"VALID_CORRECT");
    assert.equal(r.model_exit_code,0);
    assert.equal(r.wall_timeout,false);
    assert.equal(r.policy_denial,false);
    assert.equal(r.grader_exit_code,0);
    assert.equal(r.grader_error,null);
    assert.equal(r.hidden_passed,t.hidden_total);
    assert.equal(r.hidden_total,t.hidden_total);
    assert.equal(r.native_post.status,0);
    assert.ok(r.native_post.count>=study.environment.test_minimum);
    assert.ok(p.turns>0&&p.source_edits>0&&p.native_pass>0);
    assert.equal(p.bad_lines,0);assert.equal(good,true);assert.deepEqual(outside,[]);
   }
   rows.push({task:id,arm,status:r.original_status,accepted:r.accepted,
    seconds:r.model_wall_seconds,
    hidden_passed:r.hidden_passed,hidden_total:r.hidden_total,
    grader_status:r.grader_exit_code,grader_error:r.grader_error,
    native_tests:r.native_post.count,native_status:r.native_post.status,
    mcp_calls:p.calls,reported_usage:p.usage,scope:paths,
    receipt_sha256:sha(receiptBytes),jsonl_sha256:sha(out),stderr_sha256:sha(err)});
  }
 }
 const complete=rows.length===6,by_arm={};
 for(const arm of study.arms){
  const rr=rows.filter(x=>x.arm===arm);
  const time=rr.reduce((s,x)=>s+x.seconds,0);
  const accepted=rr.filter(x=>x.accepted).length;
  const known=rr.reduce((s,x)=>s+(x.reported_usage?.input_tokens??0),0);
  const missingUsage=rr.filter(x=>x.reported_usage===null).length;
  by_arm[arm]={attempts:rr.length,accepted,
   all_original_seconds:Number(time.toFixed(3)),
   seconds_per_accepted_fix:complete&&accepted?Number((time/accepted).toFixed(3)):null,
   known_input_tokens:known,missing_usage:missingUsage,
   actual_mcp_calls:rr.reduce((s,x)=>s+x.mcp_calls.length,0)};
 }
 return{schema:"godprompt.v18.independent-original-audit.v1",
  study:study.id,planned:6,observed:rows.length,complete,
  missing,by_arm,rows,replicated_productivity_gain_proven:false,
  limitations:[
   "No independent blinded human semantic review; private graders and reference patches authored by one researcher.",
   "The original grader stdout was hashed but not preserved as a separate file, so status/count audit is limited to immutable first-run receipt.",
   "Three pairs are not statistically powered to establish an effect across coding tasks.",
   "Model token accounting includes cached inputs and is not independently billed."
  ]};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 console.log(JSON.stringify(auditV18(),null,2));
