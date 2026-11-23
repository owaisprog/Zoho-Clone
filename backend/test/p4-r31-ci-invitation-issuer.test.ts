import assert from "node:assert/strict";
import {describe,it} from "node:test";
import type pg from "pg";
import {P4R28Denied} from "../src/platform/p4-r28-ci-org-service.js";
import {P4R31CiFixtureMailbox,P4R31CiInvitationIssuer}
 from "../src/platform/p4-r31-ci-invitation-issuer.js";
const ENV={CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
 PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",PGUSER:"demo_ci",
 PGPASSWORD:"fake_ci_not_for_real_accounts"};
const ACTOR={userId:"user_demo_alice",verified:true} as const;
const ORG="10000000-0000-4000-8000-000000000001";
const body={recipientEmail:"carla@example.com"};
function fake(env:NodeJS.ProcessEnv=ENV){
 let connections=0;
 const pool={async connect(){connections++;throw Error("NO_CONNECTION");}} as unknown as pg.Pool;
 return {service:new P4R31CiInvitationIssuer(
  pool,new P4R31CiFixtureMailbox(),env),
  get connections(){return connections;}};
}
async function rejected(work:Promise<unknown>,status:number,code:P4R28Denied["code"]){
 await assert.rejects(work,(e:unknown)=>
  e instanceof P4R28Denied&&e.status===status&&e.code===code);
}
describe("P4 R31 fixture mailbox and transactional issuer guard",()=>{
 it("stores a fixture-only token once and deletes it on pickup",()=>{
  const mailbox=new P4R31CiFixtureMailbox(2);
  const token="ab".repeat(32);
  mailbox.deposit("carla@example.com",token);
  assert.equal(mailbox.pendingCount(),1);
  assert.equal(mailbox.takeForFixtureTest("carla@example.com"),token);
  assert.equal(mailbox.takeForFixtureTest("carla@example.com"),null);
  assert.equal(mailbox.pendingCount(),0);
 });
 it("rejects unbounded capacity, unauthorized recipient and duplicate delivery",()=>{
  assert.throws(()=>new P4R31CiFixtureMailbox(-1));
  assert.throws(()=>new P4R31CiFixtureMailbox(101));
  const mailbox=new P4R31CiFixtureMailbox(1);
  const token="cd".repeat(32);
  assert.throws(()=>mailbox.deposit("real@merchant.com",token));
  assert.throws(()=>mailbox.deposit("carla@example.com","bad"));
  mailbox.deposit("carla@example.com",token);
  assert.throws(()=>mailbox.deposit("carla@example.com",token));
  assert.throws(()=>mailbox.deposit("diana@example.com",token));
  assert.equal(mailbox.pendingCount(),1);
 });
 it("does not connect without verified fictional issuing owner identity",async()=>{
  const x=fake();
  await rejected(x.service.issue(null,ORG,body),401,"IDENTITY_REQUIRED");
  await rejected(x.service.issue({userId:"user_demo_unknown",verified:true},
   ORG,body),401,"IDENTITY_REQUIRED");
  await rejected(x.service.issue({userId:ACTOR.userId,verified:false} as never,
   ORG,body),401,"IDENTITY_REQUIRED");
  assert.equal(x.connections,0);
 });
 it("does not allow client-selected role, actor or tenant",async()=>{
  const x=fake();
  for(const input of [{...body,role:"OWNER"},{...body,userId:"user_demo_bob"},
   {...body,organizationId:ORG},{recipientEmail:"external@merchant.com"},
   {recipientEmail:18},null,{},[]]){
   await rejected(x.service.issue(ACTOR,ORG,input),400,"INVALID_INPUT");
  }
  assert.equal(x.connections,0);
 });
 it("rejects foreign or malformed organization identifiers before SQL",async()=>{
  const x=fake();
  for(const id of ["foreign","10000000-0000-1000-8000-000000000001",
   "../organizations",null]){
   await rejected(x.service.issue(ACTOR,id,body),403,"ACCESS_DENIED");
  }
  assert.equal(x.connections,0);
 });
 it("denies non-disposable, non-CI and production credentials",async()=>{
  for(const patch of [{CI:"false"},{GITHUB_ACTIONS:"false"},
   {PGDATABASE:"production"},{PGHOST:"some.neon.tech"},
   {NODE_ENV:"production"}]){
   const x=fake({...ENV,...patch});
   await rejected(x.service.issue(ACTOR,ORG,body),503,"UNAVAILABLE");
   assert.equal(x.connections,0);
  }
 });
 it("reports sanitized error when a legitimate CI database connection fails",async()=>{
  const x=fake();
  await rejected(x.service.issue(ACTOR,ORG,body),503,"UNAVAILABLE");
  assert.equal(x.connections,1);
 });
});
