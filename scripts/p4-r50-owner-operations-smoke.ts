/** R50 signed owner operations overview: actual CI Postgres cross-feature lifecycle. */
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
import {P4R30CiAcceptanceService}
 from "../backend/src/platform/p4-r30-ci-invitation-acceptance.js";
import {P4R40CiMemberRoles}
 from "../backend/src/platform/p4-r40-ci-member-roles.js";
import {P4R43CiMemberRevokeService}
 from "../backend/src/platform/p4-r43-ci-member-revoke-service.js";
import {P4R45CiRenewalIssuer}
 from "../backend/src/platform/p4-r45-ci-renewal-issuer.js";
import {P4R46CiInvitationCanceler}
 from "../backend/src/platform/p4-r46-ci-invitation-canceler.js";
import {P4R50CiOwnerOperations}
 from "../backend/src/platform/p4-r50-ci-owner-operations.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R34CiHttpClient}
 from "../frontend/src/lib/p4-r34-ci-http-client.js";
import {P4R41CiMemberRoleClient}
 from "../frontend/src/lib/p4-r41-ci-member-role-client.js";
import {P4R50CiOwnerSummaryClient,P4R50CiOwnerSummaryError}
 from "../frontend/src/lib/p4-r50-ci-owner-summary-client.js";
import {P4R50CiOwnerSummaryController}
 from "../frontend/src/lib/p4-r50-ci-owner-summary-controller.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r50",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const now=Math.floor(Date.now()/1000);
 const enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const jwt=(sub:string)=>{
  const h=enc({typ:"JWT",alg:"RS256",kid:jwk.kid});
  const p=enc({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,
   iat:now-5,exp:now+300,email_verified:true});
  const value=h+"."+p;
  return value+"."+sign("RSA-SHA256",Buffer.from(value),pair.privateKey)
   .toString("base64url");
 };
 const aliceJwt=jwt("auth0|demo-alice"),bobJwt=jwt("auth0|demo-bob");
 const issuer=new P4R32CiOutboxIssuer(pool,key,process.env);
 const worker=new P4R32CiOutboxWorker(pool,key,process.env);
 const mailbox=new P4R32CiRecipientMailbox();
 const deliver=async(email:string):Promise<string|null>=>{
  for(let i=0;i<30;i++){
   const token=mailbox.take(email);
   if(token)return token;
   if(await worker.deliverOne(mailbox)==="empty")break;
  }
  return mailbox.take(email);
 };
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer,acceptance:new P4R30CiAcceptanceService(pool,process.env),
  roles:new P4R40CiMemberRoles(pool,process.env),
  revoker:new P4R43CiMemberRevokeService(pool,process.env),
  renewer:new P4R45CiRenewalIssuer(pool,key,process.env),
  canceler:new P4R46CiInvitationCanceler(pool,process.env),
  ownerSummary:new P4R50CiOwnerOperations(pool,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const addr=server.address() as AddressInfo;
 const base="http://127.0.0.1:"+addr.port+"/";
 const summary=new P4R50CiOwnerSummaryClient(base,async()=>aliceJwt,fetch,process.env);
 const ctl=new P4R50CiOwnerSummaryController(summary);
 const roles=new P4R41CiMemberRoleClient(base,async()=>aliceJwt,fetch,process.env);
 const invites=new P4R34CiHttpClient(base,async type=>
  type==="owner"?aliceJwt:bobJwt,fetch,process.env);
 const zero={activeMembers:0,revokedMembers:0,salesManagers:0,
  pendingInvites:0,acceptedInvites:0,revokedInvites:0,expiredInvites:0,
  roleChanges:0,membershipEvents:0,renewals:0,cancellations:0};
 let orgId:string|undefined;
 try{
  phase="isolated-owner-and-verified-fictional-recipient";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const org=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R50 Owner",slug:"demo-r50-owner",
  });orgId=org.id;
  const other=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R50 Foreign",slug:"demo-r50-foreign",
  });
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES ($1,'user_demo_bob','MEMBER',true)",
   [org.id]);
  phase="initial-aggregate-snapshot";
  assert.deepEqual(await summary.summary(org.id),{...zero,activeMembers:1});
  assert.deepEqual(await summary.summary(other.id),zero);
  phase="manager-grant-and-audit";
  const updated=await roles.change(org.id,"user_demo_bob","SALES_MANAGER",0);
  assert.equal(updated.revision,1);
  assert.deepEqual(await summary.summary(org.id),{
   ...zero,activeMembers:1,salesManagers:1,roleChanges:1,
  });
  phase="revoke-active-member";
  assert.deepEqual(await roles.revoke(org.id,"user_demo_bob"),{revoked:true});
  assert.deepEqual(await summary.summary(org.id),{
   ...zero,revokedMembers:1,roleChanges:1,membershipEvents:1,
  });
  phase="owner-issue-cancel-renew-pending";
  const initial=await invites.issue(org.id,"bob@example.com");
  assert.deepEqual(await summary.summary(org.id),{
   ...zero,revokedMembers:1,pendingInvites:1,roleChanges:1,
   membershipEvents:1,
  });
  await invites.cancel(org.id,initial.id,1);
  assert.deepEqual(await summary.summary(org.id),{
   ...zero,revokedMembers:1,revokedInvites:1,
   roleChanges:1,membershipEvents:1,cancellations:1,
  });
  const reissued=await invites.renew(org.id,initial.id,2);
  assert.equal(reissued.status,"pending");
  assert.deepEqual(await summary.summary(org.id),{
   ...zero,revokedMembers:1,pendingInvites:1,revokedInvites:1,
   roleChanges:1,membershipEvents:1,renewals:1,cancellations:1,
  });
  phase="recipient-bound-reaccept-and-least-privilege";
  const token=await deliver("bob@example.com");
  assert.ok(token);
  assert.deepEqual(await invites.accept(token),{
   accepted:true,membershipActivated:true,
  });
  const current=await summary.summary(org.id);
  assert.deepEqual(current,{
   ...zero,activeMembers:1,acceptedInvites:1,revokedInvites:1,
   roleChanges:1,membershipEvents:2,renewals:1,cancellations:1,
  });
  assert.equal(current.salesManagers,0);
  phase="effective-expired-invitation-count";
  const carla=await invites.issue(org.id,"carla@example.com");
  await pool.query("UPDATE p4_synthetic.invitations SET"+
   " issued_at=now()-interval '49 hours',"+
   " expires_at=now()-interval '1 hour' WHERE id=$1",
   [carla.id]);
  const withExpiry=await ctl.refresh(org.id);
  assert.equal(withExpiry.phase,"ready");
  assert.deepEqual(withExpiry.counts,{
   ...current,expiredInvites:1,
  });
  phase="verified-member-and-forged-JWT-denial";
  const nonOwner=new P4R50CiOwnerSummaryClient(base,async()=>bobJwt,fetch,process.env);
  await assert.rejects(nonOwner.summary(org.id),
   e=>e instanceof P4R50CiOwnerSummaryError&&e.status===403);
  const fake=new P4R50CiOwnerSummaryClient(base,async()=>"a.b.c",fetch,process.env);
  await assert.rejects(fake.summary(org.id),
   e=>e instanceof P4R50CiOwnerSummaryError&&e.status===401);
  phase="owner-revocation-erases-summary";
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  try{
   const denied=await ctl.refresh(org.id);
   assert.equal(denied.phase,"denied");assert.equal(denied.counts,null);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  }
  phase="strict-privacy-and-transaction-pool-cleanup";
  const output=JSON.stringify(withExpiry);
  for(const secret of [aliceJwt,bobJwt,token,"bob@example.com",
   "auth0|","token_hash","encrypted_token","postgresql://",
   "role_events","request_id"])
   assert.equal(output.includes(secret),false);
  const context=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(context.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R50 signed owner operational summary, PostgreSQL member/role/invitation/audit counters and live lifecycle transitions PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=false,canonical_email='alice@example.com'"+
   " WHERE user_id='user_demo_bob'");
  key.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(e=>{
 const x=e as {name?:string;code?:string;status?:number};
 process.stderr.write("P4 R50 owner operations integration FAILED at "+phase+
  " type="+(x?.name??"unknown")+" code="+(x?.code??"none")+
  " status="+(x?.status??"none")+"\n");
 process.exitCode=1;
});
