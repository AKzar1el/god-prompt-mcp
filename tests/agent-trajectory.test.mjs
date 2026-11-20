import test from "node:test";
import assert from "node:assert/strict";
import { auditAgentTrajectory, TrajectoryInputSchema } from "../dist/agent-trajectory.js";

test("P4.1 detects repeated failures, scope drift and unsupported completion", () => {
  const events = [
    { id: "a", kind: "tool_result", tool: "test", status: "failed", fingerprint: "BUG-1" },
    { id: "b", kind: "tool_result", tool: "test", status: "failed", fingerprint: "BUG-1" },
    { id: "c", kind: "tool_result", tool: "test", status: "failed", fingerprint: "BUG-1" },
    { id: "d", kind: "tool_result", operation: "write", status: "ok", scope: "outside" },
    { id: "e", kind: "completion" },
  ];
  const r = auditAgentTrajectory(events);
  assert.equal(r.status, "RECHECK");
  const codes = r.findings.map(x => x.code);
  for (const c of ["REPEATED_FAILURE", "OUT_OF_SCOPE_WRITE_REPORTED", "MISSING_VERIFICATION", "PREMATURE_COMPLETION"]) assert.ok(codes.includes(c), c);
  assert.equal(r.completion_authorized, false);
  assert.equal(r.independently_verified, false);
});

test("P4.1 flags stale verification but does not treat a failed test as success", () => {
  const events = [
    { id: "check", kind: "verification", status: "ok" },
    { id: "edit", kind: "tool_result", operation: "write", status: "ok" },
    { id: "failed", kind: "verification", status: "failed" },
    { id: "finish", kind: "completion" },
  ];
  const r = auditAgentTrajectory(events);
  assert.ok(r.findings.some(f => f.code === "STALE_VERIFICATION"));
  assert.ok(r.findings.some(f => f.code === "PREMATURE_COMPLETION"));
  assert.equal(r.reported_successful_verifications, 1);
});

test("P4.1 never echoes the opaque error fingerprint and rejects malformed events", () => {
  const secret = "SECRET_TEST_CANARY_987";
  const r = auditAgentTrajectory([{ id: "1", kind: "tool_result", tool: "build", status: "failed", fingerprint: secret }]);
  assert.doesNotMatch(JSON.stringify(r), /SECRET_TEST_CANARY_987/);
  for (const events of [[], Array.from({length: 151}, (_, i) => ({id: "e" + i, kind:"decision"})),
    [{id:"1", kind:"unknown"}], [{id:"1", kind:"tool_call", raw_log:secret}]]) {
    assert.equal(TrajectoryInputSchema.safeParse({events}).success, false);
  }
});

test("P4.1 does not claim authenticated success for benign caller-supplied events", () => {
  const r = auditAgentTrajectory([{id:"1",kind:"tool_result",operation:"write",status:"ok"},{id:"2",kind:"verification",status:"ok"},{id:"3",kind:"completion"}]);
  assert.equal(r.status, "NO_DETERMINISTIC_SIGNALS");
  assert.equal(r.independently_verified, false);
  assert.equal(r.completion_authorized, false);
});
