/**
 * One-time V19 original receipt anchors: independently raw-audited sources.
 * No model runs, no retries. Fails if public anchors already exist.
 */
import assert from "node:assert/strict";
import {writeFileSync,readFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {auditV19} from "./v19-secondary-audit.mjs";
const dir=dirname(fileURLToPath(import.meta.url));
const audit=auditV19();
assert.equal(audit.complete,true);
assert.equal(audit.original_completed,15);
assert.deepEqual(audit.missing,[]);
const anchors=Object.fromEntries(audit.rows.map(r=>[
  r.id+"|"+r.arm,{
    sha256:r.original_receipt_sha256,
    status:r.status,
    seconds:r.seconds
  }
]));
assert.equal(Object.keys(anchors).length,15);
const dest=join(dir,"v19-original-receipt-anchors-20261123.json");
writeFileSync(dest,JSON.stringify(anchors,null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({anchor_count:Object.keys(anchors).length,
  all_source_receipts_independently_audited:true,
  result_sha256:audit.rows[0].original_receipt_sha256,
  path:dest}));
