/**
 * Windows Codex runner settings for the frozen V4 public-repository pilot.
 *
 * Provides the documented, restricted unelevated fallback to avoid the
 * Windows CLI --ignore-user-config implicit-backend blocked-by-policy bug.
 * This is not an installer, config writer, sandbox bypass, or model runner.
 * Users MUST first test workspace containment and trusted offline code.
 */
import { isAbsolute } from "node:path";

const QUOTE = x=>'"'+x.replaceAll("\\","/").replaceAll('"','\\"')+'"';
const KNOWN_ARMS=["baseline","preinjected","live_mcp"];

export function safeWindowsCodexProfile({arm,serverExecutable,serverScript}){
  if(!KNOWN_ARMS.includes(arm))
    throw new Error("Unknown frozen benchmark arm");
  const args=[
    "--ignore-user-config",
    "-c", 'windows.sandbox="unelevated"',
    "--sandbox=workspace-write",
    "-c", 'approval_policy="never"',
    "-c", "sandbox_workspace_write.network_access=false",
    // Suppress account-connected apps that may masquerade as the pinned
    // local GodPrompt MCP. Verified as an effective CLI feature override.
    "-c", "features.apps=false",
  ];
  if(arm==="live_mcp"){
    for(const [name,path] of [["serverExecutable",serverExecutable],
      ["serverScript",serverScript]]){
      if(typeof path!=="string" || !isAbsolute(path) || path.includes('"') ||
         /[\r\n\x00-\x1f]/u.test(path))
        throw new Error("Explicit absolute pinned "+name+" required");
    }
    args.push("-c","mcp_servers.godprompt.command="+QUOTE(serverExecutable),
      "-c","mcp_servers.godprompt.args=["+QUOTE(serverScript)+"]");
  }else if(serverExecutable!==undefined||serverScript!==undefined){
    throw new Error("Baseline/preinjected must not expose live MCP");
  }
  return args;
}

export const trustedWindowsSandboxPrerequisites=Object.freeze({
  platform:"win32",
  requires_disposable_git_checkout:true,
  requires_before_after_git_verification:true,
  requires_in_workspace_write_proof:true,
  requires_outside_workspace_write_denial:true,
  network_isolation:"legacy-unelevated-weaker-than-elevated",
  direct_external_network_calls_disallowed:true,
  global_config_edits:false,
  admin_setup_required_for_this_fallback:false,
  danger_full_access:false,
  honest_productivity_requires_independent_grade:true,
});
