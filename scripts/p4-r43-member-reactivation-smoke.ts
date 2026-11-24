/** R43 signed CI owner revoke -> invite outbox -> recipient reactivation.
 * Exercises actual disposable PostgreSQL, not a customer API or real Auth0.
 */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import {generateKeyPairSync,randomBytes,sign} from "node:crypto";
import express from "express";
import request from "supertest";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment}
 from "../backend/src/platform/p4-v1-ci-prisma.js";
import {P4R28CiOrganizationService}
 from "../backend/src/platform/p4-r28-ci-org-service.js";
import {P4R32CiOutboxIssuer,P4R32CiOutboxWorker,P4R32CiRecipientMailbox}
 from "../backend/src/platform/p4-r32-ci-outbox.js";
import {P4R30CiAcceptanceService}
 from "../backend/src/platform/p4-r30-ci-invitation-acceptance.js";
import {P4R40CiMemberRoles}
 from "../backend/src/platform/p4-r40-ci-member-roles.js";
import {P4R43CiMemberRevokeService}
 from "../backend/src/platform/p4-r43-ci-member-revoke-service.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R41CiMemberRoleClient,P4R41CiError}
 from "../frontend/src/lib/p4-r41-ci-member-role-client.js";
import {P4R43CiRevokeController}
 from "../frontend/src/lib/p4-r43-ci-member-revoke-controller.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:6});
 const key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),kid:"r33-ci-key-r43",
  alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const now=Math.floor(Date.now()/1000);
 const encode=(x:unknown)=>Buffer.from(JSON.stringify(x)).toString("base64url");
 const jwt=(sub:string)=>{
  const h=encode({typ:"JWT",alg:"RS256",kid:jwk.kid});
  const p=encode({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,
   iat:now-5,exp:now+300,email_verified:true});
  const signed=h+"."+p;
  return signed+"."+sign("RSA-SHA256",Buffer.from(signed),pair.privateKey)
   .toString("base64url");
 };
 const aliceJwt=jwt("auth0|demo-alice");
 const bobJwt=jwt("auth0|demo-bob");
 const issuer=new P4R32CiOutboxIssuer(pool,key,process.env);
 const worker=new P4R32CiOutboxWorker(pool,key,process.env);
 const mailbox=new P4R32CiRecipientMailbox();
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer,acceptance:new P4R30CiAcceptanceService(pool,process.env),
  roles:new P4R40CiMemberRoles(pool,process.env),
  revoker:new P4R43CiMemberRevokeService(pool,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const address=server.address() as AddressInfo;
 const base="http://127.0.0.1:"+address.port+"/";
 const owner=new P4R41CiMemberRoleClient(base,async()=>aliceJwt,fetch,process.env);
 const member=new P4R41CiMemberRoleClient(base,async()=>bobJwt,fetch,process.env);
 const control=new P4R43CiRevokeController(owner);
 const ALICE="user_demo_alice",BOB="user_demo_bob";
 try{
  phase="isolated-org-fixture";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const o1=await orgs.create({userId:ALICE,verified:true},{
   name:"Demo R43 Revoke",slug:"demo-r43-revoke",
  });
  const o2=await orgs.create({userId:ALICE,verified:true},{
   name:"Demo R43 Other",slug:"demo-r43-other",
  });
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES($1,$2,'MEMBER',true)",
   [o1.id,BOB]);
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id=$1",[BOB]);
  phase="elevate-before-revocation";
  assert.equal((await owner.change(o1.id,BOB,"SALES_MANAGER",0)).revision,1);
  phase="no-self-owner-or-other-org-revocation";
  await assert.rejects(owner.revoke(o1.id,ALICE),
   e=>e instanceof P4R41CiError&&e.status===403);
  await assert.rejects(owner.revoke(o2.id,BOB),
   e=>e instanceof P4R41CiError&&e.status===403);
  await assert.rejects(member.revoke(o1.id,ALICE),
   e=>e instanceof P4R41CiError&&e.status===403);
  phase="revoke-atomic-concurrency";
  const attempts=await Promise.all([owner.revoke(o1.id,BOB),
   owner.revoke(o1.id,BOB)].map(p=>p.then(()=>200,e=>
    e instanceof P4R41CiError?e.status:503)));
  assert.deepEqual(attempts.sort(),[200,409]);
  assert.deepEqual(await owner.members(o1.id),[]);
  const revoked=await pool.query(
   "SELECT active,role FROM p4_synthetic.memberships"+
   " WHERE org_id=$1 AND user_id=$2",[o1.id,BOB]);
  assert.deepEqual(revoked.rows,[{active:false,role:"MEMBER"}]);
  phase="deny-inactive-member-and-forged-token";
  await assert.rejects(member.history(o1.id),
   e=>e instanceof P4R41CiError&&e.status===403);
  const fake=await request(app).post("/_p4_r33_ci/recipient/accept")
   .set("Authorization","Bearer "+bobJwt).send({token:"ab".repeat(32)});
  assert.equal(fake.status,403);
  const badBody=await request(app).post(
   "/_p4_r33_ci/owner/"+o1.id+"/members/"+BOB+"/revoke")
   .set("Authorization","Bearer "+aliceJwt)
   .send({role:"ORG_OWNER"});
  assert.equal(badBody.status,400);
  phase="new-recipient-bound-invite";
  const issued=await issuer.issue({userId:ALICE,verified:true},o1.id,
   {recipientEmail:"bob@example.com"});
  assert.equal(issued.status,"pending");
  assert.equal(await worker.deliverOne(mailbox),"delivered");
  const token=mailbox.take("bob@example.com");
  assert.ok(token);
  phase="accept-after-revocation";
  const accepted=await request(app).post("/_p4_r33_ci/recipient/accept")
   .set("Authorization","Bearer "+bobJwt).send({token});
  assert.equal(accepted.status,200);
  assert.deepEqual(accepted.body.data,{
   accepted:true,membershipActivated:true,
  });
  const replay=await request(app).post("/_p4_r33_ci/recipient/accept")
   .set("Authorization","Bearer "+bobJwt).send({token});
  assert.equal(replay.status,403);
  phase="role-reset-and-audit";
  const rows=await pool.query("SELECT m.active,m.role,r.role_code,r.revision"+
   " FROM p4_synthetic.memberships m"+
   " JOIN p4_r40_ci.sales_roles r ON r.org_id=m.org_id"+
   " AND r.user_id=m.user_id WHERE m.org_id=$1 AND m.user_id=$2",
   [o1.id,BOB]);
  assert.deepEqual(rows.rows,[{active:true,role:"MEMBER",
   role_code:"SALES_REP",revision:2}]);
  const events=await pool.query(
   "SELECT event_kind,actor_user_id,target_user_id,previous_active,next_active"+
   " FROM p4_r43_ci.membership_events WHERE org_id=$1 ORDER BY occurred_at",
   [o1.id]);
  assert.deepEqual(events.rows,[
   {event_kind:"member.revoked",actor_user_id:ALICE,target_user_id:BOB,
    previous_active:true,next_active:false},
   {event_kind:"member.reactivated",actor_user_id:null,target_user_id:BOB,
    previous_active:false,next_active:true},
  ]);
  phase="stale-role-revision-denied";
  await assert.rejects(owner.change(o1.id,BOB,"SALES_MANAGER",1),
   e=>e instanceof P4R41CiError&&e.status===409);
  assert.deepEqual(await owner.members(o1.id),[
   {userId:BOB,role:"SALES_REP",revision:2},
  ]);
  phase="fresh-revoke-controller";
  assert.equal((await control.revoke(o1.id,BOB)).phase,"revoked");
  assert.equal((await control.revoke(o1.id,BOB)).phase,"denied");
  phase="privacy-and-direct-grants";
  const grants=await pool.query(
   "SELECT has_table_privilege('p4_synthetic_ci_runtime',"+
   " 'p4_r43_ci.membership_events','SELECT') AS can_read,"+
   " has_table_privilege('p4_synthetic_ci_runtime',"+
   " 'p4_r43_ci.membership_events','UPDATE') AS can_write");
  assert.deepEqual(grants.rows,[{can_read:false,can_write:false}]);
  for(const res of [accepted,replay,fake,badBody]){
   const output=JSON.stringify(res.body);
   for(const secret of [token,aliceJwt,bobJwt,"auth0|","token_hash",
    "postgresql://","request_id","encrypted_token"])
    assert.equal(output.includes(secret),false);
  }
  const scope=await pool.query("SELECT current_user AS role,"+
   " nullif(current_setting('app.actor_id',true),'') AS actor,"+
   " nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R43 signed atomic member revoke, recipient invite reactivation, least-privilege sales role reset and immutable audit PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=false,canonical_email='alice@example.com'"+
   " WHERE user_id=$1",[BOB]);
  key.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(()=>{
 process.stderr.write("P4 R43 signed revoke/reactivation integration FAILED at "+phase+"\n");
 process.exitCode=1;
});
