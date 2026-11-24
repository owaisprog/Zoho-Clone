/** R46 signed owner cancel + atomic PostgreSQL status/outbox/audit and safe renewal. */
import assert from "node:assert/strict";
import {generateKeyPairSync,randomBytes,sign} from "node:crypto";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import express from "express";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment}
 from "../backend/src/platform/p4-v1-ci-prisma.js";
import {P4R28CiOrganizationService}
 from "../backend/src/platform/p4-r28-ci-org-service.js";
import {P4R32CiOutboxIssuer,P4R32CiOutboxWorker,P4R32CiRecipientMailbox}
 from "../backend/src/platform/p4-r32-ci-outbox.js";
import {P4R45CiRenewalIssuer}
 from "../backend/src/platform/p4-r45-ci-renewal-issuer.js";
import {P4R46CiInvitationCanceler}
 from "../backend/src/platform/p4-r46-ci-invitation-canceler.js";
import {P4R30CiAcceptanceService}
 from "../backend/src/platform/p4-r30-ci-invitation-acceptance.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R34CiHttpClient,P4R34CiClientError}
 from "../frontend/src/lib/p4-r34-ci-http-client.js";
import {P4R46CiCancelController}
 from "../frontend/src/lib/p4-r46-ci-invitation-cancel-controller.js";
const ALICE="user_demo_alice",BOB="user_demo_bob";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:6});
 const key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),kid:"r33-ci-key-r46",
  alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const now=Math.floor(Date.now()/1000);
 const encode=(x:unknown)=>Buffer.from(JSON.stringify(x)).toString("base64url");
 const jwt=(sub:string)=>{
  const header=encode({typ:"JWT",alg:"RS256",kid:jwk.kid});
  const claims=encode({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,
   iat:now-5,exp:now+300,email_verified:true});
  const value=header+"."+claims;
  return value+"."+sign("RSA-SHA256",Buffer.from(value),pair.privateKey)
   .toString("base64url");
 };
 const ownerJwt=jwt("auth0|demo-alice"),bobJwt=jwt("auth0|demo-bob");
 const issuer=new P4R32CiOutboxIssuer(pool,key,process.env);
 const worker=new P4R32CiOutboxWorker(pool,key,process.env);
 const mailbox=new P4R32CiRecipientMailbox();
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer,acceptance:new P4R30CiAcceptanceService(pool,process.env),
  renewer:new P4R45CiRenewalIssuer(pool,key,process.env),
  canceler:new P4R46CiInvitationCanceler(pool,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const address=server.address() as AddressInfo;
 const base="http://127.0.0.1:"+address.port+"/";
 const owner=new P4R34CiHttpClient(base,async who=>
  who==="owner"?ownerJwt:bobJwt,fetch,process.env);
 const ctl=new P4R46CiCancelController(owner);
 try{
  phase="create-fictional-owner-tenant";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const org=await orgs.create({userId:ALICE,verified:true},{
   name:"Demo R46 Cancel",slug:"demo-r46-cancel",
  });
  const other=await orgs.create({userId:ALICE,verified:true},{
   name:"Demo R46 Foreign",slug:"demo-r46-foreign",
  });
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id=$1",[BOB]);
  phase="issue-and-deliver-before-revocation";
  const created=await owner.issue(org.id,"bob@example.com");
  assert.equal(await worker.deliverOne(mailbox),"delivered");
  const delivered=mailbox.take("bob@example.com");
  assert.ok(delivered);
  phase="reject-cross-tenant-and-forged-identity";
  await assert.rejects(owner.cancel(other.id,created.id,1),
   e=>e instanceof P4R34CiClientError&&e.status===409);
  const fake=new P4R34CiHttpClient(base,async()=>"a.b.c",fetch,process.env);
  await assert.rejects(fake.cancel(org.id,created.id,1),
   e=>e instanceof P4R34CiClientError&&e.status===401);
  phase="concurrent-cancellation-version-guard";
  const attempts=await Promise.allSettled([
   owner.cancel(org.id,created.id,1),owner.cancel(org.id,created.id,1),
  ]);
  assert.equal(attempts.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(attempts.filter(x=>x.status==="rejected").length,1);
  const cancelled=(attempts.find(x=>x.status==="fulfilled") as
   PromiseFulfilledResult<Awaited<ReturnType<typeof owner.cancel>>>).value;
  const conflict=(attempts.find(x=>x.status==="rejected") as
   PromiseRejectedResult).reason;
  assert.ok(conflict instanceof P4R34CiClientError&&conflict.status===409);
  assert.equal(cancelled.status,"revoked");assert.equal(cancelled.version,2);
  phase="no-acceptance-on-cancelled-link";
  await assert.rejects(owner.accept(delivered),
   e=>e instanceof P4R34CiClientError&&e.status===403);
  phase="audit-atomic-and-no-role-grants";
  const events=await pool.query(
   "SELECT invitation_id::text,actor_user_id,canceled_version"+
   " FROM p4_r46_ci.cancellation_events WHERE org_id=$1",[org.id]);
  assert.deepEqual(events.rows,[{
   invitation_id:created.id,actor_user_id:ALICE,canceled_version:2,
  }]);
  const membership=await pool.query(
   "SELECT user_id FROM p4_synthetic.memberships WHERE org_id=$1"+
   " AND user_id=$2",[org.id,BOB]);
  assert.equal(membership.rows.length,0);
  phase="new-link-after-cancel";
  const renewed=await owner.renew(org.id,created.id,2);
  assert.equal(renewed.status,"pending");
  assert.notEqual(renewed.id,created.id);
  assert.equal(await worker.deliverOne(mailbox),"delivered");
  const token=mailbox.take("bob@example.com");
  assert.ok(token);
  assert.deepEqual(await owner.accept(token),{
   accepted:true,membershipActivated:true,
  });
  await assert.rejects(owner.accept(token),
   e=>e instanceof P4R34CiClientError&&e.status===403);
  phase="queued-delivery-canceled-atomically";
  const otherInvite=await owner.issue(other.id,"carla@example.com");
  const queueBefore=await pool.query(
   "SELECT status FROM p4_r32_ci.delivery_outbox WHERE invitation_id=$1",
   [otherInvite.id]);
  assert.deepEqual(queueBefore.rows,[{status:"queued"}]);
  const revocation=await ctl.cancel(other.id,otherInvite.id,1);
  assert.equal(revocation.phase,"canceled");
  const queueAfter=await pool.query(
   "SELECT status FROM p4_r32_ci.delivery_outbox WHERE invitation_id=$1",
   [otherInvite.id]);
  assert.deepEqual(queueAfter.rows,[{status:"dead"}]);
  phase="expired-not-cancelable";
  const old=await owner.issue(other.id,"diana@example.com");
  await pool.query("UPDATE p4_synthetic.invitations SET"+
   " issued_at=now()-interval '49 hours',"+
   " expires_at=now()-interval '1 hour' WHERE id=$1",[old.id]);
  assert.equal((await ctl.cancel(other.id,old.id,1)).phase,"denied");
  assert.equal(ctl.snapshot().invitation,null);
  phase="runtime-cannot-read-immutable-cancellation-events";
  const grants=await pool.query(
   "SELECT has_table_privilege('p4_synthetic_ci_runtime',"+
   "'p4_r46_ci.cancellation_events','SELECT') AS audit_read,"+
   "has_table_privilege('p4_synthetic_ci_runtime',"+
   "'p4_r32_ci.delivery_outbox','UPDATE') AS queue_update");
  assert.deepEqual(grants.rows,[{audit_read:false,queue_update:false}]);
  const out=JSON.stringify(cancelled)+JSON.stringify(ctl.snapshot());
  for(const secret of [delivered,token,ownerJwt,bobJwt,"token_hash",
   "encrypted_token","postgresql://","auth0|","request_id"])
   assert.equal(out.includes(secret),false);
  const context=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(context.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R46 signed owner cancellation, immutable PostgreSQL audit, queued ciphertext death, old-token denial and renewal PASS; NO_GO\n");
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
 process.stderr.write("P4 R46 signed cancel integration FAILED at "+phase+"\n");
 process.exitCode=1;
});
