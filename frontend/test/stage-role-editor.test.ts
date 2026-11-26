import {test} from "node:test";
import assert from "node:assert/strict";
import {buildRoleChange,parseSalesGrants} from "../src/lib/stage-role-editor";
const row={role:"SALES_REP" as const,active:true,revision:4};
const requestId="97000000-0000-4000-8000-000000000001";
test("role editor constructs revision-bound toggle with exact request ID",()=>{
 assert.deepEqual(buildRoleChange(row,requestId),{role:"SALES_REP",expectedActive:true,nextActive:false,expectedRevision:4,requestId});
 assert.throws(()=>buildRoleChange(row,"wrong"));
 assert.throws(()=>buildRoleChange({...row,revision:1000000000},requestId));
});
test("strict grant projection rejects privileged roles and excess fields",()=>{
 const good={status:"verified",applicationAccess:false,items:[row]};
 assert.deepEqual(parseSalesGrants(good),[row]);
 for(const value of [{...good,applicationAccess:true},{...good,items:[row,row]},{...good,items:[{...row,role:"ORG_OWNER"}]},{...good,items:[{...row,actorId:requestId}]}])assert.throws(()=>parseSalesGrants(value));
});
