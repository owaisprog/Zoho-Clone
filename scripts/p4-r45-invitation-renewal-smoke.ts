/**
 * R45 signed fictional owner renew -> encrypted outbox -> recipient acceptance.
 * Actual localhost Express + disposable PostgreSQL only; no customer services.
 */
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
import {P4R30CiAcceptanceService}
 from "../backend/src/platform/p4-r30-ci-invitation-acceptance.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R34CiHttpClient,P4R34CiClientError}
 from "../frontend/src/lib/p4-r34-ci-http-client.js";
import {P4R45CiRenewalController}
 from "../frontend/src/lib/p4-r45-ci-invitation-renewal-controller.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:6});
 const key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r45",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const now=Math.floor(Date.now()/1000);
 const enc=(x:unknown)=>Buffer.from(JSON.stringify(x)).toString("base64url");
 const jwt=(sub:string)=>{
  const header=enc({alg:"RS256",typ:"JWT",kid:jwk.kid});
  const claims=enc({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,
   iat:now-5,exp:now+300,email_verified:true});
  const value=header+"."+claims;
  return value+"."+sign("RSA-SHA256",Buffer.from(value),pair.privateKey)
   .toString("base64url");
 };
 const alice=jwt("auth0|demo-alice"),bob=jwt("auth0|demo-bob");
 const issuer=new P4R32CiOutboxIssuer(pool,key,process.env);
 const worker=new P4R32CiOutboxWorker(pool,key,process.env);
 const mailbox=new P4R32CiRecipientMailbox();
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer,acceptance:new P4R30CiAcceptanceService(pool,process.env),
  renewer:new P4R45CiRenewalIssuer(pool,key,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const address=server.address() as AddressInfo;
 const base="http://127.0.0.1:"+address.port+"/";
 const api=new P4R34CiHttpClient(base,async kind=>
  kind==="owner"?alice:bob,fetch,process.env);
 const controller=new P4R45CiRenewalController(api);
 const ALICE="user_demo_alice",BOB="user_demo_bob";
 const expired=async(id:string)=>pool.query(
  "UPDATE p4_synthetic.invitations SET"+
  " issued_at=now()-interval '49 hours',"+
  " expires_at=now()-interval '1 hour'"+
  " WHERE id=$1 AND status='pending'",[id]);
 try{
  phase="isolated-org-and-recipient";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const org=await orgs.create({userId:ALICE,verified:true},{
   name:"Demo R45 Renewal",slug:"demo-r45-renewal",
  });
  const other=await orgs.create({userId:ALICE,verified:true},{
   name:"Demo R45 Foreign",slug:"demo-r45-foreign",
  });
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id=$1",[BOB]);
  phase="issue-and-deliver-old";
  const initial=await api.issue(org.id,"bob@example.com");
  assert.equal(initial.version,1);
  assert.equal(await worker.deliverOne(mailbox),"delivered");
  const oldToken=mailbox.take("bob@example.com");
  assert.ok(oldToken);
  phase="deny-unexpired-and-cross-tenant";
  await assert.rejects(api.renew(org.id,initial.id,1),
   e=>e instanceof P4R34CiClientError&&e.status===409);
  await assert.rejects(api.renew(other.id,initial.id,1),
   e=>e instanceof P4R34CiClientError&&e.status===403);
  phase="expire-old-and-concurrently-renew";
  await expired(initial.id);
  const attempts=await Promise.allSettled([
   api.renew(org.id,initial.id,1),api.renew(org.id,initial.id,1),
  ]);
  const good=attempts.filter(x=>x.status==="fulfilled");
  const bad=attempts.filter(x=>x.status==="rejected");
  assert.equal(good.length,1);
  assert.equal(bad.length,1);
  const created=(good[0] as PromiseFulfilledResult<
   Awaited<ReturnType<typeof api.renew>>>).value;
  const conflict=(bad[0] as PromiseRejectedResult).reason;
  assert.ok(conflict instanceof P4R34CiClientError&&conflict.status===409);
  assert.equal(created.status,"pending");
  assert.notEqual(created.id,initial.id);
  assert.equal(created.recipientEmail,"bob@example.com");
  phase="old-link-dead-new-link-works";
  await assert.rejects(api.accept(oldToken),
   e=>e instanceof P4R34CiClientError&&e.status===403);
  assert.equal(await worker.deliverOne(mailbox),"delivered");
  const freshToken=mailbox.take("bob@example.com");
  assert.ok(freshToken);
  assert.notEqual(freshToken,oldToken);
  assert.deepEqual(await api.accept(freshToken),
   {accepted:true,membershipActivated:true});
  await assert.rejects(api.accept(freshToken),
   e=>e instanceof P4R34CiClientError&&e.status===403);
  phase="immutable-renewal-audit";
  const audit=await pool.query(
   "SELECT prior_invitation_id::text AS previous,"+
   " renewed_invitation_id::text AS next,actor_user_id"+
   " FROM p4_r45_ci.renewal_events WHERE org_id=$1",[org.id]);
  assert.deepEqual(audit.rows,[{
   previous:initial.id,next:created.id,actor_user_id:ALICE,
  }]);
  const old=await pool.query(
   "SELECT status,version,resend_count FROM p4_synthetic.invitations"+
   " WHERE id=$1",[initial.id]);
  assert.deepEqual(old.rows,[{status:"expired",version:2,resend_count:0}]);
  const newest=await pool.query(
   "SELECT status,resend_count FROM p4_synthetic.invitations WHERE id=$1",
   [created.id]);
  assert.deepEqual(newest.rows,[{status:"accepted",resend_count:1}]);
  phase="no-active-member-renewals";
  await assert.rejects(api.renew(org.id,initial.id,1),
   e=>e instanceof P4R34CiClientError&&e.status===409);
  phase="queued-old-delivery-invalidated";
  const carla=await issuer.issue({userId:ALICE,verified:true},
   other.id,{recipientEmail:"carla@example.com"});
  await expired(carla.id);
  const next=await api.renew(other.id,carla.id,1);
  assert.equal(next.status,"pending");
  const queue=await pool.query(
   "SELECT status FROM p4_r32_ci.delivery_outbox"+
   " WHERE invitation_id=$1",[carla.id]);
  assert.deepEqual(queue.rows,[{status:"dead"}]);
  phase="owner-revocation-denies-renew-and-clears-view";
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id=$2",[other.id,ALICE]);
  try{
   const denied=await controller.renew(other.id,carla.id,1);
   assert.equal(denied.phase,"denied");
   assert.equal(denied.invitation,null);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id=$2",[other.id,ALICE]);
  }
  phase="no-direct-audit-reads-or-privileged-connection-context";
  const perms=await pool.query(
   "SELECT has_table_privilege('p4_synthetic_ci_runtime',"+
   " 'p4_r45_ci.renewal_events','SELECT') AS read,"+
   " has_table_privilege('p4_synthetic_ci_runtime',"+
   " 'p4_r32_ci.delivery_outbox','UPDATE') AS edit");
  assert.deepEqual(perms.rows,[{read:false,edit:false}]);
  const output=JSON.stringify(created)+JSON.stringify(controller.snapshot());
  for(const secret of [alice,bob,oldToken,freshToken,"token_hash",
   "encrypted_token","postgresql://","auth0|","auth_tag"]){
   assert.equal(output.includes(secret),false);
  }
  const scope=await pool.query("SELECT current_user AS role,"+
   " nullif(current_setting('app.actor_id',true),'') AS actor,"+
   " nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R45 signed owner renewal, concurrent CAS, encrypted outbox invalidation and one-use recipient acceptance PASS; NO_GO\n");
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
 process.stderr.write("P4 R45 signed renewal integration FAILED at "+phase+"\n");
 process.exitCode=1;
});
