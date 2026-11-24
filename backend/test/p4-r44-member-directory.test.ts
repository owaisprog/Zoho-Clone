import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R40CiMemberRoles}
 from "../src/platform/p4-r40-ci-member-roles.js";
import {P4R28Denied}
 from "../src/platform/p4-r28-ci-org-service.js";
const ORG="10000000-0000-4000-8000-000000000001";
const ACTOR={userId:"user_demo_alice",verified:true as const};
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const rejected=(status:number,code:P4R28Denied["code"])=>(e:unknown)=>
 e instanceof P4R28Denied&&e.status===status&&e.code===code;
test("R44 member directory cannot initialize against non-CI database",async()=>{
 const service=new P4R40CiMemberRoles({} as never,{CI:"false"});
 await assert.rejects(service.directory(ACTOR,ORG,"all",""),
  rejected(503,"UNAVAILABLE"));
});
test("R44 owner actor must be verified; no caller-selected tenant",async()=>{
 const service=new P4R40CiMemberRoles({} as never,ENV);
 await assert.rejects(service.directory(null,ORG,"active",""),
  rejected(401,"IDENTITY_REQUIRED"));
 await assert.rejects(service.directory({userId:"user_demo_alice",verified:false as never},
  ORG,"all",""),rejected(401,"IDENTITY_REQUIRED"));
 await assert.rejects(service.directory(ACTOR,"invalid-org","all",""),
  rejected(403,"ACCESS_DENIED"));
});
test("R44 SQL receives bounded status and literal search only",async()=>{
 const service=new P4R40CiMemberRoles({} as never,ENV);
 for(const [filter,query] of [
  ["owners",""],["all","%"],["all","bob_'.OR 1=1"],
  ["all","a".repeat(41)],["revoked","carla?role=OWNER"],
  [null,""],["active",null],
 ]){
  await assert.rejects(service.directory(ACTOR,ORG,filter,query),
   rejected(400,"INVALID_INPUT"));
 }
});
