/** R56 recipient-facing React acceptance: signed owner issue -> fake mailbox -> member. */
import assert from "node:assert/strict";
import {generateKeyPairSync,randomBytes,sign} from "node:crypto";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import React,{createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import express from "express";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment}
 from "../backend/src/platform/p4-v1-ci-prisma.js";
import {P4R28CiOrganizationService}
 from "../backend/src/platform/p4-r28-ci-org-service.js";
import {P4R32CiOutboxIssuer,P4R32CiOutboxWorker,P4R32CiRecipientMailbox}
 from "../backend/src/platform/p4-r32-ci-outbox.js";
import {P4R30CiAcceptanceService}
 from "../backend/src/platform/p4-r30-ci-invitation-acceptance.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R34CiHttpClient}
 from "../frontend/src/lib/p4-r34-ci-http-client.js";
import {P4R56CiRecipientAcceptanceController}
 from "../frontend/src/lib/p4-r56-ci-recipient-acceptance-controller.js";
import {P4R56CiRecipientAcceptancePanel}
 from "../frontend/src/components/p4-r56-ci-recipient-acceptance.js";
let phase="start";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:6});
 const key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r56",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const now=Math.floor(Date.now()/1000);
 const enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const jwt=(sub:string)=>{
  const h=enc({typ:"JWT",alg:"RS256",kid:jwk.kid});
  const p=enc({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,
   iat:now-5,exp:now+300,email_verified:true});
  const data=h+"."+p;
  return data+"."+sign("RSA-SHA256",Buffer.from(data),pair.privateKey)
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
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port+"/";
 const client=new P4R34CiHttpClient(base,async kind=>
  kind==="owner"?ownerJwt:bobJwt,fetch,process.env);
 const wrong=new P4R34CiHttpClient(base,async()=>ownerJwt,fetch,process.env);
 const controller=new P4R56CiRecipientAcceptanceController(client);
 try{
  phase="fictional-recipient-verified-and-owner-created-org";
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const org=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R56 Recipient",slug:"demo-r56-recipient",
  });
  phase="owner-issue-real-ci-encrypted-outbox";
  const invite=await client.issue(org.id,"bob@example.com");
  assert.equal(invite.status,"pending");
  const prior=await pool.query("SELECT active FROM p4_synthetic.memberships"+
   " WHERE org_id=$1 AND user_id='user_demo_bob'",[org.id]);
  assert.equal(prior.rows.length,0);
  phase="fake-mailbox-release-and-token-only-in-memory";
  let token:string|null=null;
  for(let i=0;i<25;i++){
   token=mailbox.take("bob@example.com");
   if(token)break;
   if(await worker.deliverOne(mailbox)==="empty")break;
  }
  token??=mailbox.take("bob@example.com");
  assert.ok(token);assert.match(token,/^[0-9a-f]{64}$/);
  phase="signed-wrong-recipient-rejected-without-token-consumption";
  const invalid=new P4R56CiRecipientAcceptanceController(wrong);
  const notOwner=await invalid.submit(token);
  assert.equal(notOwner.phase,"denied");
  assert.equal(notOwner.accepted,false);
  const before=await pool.query("SELECT status FROM p4_synthetic.invitations"+
   " WHERE id=$1",[invite.id]);
  assert.equal(before.rows[0]?.status,"pending");
  phase="signed-bob-react-form-one-use-acceptance";
  const result=await controller.submit(token);
  assert.equal(result.phase,"accepted");assert.equal(result.accepted,true);
  assert.equal(result.membershipActivated,true);
  const after=await pool.query("SELECT role,active FROM p4_synthetic.memberships"+
   " WHERE org_id=$1 AND user_id='user_demo_bob'",[org.id]);
  assert.deepEqual(after.rows,[{role:"MEMBER",active:true}]);
  const redeemed=await pool.query("SELECT status FROM p4_synthetic.invitations"+
   " WHERE id=$1",[invite.id]);
  assert.equal(redeemed.rows[0]?.status,"accepted");
  phase="replay-and-double-submit-do-not-create-extra-membership";
  assert.equal((await controller.submit(token)).phase,"accepted");
  const replay=new P4R56CiRecipientAcceptanceController(client);
  assert.equal((await replay.submit(token)).phase,"denied");
  const single=await pool.query("SELECT count(*)::integer AS n"+
   " FROM p4_synthetic.memberships WHERE org_id=$1"+
   " AND user_id='user_demo_bob'",[org.id]);
  assert.equal(single.rows[0]?.n,1);
  phase="real-react-SSR-masks-token-and-does-not-leak-identity";
  const noop=()=>{};
  const rendered=renderToStaticMarkup(createElement(P4R56CiRecipientAcceptancePanel,{
   view:result,onSubmit:noop,onReset:noop,
  }));
  for(const label of ["Join your team","Invitation accepted",
   "Finish",'data-ci-recipient-acceptance="fictional-only"'])
   assert.ok(rendered.includes(label),label);
  for(const secret of [token,ownerJwt,bobJwt,"bob@example.com",
   "encrypted_token","token_hash","postgresql://","auth0|"])
   assert.equal(rendered.includes(secret),false);
  assert.equal(JSON.stringify(result).includes(token),false);
  phase="database-connection-scoping";
  const scope=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R56 signed fictional recipient React acceptance, encrypted mailbox, verified email single-use and replay/forged principal rejection PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=false,canonical_email='alice@example.com'"+
   " WHERE user_id='user_demo_bob'");
  key.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(e=>{
 const x=e as {name?:string;code?:string;status?:number};
 process.stderr.write("P4 R56 recipient React acceptance smoke FAILED at "+phase+
  " type="+(x.name??"unknown")+" code="+(x.code??"none")+
  " status="+(x.status??"none")+"\n");process.exitCode=1;
});
