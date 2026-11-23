/**
 * P4 R30: real disposable PostgreSQL + Express invitation redemption smoke.
 * Only CI fixture users, raw tokens generated inside this test and NEVER
 * returned to a real browser. No live email, Auth0, Neon or customer data.
 */
import assert from "node:assert/strict";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import express from "express";
import request from "supertest";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "../platform/p4-v1-ci-prisma.js";
import {P4R28CiOrganizationService} from "../platform/p4-r28-ci-org-service.js";
import {P4R29CiInvitationService} from "../platform/p4-r29-ci-invitation-service.js";
import {createP4R30CiInvitationAcceptanceRouter}
 from "../platform/p4-r30-ci-invitation-accept-router.js";
import {P4R30CiAcceptanceService}
 from "../platform/p4-r30-ci-invitation-acceptance.js";
const ALICE={userId:"user_demo_alice",verified:true} as const;
const CARLA={userId:"user_demo_carla",verified:true} as const;
const DIANA={userId:"user_demo_diana",verified:true} as const;
const BOB={userId:"user_demo_bob",verified:true} as const;
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:5});
 const orgService=new P4R28CiOrganizationService(pool,process.env);
 const invites=new P4R29CiInvitationService(pool,process.env);
 const service=new P4R30CiAcceptanceService(pool,process.env);
 const appFor=(actor:typeof ALICE|typeof CARLA|typeof DIANA|typeof BOB|null)=>{
  const app=express();app.use(express.json({limit:"16kb"}));
  app.use("/_p4_r30_ci",createP4R30CiInvitationAcceptanceRouter({
   service,resolveVerifiedActor:async()=>actor,
  }));
  return app;
 };
 const carla=appFor(CARLA),diana=appFor(DIANA),alice=appFor(ALICE),
  bob=appFor(BOB),anonymous=appFor(null);
 const path="/_p4_r30_ci/accept";
 const fixture=async(orgId:string,email:string,expiration:"active"|"expired"="active")=>{
  const token=randomBytes(32).toString("hex");
  const hash=createHash("sha256").update(token).digest("hex");
  const id=randomUUID();
  if(expiration==="expired"){
   await pool.query(
    "INSERT INTO p4_synthetic.invitations"+
    " (id,org_id,invited_by,recipient_email,granted_role,token_hash,"+
    " issued_at,expires_at) VALUES ($1,$2,$3,$4,'MEMBER',$5,"+
    " now()-interval '47 hours',now()-interval '1 hour')",
    [id,orgId,ALICE.userId,email,hash]);
  }else{
   await pool.query(
    "INSERT INTO p4_synthetic.invitations"+
    " (id,org_id,invited_by,recipient_email,granted_role,token_hash,"+
    " issued_at,expires_at) VALUES ($1,$2,$3,$4,'MEMBER',$5,"+
    " now(),now()+interval '48 hours')",
    [id,orgId,ALICE.userId,email,hash]);
  }
  return {id,token,hash};
 };
 try{
  // Fixture identities must correspond to database-verified emails.
  for(const [user,email] of [["user_demo_carla","carla@example.com"],
    ["user_demo_diana","diana@example.com"]] as const){
   await pool.query("INSERT INTO p4_synthetic.users(id) VALUES ($1)"+
    " ON CONFLICT (id) DO NOTHING",[user]);
   await pool.query(
    "INSERT INTO p4_synthetic.identity_subjects"+
    " (issuer,external_subject,user_id,canonical_email,email_verified)"+
    " VALUES ('https://demo.us.auth0.com/',$1,$2,$3,true)"+
    " ON CONFLICT (issuer,external_subject) DO NOTHING",
    ["auth0|"+user,user,email]);
  }
  const org=await orgService.create(ALICE,{
   name:"Demo R30 Acceptance",slug:"demo-r30-acceptance",
  });
  const other=await orgService.create(ALICE,{
   name:"Demo R30 Secondary",slug:"demo-r30-secondary",
  });
  phase="reject-wrong-recipients";
  const first=await fixture(org.id,"carla@example.com");
  const outsider=await request(diana).post(path).send({token:first.token})
   .set("x-recipient-email","carla@example.com").set("x-role","OWNER");
  assert.equal(outsider.status,403);
  assert.deepEqual(outsider.body,{error:{code:"ACCESS_DENIED"}});
  const owner=await request(alice).post(path).send({token:first.token});
  assert.equal(owner.status,403);
  const unverified=await request(bob).post(path).send({token:first.token});
  assert.equal(unverified.status,403);
  const missing=await request(anonymous).post(path)
   .set("x-user-id",CARLA.userId).send({token:first.token});
  assert.equal(missing.status,401);
  for(const body of [{token:"short"},{token:first.token,
   recipientEmail:"carla@example.com"},{token:first.token,role:"OWNER"},
   {token:first.token,orgId:org.id},null]){
   const res=await request(carla).post(path).send(body??{});
   assert.equal(res.status,400);
  }
  phase="atomic-acceptance";
  const accepted=await request(carla).post(path).send({token:first.token});
  assert.equal(accepted.status,200);
  assert.equal(accepted.headers["cache-control"],"no-store, private");
  assert.deepEqual(accepted.body,{scope:"disposable-ci-only",
   data:{accepted:true,membershipActivated:true}});
  const row=await pool.query(
   "SELECT i.status,i.version,m.user_id,m.role,m.active"+
   " FROM p4_synthetic.invitations i JOIN p4_synthetic.memberships m"+
   " ON m.org_id=i.org_id AND m.user_id=$2 WHERE i.id=$1",
   [first.id,CARLA.userId]);
  assert.deepEqual(row.rows,[{status:"accepted",version:2,
   user_id:CARLA.userId,role:"MEMBER",active:true}]);
  const replay=await request(carla).post(path).send({token:first.token});
  assert.equal(replay.status,403);
  assert.deepEqual(replay.body,{error:{code:"ACCESS_DENIED"}});
  phase="revoked-and-expired";
  const expired=await fixture(other.id,"diana@example.com","expired");
  const expiredRes=await request(diana).post(path).send({token:expired.token});
  assert.equal(expiredRes.status,403);
  const expiredCheck=await pool.query(
   "SELECT status,version FROM p4_synthetic.invitations WHERE id=$1",
   [expired.id]);
  assert.deepEqual(expiredCheck.rows,[{status:"pending",version:1}]);
  // Revoke via the actual owner's R29 transactional API.
  const revokeFixture=await fixture(other.id,"carla@example.com");
  const revoked=await invites.revoke(ALICE,other.id,revokeFixture.id);
  assert.equal(revoked.status,"revoked");
  assert.equal((await request(carla).post(path)
    .send({token:revokeFixture.token})).status,403);
  phase="concurrent-double-redemption";
  const concurrent=await fixture(other.id,"diana@example.com");
  const attempts=await Promise.all(Array.from({length:4},()=>
    request(diana).post(path).send({token:concurrent.token})));
  assert.deepEqual(attempts.map(a=>a.status).sort(),[200,403,403,403]);
  const results=await pool.query(
   "SELECT i.status,i.version,m.role,m.active"+
   " FROM p4_synthetic.invitations i JOIN p4_synthetic.memberships m"+
   " ON m.org_id=i.org_id AND m.user_id=$2 WHERE i.id=$1",
   [concurrent.id,DIANA.userId]);
  assert.deepEqual(results.rows,[{status:"accepted",version:2,
   role:"MEMBER",active:true}]);
  phase="no-secret-reflection";
  for(const response of [outsider,owner,missing,accepted,replay,
   expiredRes,...attempts]){
   const text=JSON.stringify(response.body);
   for(const secret of [first.token,first.hash,concurrent.token,concurrent.hash,
    "token_hash","auth0|","user_demo_carla","postgresql://"]){
    assert.equal(text.includes(secret),false);
   }
  }
  phase="pooled-transaction-context";
  const poolContext=await pool.query(
   "SELECT current_user AS role,"+
   " nullif(current_setting('app.actor_id',true),'') AS actor,"+
   " nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(poolContext.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R30 recipient-bound atomic invite redemption, "+
   "membership activation, replay/race/expiry/revoke PASS\n");
 }finally{await pool.end();}
}
main().catch(()=>{
 process.stderr.write("P4 R30 invitation redemption smoke FAILED at "+phase+"\n");
 process.exitCode=1;
});
