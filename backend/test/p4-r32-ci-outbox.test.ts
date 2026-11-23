import assert from "node:assert/strict";
import {describe,it} from "node:test";
import type pg from "pg";
import {P4R28Denied} from "../src/platform/p4-r28-ci-org-service.js";
import {P4R32CiOutboxIssuer,P4R32CiOutboxWorker,P4R32CiRecipientMailbox}
 from "../src/platform/p4-r32-ci-outbox.js";
const ENV={CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
 PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",PGUSER:"demo_ci",
 PGPASSWORD:"fake_ci_not_for_real_accounts"};
const OWNER={userId:"user_demo_alice",verified:true} as const;
const ORG="10000000-0000-4000-8000-000000000001";
const payload={recipientEmail:"carla@example.com"};
function setup(env:NodeJS.ProcessEnv=ENV,key=Buffer.alloc(32)){
 let count=0;
 const pool={async connect(){count++;throw Error("DB_UNREACHABLE");}} as unknown as pg.Pool;
 return {issuer:new P4R32CiOutboxIssuer(pool,key,env),
  worker:new P4R32CiOutboxWorker(pool,key,env),
  get count(){return count;}};
}
async function fails(p:Promise<unknown>,status:number,code:P4R28Denied["code"]){
 await assert.rejects(p,(e:unknown)=>e instanceof P4R28Denied&&
  e.status===status&&e.code===code);
}
describe("P4 R32 encrypted outbox lifecycle strict guards",()=>{
 it("requires trusted fictional OWNER identity before database",async()=>{
  const s=setup();
  await fails(s.issuer.issue(null,ORG,payload),401,"IDENTITY_REQUIRED");
  await fails(s.issuer.issue({userId:"user_demo_unknown",verified:true},
   ORG,payload),401,"IDENTITY_REQUIRED");
  await fails(s.issuer.issue({userId:OWNER.userId,verified:false} as never,
   ORG,payload),401,"IDENTITY_REQUIRED");
  assert.equal(s.count,0);
 });
 it("rejects client-controlled roles or email outside fictional domain",async()=>{
  const s=setup();
  for(const body of [{...payload,role:"OWNER"},
   {...payload,actorId:OWNER.userId},{recipientEmail:"person@merchant.com"},
   {recipientEmail:"CARLA@example.com"},null,{},[]]){
   await fails(s.issuer.issue(OWNER,ORG,body),400,"INVALID_INPUT");
  }
  assert.equal(s.count,0);
 });
 it("blocks malformed org UUIDs without connecting",async()=>{
  const s=setup();
  for(const id of ["foreign","10000000-0000-1000-8000-000000000001",null]){
   await fails(s.issuer.issue(OWNER,id,payload),403,"ACCESS_DENIED");
  }
  assert.equal(s.count,0);
 });
 it("blocks all database operations outside exact isolated CI settings",async()=>{
  for(const patch of [{CI:"false"},{GITHUB_ACTIONS:"false"},
   {PGDATABASE:"production"},{PGHOST:"neon.tech"},{NODE_ENV:"production"}]){
   const s=setup({...ENV,...patch});
   await fails(s.issuer.issue(OWNER,ORG,payload),503,"UNAVAILABLE");
   await fails(s.worker.deliverOne(new P4R32CiRecipientMailbox()),
    503,"UNAVAILABLE");
   assert.equal(s.count,0);
  }
 });
 it("requires an exact 256-bit encryption key",async()=>{
  for(const key of [Buffer.alloc(0),Buffer.alloc(16),Buffer.alloc(33)]){
   const s=setup(ENV,key);
   await fails(s.issuer.issue(OWNER,ORG,payload),503,"UNAVAILABLE");
   await fails(s.worker.deliverOne(new P4R32CiRecipientMailbox()),
    503,"UNAVAILABLE");
   assert.equal(s.count,0);
  }
 });
 it("fixture mailer never creates duplicate records with same job ID",()=>{
  const mailbox=new P4R32CiRecipientMailbox();
  mailbox.deliver("job-1","carla@example.com","ab".repeat(32));
  mailbox.deliver("job-1","carla@example.com","cd".repeat(32));
  assert.equal(mailbox.count(),1);
  assert.equal(mailbox.take("carla@example.com"),"ab".repeat(32));
  assert.equal(mailbox.take("carla@example.com"),null);
 });
 it("outbox connection failures remain sanitized",async()=>{
  const s=setup();
  await fails(s.issuer.issue(OWNER,ORG,payload),503,"UNAVAILABLE");
  await fails(s.worker.deliverOne(new P4R32CiRecipientMailbox()),
   503,"UNAVAILABLE");
  assert.equal(s.count,2);
 });
});
