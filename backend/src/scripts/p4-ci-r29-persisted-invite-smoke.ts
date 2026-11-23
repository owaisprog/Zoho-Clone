import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "../platform/p4-v1-ci-prisma.js";
import {P4R28CiOrganizationService} from "../platform/p4-r28-ci-org-service.js";
import {P4R29CiInvitationService} from "../platform/p4-r29-ci-invitation-service.js";
import {createP4R29CiInvitationRouter} from "../platform/p4-r29-ci-invitation-router.js";
const ALICE={userId:"user_demo_alice",verified:true} as const;
const BOB={userId:"user_demo_bob",verified:true} as const;
let diagnosticPhase="initial";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:3});
 const orgService=new P4R28CiOrganizationService(pool,process.env);
 const service=new P4R29CiInvitationService(pool,process.env);
 const appFor=(actor:typeof ALICE|typeof BOB|null)=>{
  const app=express();app.use(express.json({limit:"16kb"}));
  app.use("/_p4_r29_ci",createP4R29CiInvitationRouter({
   service,resolveVerifiedActor:async()=>actor,
  }));
  return app;
 };
 const alice=appFor(ALICE),bob=appFor(BOB),anonymous=appFor(null);
 const email="new.r29@example.com";
 try{
  diagnosticPhase="create-organization";
  const org=await orgService.create(ALICE,{
   name:"Demo R29 Payments",slug:"demo-r29-payments",
  });
  const base="/_p4_r29_ci/"+org.id+"/invitations";
  diagnosticPhase="anonymous-denial";
  const denied=await request(anonymous).post(base).send({recipientEmail:email})
   .set("x-role","OWNER").set("x-user-id","user_demo_alice");
  assert.equal(denied.status,401);
  assert.deepEqual(denied.body,{error:{code:"IDENTITY_REQUIRED"}});
  diagnosticPhase="foreign-denial";
  const foreign=await request(bob).post(base).send({recipientEmail:email})
   .set("x-role","OWNER");
  assert.equal(foreign.status,403);
  assert.deepEqual(foreign.body,{error:{code:"ACCESS_DENIED"}});
  diagnosticPhase="invalid-body";
  for(const body of [{recipientEmail:"real@merchant.com"},
   {recipientEmail:email,role:"OWNER"},
   {recipientEmail:email,token:"never-allowed"},{recipientEmail:42}]){
   const invalid=await request(alice).post(base).send(body);
   assert.equal(invalid.status,400);
   assert.deepEqual(invalid.body,{error:{code:"INVALID_INPUT"}});
  }
  diagnosticPhase="create-invitation";
  const created=await request(alice).post(base).send({recipientEmail:email});
  assert.equal(created.status,201);
  assert.equal(created.headers["cache-control"],"no-store, private");
  assert.deepEqual(Object.keys(created.body.data).sort(),[
   "expiresAt","id","issuedAt","organizationId","recipientEmail",
   "role","status","version",
  ]);
  assert.equal(created.body.data.status,"pending");
  assert.equal(created.body.data.version,1);
  const id=created.body.data.id as string;
  diagnosticPhase="verify-persisted-hash";
  const db=await pool.query(
   "SELECT token_hash,status,recipient_email FROM p4_synthetic.invitations"+
   " WHERE id=$1",[id]);
  assert.equal(db.rowCount,1);
  assert.match(db.rows[0].token_hash,/^[0-9a-f]{64}$/);
  assert.equal(db.rows[0].status,"pending");
  assert.equal(db.rows[0].recipient_email,email);
  diagnosticPhase="list-invitations";
  const listed=await request(alice).get(base);
  assert.equal(listed.status,200);
  assert.equal(listed.body.data.length,1);
  assert.deepEqual(listed.body.data[0],created.body.data);
  assert.equal((await request(bob).get(base)).status,403);
  diagnosticPhase="duplicate-invitation";
  const duplicate=await request(alice).post(base).send({recipientEmail:email});
  assert.equal(duplicate.status,409);
  assert.deepEqual(duplicate.body,{error:{code:"CONFLICT"}});
  diagnosticPhase="revoke-invitation";
  const revoked=await request(alice).post(base+"/"+id+"/revoke");
  assert.equal(revoked.status,200);
  assert.equal(revoked.body.data.status,"revoked");
  assert.equal(revoked.body.data.version,2);
  assert.equal((await request(alice).post(base+"/"+id+"/revoke")).status,409);
  assert.equal((await request(bob).post(base+"/"+id+"/revoke")).status,403);
  diagnosticPhase="replacement-invitation";
  const replacement=await request(alice).post(base).send({recipientEmail:email});
  diagnosticPhase="replacement-invitation-http-"+replacement.status+"-"+String(replacement.body?.error?.code??"ok");
  assert.equal(replacement.status,201);
  assert.notEqual(replacement.body.data.id,id);
  // An old expired pending row is atomically terminalized before insert.
  await pool.query(
   "UPDATE p4_synthetic.invitations"+
   " SET issued_at=now()-interval '49 hours',"+
   " expires_at=now()-interval '1 hour'"+
   " WHERE id=$1",[replacement.body.data.id]);
  diagnosticPhase="expired-replacement";
  const refresh=await request(alice).post(base).send({recipientEmail:email});
  assert.equal(refresh.status,201);
  const old=await pool.query(
   "SELECT status,version FROM p4_synthetic.invitations WHERE id=$1",
   [replacement.body.data.id]);
  assert.deepEqual(old.rows,[{status:"expired",version:2}]);
  diagnosticPhase="foreign-organization";
  const foreignOrg="10000000-0000-4000-8000-000000000002";
  assert.equal((await request(alice).post(
   "/_p4_r29_ci/"+foreignOrg+"/invitations")
   .send({recipientEmail:"other@example.com"})).status,403);
  diagnosticPhase="safe-response-projection";
  for(const item of [created,listed,revoked,refresh,foreign,denied]){
   const body=JSON.stringify(item.body);
   for(const hidden of ["token_hash","password","postgresql://","user_demo_alice",
    db.rows[0].token_hash,"Authorization","auth0|"]){
    assert.equal(body.includes(hidden),false);
   }
  }
  diagnosticPhase="pooled-session-cleanup";
  const ctx=await pool.query("SELECT current_user AS role,"+
   " nullif(current_setting('app.actor_id',true),'') AS actor,"+
   " nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(ctx.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write(
   "P4 R29 persisted invitation draft create/list/revoke/expiry + RLS isolation PASS\n");
 }finally{await pool.end();}
}
main().catch(()=>{
 process.stderr.write("P4 R29 persisted invitation CI smoke FAILED at "+diagnosticPhase+"\n");
 process.exitCode=1;
});
