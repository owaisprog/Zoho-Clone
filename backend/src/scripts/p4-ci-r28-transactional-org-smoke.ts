/**
 * Batch 28: actual CI PostgreSQL transactional organization API smoke.
 * This does not validate a live Auth0 login, customer database, or production.
 */
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "../platform/p4-v1-ci-prisma.js";
import {P4R28CiOrganizationService,P4R28Denied}
 from "../platform/p4-r28-ci-org-service.js";
import {createP4R28CiOrgRouter} from "../platform/p4-r28-ci-org-router.js";
const ALICE={userId:"user_demo_alice",verified:true} as const;
const BOB={userId:"user_demo_bob",verified:true} as const;
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:4});
 const service=new P4R28CiOrganizationService(pool,process.env);
 const appFor=(actor:typeof ALICE|typeof BOB|null)=>{
  const app=express();app.use(express.json({limit:"16kb"}));
  app.use("/_p4_r28_ci/organizations",createP4R28CiOrgRouter({
   service,resolveVerifiedActor:async()=>actor,
  }));
  return app;
 };
 const alice=appFor(ALICE),bob=appFor(BOB),unknown=appFor(null);
 const base="/_p4_r28_ci/organizations";
 const name="Demo R28 Alpha",slug="demo-r28-alpha";
 try{
  const unauthorized=await request(unknown).post(base)
   .set("x-user-id",ALICE.userId).set("x-role","ORG_OWNER")
   .send({name,slug});
  assert.equal(unauthorized.status,401);
  assert.deepEqual(unauthorized.body,{error:{code:"IDENTITY_REQUIRED"}});
  const unverified=await request(bob).post(base).send({name,slug});
  assert.equal(unverified.status,403);
  assert.deepEqual(unverified.body,{error:{code:"ACCESS_DENIED"}});
  for(const body of [{name:"Real Company",slug:"demo-r28-invalid"},
   {name,slug,role:"OWNER"}, {name,slug:"demo-admin"},
   {name,slug:"demo-r28-alpha' OR 1=1--"}]){
   const bad=await request(alice).post(base).send(body);
   assert.equal(bad.status,400);
   assert.deepEqual(bad.body,{error:{code:"INVALID_INPUT"}});
  }
  const created=await request(alice).post(base).send({name,slug});
  assert.equal(created.status,201);
  assert.equal(created.headers["cache-control"],"no-store, private");
  assert.deepEqual(Object.keys(created.body.data).sort(),
   ["id","name","ownerRole","slug"]);
  assert.equal(created.body.data.name,name);
  assert.equal(created.body.data.ownerRole,"OWNER");
  const id=created.body.data.id as string;
  assert.match(id,/^[0-9a-f-]{36}$/);
  const persisted=await pool.query(
   "SELECT o.id::text AS id,o.created_by,m.role,m.active"+
   " FROM p4_synthetic.organizations o JOIN p4_synthetic.memberships m"+
   " ON m.org_id=o.id WHERE o.id=$1",[id]);
  assert.deepEqual(persisted.rows,[{id,created_by:ALICE.userId,role:"OWNER",active:true}]);
  const read=await request(alice).get(base+"/"+id);
  assert.equal(read.status,200);assert.deepEqual(read.body.data,created.body.data);
  const foreign=await request(bob).get(base+"/"+id)
   .set("x-role","ORG_OWNER").set("x-tenant-id",id);
  assert.equal(foreign.status,403);
  assert.deepEqual(foreign.body,{error:{code:"ACCESS_DENIED"}});
  const anonymous=await request(unknown).get(base+"/"+id);
  assert.equal(anonymous.status,401);
  assert.equal((await request(alice).get(base+"/invalid")).status,403);
  const duplicate=await request(alice).post(base).send({name,slug});
  assert.equal(duplicate.status,409);
  assert.deepEqual(duplicate.body,{error:{code:"CONFLICT"}});
  // A failed second insert must roll back the first insert atomically.
  await assert.rejects(service.create(ALICE,{
   name:"Demo R28 Rollback",slug:"demo-r28-rollback",
  },{failAfterOrg:true}),e=>e instanceof P4R28Denied&&e.status===503);
  assert.equal((await pool.query(
   "SELECT count(*)::integer AS count FROM p4_synthetic.organizations"+
   " WHERE slug='demo-r28-rollback'")).rows[0]?.count,0);
  // Create two different tenants concurrently. No tenant context leaks.
  const concurrent=await Promise.all([
   request(alice).post(base).send({name:"Demo R28 Beta",slug:"demo-r28-beta"}),
   request(alice).post(base).send({name:"Demo R28 Gamma",slug:"demo-r28-gamma"}),
  ]);
  concurrent.forEach(r=>assert.equal(r.status,201));
  assert.notEqual(concurrent[0]?.body.data.id,concurrent[1]?.body.data.id);
  const context=await pool.query(
   "SELECT current_user AS role,"+
   " nullif(current_setting('app.actor_id',true),'') AS actor,"+
   " nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(context.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  // No token, email, DB path, SQL error or internal identity should be echoed.
  for(const response of [created,read,foreign,unauthorized,unverified,duplicate]){
   const json=JSON.stringify(response.body);
   for(const value of ["auth0|","token_hash","recipient_email","password",
    "postgresql://","user_demo_alice","internal_error"]){
    assert.equal(json.includes(value),false);
   }
  }
  process.stdout.write("P4 R28 transactional persisted org + owner API, rollback, duplicate, tenant isolation PASS\n");
 }finally{await pool.end();}
}
main().catch(()=>{
 process.stderr.write("P4 R28 disposable organization transaction smoke FAILED\n");
 process.exitCode=1;
});
