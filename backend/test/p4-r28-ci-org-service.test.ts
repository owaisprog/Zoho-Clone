import assert from "node:assert/strict";
import {describe,it} from "node:test";
import type pg from "pg";
import {
 P4R28CiOrganizationService,P4R28Denied,
} from "../src/platform/p4-r28-ci-org-service.js";
const ENV={CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
 PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",PGUSER:"demo_ci",
 PGPASSWORD:"fake_ci_not_for_real_accounts"};
const OWNER={userId:"user_demo_alice",verified:true} as const;
function fake(){
 let connections=0;
 const pool={async connect(){connections++;throw Error("DB_NOT_EXPECTED");}} as unknown as pg.Pool;
 return {service:new P4R28CiOrganizationService(pool,ENV),
  get connections(){return connections;}};
}
const payload={name:"Demo R28 Example",slug:"demo-r28-example"};
async function denied(promise:Promise<unknown>,status:number,code:string){
 await assert.rejects(promise,(e:unknown)=>{
  assert.ok(e instanceof P4R28Denied);
  assert.equal(e.status,status);assert.equal(e.code,code);
  return true;
 });
}
describe("P4 R28 transactional org API input and environment gates",()=>{
 it("denies missing identity before any SQL connection",async()=>{
  const f=fake();
  await denied(f.service.create(null,payload),401,"IDENTITY_REQUIRED");
  assert.equal(f.connections,0);
 });
 it("denies unknown synthetic actor and forged verification",async()=>{
  const f=fake();
  await denied(f.service.create({userId:"user_demo_mallory",verified:true},payload),
   401,"IDENTITY_REQUIRED");
  await denied(f.service.create({userId:OWNER.userId,verified:false} as never,payload),
   401,"IDENTITY_REQUIRED");
  assert.equal(f.connections,0);
 });
 it("rejects additional role, claimed tenant, or owner properties",async()=>{
  const f=fake();
  for(const body of [{...payload,role:"OWNER"},
   {...payload,ownerId:"user_demo_bob"},
   {...payload,organizationId:"another"},null,[],{}]){
   await denied(f.service.create(OWNER,body),400,"INVALID_INPUT");
  }
  assert.equal(f.connections,0);
 });
 it("rejects unsafe and duplicate-prone naming before the DB",async()=>{
  const f=fake();
  for(const body of [
   {name:"Acme Payments",slug:"demo-acme"},
   {name:"Demo A",slug:"demo-a"},
   {name:"Demo R28 Test",slug:"DEMO-UPPER"},
   {name:"Demo R28 Test",slug:"demo-admin"},
   {name:"Demo R28 Test",slug:"demo-foo--bar"},
   {name:"Demo R28 Test",slug:"demo-foo' OR 1=1--"},
   {name:"Demo R28 Test",slug:"demo-"+ "a".repeat(80)},
  ])await denied(f.service.create(OWNER,body),400,"INVALID_INPUT");
  assert.equal(f.connections,0);
 });
 it("rejects non-disposable database environment for create and read",async()=>{
  for(const patch of [{CI:"false"},{PGHOST:"owner.neon.tech"},
   {PGDATABASE:"production"},{NODE_ENV:"production"}]){
   const f=new P4R28CiOrganizationService(
    {connect(){throw Error("MUST_NOT_CONNECT");}} as unknown as pg.Pool,
    {...ENV,...patch});
   await denied(f.create(OWNER,payload),503,"UNAVAILABLE");
   await denied(f.read(OWNER,"00000000-0000-4000-8000-000000000001"),
    503,"UNAVAILABLE");
  }
 });
 it("does not query the database for malformed read IDs",async()=>{
  const f=fake();
  for(const value of ["../users","not-a-uuid",null,
   "10000000-0000-1000-8000-000000000001"]){
   await denied(f.service.read(OWNER,value),403,"ACCESS_DENIED");
  }
  assert.equal(f.connections,0);
 });
});
