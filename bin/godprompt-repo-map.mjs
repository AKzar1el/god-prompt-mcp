#!/usr/bin/env node
/** Local, opt-in, non-executing repository map. Static import matching is not semantic AST parsing. */
import { readdir, lstat, readFile, realpath } from "node:fs/promises";
import { resolve, relative, dirname, extname, posix, sep, join } from "node:path";
import { pathToFileURL } from "node:url";
const DENY_DIRS=new Set([".git",".hg","node_modules","vendor",".next","dist","build","coverage",".cache","tmp"]);
const CODE_EXTS=new Set([".ts",".tsx",".js",".jsx",".mjs",".cjs",".mts",".cts"]);
const ID=/^[A-Za-z0-9_./-]{1,240}$/;
const LIMIT_FILES=700, LIMIT_PER_FILE=64*1024, LIMIT_TOTAL=3*1024*1024;
const bail=(msg)=>{throw new Error(msg)};
function safeRel(p) {
  return typeof p==="string" && ID.test(p) && !p.startsWith("/") &&
    !p.split("/").includes("..") && !p.split("/").includes(".") && !p.includes("\\");
}
function normalize(root,path) {
  const rel=relative(root,path).split(sep).join("/");
  return rel && safeRel(rel) ? rel : null;
}
function imports(text) {
  const found=new Set();
  const patterns=[
    /\b(?:import|export)\s+(?:[\s\S]{0,400}?\s+from\s*)?["'](\.{1,2}\/[^"'\r\n]{1,220})["']/g,
    /\brequire\s*\(\s*["'](\.{1,2}\/[^"'\r\n]{1,220})["']\s*\)/g,
    /\bimport\s*\(\s*["'](\.{1,2}\/[^"'\r\n]{1,220})["']\s*\)/g,
  ];
  for(const re of patterns) {
    let m,count=0;
    while((m=re.exec(text))&&count++<300)found.add(m[1]);
  }
  return [...found];
}
function symbols(text) {
  const out=new Set();
  const regex=/^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const)\s+([A-Za-z_$][\w$]{0,80})/gm;
  let m;
  while((m=regex.exec(text))&&out.size<60)out.add(m[1]);
  return [...out].sort();
}
function resolveImport(consumer, spec, available) {
  const base=posix.normalize(posix.join(posix.dirname(consumer),spec));
  if(!safeRel(base))return null;
  const variants=[base,...[...CODE_EXTS].map(ext=>base+ext),...["index.ts","index.tsx","index.js","index.mjs"].map(x=>base+"/"+x)];
  return variants.find(x=>available.has(x))??null;
}
export async function mapRepository({root,changed_files=[],max_files=LIMIT_FILES}={}) {
  if(typeof root!=="string"||!root.trim())bail("Explicit repository root required");
  if(!Number.isInteger(max_files)||max_files<1||max_files>LIMIT_FILES)bail("max_files must be 1..700");
  if(!Array.isArray(changed_files)||changed_files.length<1||changed_files.length>50||
      changed_files.some(x=>!safeRel(x)))bail("Supply 1..50 safe relative changed_files");
  const base=await realpath(resolve(root));
  if(!(await lstat(base)).isDirectory())bail("Root must be a regular directory");
  let bytes=0,skipped=0,skipped_links=0,oversized=0;
  const files=[];
  const stack=[base];
  let directoryCount=0;
  while(stack.length){
    const dir=stack.pop();
    const directoryReal=await realpath(dir);
    if(directoryReal!==base&&!directoryReal.startsWith(base+sep)){skipped_links++;continue;}
    if(++directoryCount>1000){skipped++;break;}
    const entries=await readdir(dir,{withFileTypes:true});
    entries.sort((a,b)=>a.name.localeCompare(b.name));
    for(const entry of entries){
      if(entry.name.startsWith(".") && entry.name!==".github")continue;
      const abs=join(dir,entry.name);
      if(entry.isSymbolicLink()){skipped_links++;continue;}
      if(entry.isDirectory()){
        if(!DENY_DIRS.has(entry.name) && stack.length<1000)stack.push(abs);
        continue;
      }
      if(!entry.isFile() || !CODE_EXTS.has(extname(entry.name)))continue;
      const info=await lstat(abs);
      if(!info.isFile() || info.nlink>1){skipped_links++;continue;}
      if(info.size>LIMIT_PER_FILE){oversized++;continue;}
      const rel=normalize(base,abs);
      if(!rel){skipped++;continue;}
      if(files.length>=max_files || bytes+info.size>LIMIT_TOTAL){skipped++;continue;}
      bytes+=info.size;
      files.push({path:rel,abs});
    }
  }
  files.sort((a,b)=>a.path.localeCompare(b.path));
  const available=new Set(files.map(x=>x.path));
  const dependencies=[];
  const outputSymbols=[];
  const proposedTests=[];
  const changes=[...new Set(changed_files)];
  let unresolved=0;
  for(const file of files) {
    // No source content leaves the output; ignore injected instructions in comments.
    const code=await readFile(file.abs,"utf8");
    const edges=new Set();
    for(const ref of imports(code)){
      const target=resolveImport(file.path,ref,available);
      if(target && target!==file.path)edges.add(target);
      else unresolved++;
    }
    for(const target of [...edges].sort())dependencies.push({consumer:file.path,dependency:target});
    if(changes.includes(file.path))outputSymbols.push({path:file.path,exports:symbols(code)});
    if(/(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file.path)){
      const relevant=[...edges].filter(x=>changes.includes(x));
      if(relevant.length)proposedTests.push({test_file:file.path,imports_changed_files:relevant});
    }
  }
  return {
    status:skipped||oversized||skipped_links?"PARTIAL_STATIC_MAP":"STATIC_MAP_ONLY",
    schema:"godprompt.local_code_map.v1",
    changed_files:changes,dependencies:dependencies.slice(0,3500),
    changed_file_exports:outputSymbols,
    candidate_test_imports:proposedTests.slice(0,100),
    files_scanned:files.length,bytes_scanned:bytes,unresolved_relative_imports:unresolved,
    skipped_files:skipped,oversized_files:oversized,skipped_links,
    truncated:dependencies.length>3500 || proposedTests.length>100||skipped>0,
    remote_transmission:false,independently_verified:false,
    warning:"Local static import and export heuristics, NOT a TypeScript/JavaScript AST or proof of test coverage. No code content is returned. Check dynamic imports, path aliases, joins and file links independently. Use dependencies only as caller-supplied graph for trace_change_impact.",
  };
}
async function main(args){
  if(args.length<2||args.length>51)bail("Usage: godprompt-repo-map ROOT CHANGED_FILE [CHANGED_FILE...]");
  return mapRepository({root:args[0],changed_files:args.slice(1)});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(v=>process.stdout.write(JSON.stringify(v,null,2)+"\n"))
    .catch(()=>{process.stderr.write("Unable to map bounded local codebase; check root and scope.\n");process.exitCode=1;});
}
