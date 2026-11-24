import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R48CiInvitationPager}
 from "../src/platform/p4-r48-ci-invitation-pager.js";
import {P4R28Denied}
 from "../src/platform/p4-r28-ci-org-service.js";
const ORG="10000000-0000-4000-8000-000000000001";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const ACTOR={userId:"user_demo_alice",verified:true as const};
const err=(status:number,code:P4R28Denied["code"])=>(e:unknown)=>
 e instanceof P4R28Denied&&e.status===status&&e.code===code;
test("R48 pager disabled outside CI and with untrusted key",async()=>{
 for(const [key,env] of [
  [Buffer.alloc(32),{...ENV,CI:"false"}],
  [Buffer.alloc(16),ENV],
 ] as const){
  const page=new P4R48CiInvitationPager({} as never,key,env);
  await assert.rejects(page.page(ACTOR,ORG,"all","",null),
   err(503,"UNAVAILABLE"));
 }
});
test("R48 missing identity, wrong tenant, bad filters cannot hit PostgreSQL",async()=>{
 const page=new P4R48CiInvitationPager({} as never,Buffer.alloc(32),ENV);
 await assert.rejects(page.page(null,ORG,"all","",null),
  err(401,"IDENTITY_REQUIRED"));
 await assert.rejects(page.page(ACTOR,"other","all","",null),
  err(403,"ACCESS_DENIED"));
 for(const [status,query,cursor] of [
  ["OWNER","",null],["all","%",null],["revoked","x".repeat(41),null],
  ["all","","garbage"],["all","",3],
 ] as const){
  await assert.rejects(page.page(ACTOR,ORG,status,query,cursor),
   err(400,"INVALID_INPUT"));
 }
});
