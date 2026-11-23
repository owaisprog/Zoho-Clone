import assert from "node:assert/strict";
import {describe,it} from "node:test";
import type pg from "pg";
import {P4R28Denied} from "../src/platform/p4-r28-ci-org-service.js";
import {P4R30CiAcceptanceService} from "../src/platform/p4-r30-ci-invitation-acceptance.js";
const ENV={CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
 PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",PGUSER:"demo_ci",
 PGPASSWORD:"fake_ci_not_for_real_accounts"};
const ACTOR={userId:"user_demo_carla",verified:true} as const;
const TOKEN="ab".repeat(32);
function fake(env:NodeJS.ProcessEnv=ENV){
 let calls=0;
 const pool={async connect(){calls++;throw Error("NO_DATABASE");}} as unknown as pg.Pool;
 return {service:new P4R30CiAcceptanceService(pool,env),get calls(){return calls;}};
}
async function denied(p:Promise<unknown>,status:number,code:P4R28Denied["code"]){
 await assert.rejects(p,(e:unknown)=>e instanceof P4R28Denied&&
  e.status===status&&e.code===code);
}
describe("P4 R30 synthetic recipient redemption input and safety boundary",()=>{
 it("cannot run without a trusted server-provided recipient",async()=>{
  const x=fake();
  await denied(x.service.accept(null,{token:TOKEN}),401,"IDENTITY_REQUIRED");
  assert.equal(x.calls,0);
 });
 it("rejects forged, unknown or unverified actors",async()=>{
  const x=fake();
  await denied(x.service.accept({userId:"user_demo_mallory",verified:true},
    {token:TOKEN}),401,"IDENTITY_REQUIRED");
  await denied(x.service.accept({userId:ACTOR.userId,verified:false} as never,
    {token:TOKEN}),401,"IDENTITY_REQUIRED");
  assert.equal(x.calls,0);
 });
 it("rejects any client-claimed recipient, role or org before SQL",async()=>{
  const x=fake();
  for(const body of [{token:TOKEN,recipientEmail:"carla@example.com"},
   {token:TOKEN,role:"OWNER"},{token:TOKEN,orgId:"some-org"},
   {token:TOKEN,userId:ACTOR.userId},{recipientEmail:"carla@example.com"},
   null,{},[]]){
   await denied(x.service.accept(ACTOR,body),400,"INVALID_INPUT");
  }
  assert.equal(x.calls,0);
 });
 it("only accepts fixed-length hex test tokens without whitespace",async()=>{
  const x=fake();
  for(const token of ["a".repeat(63),"a".repeat(65),
    "ZZ".repeat(32),TOKEN+" ", "not-a-token","../private"]){
   await denied(x.service.accept(ACTOR,{token}),400,"INVALID_INPUT");
  }
  assert.equal(x.calls,0);
 });
 it("rejects any non-disposable DB or production environment without connection",async()=>{
  for(const patch of [{CI:"false"},{GITHUB_ACTIONS:"false"},
   {PGHOST:"some.neon.tech"},{PGDATABASE:"production"},
   {NODE_ENV:"production"}]){
   const x=fake({...ENV,...patch});
   await denied(x.service.accept(ACTOR,{token:TOKEN}),503,"UNAVAILABLE");
   assert.equal(x.calls,0);
  }
 });
 it("valid shape delegates to DB and translates connection exceptions safely",async()=>{
  const x=fake();
  await denied(x.service.accept(ACTOR,{token:TOKEN}),503,"UNAVAILABLE");
  assert.equal(x.calls,1);
 });
});
