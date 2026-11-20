/** Deterministic adversarial test plans, never generated tests or executed payloads. */
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

const fieldSchema=z.object({
  id:z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/),
  type:z.enum(["string","number","boolean","array","object"]),
  required:z.boolean().default(true),
  min:z.number().finite().optional(),
  max:z.number().finite().optional(),
  invariant:z.enum(["none","idempotent","monotonic","order_independent"]).default("none"),
  untrusted:z.boolean().default(false),
}).strict();
export const AdversarialPlanSchema=z.object({
  fields:z.array(fieldSchema).min(1).max(30),
  max_cases:z.number().int().min(4).max(80).default(30),
}).strict();
type Field=z.output<typeof fieldSchema>;
type Case={id:string;field_id:string;category:"negative"|"boundary"|"property"|"metamorphic"|"trust_boundary";variation:string;expected:string;status:"PROPOSED_NOT_RUN"};

export function designAdversarialTests(fields:Field[],maxCases:number) {
  const proposed:Case[]=[];
  const issues:Array<{code:string;field_id:string}>=[];
  const used=new Set<string>();
  for(const field of fields){
    if(used.has(field.id))issues.push({code:"DUPLICATE_FIELD_ID",field_id:field.id});
    used.add(field.id);
    if(field.min!==undefined&&field.max!==undefined&&field.min>field.max){
      issues.push({code:"INVALID_BOUNDS",field_id:field.id});
    }
    if((field.min!==undefined||field.max!==undefined)&&!["number","string","array"].includes(field.type)){
      issues.push({code:"UNSUPPORTED_BOUNDS_FOR_TYPE",field_id:field.id});
    }
  }
  function add(field:Field,category:Case["category"],variation:string,expected:string){
    if(proposed.length>=maxCases)return;
    proposed.push({id:"AT-"+String(proposed.length+1).padStart(3,"0"),field_id:field.id,category,variation,expected,status:"PROPOSED_NOT_RUN"});
  }
  // Distribute one negative baseline across fields before deeper cases.
  for(const f of fields){
    if(proposed.length>=maxCases)break;
    add(f,"negative","wrong_type","REJECT_WRONG_TYPE_IF_STRICT_SCHEMA");
  }
  for(const f of fields){
    if(proposed.length>=maxCases)break;
    if(f.required)add(f,"negative","missing_field","REJECT_MISSING_REQUIRED_FIELD");
    if(f.min!==undefined && (f.max===undefined||f.min<=f.max)){
      add(f,"boundary","at_minimum","ACCEPT_IF_WITHIN_CONTRACT");
      add(f,"boundary","below_minimum","REJECT_BELOW_DECLARED_MINIMUM");
    }
    if(f.max!==undefined && (f.min===undefined||f.max>=f.min)){
      add(f,"boundary","at_maximum","ACCEPT_IF_WITHIN_CONTRACT");
      add(f,"boundary","above_maximum","REJECT_ABOVE_DECLARED_MAXIMUM");
    }
    add(f,"property","repeat_same_valid_input","CHECK_DETERMINISTIC_OUTPUT_IF_REQUIRED_BY_INTERFACE");
    if(f.invariant!=="none")add(f,"metamorphic","assert_"+f.invariant.toLowerCase(),
      "VERIFY_EXPLICIT_"+f.invariant.toUpperCase()+"_CONTRACT");
    if(f.untrusted)add(f,"trust_boundary","instruction_like_untrusted_content",
      "VERIFY_UNTRUSTED_INPUT_IS_TREATED_AS_DATA_NOT_AUTHORITY");
  }
  return {
    status:issues.length?"INVALID_OR_AMBIGUOUS_CONTRACT":proposed.length>=maxCases?"PARTIAL_ADVERSARIAL_PLAN":"DRAFT_ADVERSARIAL_PLAN",
    cases:proposed,
    issues,
    total_fields:fields.length,
    truncated:proposed.length>=maxCases,
    tests_executed:0,
    independently_verified:false,
    warning:"These are deterministic test design suggestions. Actual samples, oracles, execution, security findings and invariants need independent verification.",
  };
}
export const AdversarialOutputSchema=z.object({
  status:z.enum(["INVALID_OR_AMBIGUOUS_CONTRACT","PARTIAL_ADVERSARIAL_PLAN","DRAFT_ADVERSARIAL_PLAN"]),
  cases:z.array(z.object({
    id:z.string(),field_id:z.string(),
    category:z.enum(["negative","boundary","property","metamorphic","trust_boundary"]),
    variation:z.string(),expected:z.string(),status:z.literal("PROPOSED_NOT_RUN"),
  }).strict()),
  issues:z.array(z.object({code:z.string(),field_id:z.string()}).strict()),
  total_fields:z.number().int(),truncated:z.boolean(),tests_executed:z.literal(0),
  independently_verified:z.literal(false),warning:z.string(),
}).strict();

export function registerAdversarialPlanningTool(server:McpServer):void {
  server.registerTool("design_adversarial_tests",{
    title:"Design adversarial and property test cases",
    description:"Generate bounded negative, boundary, metamorphic, property and trust-boundary test ideas from explicit caller-supplied field contracts. Never runs or generates executable tests.",
    inputSchema:AdversarialPlanSchema.shape,
    outputSchema:AdversarialOutputSchema.shape,
    annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
  },async(args)=>{
    const input=AdversarialPlanSchema.parse(args);
    const output=designAdversarialTests(input.fields,input.max_cases);
    return {structuredContent:output,content:[{type:"text",text:JSON.stringify(output)}]};
  });
}
