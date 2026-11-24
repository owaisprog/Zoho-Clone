import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R45CiRenewalIssuer}
 from "../src/platform/p4-r45-ci-renewal-issuer.js";
import {P4R28Denied}
 from "../src/platform/p4-r28-ci-org-service.js";
const ORG="10000000-0000-4000-8000-000000000001";
const OLD="10000000-0000-4000-8000-000000000002";
const ACTOR={userId:"user_demo_alice",verified:true as const};
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const denied=(status:number,code:P4R28Denied["code"])=>(e:unknown)=>
 e instanceof P4R28Denied&&e.status===status&&e.code===code;
test("R45 renewal is disabled outside explicit synthetic CI",async()=>{
 const issuer=new P4R45CiRenewalIssuer({} as never,Buffer.alloc(32),
  {...ENV,CI:"false"});
 await assert.rejects(issuer.renew(ACTOR,ORG,{
  invitationId:OLD,expectedVersion:1}),denied(503,"UNAVAILABLE"));
});
test("R45 renewal fails closed for missing verified actor and invalid tenant",async()=>{
 const issuer=new P4R45CiRenewalIssuer({} as never,Buffer.alloc(32),ENV);
 await assert.rejects(issuer.renew(null,ORG,{
  invitationId:OLD,expectedVersion:1}),denied(401,"IDENTITY_REQUIRED"));
 await assert.rejects(issuer.renew(ACTOR,"bad",{
  invitationId:OLD,expectedVersion:1}),denied(403,"ACCESS_DENIED"));
});
test("R45 renewal cannot accept extra actor/role fields or unsafe revision",async()=>{
 const issuer=new P4R45CiRenewalIssuer({} as never,Buffer.alloc(32),ENV);
 for(const body of [{invitationId:OLD,expectedVersion:1,role:"OWNER"},
  {invitationId:OLD,expectedVersion:-1},
  {invitationId:"invalid",expectedVersion:1},
  {invitationId:OLD,expectedVersion:1,actorId:"user_demo_alice"},
  {invitationId:OLD,expectedVersion:1.2}]){
  await assert.rejects(issuer.renew(ACTOR,ORG,body),
   denied(400,"INVALID_INPUT"));
 }
});
