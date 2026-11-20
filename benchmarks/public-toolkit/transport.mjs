import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { performance } from "node:perf_hooks";
import { primary,cases,score,quantile,dir } from "./run.mjs";
const hosted="https://god-prompt-mcp.tomi-seregi99.workers.dev/mcp";
const stdioPath=process.env.GODPROMPT_BENCH_STDIO??"dist/stdio.js";
let nextId=1, sequence=20261120;
const rnd=()=>{sequence=(Math.imul(sequence,1664525)+1013904223)>>>0;return sequence/4294967296;};
const time=[];const errors=[];const parity=[];const invalid=[];
const meta={"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{name:"godprompt-free-benchmark",version:"1.0.0"},"io.modelcontextprotocol/clientCapabilities":{}};
const parse=(r)=>{
  if(r?.error||r?.result?.isError)throw Error("MCP tool returned error");
  const o=r.result??r;
  return o.structuredContent??JSON.parse((o.content??[]).find(x=>x.type==="text")?.text??"null");
};
async function host(method,name,args={}){
  const headers={"content-type":"application/json","accept":"application/json, text/event-stream","mcp-protocol-version":"2026-07-28","mcp-method":method};
  if(name)headers["mcp-name"]=name;
  const body={jsonrpc:"2.0",id:nextId++,method,params:{...((method==="tools/call")?{name,arguments:args}:{}),_meta:meta}};
  const start=performance.now();
  const res=await fetch(hosted,{method:"POST",headers,body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const str=await res.text();
  if(!res.ok)throw Error("Hosted HTTP "+res.status);
  let payload;
  if(res.headers.get("content-type")?.includes("text/event-stream")){
    const msg=str.split("\n").filter(x=>x.startsWith("data:")).map(x=>x.slice(5).trim()).find(x=>x.startsWith("{"));
    if(!msg)throw Error("Empty MCP SSE result");
    payload=JSON.parse(msg);
  }else payload=JSON.parse(str);
  return {payload,elapsed_ms:performance.now()-start};
}
function stdioServer(){
  const env={...process.env,GODPROMPT_CODEXIFY_CHECKPOINT:"0"};
  const child=spawn(process.execPath,[stdioPath],{stdio:["pipe","pipe","pipe"],env});
  const pending=new Map();let stderr="";
  child.stderr.setEncoding("utf8");child.stderr.on("data",x=>{stderr=(stderr+x).slice(-600);});
  const lines=createInterface({input:child.stdout});
  lines.on("line",line=>{
    if(!line.trim())return;
    let msg;try{msg=JSON.parse(line)}catch{return;}
    if(!pending.has(msg.id))return;
    const item=pending.get(msg.id);pending.delete(msg.id);clearTimeout(item.timer);
    if(msg.error)item.reject(Error("stdio JSONRPC error "+msg.error.code));else item.resolve({payload:{result:msg.result},elapsed_ms:performance.now()-item.start});
  });
  child.on("exit",()=>{for(const x of pending.values())x.reject(Error("stdio process ended"));pending.clear();});
  function request(method,name,args={}){
    const id=nextId++,start=performance.now();
    const params=method==="tools/call"?{name,arguments:args}:{};
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(Error("stdio timed out"))},15000);
      pending.set(id,{start,timer,resolve,reject});
      child.stdin.write(JSON.stringify({jsonrpc:"2.0",id,method,params})+"\n");
    });
  }
  async function init(){
    const r=await request("initialize","",{protocolVersion:"2025-03-26"});
    if(r.payload.result?.serverInfo?.version!=="1.2.0")throw Error("stdio version mismatch");
    child.stdin.write(JSON.stringify({jsonrpc:"2.0",method:"notifications/initialized",params:{}})+"\n");
    return r;
  }
  async function initialize(){
    const id=nextId++,start=performance.now();
    const params={protocolVersion:"2025-03-26",capabilities:{},clientInfo:{name:"benchmark-stdio",version:"1.0.0"}};
    const p=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(Error("stdio init timed out"))},15000);
      pending.set(id,{start,timer,resolve,reject});
    });
    child.stdin.write(JSON.stringify({jsonrpc:"2.0",id,method:"initialize",params})+"\n");
    const r=await p;
    if(r.payload.result?.serverInfo?.version!=="1.2.0")throw Error("stdio version mismatch");
    child.stdin.write(JSON.stringify({jsonrpc:"2.0",method:"notifications/initialized",params:{}})+"\n");
    return r;
  }
  return {request,initialize,close:()=>{lines.close();child.kill();},getStderr:()=>stderr};
}
const tools=[...new Set(cases.map(x=>x.tool))].sort();
let client=null;
try{
  client=stdioServer();await client.initialize();
  const [localList,remoteList]=await Promise.all([client.request("tools/list",""),host("tools/list","")]);
  const a=(localList.payload.result?.tools??[]).map(x=>x.name),b=(remoteList.payload.result?.tools??[]).map(x=>x.name);
  if(a.length!==17||b.length!==17||!tools.every(x=>a.includes(x)&&b.includes(x)))throw Error("tool list missing public capabilities");
  for(const tool of tools){
    const fixture=cases.find(x=>x.tool===tool);
    const stdio=await client.request("tools/call",tool,fixture.input);
    const remote=await host("tools/call",tool,fixture.input);
    const lhs=parse(stdio.payload),rhs=parse(remote.payload);
    const same=isDeepStrictEqual(lhs,rhs);
    parity.push({tool,equivalent:same,stdio_fulfills_fixture:score(fixture,lhs).length===0,hosted_fulfills_fixture:score(fixture,rhs).length===0});
    if(!same)errors.push("semantic parity mismatch "+tool);
    time.push({kind:"stdio",tool,elapsed_ms:stdio.elapsed_ms},{kind:"hosted",tool,elapsed_ms:remote.elapsed_ms});
  }
  for(let i=0;i<2;i++)for(const tool of [...tools].sort(()=>rnd()-.5)){
    const fixture=cases.find(x=>x.tool===tool),r=await host("tools/call",tool,fixture.input);
    parse(r.payload);time.push({kind:"hosted",tool,elapsed_ms:r.elapsed_ms});
  }
  const bad=[
    ["review_code_change",{diff:"short"}],
    ["audit_requirements",{specification:"tiny"}],
    ["build_test_matrix",{specification:"- The endpoint must reject bad input.",max_cases:-1}],
    ["get_tailored_guidance",{task_type:"INVALID",phase:"verify"}],
    ["diagnose_failure",{symptoms:"short"}],
    ["assess_release_readiness",{target:"production",checks:[]}],
    ["create_context_handoff",{goal:"tiny"}],
    ["compare_evaluation_runs",{baseline:[],candidate:[]}],
  ];
  for(const [tool,args] of bad){
    try{
      const r=await host("tools/call",tool,args);
      const rejected=!!r.payload.error||r.payload.result?.isError===true;
      invalid.push({tool,rejected});
      if(!rejected)errors.push("invalid args accepted "+tool);
    }catch(e){invalid.push({tool,rejected:false});errors.push("invalid input raised transport error "+tool+": "+String(e.message).slice(0,120));}
  }
}catch(e){errors.push("transport: "+String(e?.message??e).slice(0,300));}
finally{client?.close();}
const guide=[];
const types=["BUILD","DEBUG","REFACTOR","CONTENT","DESIGN","SHIP","ANALYZE","AUTOMATE","PLAN"];
for(let i=0;i<types.length;i++){
  const type=types[i],phase=i%2?"verify":"plan";
  const names=i%2?["get_core_skill","get_tailored_guidance"]:["get_tailored_guidance","get_core_skill"];
  const result={task_type:type,phase};
  for(const name of names){
    try{
      const response=await host("tools/call",name,name==="get_tailored_guidance"?{task_type:type,phase,max_chars:1800}:{});
      const data=parse(response.payload);
      const raw=name==="get_core_skill"?(typeof data==="string"?data:JSON.stringify(data)):data.content;
      result[name+"_bytes"]=Buffer.byteLength(raw??"");
      result[name+"_ms"]=Math.round(response.elapsed_ms*100)/100;
    }catch(e){errors.push("guidance "+type+" "+name+": "+String(e.message).slice(0,90));}
  }
  if(result.get_core_skill_bytes&&result.get_tailored_guidance_bytes){
    result.reduction_percent=Math.round((1-result.get_tailored_guidance_bytes/result.get_core_skill_bytes)*10000)/100;
  }
  guide.push(result);
}
const hostedTimes=time.filter(x=>x.kind==="hosted").map(x=>x.elapsed_ms);
const stdioTimes=time.filter(x=>x.kind==="stdio").map(x=>x.elapsed_ms);
const reductions=guide.map(x=>x.reduction_percent).filter(Number.isFinite);
const performanceSummary={
  hosted_requests:hostedTimes.length,
  hosted_p50_ms:quantile(hostedTimes,.5),hosted_p95_ms:quantile(hostedTimes,.95),
  stdio_requests:stdioTimes.length,
  stdio_p50_ms:quantile(stdioTimes,.5),stdio_p95_ms:quantile(stdioTimes,.95),
  semantic_parity_percent:Math.round(parity.filter(x=>x.equivalent).length/Math.max(1,parity.length)*10000)/100,
  invalid_rejected:invalid.filter(x=>x.rejected).length,
  invalid_attempts:invalid.length,
  guidance_pairs:reductions.length,
  guidance_median_byte_reduction_percent:quantile(reductions,.5),
};
const gate={correctness:primary.summary.pass_percent>=90,parity:performanceSummary.semantic_parity_percent>=95,privacy:!primary.cases.some(x=>x.category==="privacy"&&!x.pass),safety:!errors.some(x=>x.includes("invalid args accepted")),no_protocol_errors:errors.length===0};
const report={...primary,performance:performanceSummary,parity,invalid,guide,transport_errors:errors,gate};
await writeFile(new URL("report.json",dir),JSON.stringify(report,null,2)+"\n");
const rows=Object.entries(primary.by_tool).map(([name,s])=>"| "+name+" | "+s.passed+"/"+s.cases+" | "+s.pass_percent+"% |");
const md=[
  "# GodPrompt v1.2.0 — frozen free quality benchmark",
  "",
  "Run: "+(process.env.GITHUB_SHA??"local")+"; seed 20261120; no paid models or API keys.",
  "",
  "**Primary fixtures:** "+primary.summary.passed+"/"+primary.summary.cases+" passed ("+primary.summary.pass_percent+"%).",
  "",
  "| Tool | Passing fixtures | Pass rate |","|---|---:|---:|",...rows,
  "",
  "**Transport:** "+performanceSummary.semantic_parity_percent+"% local stdio/hosted parity; "+performanceSummary.invalid_rejected+"/"+performanceSummary.invalid_attempts+" invalid inputs rejected.",
  "**Latency:** hosted p50 "+performanceSummary.hosted_p50_ms+"ms, p95 "+performanceSummary.hosted_p95_ms+"ms; stdio p50 "+performanceSummary.stdio_p50_ms+"ms, p95 "+performanceSummary.stdio_p95_ms+"ms.",
  "**Targeted guidance:** median first-chunk byte reduction "+performanceSummary.guidance_median_byte_reduction_percent+"% versus full core skill ("+performanceSummary.guidance_pairs+" pairs).",
  "",
  "## Failed independently labeled scenarios",
  ...primary.cases.filter(x=>!x.pass).map(x=>"- "+x.id+": "+x.errors.join("; ")),
  "",
  "## Other transport or schema failures",...((errors.length)?errors.map(x=>"- "+x):["None observed."]),
  "",
  "## Release gate",...Object.entries(gate).map(([k,v])=>"- "+k+": "+(v?"PASS":"FAIL")),
  "",
  "## Interpretation",
  "These measurements test bounded deterministic tool outputs and transport, not agent coding success or causal productivity. No equal-budget agent A/B was run because the local model was unavailable and paid APIs were excluded. False positives and semantic false negatives are retained as observed.",
].join("\n");
await writeFile(new URL("report.md",dir),md+"\n");
console.log("LIVE_PERFORMANCE "+JSON.stringify(performanceSummary));
console.log("QUALITY_GATE "+JSON.stringify(gate));
console.log("TRANSPORT_ERRORS "+JSON.stringify(errors));
if(Object.values(gate).some(x=>!x))process.exitCode=1;
