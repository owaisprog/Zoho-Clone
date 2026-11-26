import {test} from "node:test";
import assert from "node:assert/strict";
import {createPermissionWorkspaceTransport,parseGrantOutcome} from "../src/lib/stage-permission-workspace";
const id="99000000-0000-4000-8000-000000000001";
test("workspace transport never accepts browser identity and uses fixed same-origin endpoints",async()=>{
 const calls:string[]=[];
 const api=createPermissionWorkspaceTransport(async(url,init)=>{
  calls.push(String(url));assert.equal(init?.credentials,"same-origin");assert.equal(init?.redirect,"error");
  const headers=new Headers(init?.headers);assert.equal(headers.get("authorization"),null);assert.equal(headers.get("x-p4-permission-workspace"),"1");
  return Response.json({status:"verified",items:[{role:"SALES_REP",active:false,revision:0}],applicationAccess:false});
 });
 assert.equal((await api.roles.list(id,id)).length,1);
 assert.deepEqual(calls,["/api/permission-workspace/"+id+"/targets/"+id+"/sales-grants"]);
 await assert.rejects(api.roles.list("../",id));assert.equal(calls.length,1);
});
test("grant outcome is fail closed for unexpected authority, status or payload",()=>{
 assert.equal(parseGrantOutcome({status:"applied",applicationAccess:false},200),"applied");
 assert.equal(parseGrantOutcome({status:"applied",applicationAccess:true},200),"unavailable");
 assert.equal(parseGrantOutcome({status:"applied",applicationAccess:false},409),"unavailable");
 assert.equal(parseGrantOutcome({status:"conflict",applicationAccess:false},409),"conflict");
 assert.equal(parseGrantOutcome({status:"unauthenticated",applicationAccess:false},401),"denied");
});
