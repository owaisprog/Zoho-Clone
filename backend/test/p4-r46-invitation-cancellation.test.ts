import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R46CiInvitationCanceler}
 from "../src/platform/p4-r46-ci-invitation-canceler.js";
import {P4R28Denied}
 from "../src/platform/p4-r28-ci-org-service.js";
const ORG="10000000-0000-4000-8000-000000000001";
const ID="10000000-0000-4000-8000-000000000002";
const ACTOR={userId:"user_demo_alice",verified:true as const};
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const isDenied=(status:number,code:P4R28Denied["code"])=>(x:unknown)=>
 x instanceof P4R28Denied&&x.status===status&&x.code===code;
test("R46 cannot cancel outside synthetic CI",async()=>{
 const service=new P4R46CiInvitationCanceler({} as never,{...ENV,CI:"false"});
 await assert.rejects(service.cancel(ACTOR,ORG,{invitationId:ID,expectedVersion:1}),
  isDenied(503,"UNAVAILABLE"));
});
test("R46 missing verified actor and malformed org are denied before SQL",async()=>{
 const service=new P4R46CiInvitationCanceler({} as never,ENV);
 await assert.rejects(service.cancel(null,ORG,{invitationId:ID,expectedVersion:1}),
  isDenied(401,"IDENTITY_REQUIRED"));
 await assert.rejects(service.cancel(ACTOR,"bad",{invitationId:ID,expectedVersion:1}),
  isDenied(403,"ACCESS_DENIED"));
});
test("R46 accepts no caller-provided role, email, actor or negative revision",async()=>{
 const service=new P4R46CiInvitationCanceler({} as never,ENV);
 for(const payload of [{invitationId:ID,expectedVersion:1,role:"OWNER"},
  {invitationId:ID,expectedVersion:1,actorId:"user_demo_alice"},
  {invitationId:ID,expectedVersion:1,email:"bob@example.com"},
  {invitationId:ID,expectedVersion:0},
  {invitationId:"bad",expectedVersion:1}]){
  await assert.rejects(service.cancel(ACTOR,ORG,payload),
   isDenied(400,"INVALID_INPUT"));
 }
});
