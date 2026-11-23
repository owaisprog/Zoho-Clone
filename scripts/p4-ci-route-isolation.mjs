#!/usr/bin/env node
/**
 * P4 B19: fail-closed production source dependency guard for internal IAM.
 * Traverses relative import/export/require and literal dynamic imports in
 * Express entrypoints. Not a substitute for a production security review.
 */
import {readFileSync,existsSync,realpathSync} from "node:fs";
import {resolve,dirname,extname,relative,sep} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const sourceRoot=resolve(root,"backend/src");
const CI_MODULE=/(?:^|\/)(?:p4-(?:v1|r\d+)-ci-[^/]+|p4-ci-[^/]+)(?:\.[jt]sx?)?$/;
const SPECIFIER=/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;
const DYNAMIC=/(?:\bimport|\brequire)\s*\(\s*(?!["'])/g;
const ALLOWED_EXT=new Set([".ts",".tsx",".mts",".cts"]);
function fail(){throw new Error("P4_CI_TEST_ROUTER_REACHABLE");}
function inside(path){
 const rel=relative(sourceRoot,path);
 return rel!==""&&rel!==".."&&!rel.startsWith(".."+sep);
}
export function inspectProductionGraph(read=readFileSync,exists=existsSync,canonical=p=>p){
 const visited=new Set();
 function visit(path){
  const abs=resolve(path);
  if(!inside(abs))fail();
  if(visited.has(abs))return;
  visited.add(abs);
  const src=read(abs,"utf8");
  // Nonliteral imports can conceal internal CI modules; refuse them.
  if(DYNAMIC.test(src))fail();
  for(const match of src.matchAll(SPECIFIER)){
   const spec=match[1];
   if(!spec)continue;
   if(!spec.startsWith(".")){
    if(spec.startsWith("@zoho-clone/backend/")||spec.startsWith("@/"))fail();
    continue;
   }
   const stem=resolve(dirname(abs),spec);
   if(!inside(stem))fail();
   if(CI_MODULE.test(stem.replace(/\.[jt]sx?$/,"")))fail();
   const candidates=[
    stem,stem.replace(/\.js$/,".ts"),stem.replace(/\.js$/,".tsx"),
    stem.replace(/\.js$/,".mts"),stem.replace(/\.js$/,".cts"),
    stem+".ts",stem+".tsx",resolve(stem,"index.ts"),
   ];
   const target=candidates.find(p=>exists(p)&&ALLOWED_EXT.has(extname(p)));
   if(!target)fail();
   const real=canonical(target);
   if(!inside(real))fail();
   visit(real);
  }
 }
 visit(resolve(sourceRoot,"app.ts"));
 visit(resolve(sourceRoot,"server.ts"));
 return Object.freeze({checked:visited.size,status:"P4_CI_ROUTE_ISOLATION_PASS"});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const r=inspectProductionGraph(readFileSync,existsSync,realpathSync);
  console.info(r.status+": "+r.checked+" production modules inspected");
 }catch{
  console.error("P4_CI_ROUTE_ISOLATION_FAIL");process.exitCode=1;
 }
}
