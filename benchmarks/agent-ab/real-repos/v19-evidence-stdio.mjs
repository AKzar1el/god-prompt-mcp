#!/usr/bin/env node
/** Isolated research-only MCP: serve one immutable source-linked RED receipt. */
import {McpServer} from "@modelcontextprotocol/server";
import {serveStdio} from "@modelcontextprotocol/server/stdio";
import {readFileSync,realpathSync,statSync} from "node:fs";
import {resolve} from "node:path";
import {renderV19Packet,verifyV19Packet} from "./v19-evidence-format.mjs";

const file=process.env.GODPROMPT_V19_PACKET_FILE;
if(!file||!file.trim())throw new Error(
  "One absolute V19 packet path must be prebound by the frozen runner");
const path=resolve(file);
const stat=statSync(path);
if(!stat.isFile()||stat.isSymbolicLink())throw new Error(
  "V19 packet must be an ordinary existing file, not a symlink");
if(realpathSync(path).toLowerCase()!==path.toLowerCase())throw new Error(
  "V19 packet path alias is not permitted");
const packet=JSON.parse(readFileSync(path,"utf8"));
verifyV19Packet(packet);
const frozen=renderV19Packet(packet);
const server=new McpServer({
  name:"godprompt-v19-bound-evidence-research",
  version:"0.1.0"
},{instructions:"Research-only, read-only and task-bound. "+
  "One local tool exposes bounded source-linked failure evidence from the "+
  "independent native RED preflight. Do not infer or claim a root cause, "+
  "test pass, or fix merely because the packet exists. "+
  "No network, repository writes, hidden graders or production state."});
server.registerTool("get_failure_evidence",{
  title:"Read frozen, source-linked failed-test evidence",
  description:"Fetch one prebound actual failing native test excerpt and a "+
    "small allowed-source snippet. No live code execution and no solution.",
  inputSchema:{},
  annotations:{
    readOnlyHint:true,destructiveHint:false,
    idempotentHint:true,openWorldHint:false
  }
},async()=>({
  structuredContent:frozen,
  content:[{type:"text",text:JSON.stringify(frozen)}]
}));
// The host API accepts a server factory, not a constructed server object.
// Passing the instance directly caused a transport-level initialization error.
await serveStdio(() => server);
