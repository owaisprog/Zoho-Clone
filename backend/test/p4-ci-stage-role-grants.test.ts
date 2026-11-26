import {test} from "node:test";
import assert from "node:assert/strict";
import {parseRoleCommand,CiStageRoleGrants} from "../src/platform/p4-ci-stage-role-grants.js";
const good={role:"SALES_REP",expectedActive:false,nextActive:true,expectedRevision:0,requestId:"97000000-0000-4000-8000-000000000001"};
test("role commands accept only existing allowed role toggle shape",()=>{
 assert.deepEqual(parseRoleCommand(good),good);
 for(const bad of [{...good,role:"ORG_OWNER"},{...good,role:"ORG_ADMIN"},{...good,actorId:good.requestId},{...good,expectedRevision:-1},{...good,nextActive:false},{...good,requestId:"wrong"}])assert.throws(()=>parseRoleCommand(bad));
});
test("restricted writer cannot be created outside disposable CI",()=>assert.throws(()=>new CiStageRoleGrants({})));
