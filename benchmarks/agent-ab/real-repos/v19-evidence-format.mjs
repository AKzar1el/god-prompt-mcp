/**
 * V19 research-only failure evidence packet: deterministic, bounded and
 * source-linked. This is NOT a root-cause model and cannot verify a fix.
 */
import {createHash} from "node:crypto";

const SCHEMA="godprompt.v19.bound-failure-evidence.v1";
const KEYS=["schema","task_id","source_revision","source_path",
  "source_sha256","test_id","red_exit_code","exception_class",
  "failure_excerpt","source_excerpt","evidence_sha256"];
const SHA=/^[a-f0-9]{64}$/u;

export function redactEvidence(value){
  if(typeof value!=="string")throw new TypeError("Only text evidence is supported");
  return value
    .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]{0,4000}?-----END [A-Z0-9 ]*PRIVATE KEY-----/giu,
      "[REDACTED_PRIVATE_KEY]")
    .replace(/(?:[A-Z]:\\Users\\|\/home\/)[^\\\/\s]+/giu,"[PRIVATE_HOME]")
    .replace(/\b(?:sk-proj-|ghp_|github_pat_)[A-Za-z0-9_-]{10,}\b/giu,"[REDACTED_TOKEN]")
    .replace(/\bAuthorization\s*:\s*(?:Basic|Bearer|Token)\s+[A-Za-z0-9+\/=._-]{8,}/giu,
      "Authorization: [REDACTED]")
    .replace(/\b(password|secret|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|token)\s*[:=]\s*[^\s,;]+/giu,
      "$1=[REDACTED]")
    .replace(/\b[\w.+%-]+@[\w.-]+\.[a-z]{2,}\b/giu,"[REDACTED_EMAIL]")
    .replace(/\r\n/gu,"\n").replace(/\r/gu,"\n")
    .replace(/\0/gu,"");
}
const bad=/(?:BEGIN [A-Z0-9 ]*PRIVATE KEY|reference.?patch|hidden.?grader|solution.?diff)/iu;
const text=(v,max,field)=>{
  if(typeof v!=="string"||!v.trim()||v.length>max)throw new TypeError(
    "Invalid V19 evidence field "+field);
  if(bad.test(v))throw new Error("Solution or private grader material forbidden");
  return v;
};
const digest=contents=>createHash("sha256").update(contents).digest("hex");

export function makeV19Packet({task_id,source_revision,source_path,
  source_sha256,test_id,red_exit_code,exception_class,
  failure_excerpt,source_excerpt}){
  text(task_id,120,"task_id");
  text(source_revision,64,"source_revision");
  text(source_path,250,"source_path");
  if(!/^[a-f0-9]{40}$/u.test(source_revision))
    throw new TypeError("Pinned source must be an exact Git SHA-1");
  if(source_path.startsWith("/")||source_path.includes("\\")||
    source_path.split("/").some(part=>!part||part==="."||part==="..")||
    source_path.includes(":"))
    throw new TypeError("Source file path must be safely relative");
  text(test_id,180,"test_id");
  text(exception_class,80,"exception_class");
  if(!SHA.test(source_sha256))throw new TypeError("Source sha256 required");
  if(!Number.isInteger(red_exit_code)||red_exit_code===0)
    throw new TypeError("Actual native RED exit code required");
  const failure=redactEvidence(text(failure_excerpt,5000,"failure_excerpt")).slice(0,1100);
  const excerpt=redactEvidence(text(source_excerpt,5000,"source_excerpt")).slice(0,1250);
  if(failure.length<10||excerpt.length<10||bad.test(failure)||bad.test(excerpt))
    throw new Error("Missing or unsafe evidence");
  const item={schema:SCHEMA,task_id,source_revision,source_path,
    source_sha256,test_id,red_exit_code,exception_class,
    failure_excerpt:failure,source_excerpt:excerpt};
  return {...item,evidence_sha256:digest(JSON.stringify(item))};
}
export function verifyV19Packet(packet){
  if(!packet||typeof packet!=="object"||Array.isArray(packet))
    throw new TypeError("Packet object required");
  if(Object.keys(packet).sort().join(",")!==[...KEYS].sort().join(","))
    throw new TypeError("Unexpected V19 packet key");
  const {schema,evidence_sha256,...fields}=packet;
  if(schema!==SCHEMA)throw new TypeError("Wrong V19 evidence schema");
  if(!SHA.test(evidence_sha256))throw new TypeError("Invalid packet digest");
  const reformed=makeV19Packet(fields);
  if(JSON.stringify(reformed)!==JSON.stringify(packet))
    throw new Error("Packet content or digest does not match");
  return true;
}
export function renderV19Packet(packet){
  verifyV19Packet(packet);
  return {
    status:"EXTERNALLY_FROZEN_FAILURE_EVIDENCE_NOT_ROOT_CAUSE",
    task_id:packet.task_id,
    observed_native_test:{id:packet.test_id,exit_code:packet.red_exit_code,
      exception_class:packet.exception_class},
    source:{relative_path:packet.source_path,
      source_revision:packet.source_revision,source_sha256:packet.source_sha256},
    error_excerpt:packet.failure_excerpt,
    bounded_source_excerpt:packet.source_excerpt,
    evidence_sha256:packet.evidence_sha256,
    root_cause_verified:false,
    solution_supplied:false,
    independent_hidden_grade_supplied:false,
    warning:"This is only the pinned observed RED test and public code context. Verify independently and do not infer a fix from this evidence alone."
  };
}
