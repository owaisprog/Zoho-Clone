import assert from "node:assert/strict";
import {describe,it} from "node:test";
import type pg from "pg";
import {P4R28Denied} from "../src/platform/p4-r28-ci-org-service.js";
import {P4R29CiInvitationService} from "../src/platform/p4-r29-ci-invitation-service.js";
const ENV={CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
 PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",PGUSER:"demo_ci",
 PGPASSWORD:"fake_ci_not_for_real_accounts"};
const ACTOR={userId:"user_demo_alice",verified:true} as const;
const ORG="10000000-0000-4000-8000-000000000001";
function f(env:NodeJS.ProcessEnv=ENV){
 let count=0;
 const pool={async connect(){count++;throw Error("UNEXPECTED_DB");}} as unknown as pg.Pool;
 return {s:new P4R29CiInvitationService(pool,env),get count(){return count;}};
}
async function denied(value:Promise<unknown>,status:number,code:string){
 await assert.rejects(value,(e:unknown)=>{
  assert.ok(e instanceof P4R28Denied);
  assert.equal(e.status,status);assert.equal(e.code,code);
  return true;
 });
}
describe("P4 R29 persisted invitation command input/identity gates",()=>{
 it("rejects invalid real email domains and extra fields without database connection",async()=>{
  const x=f();
  for(const body of [null,{},[],{recipientEmail:9},
   {recipientEmail:"foo@merchant.com"},
   {recipientEmail:"Demo@example.com"},
   {recipientEmail:"owner@example.com",role:"OWNER"},
   {recipientEmail:"a@example.com",token:"injected"}]){
   await denied(x.s.create(ACTOR,ORG,body),400,"INVALID_INPUT");
  }
  assert.equal(x.count,0);
 });
 it("missing or forged actors cannot access invitation APIs",async()=>{
  const x=f();
  await denied(x.s.list(null,ORG),401,"IDENTITY_REQUIRED");
  await denied(x.s.create({userId:"user_demo_alice",verified:false} as never,
   ORG,{recipientEmail:"r@example.com"}),401,"IDENTITY_REQUIRED");
  await denied(x.s.revoke({userId:"user_demo_unknown",verified:true},ORG,
   "10000000-0000-4000-8000-000000000001"),401,"IDENTITY_REQUIRED");
  assert.equal(x.count,0);
 });
 it("foreign or malformed org identifiers never reach SQL",async()=>{
  const x=f();
  for(const org of ["invalid","10000000-0000-1000-8000-000000000001",null]){
   await denied(x.s.list(ACTOR,org),403,"ACCESS_DENIED");
  }
  assert.equal(x.count,0);
 });
 it("invalid invite IDs rejected before connecting",async()=>{
  const x=f();
  for(const invite of ["../private","a",null,"10000000-0000-1000-8000-000000000001"]){
   await denied(x.s.revoke(ACTOR,ORG,invite),403,"ACCESS_DENIED");
  }
  assert.equal(x.count,0);
 });
 it("wrong database, production, and CI failures block all commands",async()=>{
  for(const patch of [{CI:"false"},{GITHUB_ACTIONS:"false"},
   {PGDATABASE:"zoho_clone_synthetic"},{PGHOST:"neon.tech"},
   {NODE_ENV:"production"}]){
   const x=f({...ENV,...patch});
   await denied(x.s.create(ACTOR,ORG,{recipientEmail:"r@example.com"}),
    503,"UNAVAILABLE");
   await denied(x.s.list(ACTOR,ORG),503,"UNAVAILABLE");
   assert.equal(x.count,0);
  }
 });
 it("valid input only delegates to database, never preauthorizes in browser",async()=>{
  const x=f();
  await denied(x.s.create(ACTOR,ORG,{recipientEmail:"demo@example.com"}),
   503,"UNAVAILABLE");
  assert.equal(x.count,1);
 });
});
