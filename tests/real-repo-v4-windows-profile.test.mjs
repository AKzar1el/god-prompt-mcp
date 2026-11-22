import assert from "node:assert/strict";
import { test } from "node:test";
import { safeWindowsCodexProfile, trustedWindowsSandboxPrerequisites }
  from "../benchmarks/agent-ab/real-repos/v4-windows-profile.mjs";

const asString=(args)=>args.join(" ");
const all=(arm)=>safeWindowsCodexProfile({arm});

test("V4 Windows ordinary arms remain restricted without globally disabling MCP discovery",()=>{
  for(const arm of ["baseline","preinjected"]){
    const args=all(arm);
    assert.ok(args.includes("--ignore-user-config"));
    assert.ok(args.includes("--sandbox=workspace-write"));
    assert.ok(args.includes('windows.sandbox="unelevated"'));
    assert.ok(args.includes('approval_policy="never"'));
    assert.ok(args.includes("sandbox_workspace_write.network_access=false"));
    assert.ok(!args.includes("features.apps=false"),
      "Disabling the apps feature also hides the pinned local MCP runtime");
    assert.doesNotMatch(asString(args),/danger-full-access|dangerously-bypass|mcp_servers[.]/u);
  }
});
test("V4 live MCP is explicitly pinned and still discoverable",()=>{
  const args=safeWindowsCodexProfile({
    arm:"live_mcp",
    serverExecutable:process.execPath,
    serverScript:process.platform==="win32"?
      "C:\\temp\\god-prompt\\dist\\stdio.js":"/tmp/god-prompt/dist/stdio.js",
  });
  assert.ok(!args.includes("features.apps=false"));
  assert.ok(args.some(x=>x.startsWith("mcp_servers.godprompt.command=")));
  assert.ok(args.some(x=>x.startsWith("mcp_servers.godprompt.args=")));
  assert.doesNotMatch(asString(args),/danger-full-access|dangerously-bypass/u);
});
test("unknown arms, unpinned or malformed live server config fail closed",()=>{
  assert.throws(()=>safeWindowsCodexProfile({arm:"other"}),/Unknown/);
  assert.throws(()=>safeWindowsCodexProfile({arm:"live_mcp"}),/absolute pinned/);
  assert.throws(()=>safeWindowsCodexProfile({
    arm:"baseline",serverExecutable:process.execPath,
  }),/must not expose live MCP/);
  assert.throws(()=>safeWindowsCodexProfile({
    arm:"live_mcp",serverExecutable:process.execPath,
    serverScript:"../relative/stdio.js",
  }),/absolute pinned/);
  assert.throws(()=>safeWindowsCodexProfile({
    arm:"live_mcp",serverExecutable:process.execPath,
    serverScript:process.platform==="win32"?"C:\\bad\\a\"\n":"/tmp/bad\n",
  }),/absolute pinned/);
});
test("sandbox policy prerequisites are explicit and do not claim production equivalent",()=>{
  assert.equal(trustedWindowsSandboxPrerequisites.platform,"win32");
  assert.equal(trustedWindowsSandboxPrerequisites.requires_outside_workspace_write_denial,true);
  assert.equal(trustedWindowsSandboxPrerequisites.danger_full_access,false);
  assert.equal(trustedWindowsSandboxPrerequisites.unrelated_app_calls_invalidate_arm,true);
  assert.equal(trustedWindowsSandboxPrerequisites.account_apps_not_disabled_because_local_mcp_depends_on_feature,true);
  assert.match(trustedWindowsSandboxPrerequisites.network_isolation,/weaker-than-elevated/u);
  assert.equal(trustedWindowsSandboxPrerequisites.honest_productivity_requires_independent_grade,true);
});
