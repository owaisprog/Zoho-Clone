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
