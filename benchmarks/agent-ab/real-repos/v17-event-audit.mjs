/**
 * V17 research-only native-event evaluator.
 *
 * A diagnostic MCP call is eligible only after TWO separate post-edit
 * nonzero native unittest exits with a successful intervening file edit.
 * These are observed agent tool events, never agent-authored claims.
 */
import {resolve} from "node:path";
const TOKEN_KEYS=["input_tokens","cached_input_tokens","output_tokens"];
const UNITTEST=/\bpython(?:\.exe)?\s+(?:-B\s+)?-m\s+unittest\s+discover\b/iu;

export function inspectV17Events(jsonl,{root=null,codePaths=null}={}) {
  if(typeof jsonl!=="string")throw new TypeError("JSONL text required");
  if((root===null)!==(codePaths===null))
    throw new TypeError("The trial root and source-code paths must be supplied together");
  if(codePaths!==null&&(!Array.isArray(codePaths)||!codePaths.length||
      typeof root!=="string"||!root))
    throw new TypeError("Exact source code paths and trial root required");
  let turns=0, completeUsage=0, commands=0, edits=0, codeEdits=0, malformedLines=0;
  let nativeTests=0, passedNativeTests=0, failedNativeTests=0;
  let priorPostEditFailureAt=null, gateEligible=false;
  const usage={input_tokens:0,cached_input_tokens:0,output_tokens:0};
  const mcp=[];
  for(const raw of jsonl.split(/\r?\n/u)) {
    if(!raw.trim())continue;
    let event;
    try{event=JSON.parse(raw);}catch{malformedLines++;continue;}
    if(event.type==="turn.completed"){
      turns++;
      if(TOKEN_KEYS.every(k=>Number.isSafeInteger(event.usage?.[k])&&
          event.usage[k]>=0)){
        completeUsage++;
        for(const k of TOKEN_KEYS)usage[k]+=event.usage[k];
      }
    }
    if(event.type!=="item.completed")continue;
    const x=event.item||{};
    if(x.type==="file_change"&&x.status==="completed"&&!x.error){
      edits++;
      if(codePaths===null)codeEdits++;
      else if(Array.isArray(x.changes)&&x.changes.some(change=>
        typeof change?.path==="string" &&
        codePaths.some(source=>resolve(root,change.path).toLowerCase()===
          resolve(root,source).toLowerCase())))codeEdits++;
    }
    if(x.type==="command_execution"){
      if(x.status==="completed"&&!x.error&&x.exit_code===0)commands++;
      if(UNITTEST.test(String(x.command||""))&&codeEdits>0&&
         Number.isInteger(x.exit_code)){
        nativeTests++;
        if(x.exit_code===0&&!x.error)passedNativeTests++;
        else if(x.exit_code!==0){
          failedNativeTests++;
          if(priorPostEditFailureAt!==null && codeEdits>priorPostEditFailureAt)
            gateEligible=true;
          priorPostEditFailureAt=codeEdits;
        }
      }
    }
    if(x.type==="mcp_tool_call")mcp.push({
      server:x.server,tool:x.tool,
      success:x.status==="completed"&&!x.error,
      after_repeated_post_edit_test_failures:gateEligible
    });
  }
  return {
    turns, successful_shell:commands, successful_edits:edits,
    successful_source_code_edits:codeEdits,
    native_test_runs_after_edits:nativeTests,
    successful_post_edit_native_tests:passedNativeTests,
    failing_post_edit_native_tests:failedNativeTests,
    repeated_failure_gate_eligible:gateEligible,
    mcp_calls:mcp,
    model_reported_usage:turns&&turns===completeUsage?usage:null,
    complete_usage_turns:completeUsage,malformed_jsonl_lines:malformedLines
  };
}

export function validateV17Protocol(arm,events){
  if(events.malformed_jsonl_lines>0)return false;
  const god=events.mcp_calls.filter(x=>x.server==="godprompt");
  const other=events.mcp_calls.filter(x=>x.server!=="godprompt");
  if(other.length)return false;
  if(arm==="baseline")return god.length===0;
  if(arm==="repeated_failure_mcp"){
    if(!events.repeated_failure_gate_eligible)return god.length===0;
    return god.length===1&&god[0].success&&
      god[0].tool==="get_tailored_guidance"&&
      god[0].after_repeated_post_edit_test_failures===true;
  }
  throw new TypeError("Unknown V17 treatment arm");
}
