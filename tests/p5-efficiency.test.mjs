import test from "node:test";
import assert from "node:assert/strict";
import { measure } from "../benchmarks/p5-efficiency/run.mjs";
test("P5 efficiency probe measures bounded deterministic outputs without model claims",()=>{
 const a=measure({runs:5});
 const b=measure({runs:5});
 assert.equal(a.status,"LOCAL_TOOL_PERFORMANCE_ONLY");
 assert.equal(a.measurements.length,3);
 assert.ok(a.protocol_all_bytes>a.guidance_first_chunk_bytes);
 assert.equal(a.independently_verified,false);
 assert.deepEqual(a.measurements.map(x=>x.output_digest),b.measurements.map(x=>x.output_digest));
 for(const item of a.measurements){
   assert.ok(item.local_p50_ms>=0);
   assert.ok(item.local_p95_ms>=0);
   assert.ok(item.bytes_per_output<15000);
 }
 assert.match(a.warning,/NOT model-token savings/);
 assert.throws(()=>measure({runs:201}),/5..200/);
});
