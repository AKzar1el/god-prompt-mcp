/** Free, read-only, live hosted MCP smoke for the unpublished OpenAI combined plugin. */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const path = new URL("../distribution/openai/mcp.json", import.meta.url);
const portable = JSON.parse(await readFile(path, "utf8"));
const mcp = portable.mcpServers?.["god-prompt-mcp"];
assert.equal(mcp?.type, "streamable-http");
assert.equal(mcp?.extensions?.["com.openai"]?.auth?.type, "none");
const URL_ = new URL(mcp.url);
assert.equal(URL_.protocol, "https:");
assert.equal(URL_.hostname, "god-prompt-mcp.tomi-seregi99.workers.dev");
const meta={
  "io.modelcontextprotocol/protocolVersion":"2026-07-28",
  "io.modelcontextprotocol/clientInfo":{name:"godprompt-openai-preview-ci",version:"1.5.0"},
  "io.modelcontextprotocol/clientCapabilities":{},
};
async function request(method,id,name,args){
  const headers={
    "content-type":"application/json",
    "accept":"application/json, text/event-stream",
    "mcp-protocol-version":"2026-07-28",
    "mcp-method":method,
  };
  if(name)headers["mcp-name"]=name;
  const body={jsonrpc:"2.0",id,method,params:{...(name?{name,arguments:args}:{}),_meta:meta}};
  const response=await fetch(URL_,{
    method:"POST",headers,body:JSON.stringify(body),signal:AbortSignal.timeout(16_000),
  });
  assert.equal(response.status,200,"Hosted MCP "+method+" HTTP "+response.status);
  const contentType=response.headers.get("content-type")??"";
  assert.match(contentType,/^application\/json/i,"Expected JSON for single read-only request");
  const result=await response.json();
  assert.equal(result.jsonrpc,"2.0");
  assert.equal(result.id,id);
  assert.ok(result.result,"Missing MCP result for "+method);
  return result.result;
}
async function probe(){
  const listed=await request("tools/list",101);
  const tools=listed.tools??[];
  assert.equal(tools.length,22,"Hosted GodPrompt v1.5.0 must advertise exactly 22 public tools");
  for(const name of ["audit_agent_trajectory","trace_change_impact","review_mcp_tool_contracts",
    "audit_agent_instructions","design_adversarial_tests"]){
    const tool=tools.find(x=>x.name===name);
    assert.ok(tool,"Missing hosted tool "+name);
    assert.equal(tool.annotations?.readOnlyHint,true,name);
    assert.equal(tool.annotations?.destructiveHint,false,name);
    assert.ok(tool.outputSchema,name+" missing structured output schema");
  }
  const check=await request("tools/call",102,"audit_agent_trajectory",
    {events:[{id:"read-only-1",kind:"verification",status:"ok"}]});
  assert.notEqual(check.isError,true);
  assert.equal(check.structuredContent?.independently_verified,false);
  assert.equal(check.structuredContent?.completion_authorized,false);
  console.log("Hosted OpenAI preview: 22 read-only GodPrompt tools and an advisory tool call verified.");
}
let last;
for(let i=0;i<3;i++){
  try{await probe();process.exit(0)}catch(error){
    last=error;
    if(i<2)await new Promise(resolve=>setTimeout(resolve,2000*(i+1)));
  }
}
console.error("Host preview read-only validation failed:",last?.message??String(last));
process.exit(1);
