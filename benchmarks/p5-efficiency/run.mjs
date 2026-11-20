/** Deterministic size + noisy local latency probe. No model, network or repository access. */
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { getTailoredGuidance } from "../../dist/tailored-guidance.js";
import { auditAgentTrajectory } from "../../dist/agent-trajectory.js";
import { traceChangeImpact, ImpactSchema } from "../../dist/change-impact.js";
import { CONTENT } from "../../dist/content.js";
const enc=new TextEncoder();
const bytes=v=>enc.encode(typeof v==="string"?v:JSON.stringify(v)).length;
const percentile=(a,p)=>{const sorted=[...a].sort((x,y)=>x-y);return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*p)-1))];};
export function measure({runs=50}={}) {
  if(!Number.isInteger(runs)||runs<5||runs>200)throw Error("Expected 5..200 repeats");
  const cases=[
    {name:"guidance_plan_debug",run:()=>getTailoredGuidance("DEBUG","plan",0,900)},
    {name:"trajectory_bounded",run:()=>auditAgentTrajectory([{id:"read",kind:"tool_result",operation:"read",status:"ok"}])},
    {name:"impact_bounded",run:()=>traceChangeImpact(ImpactSchema.parse({changed_files:["src/main.ts"],dependencies:[]}))},
  ];
  const data=cases.map(c=>{
    for(let i=0;i<10;i++)c.run();
    const durations=[];
    let last;
    for(let i=0;i<runs;i++){
      const before=performance.now();
      last=c.run();
      durations.push(performance.now()-before);
    }
    return {name:c.name,repetitions:runs,bytes_per_output:bytes(last),
      local_p50_ms:Math.round(percentile(durations,0.50)*1000)/1000,
      local_p95_ms:Math.round(percentile(durations,0.95)*1000)/1000,
      output_digest:createHash("sha256").update(JSON.stringify(last)).digest("hex").slice(0,20)};
  });
  const focused=getTailoredGuidance("DEBUG","plan",0,900);
  return {
    status:"LOCAL_TOOL_PERFORMANCE_ONLY",measurements:data,
    protocol_all_bytes:bytes(CONTENT.PROTOCOLS),
    guidance_first_chunk_bytes:bytes(focused.content),
    static_byte_reduction_percent:Math.round((1-bytes(focused.content)/bytes(CONTENT.PROTOCOLS))*10000)/100,
    independently_verified:false,
    warning:"Elapsed times are noisy local microbenchmarks, NOT model-token savings or coding-agent productivity. Byte comparisons use different scopes and must not be treated as equivalent answer quality.",
  };
}
if(process.argv[1]&&process.argv[1].endsWith("run.mjs")){
 const r=measure();
 process.stdout.write(JSON.stringify(r,null,2)+"\n");
}
