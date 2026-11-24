/** R51 signed localhost owner activity across real disposable PostgreSQL workflows. */
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
import {P4R51CiOwnerActivityService}
 from "../backend/src/platform/p4-r51-ci-owner-activity.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R34CiHttpClient}
 from "../frontend/src/lib/p4-r34-ci-http-client.js";
import {P4R41CiMemberRoleClient}
 from "../frontend/src/lib/p4-r41-ci-member-role-client.js";
import {P4R51CiOwnerActivityClient,P4R51CiActivityError}
 from "../frontend/src/lib/p4-r51-ci-owner-activity-client.js";
import {P4R51CiOwnerActivityController}
 from "../frontend/src/lib/p4-r51-ci-owner-activity-controller.js";
let phase="start";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r51",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
 const ownerJwt=jwt("auth0|demo-alice"),bobJwt=jwt("auth0|demo-bob");
 const issuer=new P4R32CiOutboxIssuer(pool,key,process.env);
 const worker=new P4R32CiOutboxWorker(pool,key,process.env);
 const mailbox=new P4R32CiRecipientMailbox();
 const deliver=async(email:string):Promise<string|null>=>{
  for(let i=0;i<25;i++){
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
  ownerActivity:new P4R51CiOwnerActivityService(pool,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const addr=server.address() as AddressInfo;
 const base="http://127.0.0.1:"+addr.port+"/";
 const activity=new P4R51CiOwnerActivityClient(base,async()=>ownerJwt,fetch,process.env);
 const controller=new P4R51CiOwnerActivityController(activity);
 const roles=new P4R41CiMemberRoleClient(base,async()=>ownerJwt,fetch,process.env);
 const invites=new P4R34CiHttpClient(base,async type=>
  type==="owner"?ownerJwt:bobJwt,fetch,process.env);
 try{
  phase="synthetic-owner-and-verified-recipient";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const org=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R51 Activity",slug:"demo-r51-activity",
  });
  const foreign=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R51 Foreign",slug:"demo-r51-foreign",
  });
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES ($1,'user_demo_bob','MEMBER',true)",
   [org.id]);
  assert.deepEqual(await activity.list(org.id),[]);
  phase="write-genuine-audit-events";
  await roles.change(org.id,"user_demo_bob","SALES_MANAGER",0);
  await roles.revoke(org.id,"user_demo_bob");
  const original=await invites.issue(org.id,"bob@example.com");
  await invites.cancel(org.id,original.id,1);
  const fresh=await invites.renew(org.id,original.id,2);
  assert.equal(fresh.status,"pending");
  const token=await deliver("bob@example.com");
  assert.ok(token);
  assert.deepEqual(await invites.accept(token),{
   accepted:true,membershipActivated:true,
  });
  phase="owner-activity-combines-five-immutable-sources";
  const events=await activity.list(org.id,"all");
  assert.equal(events.length,5);
  assert.deepEqual(new Set(events.map(x=>x.kind)),new Set([
   "role.changed","member.revoked","member.reactivated",
   "invitation.renewed","invitation.canceled",
  ]));
  assert.equal(new Set(events.map(x=>x.eventId)).size,5);
  assert.ok(events.every(x=>x.occurredAt.endsWith("Z")));
  for(const kind of ["role.changed","member.revoked","member.reactivated",
   "invitation.renewed","invitation.canceled"] as const){
   const filtered=await activity.list(org.id,kind);
   assert.equal(filtered.length,1);assert.equal(filtered[0]?.kind,kind);
  }
  const restored=events.find(x=>x.kind==="member.reactivated");
  assert.equal(restored?.actorUserId,null);
  assert.equal(restored?.subjectId,"user_demo_bob");
  phase="member-and-foreign-tenant-denials";
  const member=new P4R51CiOwnerActivityClient(base,async()=>bobJwt,fetch,process.env);
  await assert.rejects(member.list(org.id),
   e=>e instanceof P4R51CiActivityError&&e.status===403);
  const forged=new P4R51CiOwnerActivityClient(base,async()=>"a.b.c",fetch,process.env);
  await assert.rejects(forged.list(org.id),
   e=>e instanceof P4R51CiActivityError&&e.status===401);
  assert.deepEqual(await activity.list(foreign.id),[]);
  phase="owner-revocation-clears-previously-loaded-activity";
  assert.equal((await controller.refresh(org.id)).events.length,5);
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  try{
   const denied=await controller.refresh(org.id);
   assert.equal(denied.phase,"denied");assert.deepEqual(denied.events,[]);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  }
  phase="redaction-and-no-leaked-RLS-context";
  const output=JSON.stringify(events);
  for(const secret of [token,ownerJwt,bobJwt,"bob@example.com",
   "token_hash","encrypted_token","auth0|","postgresql://"])
   assert.equal(output.includes(secret),false);
  const scope=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R51 signed owner audit feed across 5 genuine member/role/invitation events, tenancy and revocation PASS; NO_GO\n");
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
 const x=e as {name?:string;status?:number;code?:string};
 process.stderr.write("P4 R51 owner audit integration FAILED at "+phase+
  " type="+(x.name??"unknown")+" status="+(x.status??"none")+
  " code="+(x.code??"none")+"\n");
 process.exitCode=1;
});
