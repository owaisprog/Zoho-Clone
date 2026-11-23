import test from "node:test";
import assert from "node:assert/strict";
import {resolve} from "node:path";
import {inspectP4R19CompiledGraph} from "./p4-ci-compiled-boundary.mjs";
const dist=resolve("backend/dist");
function fake(app,server,extra={}){
 const files=new Map([
  [resolve(dist,"app.js"),app],[resolve(dist,"server.js"),server],
  ...Object.entries(extra).map(([name,src])=>[resolve(dist,name),src]),
 ]);
 return inspectP4R19CompiledGraph(
  p=>{if(!files.has(p))throw Error("MISSING_FIXTURE");return files.get(p);},
  p=>files.has(p),
 );
}
test("compiled graph permits safe imports",()=>{
 assert.deepEqual(fake('import "./internal/a.js";',"",{
  "internal/a.js":'export const x=1;',
 }),{status:"P4_PRODUCTION_BUILD_BOUNDARY_PASS",modules:3});
});
test("compiled graph denies reachable CI-specific database connector",()=>{
 assert.throws(()=>fake('import "./platform/p4-r7-ci-prisma-reader.js";',""),
  /P4_PRODUCTION_BUILD_BOUNDARY_DENIED/);
});
test("compiled graph denies nested CI HTTP router",()=>{
 assert.throws(()=>fake('import "./internal/a.js";',"",{
  "internal/a.js":'export * from "../platform/p4-r17-ci-rotated-audit-router.js";',
 }),/P4_PRODUCTION_BUILD_BOUNDARY_DENIED/);
});
test("compiled graph denies computed lazy imports",()=>{
 assert.throws(()=>fake('const name="./ci.js";void import(name);',""),
  /P4_PRODUCTION_BUILD_BOUNDARY_DENIED/);
});
test("compiled graph denies missing or escaped module",()=>{
 assert.throws(()=>fake('import "./missing.js";',""),/P4_PRODUCTION_BUILD_BOUNDARY_DENIED/);
 assert.throws(()=>fake('import "../test/bypass.js";',""),/P4_PRODUCTION_BUILD_BOUNDARY_DENIED/);
});
test("compiled graph denies fake canonical import outside output",()=>{
 assert.throws(()=>inspectP4R19CompiledGraph(
  ()=> 'import "./internal/safe.js";',
  p=>p.endsWith("internal/safe.js"),
  ()=>resolve("backend/test/escaped.js"),
 ),/P4_PRODUCTION_BUILD_BOUNDARY_DENIED/);
});
test("compiled server importing CI helper is blocked",()=>{
 assert.throws(()=>fake("",
  'import "./platform/p4-r15-ci-audit-test-router.js";'),
  /P4_PRODUCTION_BUILD_BOUNDARY_DENIED/);
});
