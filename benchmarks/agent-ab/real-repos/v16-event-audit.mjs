/**
 * Research-only V16 JSONL event inspector.
 *
 * Decisions use real completed tool events, not an agent's claims. In
 * particular, a failed reproduction before any edit is expected RED and must
 * not trigger extra GodPrompt context. Never executes output text.
 */
const NEED = ["input_tokens", "cached_input_tokens", "output_tokens"];

export function inspectV16Events(jsonl) {
  if (typeof jsonl !== "string") throw new TypeError("Expected JSONL text");
  let turns = 0, completeUsageTurns = 0;
  let commands = 0, edits = 0, successfulPostEditPytest = 0;
  let postEditPytestFailures = 0, malformedLines = 0;
  const mcpCalls = [];
  const usage = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 };
  for (const raw of jsonl.split(/\r?\n/u)) {
    if (!raw.trim()) continue;
    let event;
    try { event = JSON.parse(raw); }
    catch { malformedLines++; continue; }
    if (event.type === "turn.completed") {
      turns++;
      if (NEED.every(key => Number.isSafeInteger(event.usage?.[key]) &&
          event.usage[key] >= 0)) {
        completeUsageTurns++;
        for (const key of NEED) usage[key] += event.usage[key];
      }
    }
    if (event.type !== "item.completed") continue;
    const item = event.item || {};
    if (item.type === "command_execution") {
      if (item.status === "completed" && !item.error && item.exit_code === 0)
        commands++;
      const isTest = /\bpytest\b/iu.test(String(item.command || ""));
      if (isTest && edits > 0) {
        if (item.status === "completed" && !item.error && item.exit_code === 0)
          successfulPostEditPytest++;
        if (Number.isInteger(item.exit_code) && item.exit_code !== 0)
          postEditPytestFailures++;
      }
    }
    if (item.type === "file_change" && item.status === "completed" && !item.error)
      edits++;
    if (item.type === "mcp_tool_call") mcpCalls.push({
      server: item.server, tool: item.tool,
      success: item.status === "completed" && !item.error,
      after_post_edit_pytest_failure: postEditPytestFailures > 0
    });
  }
  return {
    turns, successful_shell: commands, successful_edits: edits,
    successful_post_edit_pytest: successfulPostEditPytest,
    post_edit_pytest_failures: postEditPytestFailures,
    mcp_calls: mcpCalls,
    model_reported_usage: turns && turns === completeUsageTurns ? usage : null,
    complete_usage_turns: completeUsageTurns, malformed_lines: malformedLines
  };
}

export function validV16TreatmentProtocol(arm, events) {
  const calls = events.mcp_calls.filter(x => x.server === "godprompt");
  const other = events.mcp_calls.filter(x => x.server !== "godprompt");
  if (other.length || events.malformed_lines) return false;
  const success = calls.filter(x => x.success);
  if (arm === "baseline") return calls.length === 0;
  if (arm === "conditional_mcp") {
    if (!events.post_edit_pytest_failures) return calls.length === 0;
    return calls.length === 1 && success.length === 1 &&
      success[0].tool === "get_tailored_guidance" &&
      success[0].after_post_edit_pytest_failure === true;
  }
  if (arm === "full_mcp") {
    return success.some(x => x.tool === "classify_task") &&
      success.filter(x => x.tool === "get_tailored_guidance").length >= 2;
  }
  throw new TypeError("Unknown arm");
}
