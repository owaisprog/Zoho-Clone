import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R40CiMemberRoles} from "../src/platform/p4-r40-ci-member-roles";
import {P4R28Denied} from "../src/platform/p4-r28-ci-org-service";
import {createP4R40CiMemberRolesRouter}
 from "../src/platform/p4-r40-ci-member-roles-router";

const demoOrg="10000000-0000-4000-8000-000000000001";
const actor={userId:"user_demo_alice",verified:true as const};
const denied=(error:unknown,status:number,code:string)=>
 error instanceof P4R28Denied&&error.status===status&&error.code===code;

test("R40 refuses unauthenticated CI pool even for fictional owner",async()=>{
 const service=new P4R40CiMemberRoles({} as never,{CI:"false"});
 await assert.rejects(service.list(actor,demoOrg),e=>denied(e,503,"UNAVAILABLE"));
 await assert.rejects(service.change(actor,demoOrg,"user_demo_bob",
  {role:"SALES_MANAGER",expectedRevision:0}),e=>denied(e,503,"UNAVAILABLE"));
});
test("R40 rejects fake actor and out-of-scope organization before DB calls",async()=>{
 const service=new P4R40CiMemberRoles({} as never,{
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"5432",
  PGDATABASE:"zoho_clone_synthetic_ci",PGUSER:"demo_ci",
  PGPASSWORD:"fake_ci_not_for_real_accounts",
 });
 await assert.rejects(service.list(null,demoOrg),e=>denied(e,401,"IDENTITY_REQUIRED"));
 await assert.rejects(service.list(actor,"not-uuid"),e=>denied(e,403,"ACCESS_DENIED"));
});
test("R40 validates body, revision and forbids hidden role fields",async()=>{
 const service=new P4R40CiMemberRoles({} as never);
 for(const body of [
  {role:"ORG_OWNER",expectedRevision:0},
  {role:"SALES_MANAGER",expectedRevision:-1},
  {role:"SALES_REP",expectedRevision:1.5},
  {role:"SALES_MANAGER",expectedRevision:0,actorId:"user_demo_alice"},
  ["SALES_MANAGER",0],
 ]){
  await assert.rejects(service.change(actor,demoOrg,"user_demo_bob",body),
   e=>denied(e,400,"INVALID_INPUT"));
 }
 await assert.rejects(service.change(actor,demoOrg,"alice@merchant.com",
  {role:"SALES_MANAGER",expectedRevision:0}),
  e=>denied(e,403,"ACCESS_DENIED"));
});
test("R40 HTTP router rejects activation outside required isolated CI",()=>{
 assert.throws(()=>createP4R40CiMemberRolesRouter({} as never,{
  CI:"false",NODE_ENV:"production",
 }),/P4_V1_CI_PRISMA_DENIED/);
});
