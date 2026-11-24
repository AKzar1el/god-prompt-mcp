/** V19 review-only native Codex event and exact MCP intervention audit. */
import {resolve} from "node:path";
const NATIVE=/\bpython(?:\.exe)?\s+(?:-B\s+)?-m\s+unittest\s+discover\b/iu;
const USAGE=["input_tokens","cached_input_tokens","output_tokens"];
const GENERIC={task_type:"DEBUG",phase:"execute",compact:true,max_chars:600};

function sameArgs(actual,expected){
  if(typeof actual==="string"){
    try{actual=JSON.parse(actual)}catch{return false}
  }
  if(!actual||typeof actual!=="object"||Array.isArray(actual))
    return false;
  return Object.keys(actual).sort().join(",")===
    Object.keys(expected).sort().join(",")&&
    Object.keys(expected).every(k=>actual[k]===expected[k]);
}
export function inspectV19Events(jsonl,{root,codePaths}){
  if(typeof jsonl!=="string"||typeof root!=="string"||
    !Array.isArray(codePaths)||!codePaths.length)
    throw new TypeError("V19 native event audit needs exact trial root and source paths");
  const sourceAbs=codePaths.map(p=>resolve(root,p).toLowerCase());
  let turns=0,usageTurns=0,commands=0,edits=0,sourceEdits=0,
    nativeRuns=0,nativePass=0,nativeFail=0,malformed=0;
  const usage={input_tokens:0,cached_input_tokens:0,output_tokens:0};
  const calls=[];
  for(const line of jsonl.split(/\r?\n/u)){
    if(!line.trim())continue;
    let event;
    try{event=JSON.parse(line)}catch{malformed++;continue}
    if(event.type==="turn.completed"){
      turns++;
      if(USAGE.every(k=>Number.isSafeInteger(event.usage?.[k])&&
        event.usage[k]>=0)){
        usageTurns++;
        for(const k of USAGE)usage[k]+=event.usage[k];
      }
    }
    if(event.type!=="item.completed")continue;
    const it=event.item??{};
    if(it.type==="file_change"&&it.status==="completed"&&!it.error){
      edits++;
      if(Array.isArray(it.changes)&&it.changes.some(c=>
        typeof c?.path==="string"&&
        sourceAbs.includes(resolve(root,c.path).toLowerCase())))sourceEdits++;
    }
    if(it.type==="command_execution"){
      if(it.status==="completed"&&it.exit_code===0&&!it.error)commands++;
      if(NATIVE.test(String(it.command||""))&&Number.isInteger(it.exit_code)){
        nativeRuns++;
        if(it.exit_code===0&&!it.error)nativePass++;
        else nativeFail++;
      }
    }
    if(it.type==="mcp_tool_call"){
      const args=it.arguments??null;
      const content=it.result?.structured_content??it.result?.structuredContent;
      calls.push({
        server:it.server,tool:it.tool,
        success:it.status==="completed"&&!it.error,
        before_source_edit:sourceEdits===0,
        exact_generic_args:sameArgs(args,GENERIC),
        exact_evidence_args:sameArgs(args,{}),
        packet_task:content?.task_id??null,
        packet_evidence_sha256:content?.evidence_sha256??null,
        packet_status:content?.status??null
      });
    }
  }
  return {turns,successful_commands:commands,file_edits:edits,
    source_edits:sourceEdits,native_runs:nativeRuns,
    native_pass:nativePass,native_fail:nativeFail,
    malformed_jsonl_lines:malformed,mcp_calls:calls,
    model_reported_usage:turns&&turns===usageTurns?usage:null};
}
export function validV19Protocol(arm,events,{task_id,packet_sha256}={}){
  if(events.malformed_jsonl_lines)return false;
  if(arm==="baseline")return events.mcp_calls.length===0;
  if(events.mcp_calls.length!==1)return false;
  const call=events.mcp_calls[0];
  if(!call.success||!call.before_source_edit)return false;
  if(arm==="generic_godprompt")
    return call.server==="godprompt"&&
      call.tool==="get_tailored_guidance"&&call.exact_generic_args;
  if(arm==="evidence_mcp")
    return call.server==="godprompt_evidence"&&
      call.tool==="get_failure_evidence"&&
      call.exact_evidence_args&&call.packet_task===task_id&&
      call.packet_evidence_sha256===packet_sha256&&
      call.packet_status==="EXTERNALLY_FROZEN_FAILURE_EVIDENCE_NOT_ROOT_CAUSE";
  throw new TypeError("Unknown V19 experimental arm");
}
