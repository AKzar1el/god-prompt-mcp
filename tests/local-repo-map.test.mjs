import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,mkdir,writeFile,symlink,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mapRepository } from "../bin/godprompt-repo-map.mjs";

async function inRepo(fn) {
  const root=await mkdtemp(join(tmpdir(),"godprompt-p5-map-"));
  try{await fn(root)}finally{await rm(root,{recursive:true,force:true})}
}
test("P5 local map discovers dependencies and test import candidates without raw code",async()=>{
  await inRepo(async root=>{
    await mkdir(join(root,"src"),{recursive:true});
    await mkdir(join(root,"tests"),{recursive:true});
    const secret="sk-proj-TEST-VERY-PRIVATE-123456789";
    await writeFile(join(root,"src","calc.ts"),
      "export function calc(x:number){return x+1;}\n// "+secret+"\n");
    await writeFile(join(root,"src","index.ts"),"import { calc } from './calc';\nexport {calc};\n");
    await writeFile(join(root,"tests","calc.test.ts"),"import {calc} from '../src/calc';\n");
    await mkdir(join(root,"node_modules"),{recursive:true});
    await writeFile(join(root,"node_modules","bad.ts"),"export const bad=1");
    const result=await mapRepository({root,changed_files:["src/calc.ts"]});
    assert.equal(result.status,"STATIC_MAP_ONLY");
    assert.equal(result.files_scanned,3);
    assert.ok(result.dependencies.some(x=>x.consumer==="src/index.ts"&&x.dependency==="src/calc.ts"));
    assert.ok(result.changed_file_exports.some(x=>x.exports.includes("calc")));
    assert.ok(result.candidate_test_imports.some(x=>x.test_file==="tests/calc.test.ts"));
    assert.doesNotMatch(JSON.stringify(result),/TEST-VERY-PRIVATE/);
    assert.equal(result.remote_transmission,false);
    assert.equal(result.independently_verified,false);
  });
});
test("P5 local mapping blocks outside paths and skips symlinked external source",async()=>{
  await inRepo(async root=>{
    await mkdir(join(root,"src"),{recursive:true});
    await writeFile(join(root,"src","one.js"),"export const one=1;");
    const link=join(root,"src","outside.js");
    await symlink(join(root,"src","one.js"),link);
    const r=await mapRepository({root,changed_files:["src/one.js"]});
    assert.equal(r.files_scanned,1);
    assert.equal(r.skipped_links,1);
    assert.equal(r.status,"PARTIAL_STATIC_MAP");
    for(const path of ["../secrets","/etc/passwd","src/../../private","src\\windows"]) {
      await assert.rejects(()=>mapRepository({root,changed_files:[path]}),/safe relative/);
    }
  });
});
test("P5 local map caps file scans and rejects invalid options",async()=>{
  await inRepo(async root=>{
    await mkdir(join(root,"src"),{recursive:true});
    await writeFile(join(root,"src","a.ts"),"export class A{}");
    await writeFile(join(root,"src","b.ts"),"export class B{}");
    const r=await mapRepository({root,changed_files:["src/a.ts"],max_files:1});
    assert.equal(r.files_scanned,1);
    assert.equal(r.truncated,true);
    await assert.rejects(()=>mapRepository({root,changed_files:["src/a.ts"],max_files:701}),/max_files/);
  });
});
