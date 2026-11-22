#!/usr/bin/env node
/**
 * Capture genuine local GodPrompt MCP stdio context for V4 preinjection arms.
 * This is NOT an AI coding agent and does not contact any external provider.
 * Results live only in ignored real-runs; no raw context goes into task manifest.
 */
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE=dirname(fileURLToPath(import.meta.url));
const PROJECT=resolve(HERE,"../../..");
const PRIVATE=resolve(HERE,"../real-runs/replication-v4/context");
const SUITE=JSON.parse(await readFile(join(HERE,"v4-frozen-suite.json"),"utf8"));
const SOURCE_SHA=SUITE.godprompt_product_base_sha;
const hash=value=>createHash("sha256").update(value).digest("hex");
const git=args=>execFileSync("git",args,{
  cwd:PROJECT,encoding:"utf8",windowsHide:true,timeout:15000,
  env:{...process.env,GIT_TERMINAL_PROMPT:"0"},
}).trim();
const current=git(["rev-parse","HEAD"]);
const pinned=git(["rev-parse",SOURCE_SHA]);
if(pinned!==SOURCE_SHA)throw new Error("Pinned product SHA unavailable");
try {
  git(["diff","--exit-code",SOURCE_SHA,"--","src/"]);
} catch {
  throw new Error("Product source differs from the fixed benchmark code revision");
}
const runtimeFiles=["dist/stdio.js","dist/server.js"];
const runtime={};
for(const file of runtimeFiles) runtime[file]=hash(await readFile(join(PROJECT,file)));
const env={};
for(const name of ["PATH","SystemRoot","WINDIR","TEMP","TMP","USERPROFILE",
    "APPDATA","LOCALAPPDATA","COMSPEC"]) {
  if(process.env[name])env[name]=process.env[name];
}
env.NODE_ENV="test";
const child=spawn(process.execPath,[join(PROJECT,"dist/stdio.js")],{
  cwd:PROJECT,env,windowsHide:true,stdio:["pipe","pipe","pipe"],
});
let id=0,closed=false,stderr="",pending=new Map();
const lines=createInterface({input:child.stdout,crlfDelay:Infinity});
lines.on("line",line=>{
  let message;
  try{message=JSON.parse(line);}catch{return;}
  if(!Number.isInteger(message.id))return;
  const p=pending.get(message.id);
  if(!p)return;
  pending.delete(message.id);clearTimeout(p.timer);
  if(message.error)p.reject(new Error("MCP tool error: "+JSON.stringify(message.error).slice(0,150)));
  else p.resolve(message.result);
});
child.stderr.setEncoding("utf8");
child.stderr.on("data",part=>{stderr=(stderr+part).slice(-300);});
child.on("exit",code=>{
  closed=true;
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error("MCP exited: "+code));}
  pending.clear();
});
function request(method,params={}){
  return new Promise((ok,fail)=>{
    if(closed)return fail(new Error("MCP already closed"));
    const next=++id;
    const timer=setTimeout(()=>{pending.delete(next);fail(new Error("MCP timeout: "+method));},
      method==="initialize"?60000:20000);
    pending.set(next,{resolve:ok,reject:fail,timer});
    child.stdin.write(JSON.stringify({jsonrpc:"2.0",id:next,method,params})+"\n");
  });
}
function value(result){
  if(result?.isError)throw new Error("MCP reported tool failure");
  const t=result?.content?.find(x=>x.type==="text")?.text;
  if(!t||t.length>250000)throw new Error("MCP payload missing or too large");
  return JSON.parse(t);
}
const outputs=[];
try{
  const initialized=await request("initialize",{
    protocolVersion:"2025-03-26",capabilities:{},
    clientInfo:{name:"godprompt-v4-frozen-benchmark-probe",version:"1"},
  });
  if(initialized?.serverInfo?.name!=="god-prompt-mcp")throw new Error("Wrong MCP server identity");
  child.stdin.write(JSON.stringify({jsonrpc:"2.0",method:"notifications/initialized",params:{}})+"\n");
  const tool=async(name,args={})=>value(await request("tools/call",{name,arguments:args}));
  const version=await tool("get_version");
  for(const task of SUITE.tasks){
    const route=await tool("classify_task",{description:task.description});
    const type=route.task_type;
    if(!["BUILD","DEBUG","REFACTOR","ANALYZE","PLAN","DESIGN","CONTENT",
        "AUTOMATE","SHIP"].includes(type))throw new Error("Invalid route");
    const execution=await tool("get_tailored_guidance",{
      task_type:type,phase:"execute",max_chars:1800,
    });
    const verification=await tool("get_tailored_guidance",{
      task_type:type,phase:"verify",max_chars:1800,
    });
    const receipt={
      schema:"godprompt.v4.local-stdio-context.v1",task_id:task.task_id,
      product_base_sha:SOURCE_SHA,checkout_head:current,
      server:initialized.serverInfo,version,route,
      execution_guidance:execution,verification_guidance:verification,
      runtime_sha256:runtime,
      actual_local_mcp_tool_calls:["get_version","classify_task",
        "get_tailored_guidance:execute","get_tailored_guidance:verify"],
      model_agent_invoked:false,paid_provider_calls:0,
    };
    receipt.receipt_sha256=hash(JSON.stringify(receipt));
    outputs.push(receipt);
  }
}finally{
  child.kill();
  lines.close();
}
if(stderr)throw new Error("Local MCP emitted stderr; receipt not accepted");
await mkdir(PRIVATE,{recursive:true});
for(const receipt of outputs){
  const path=join(PRIVATE,receipt.task_id+".json");
  await writeFile(path,JSON.stringify(receipt,null,2)+"\n",{flag:"wx"});
}
console.log(JSON.stringify({
  status:"PINNED_LOCAL_MCP_CONTEXT_CAPTURED_NOT_MODEL_TRIAL",
  product_base_sha:SOURCE_SHA,current_head:current,
  captured:outputs.map(r=>({task_id:r.task_id,route:r.route.task_type,
    receipt_sha256:r.receipt_sha256})),
  runtime_sha256:runtime,
  model_calls:0,
},null,2));
