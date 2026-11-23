/**
 * P4 R34: real localhost frontend HTTP client -> signed CI Express API ->
 * disposable PostgreSQL encrypted outbox -> fictional mailbox ->
 * verified recipient acceptance. NO public route, live Auth0 or Neon.
 * Executed via tsx after backend build in synthetic-postgres-isolation CI.
 */
import assert from "node:assert/strict";
import {generateKeyPairSync,randomBytes,sign} from "node:crypto";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import express from "express";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment}
 from "../backend/src/platform/p4-v1-ci-prisma.js";
import {P4R28CiOrganizationService,P4R28Denied}
 from "../backend/src/platform/p4-r28-ci-org-service.js";
import {P4R32CiOutboxIssuer,P4R32CiOutboxWorker,P4R32CiRecipientMailbox}
 from "../backend/src/platform/p4-r32-ci-outbox.js";
import {P4R30CiAcceptanceService}
 from "../backend/src/platform/p4-r30-ci-invitation-acceptance.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R34CiHttpClient,P4R34CiClientError}
 from "../frontend/src/lib/p4-r34-ci-http-client.js";
import {P4R34CiWorkflowController}
 from "../frontend/src/lib/p4-r34-ci-workflow-controller.js";

const ALICE={userId:"user_demo_alice",verified:true} as const;
const CARLA={userId:"user_demo_carla",verified:true} as const;
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:4});
 const key=randomBytes(32);
 const issuer=new P4R32CiOutboxIssuer(pool,key,process.env);
 const worker=new P4R32CiOutboxWorker(pool,key,process.env);
 const mailbox=new P4R32CiRecipientMailbox();
 const orgService=new P4R28CiOrganizationService(pool,process.env);
 const now=Math.floor(Date.now()/1000);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r34",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const jwt=(subject:string)=>{
  const header=encode({typ:"JWT",alg:"RS256",kid:jwk.kid});
  const claims=encode({iss:CI_ISSUER,aud:CI_AUDIENCE,sub:subject,
   iat:now-5,exp:now+300,email_verified:true});
  const signingInput=header+"."+claims;
  return signingInput+"."+sign("RSA-SHA256",
   Buffer.from(signingInput),pair.privateKey).toString("base64url");
 };
 const ownerToken=jwt("auth0|demo-alice");
 const recipientToken=jwt("auth0|user_demo_carla");
 const resolver=new P4R33CiActorMapper(pool,[jwk],()=>now,process.env);
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:resolver,issuer,
  acceptance:new P4R30CiAcceptanceService(pool,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const address=server.address() as AddressInfo;
 const base="http://127.0.0.1:"+address.port+"/";
 const client=new P4R34CiHttpClient(base,async actor=>
  actor==="owner"?ownerToken:recipientToken,fetch,process.env);
 const ctl=new P4R34CiWorkflowController(client);
 try{
  await pool.query("INSERT INTO p4_synthetic.users(id) VALUES ($1)"+
   " ON CONFLICT (id) DO NOTHING",[CARLA.userId]);
  await pool.query("INSERT INTO p4_synthetic.identity_subjects"+
   " (issuer,external_subject,user_id,canonical_email,email_verified)"+
   " VALUES ($1,$2,$3,'carla@example.com',true)"+
   " ON CONFLICT (issuer,external_subject) DO NOTHING",
   [CI_ISSUER,"auth0|user_demo_carla",CARLA.userId]);
  const org=await orgService.create(ALICE,{
   name:"Demo R34 Fullstack",slug:"demo-r34-fullstack",
  });
  phase="typed-client-issues";
  const view=await ctl.issue(org.id,"carla@example.com");
  assert.equal(view.phase,"issued");
  assert.equal(view.invitation?.status,"pending");
  assert.equal(view.invitation?.organizationId,org.id);
  assert.equal(view.invitation?.role,"MEMBER");
  const before=ctl.snapshot();
  assert.equal(JSON.stringify(before).includes(ownerToken),false);
  phase="server-queue-to-mailbox";
  assert.equal(await worker.deliverOne(mailbox),"delivered");
  const inviteToken=mailbox.take("carla@example.com");
  assert.ok(inviteToken);
  assert.equal(JSON.stringify(ctl.snapshot()).includes(inviteToken),false);
  phase="token-bound-recipient-client";
  const wrongActor=new P4R34CiHttpClient(base,async()=>ownerToken,
   fetch,process.env);
  await assert.rejects(wrongActor.accept(inviteToken),
   e=>e instanceof P4R34CiClientError&&e.status===403&&
    e.code==="ACCESS_DENIED");
  const success=await ctl.accept(inviteToken);
  assert.equal(success.phase,"accepted");
  assert.deepEqual(success.acceptance,{
   accepted:true,membershipActivated:true,
  });
  const after=await pool.query(
   "SELECT i.status,i.version,m.role,m.active,q.status AS delivery"+
   " FROM p4_synthetic.invitations i"+
   " JOIN p4_synthetic.memberships m ON m.org_id=i.org_id"+
   " AND m.user_id=$2"+
   " JOIN p4_r32_ci.delivery_outbox q ON q.invitation_id=i.id"+
   " WHERE i.id=$1",[view.invitation?.id,CARLA.userId]);
  assert.deepEqual(after.rows,[{status:"accepted",version:2,
   role:"MEMBER",active:true,delivery:"delivered"}]);
  phase="replay-and-ui-error";
  await assert.rejects(client.accept(inviteToken),
   e=>e instanceof P4R34CiClientError&&e.status===403&&
    e.code==="ACCESS_DENIED");
  assert.equal((await ctl.accept(inviteToken)).phase,"error");
  assert.equal(JSON.stringify(ctl.snapshot()).includes(inviteToken),false);
  phase="unsigned-client-fails-closed";
  const forgedClient=new P4R34CiHttpClient(base,
   async()=>"a.b.c",fetch,process.env);
  await assert.rejects(forgedClient.issue(org.id,"carla@example.com"),
   e=>e instanceof P4R34CiClientError&&e.status===401);
  phase="cross-tenant-client-denial";
  const bogusOrg="10000000-0000-4000-8000-000000000099";
  await assert.rejects(client.issue(bogusOrg,"carla@example.com"),
   e=>e instanceof P4R34CiClientError&&e.status===403);
  phase="reset-and-safe-state";
  ctl.reset();assert.equal(ctl.snapshot().phase,"idle");
  assert.equal(JSON.stringify(ctl.snapshot()).includes(recipientToken),false);
  const context=await pool.query(
   "SELECT current_user AS role,"+
   " nullif(current_setting('app.actor_id',true),'') AS actor,"+
   " nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(context.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R34 actual frontend typed client -> RSA signed localhost HTTP ->"+
   " PG outbox -> recipient membership PASS\n");
 }finally{
  key.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(()=>{
 process.stderr.write("P4 R34 frontend/backend CI integration FAILED at "+phase+"\n");
 process.exitCode=1;
});
