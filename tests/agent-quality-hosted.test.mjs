import test from "node:test";
import assert from "node:assert/strict";
const META = {"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{name:"p4-hosted-test",version:"1.0.0"},"io.modelcontextprotocol/clientCapabilities":{}};
async function request(worker,name,args,id){
  const response=await worker.fetch(new Request("https://example.test/mcp",{
    method:"POST",
    headers:{"content-type":"application/json",accept:"application/json, text/event-stream","mcp-protocol-version":"2026-07-28","mcp-method":name?"tools/call":"tools/list",...(name?{"mcp-name":name}:{})},
    body:JSON.stringify({jsonrpc:"2.0",id,method:name?"tools/call":"tools/list",params:{...(name?{name,arguments:args}:{}),_meta:META}})
  }),{},{});
  assert.equal(response.status,200);
  return response.json();
}
const newNames=["audit_agent_trajectory","trace_change_impact","review_mcp_tool_contracts","audit_agent_instructions","design_adversarial_tests"];
test("P4 hosted Worker exposes five read-only bounded tools",async()=>{
  const {default:worker}=await import("../dist/index.js");
  const listing=await request(worker,null,null,1);
  const tools=listing.result.tools;
  for(const name of newNames){
    const t=tools.find(x=>x.name===name);
    assert.ok(t,name);
    assert.equal(t.annotations.readOnlyHint,true);
    assert.equal(t.annotations.destructiveHint,false);
    assert.ok(t.inputSchema);
    assert.ok(t.outputSchema, name + ' must advertise structured result contract');
  }
  assert.equal(tools.length,22);
});
test("P4 hosted Worker handles all five tools with structured no-permission outputs",async()=>{
  const {default:worker}=await import("../dist/index.js");
  const examples=[
    ["audit_agent_trajectory",{events:[{id:"1",kind:"tool_result",operation:"write",status:"ok"}]}],
    ["trace_change_impact",{changed_files:["src/service.ts"]}],
    ["review_mcp_tool_contracts",{tools:[{name:"read_stats",description:"Read and summarize the bounded resource statistics."}]}],
    ["audit_agent_instructions",{instructions:[{source_id:"project",priority:"project",text:"Never publish without approval."}]}],
    ["design_adversarial_tests",{fields:[{id:"age",type:"number",min:1,max:120}]}]
  ];
  for(let i=0;i<examples.length;i++){
    const [name,args]=examples[i];
    const res=await request(worker,name,args,10+i);
    assert.equal(res.result?.isError,true===false,name);
    const c=res.result?.structuredContent;
    assert.ok(c?.status,name);
    assert.equal(c.independently_verified,false,name);
    assert.ok(JSON.stringify(c).length<20000,name);
  }
});
test("P4 Worker rejects unknown keys and oversized arrays before work",async()=>{
  const {default:worker}=await import("../dist/index.js");
  const calls=[
    ["audit_agent_trajectory",{events:[]}],
    ["trace_change_impact",{changed_files:["../secrets"]}],
    ["review_mcp_tool_contracts",{tools:[]}],
    ["audit_agent_instructions",{instructions:[{source_id:"a",priority:"system",text:"do not publish this!"}]}],
    ["design_adversarial_tests",{fields:[{id:"x",type:"text"}]}]
  ];
  for(let i=0;i<calls.length;i++){
    const [name,args]=calls[i];
    const res=await request(worker,name,args,30+i);
    assert.equal(res.result?.isError,true,name);
  }
});
