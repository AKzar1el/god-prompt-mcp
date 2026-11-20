/** Offline instruction-conflict lint; source text never becomes an instruction for this server. */
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

export const InstructionAuditSchema = z.object({
  instructions: z.array(z.object({
    source_id: z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/),
    priority: z.enum(["organization", "project", "task"]),
    text: z.string().trim().min(10).max(4_000),
  }).strict()).min(1).max(20),
}).strict();
type InstructionInput = z.infer<typeof InstructionAuditSchema>["instructions"];
type Hint = {code:string;severity:"high"|"medium"|"low";source_indices:number[];recommendation:string};
const actionRE = "(?:deploy|publish|merge|delete|write|edit|execute|test|verify|commit|push|share|read)";
const negate = new RegExp("\\b(?:must\\s+never|must\\s+not|do\\s+not|don't|should\\s+not|never|cannot|prohibited\\s+to)\\s+("+actionRE+")\\b","i");
const requireAction = new RegExp("\\b(?:must|always|should|required\\s+to)\\s+("+actionRE+")\\b","i");

export function auditAgentInstructions(instructions: InstructionInput) {
  const hints: Hint[] = [];
  const seen = new Map<string, number>();
  const actions = new Map<string, {polarity:"permit"|"forbid";index:number;priority:string}>();
  const refs = new Set<string>();
  let verificationMentioned = false;
  for (let i = 0; i < instructions.length; i++) {
    const doc = instructions[i];
    const ix = i + 1;
    if (refs.has(doc.source_id)) hints.push({code:"DUPLICATE_SOURCE_ID",severity:"medium",source_indices:[ix],
      recommendation:"Assign stable unique IDs to policy documents."});
    refs.add(doc.source_id);
    let fenced = false;
    for (const original of doc.text.split(/\r?\n/).slice(0, 120)) {
      let line = original.trim();
      if (line.startsWith("~~~") || line.startsWith(String.fromCharCode(96).repeat(3))) {fenced = !fenced;continue;}
      if (fenced || !line) continue;
      line = line.replace(/^(?:[-*]\s+|#{1,6}\s+|\d+[.)]\s+)/,"").trim();
      if (!line || line.length > 500) continue;
      const normalized=line.toLowerCase().replace(/\s+/g," ").replace(/[.!]+$/,"");
      if (/\b(test|verify|verification|check)\b/i.test(line)) verificationMentioned = true;
      if (seen.has(normalized)) hints.push({code:"DUPLICATE_RULE",severity:"low",
        source_indices:[seen.get(normalized)!,ix],
        recommendation:"Deduplicate overlapping agent rules or reference the canonical policy."});
      else seen.set(normalized,ix);
      if (/\b(?:skip|bypass|ignore)\s+(?:all\s+)?(?:tests|verification|approvals?)\b/i.test(line) ||
          /\b(?:do anything|without any approval)\b/i.test(line)) {
        hints.push({code:"RISKY_OVERRIDING_INSTRUCTION",severity:"high",source_indices:[ix],
          recommendation:"Reconcile any blanket bypass with project safety and approval requirements."});
      }
      const negative = negate.exec(line);
      const positive = negative ? null : requireAction.exec(line);
      const match = negative ?? positive;
      if (!match) continue;
      const action = match[1].toLowerCase();
      const polarity = negative ? "forbid" : "permit";
      const prior = actions.get(action);
      if (prior && prior.polarity !== polarity) hints.push({code:"POSSIBLE_ACTION_POLICY_CONFLICT",
        severity:"high",source_indices:[prior.index,ix],
        recommendation:"Clarify the scope and precedence of opposing action constraints; do not silently override either."});
      if (!prior) actions.set(action,{polarity,index:ix,priority:doc.priority});
    }
  }
  if (!verificationMentioned && instructions.length > 1) hints.push({
    code:"VERIFICATION_POLICY_UNSPECIFIED",severity:"low",source_indices:[],
    recommendation:"Consider documenting observable verification before declaring task completion.",
  });
  return {
    status:hints.length?"INSTRUCTIONS_NEED_REVIEW":"NO_DETERMINISTIC_SIGNALS",
    findings:hints.slice(0,60),
    truncated:hints.length>60,
    sources_reviewed:instructions.length,
    independently_verified:false,
    warning:"Input documents are treated as untrusted data. Regex-level warnings do not establish semantic conflict, actual rule hierarchy or permission to act.",
  };
}
export function registerInstructionAuditTool(server:McpServer):void {
  server.registerTool("audit_agent_instructions",{
    title:"Audit agent instruction consistency",
    description:"Review bounded caller-supplied instruction documents for duplicates, possible opposing action constraints and risky bypass wording. No instruction is executed or promoted.",
    inputSchema:InstructionAuditSchema.shape,
    annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
  },async({instructions})=>{
    const output=auditAgentInstructions(instructions);
    return {structuredContent:output,content:[{type:"text",text:JSON.stringify(output)}]};
  });
}
