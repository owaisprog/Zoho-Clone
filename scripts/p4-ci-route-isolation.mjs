#!/usr/bin/env node
/**
 * CI-only safeguard: no P4 IAM/audit test router may become transitively
 * reachable from production Express app/server entrypoints. This is an
 * additional static check, not a complete security review.
 */
import {readFileSync,existsSync} from "node:fs";
import {resolve,dirname,extname} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const blocked=/\/platform\/p4-r(?:8|14|15|16|17)-ci-[^/]*(?:router|test-router)(?:\.tsx?)?$/;
export function inspectProductionGraph(read=readFileSync,exists=existsSync){
 const visited=new Set();
 function visit(path){
  const abs=resolve(path);
  if(visited.has(abs))return;
  visited.add(abs);
  const src=read(abs,"utf8");
  // Covers normal import/export and dynamic import with literal specifiers.
  const re=/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["'](\.[^"']+)["']/g;
  for(const match of src.matchAll(re)){
   const spec=match[1];
   if(!spec)continue;
   const stem=resolve(dirname(abs),spec);
   if(blocked.test(stem.replace(/\.js$/,"")))throw new Error("P4_CI_TEST_ROUTER_REACHABLE");
   const candidates=[
    stem,stem.replace(/\.js$/,".ts"),stem.replace(/\.js$/,".tsx"),
    stem+".ts",stem+".tsx",resolve(stem,"index.ts"),
   ];
   const target=candidates.find(p=>exists(p)&&[".ts",".tsx"].includes(extname(p)));
   if(target&&target.startsWith(resolve(root,"backend/src")+"/"))visit(target);
  }
 }
 visit(resolve(root,"backend/src/app.ts"));
 visit(resolve(root,"backend/src/server.ts"));
 return Object.freeze({checked:visited.size,status:"P4_CI_ROUTE_ISOLATION_PASS"});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const r=inspectProductionGraph();console.info(r.status+": "+r.checked+" production modules inspected");}
 catch{console.error("P4_CI_ROUTE_ISOLATION_FAIL");process.exitCode=1;}
}
