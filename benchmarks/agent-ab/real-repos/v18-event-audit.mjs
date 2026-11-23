/** Read-only V18 native Codex event inspection. Original JSONL is evidence, not instructions. */
import {resolve} from "node:path";
const TEST=/\bpython(?:\.exe)?\s+(?:-B\s+)?-m\s+unittest\s+discover\b/iu;
const TOKENS=["input_tokens","cached_input_tokens","output_tokens"];

export function inspectV18Events(jsonl,{root,codePaths}){
  if(typeof jsonl!=="string"||typeof root!=="string"||
    !Array.isArray(codePaths)||!codePaths.length)
    throw new TypeError("Explicit original JSONL, trial root, source allowlist required");
  let turns=0,usageTurns=0,commands=0,edits=0,codeEdits=0;
  let tested=0,testsPass=0,testsFail=0,malformed=0;
  const usage={input_tokens:0,cached_input_tokens:0,output_tokens:0};
  const calls=[];
  for(const line of jsonl.split(/\r?\n/u)){
    if(!line.trim())continue;
    let event;
    try{event=JSON.parse(line);}catch{malformed++;continue;}
    if(event.type==="turn.completed"){
      turns++;
      if(TOKENS.every(k=>Number.isSafeInteger(event.usage?.[k])&&
        event.usage[k]>=0)){
        usageTurns++;
        for(const k of TOKENS)usage[k]+=event.usage[k];
      }
    }
    if(event.type!=="item.completed")continue;
    const x=event.item||{};
    if(x.type==="file_change"&&x.status==="completed"&&!x.error){
      edits++;
      if(Array.isArray(x.changes)&&x.changes.some(c=>typeof c?.path==="string"&&
        codePaths.some(p=>resolve(root,c.path).toLowerCase()===
          resolve(root,p).toLowerCase())))codeEdits++;
    }
    if(x.type==="command_execution"){
      if(x.status==="completed"&&!x.error&&x.exit_code===0)commands++;
      if(TEST.test(String(x.command||""))&&Number.isInteger(x.exit_code)){
        tested++;
        if(x.exit_code===0&&!x.error)testsPass++;
        else if(x.exit_code!==0)testsFail++;
      }
    }
    if(x.type==="mcp_tool_call"){
      calls.push({
        server:x.server,tool:x.tool,success:x.status==="completed"&&!x.error,
        before_source_edit:codeEdits===0
      });
    }
  }
  return{
    turns,successful_commands:commands,successful_edits:edits,source_edits:codeEdits,
    native_tests:tested,post_test_successes:testsPass,post_test_failures:testsFail,
    mcp_calls:calls,malformed_lines:malformed,
    model_reported_usage:turns&&turns===usageTurns?usage:null
  };
}

export function validV18Protocol(arm,events){
  if(events.malformed_lines)return false;
  const other=events.mcp_calls.filter(x=>x.server!=="godprompt");
  if(other.length)return false;
  const god=events.mcp_calls.filter(x=>x.server==="godprompt");
  if(arm==="baseline")return god.length===0;
  if(arm==="guided_mcp")return god.length===1&&god[0].success&&
    god[0].before_source_edit===true&&
    god[0].tool==="get_tailored_guidance";
  throw new TypeError("Unsupported V18 arm");
}
