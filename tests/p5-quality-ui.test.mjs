import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { QUALITY_UI_URI,QUALITY_UI_MIME,QUALITY_UI_HTML } from "../dist/quality-view.js";
const META={"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{name:"p5-app-test",version:"1.0.0"},"io.modelcontextprotocol/clientCapabilities":{}};
async function req(worker,method,params,id){
  const response=await worker.fetch(new Request("https://example.test/mcp",{
    method:"POST",
    headers:{"content-type":"application/json","accept":"application/json, text/event-stream",
      "mcp-protocol-version":"2026-07-28","mcp-method":method},
    body:JSON.stringify({jsonrpc:"2.0",id,method,params:{...params,_meta:META}})
  }),{},{});
  assert.equal(response.status,200);
  return response.json();
}
test("P5 MCP Apps view links existing tools to one safe static resource",async()=>{
  const {default:worker}=await import("../dist/index.js");
  const listed=await req(worker,"tools/list",{},1);
  assert.equal(listed.result.tools.length,22);
  for(const name of ["audit_agent_trajectory","trace_change_impact"]){
    const tool=listed.result.tools.find(x=>x.name===name);
    assert.equal(tool._meta?.ui?.resourceUri,QUALITY_UI_URI);
    assert.equal(tool.annotations?.readOnlyHint,true);
  }
  const read=await req(worker,"resources/read",{uri:QUALITY_UI_URI},2);
  assert.equal(read.result.contents.length,1);
  assert.equal(read.result.contents[0].mimeType,QUALITY_UI_MIME);
  assert.equal(read.result.contents[0].text,QUALITY_UI_HTML);
});
test("P5 MCP Apps standalone view has restrictive CSP and no exfiltration primitives",()=>{
  assert.match(QUALITY_UI_HTML,/text\/html|<!doctype html>/i);
  assert.match(QUALITY_UI_HTML,/connect-src 'none'/);
  assert.match(QUALITY_UI_HTML,/object-src 'none'/);
  assert.match(QUALITY_UI_HTML,/ui\/notifications\/tool-result/);
  assert.match(QUALITY_UI_HTML,/textContent/);
  assert.doesNotMatch(QUALITY_UI_HTML,/\bfetch\s*\(|\bXMLHttpRequest\b|\beval\s*\(|<script\s+src=|\.innerHTML\s*=/);
  assert.ok(QUALITY_UI_HTML.length<16000);
});
test("P5 app handshake, structured result and interactive severity filter work in sandbox simulation",()=>{
  class Elem {
    constructor(){this.children=[];this.listeners={};this.textContent="";this.attrs={};this.value="";}
    appendChild(child){this.children.push(child);return child}
    removeChild(){return this.children.shift()}
    get firstChild(){return this.children[0]??null}
    setAttribute(k,v){this.attrs[k]=v}
    addEventListener(name,fn){this.listeners[name]=fn}
  }
  const els=new Map();
  const doc={getElementById(id){if(!els.has(id))els.set(id,new Elem());return els.get(id)},createElement(){return new Elem()}};
  const sent=[],handlers={};
  const parent={postMessage(msg){sent.push(msg)}};
  const win={parent,addEventListener(name,fn){handlers[name]=fn}};
  const script=QUALITY_UI_HTML.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  vm.runInNewContext(script,{window:win,document:doc,console});
  assert.equal(sent[0].method,"ui/initialize");
  handlers.message({source:parent,data:{jsonrpc:"2.0",id:1,result:{protocolVersion:"2026-01-26"}}});
  assert.ok(sent.some(x=>x.method==="ui/notifications/initialized"));
  handlers.message({source:parent,data:{jsonrpc:"2.0",method:"ui/notifications/tool-result",params:{
    structuredContent:{status:"RECHECK",independently_verified:false,findings:[
      {code:"HIGH_CANARY_<script>",severity:"high",recommendation:"Review."},
      {code:"LOW_CANARY",severity:"low",recommendation:"Maybe."}
    ]}
  }}});
  assert.equal(els.get("findings").children.length,2);
  assert.match(els.get("findings").children[0].children[0].textContent,/HIGH_CANARY_/);
  els.get("low").listeners.click();
  assert.equal(els.get("findings").children.length,1);
  assert.equal(els.get("findings").children[0].children[0].textContent,"LOW_CANARY");
});
