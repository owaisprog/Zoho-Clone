import test from "node:test";
import assert from "node:assert/strict";
import {resolve} from "node:path";
import {inspectProductionGraph} from "./p4-ci-route-isolation.mjs";

function fakeGraph(app,server,more={}){
 const root=resolve("backend/src");
 const files=new Map([
  [resolve(root,"app.ts"),app],
  [resolve(root,"server.ts"),server],
  ...Object.entries(more).map(([name,src])=>[resolve(root,name),src]),
 ]);
 const read=(p)=>{if(!files.has(p))throw Error("UNKNOWN_FIXTURE");return files.get(p);};
 return inspectProductionGraph(read,p=>files.has(p));
}
test("real app and server have no R8-R17 synthetic IAM router import",()=>{
 const result=inspectProductionGraph();
 assert.equal(result.status,"P4_CI_ROUTE_ISOLATION_PASS");
 assert.ok(result.checked>=2);
});
test("detects direct imported private CI audit route",()=>{
 assert.throws(()=>fakeGraph(
  'import "./platform/p4-r17-ci-rotated-audit-router.js";',""),
  /P4_CI_TEST_ROUTER_REACHABLE/);
});
test("detects indirect import through benign-looking internal adapter",()=>{
 assert.throws(()=>fakeGraph(
  'import "./internal/bind.js";',"",
  {"internal/bind.ts":'export { createP4R17CiRotatedAuditRouter } from "../platform/p4-r17-ci-rotated-audit-router.js";'}),
  /P4_CI_TEST_ROUTER_REACHABLE/);
});
test("detects literal dynamic import even when not executed",()=>{
 assert.throws(()=>fakeGraph(
  'const x=import("./platform/p4-r16-ci-signed-audit-test-router.js");',""),
  /P4_CI_TEST_ROUTER_REACHABLE/);
});
test("does not deny a normal non-IAM module import",()=>{
 const result=fakeGraph('import "./internal/safe.js";',"",
  {"internal/safe.ts":'export const safe=true;'});
 assert.equal(result.checked,3);
});
test("server direct imported synthetic router also fails",()=>{
 assert.throws(()=>fakeGraph("",
  'import "./platform/p4-r15-ci-audit-test-router.js";'),
  /P4_CI_TEST_ROUTER_REACHABLE/);
});


test("rejects reaching a CI Prisma reader even without a router",()=>{
 assert.throws(()=>fakeGraph('import "./platform/p4-r7-ci-prisma-reader.js";',""),/P4_CI_TEST_ROUTER_REACHABLE/);
});
test("rejects CI identity helper imported through safe-looking module",()=>{
 assert.throws(()=>fakeGraph('import "./internal/safe.js";',"",{
  "internal/safe.ts":'export * from "../platform/p4-v1-ci-identity.js";',
 }),/P4_CI_TEST_ROUTER_REACHABLE/);
});
test("rejects unresolved relative dependency rather than silently skipping",()=>{
 assert.throws(()=>fakeGraph('import "./internal/unknown.js";',""),/P4_CI_TEST_ROUTER_REACHABLE/);
});
test("rejects computed dynamic imports",()=>{
 assert.throws(()=>fakeGraph('const spec="./safe.js";void import(spec);',""),/P4_CI_TEST_ROUTER_REACHABLE/);
});
test("rejects CommonJS computed require",()=>{
 assert.throws(()=>fakeGraph('const dep="./safe.js";require(dep);',""),/P4_CI_TEST_ROUTER_REACHABLE/);
});
test("rejects backend alias imports until explicitly resolved",()=>{
 assert.throws(()=>fakeGraph('import x from "@/platform/p4-r7-ci-prisma-reader";',""),/P4_CI_TEST_ROUTER_REACHABLE/);
});
test("rejects traversal outside backend source tree",()=>{
 assert.throws(()=>fakeGraph('import "../test/p4-r15-ci-audit-page.test.js";',""),/P4_CI_TEST_ROUTER_REACHABLE/);
});
test("rejects canonical paths resolving outside backend source",()=>{
 assert.throws(()=>inspectProductionGraph(
  ()=> 'import "./internal/safe.js";',
  p=>p.endsWith("internal/safe.ts"),
  ()=>resolve("backend/test/escaped.ts"),
 ),/P4_CI_TEST_ROUTER_REACHABLE/);
});
test("rejects static CommonJS CI module import",()=>{
 assert.throws(()=>fakeGraph('const test=require("./platform/p4-r17-ci-rotated-audit-router.js");',""),/P4_CI_TEST_ROUTER_REACHABLE/);
});

test("R88 rejects unmounted SDK preparation and new privileged CI modules",()=>{
 for(const path of ["p4-r81-provider-tenant","p4-r84-ci-runtime","p4-r85-ci-files","p4-r86-ci-notifications","p4-r87-ci-queue"]){assert.throws(()=>fakeGraph('import "./platform/'+path+'.js";',"",{["platform/"+path+".ts"]:"export const candidate=true;"}),/P4_CI_TEST_ROUTER_REACHABLE/);}
});

test("Vercel index entrypoint cannot import CI modules",()=>{
 assert.throws(()=>fakeGraph("","",{"index.ts":'import "./platform/p4-r84-ci-runtime.js";'}),/P4_CI_TEST_ROUTER_REACHABLE/);
});
