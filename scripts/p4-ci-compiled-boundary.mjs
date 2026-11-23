#!/usr/bin/env node
/**
 * P4 R19: inspect actual compiled Express module graph after backend build.
 * Test-only CI code may be emitted by tsc, but may not be reachable from
 * production Express entrypoints. Not a bundler or pen-test substitute.
 */
import {readFileSync,existsSync,realpathSync} from "node:fs";
import {resolve,dirname,relative,sep,extname} from "node:path";
import {fileURLToPath} from "node:url";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const OUT=resolve(ROOT,"backend/dist");
const BLOCK=/(?:^|\/)(?:p4-(?:v1|r\d+)-ci-[^/]+|p4-ci-[^/]+)(?:\.js)?$/;
const STATICS=/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;
const COMPUTED=/(?:\bimport|\brequire)\s*\(\s*(?!["'])/g;
const deny=()=>{throw new Error("P4_PRODUCTION_BUILD_BOUNDARY_DENIED");};
function within(p){
 const rel=relative(OUT,p);
 return rel!==""&&rel!==".."&&!rel.startsWith(".."+sep);
}
export function inspectP4R19CompiledGraph(
 read=readFileSync,exists=existsSync,canonical=p=>p,
){
 const visited=new Set();
 function walk(path){
  const abs=resolve(path);
  if(!within(abs))deny();
  if(visited.has(abs))return;
  visited.add(abs);
  const source=read(abs,"utf8");
  if(COMPUTED.test(source))deny();
  for(const match of source.matchAll(STATICS)){
   const spec=match[1];
   if(!spec)continue;
   if(!spec.startsWith(".")){
    if(spec.startsWith("@/")||spec.startsWith("@zoho-clone/backend/"))deny();
    continue;
   }
   const file=resolve(dirname(abs),spec);
   if(!within(file)||BLOCK.test(file.replace(/\.js$/,"")))deny();
   const candidates=[file,file+".js",resolve(file,"index.js")];
   const target=candidates.find(x=>extname(x)===".js"&&exists(x));
   if(!target)deny();
   const real=canonical(target);
   if(!within(real))deny();
   walk(real);
  }
 }
 walk(resolve(OUT,"app.js"));
 walk(resolve(OUT,"server.js"));
 return Object.freeze({status:"P4_PRODUCTION_BUILD_BOUNDARY_PASS",modules:visited.size});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const r=inspectP4R19CompiledGraph(readFileSync,existsSync,realpathSync);
  console.info(r.status+": "+r.modules+" compiled modules inspected");
 }catch{
  console.error("P4_PRODUCTION_BUILD_BOUNDARY_FAIL");process.exitCode=1;
 }
}
