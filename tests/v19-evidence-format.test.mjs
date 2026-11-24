import test from "node:test";
import assert from "node:assert/strict";
import {makeV19Packet,verifyV19Packet,renderV19Packet,redactEvidence} from
  "../benchmarks/agent-ab/real-repos/v19-evidence-format.mjs";
const input={
 task_id:"rich-4270",
 source_revision:"3a109ccdffe5b2d0e30684a304fbd388e99ce57b",
 source_path:"rich/cells.py",
 source_sha256:"d".repeat(64),
 test_id:"test_leading_zwj_retains_visible_width",
 red_exit_code:1,
 exception_class:"AssertionError",
 failure_excerpt:"FAILED test_leading_zwj_retains_visible_width expected width 1 but saw 0",
 source_excerpt:"145: def cell_len(text):\n146:     for character in text:\n147:         ...",
};
test("V19 evidence format freezes bounded, explicit source-linked RED with digest",()=>{
 const packet=makeV19Packet(input);
 assert.equal(verifyV19Packet(packet),true);
 const rendered=renderV19Packet(packet);
 assert.equal(rendered.root_cause_verified,false);
 assert.equal(rendered.solution_supplied,false);
 assert.equal(rendered.source.relative_path,"rich/cells.py");
 assert.equal(rendered.observed_native_test.exit_code,1);
 assert.equal(rendered.evidence_sha256,packet.evidence_sha256);
});
test("V19 rejects changed receipts, new keys, hidden graders and reference patches",()=>{
 const p=makeV19Packet(input);
 assert.throws(()=>verifyV19Packet({...p,failure_excerpt:"PASS"}));
 assert.throws(()=>verifyV19Packet({...p,untrusted:"extra"}));
 assert.throws(()=>makeV19Packet({...input,source_excerpt:"hidden grader code and private solution"}));
 assert.throws(()=>makeV19Packet({...input,source_excerpt:"reference patch from a solution"}));
});
test("V19 rejects bad paths, red exit code false, unpinned source",()=>{
 assert.throws(()=>makeV19Packet({...input,source_path:"../tests/secret.txt"}));
 assert.throws(()=>makeV19Packet({...input,source_path:"C:\\Users\\someone\\secrets.txt"}));
 assert.throws(()=>makeV19Packet({...input,red_exit_code:0}));
 assert.throws(()=>makeV19Packet({...input,source_revision:"HEAD"}));
 assert.throws(()=>makeV19Packet({...input,source_sha256:"invalid"}));
});
test("V19 redacts basic secrets and private user paths from returned evidence",()=>{
 const red=redactEvidence(
   "C:\\Users\\Alice\\Repo\\test.py password=supersecret ghp_12345678901234567890 "+
   "auth@company.test Authorization: Bearer 123456789012345");
 assert.ok(!red.includes("Alice"));
 assert.ok(!red.includes("supersecret"));
 assert.ok(!red.includes("ghp_12345678901234567890"));
 assert.ok(!red.includes("auth@company.test"));
 assert.ok(!red.includes("123456789012345"));
 const p=makeV19Packet({...input,failure_excerpt:
    "FAILED in /home/privateuser/project password=exposed"}),
 rendered=renderV19Packet(p);
 assert.ok(!rendered.error_excerpt.includes("privateuser"));
 assert.ok(!rendered.error_excerpt.includes("exposed"));
});
