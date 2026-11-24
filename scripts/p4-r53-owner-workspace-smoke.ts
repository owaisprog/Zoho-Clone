/** R53 real signed owner React workspace over disposable PostgreSQL only. */
import assert from "node:assert/strict";
import {generateKeyPairSync,randomBytes,sign} from "node:crypto";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import {createElement} from "react";
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
import {P4R40CiMemberRoles}
 from "../backend/src/platform/p4-r40-ci-member-roles.js";
import {P4R43CiMemberRevokeService}
 from "../backend/src/platform/p4-r43-ci-member-revoke-service.js";
import {P4R45CiRenewalIssuer}
 from "../backend/src/platform/p4-r45-ci-renewal-issuer.js";
import {P4R46CiInvitationCanceler}
 from "../backend/src/platform/p4-r46-ci-invitation-canceler.js";
import {P4R48CiInvitationPager}
 from "../backend/src/platform/p4-r48-ci-invitation-pager.js";
import {P4R49CiMemberPager}
 from "../backend/src/platform/p4-r49-ci-member-pager.js";
import {P4R50CiOwnerOperations}
 from "../backend/src/platform/p4-r50-ci-owner-operations.js";
import {P4R52CiOwnerActivityPager}
 from "../backend/src/platform/p4-r52-ci-owner-activity-pager.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R34CiHttpClient}
 from "../frontend/src/lib/p4-r34-ci-http-client.js";
import {P4R41CiMemberRoleClient}
 from "../frontend/src/lib/p4-r41-ci-member-role-client.js";
import {P4R48CiInvitationPageClient}
 from "../frontend/src/lib/p4-r48-ci-invitation-page-client.js";
import {P4R49CiMemberPageClient}
 from "../frontend/src/lib/p4-r49-ci-member-page-client.js";
import {P4R50CiOwnerSummaryClient}
 from "../frontend/src/lib/p4-r50-ci-owner-summary-client.js";
import {P4R52CiActivityPageClient}
 from "../frontend/src/lib/p4-r52-ci-activity-page-client.js";
import {P4R53CiOwnerWorkspaceController}
 from "../frontend/src/lib/p4-r53-ci-owner-workspace-controller.js";
import {P4R53CiOwnerWorkspacePanel}
 from "../frontend/src/components/p4-r53-ci-owner-workspace.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32),inviteHmac=randomBytes(32),
  memberHmac=randomBytes(32),auditHmac=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r53",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
 const issuer=new P4R32CiOutboxIssuer(pool,aes,process.env);
 const worker=new P4R32CiOutboxWorker(pool,aes,process.env);
 const mailbox=new P4R32CiRecipientMailbox();
 const deliver=async(email:string):Promise<string|null>=>{
  for(let i=0;i<40;i++){
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
  renewer:new P4R45CiRenewalIssuer(pool,aes,process.env),
  canceler:new P4R46CiInvitationCanceler(pool,process.env),
  invitationPages:new P4R48CiInvitationPager(pool,inviteHmac,process.env),
  memberPages:new P4R49CiMemberPager(pool,memberHmac,process.env),
  ownerSummary:new P4R50CiOwnerOperations(pool,process.env),
  ownerActivityPages:new P4R52CiOwnerActivityPager(pool,auditHmac,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port+"/";
 const clients=(token:string)=>({
  summary:new P4R50CiOwnerSummaryClient(base,async()=>token,fetch,process.env),
  members:new P4R49CiMemberPageClient(base,async()=>token,fetch,process.env),
  invitations:new P4R48CiInvitationPageClient(base,async()=>token,fetch,process.env),
  activity:new P4R52CiActivityPageClient(base,async()=>token,fetch,process.env),
  actions:new P4R34CiHttpClient(base,async who=>
   who==="owner"?token:bobJwt,fetch,process.env),
  roles:new P4R41CiMemberRoleClient(base,async()=>token,fetch,process.env),
 });
 const controller=new P4R53CiOwnerWorkspaceController(clients(ownerJwt));
 const recipient=new P4R34CiHttpClient(base,async who=>
  who==="owner"?ownerJwt:bobJwt,fetch,process.env);
 try{
  phase="fictional-tenant-fixture";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const org=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R53 Workspace",slug:"demo-r53-workspace",
  });
  const foreign=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R53 Foreign",slug:"demo-r53-foreign",
  });
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES($1,'user_demo_bob','MEMBER',true)",
   [org.id]);
  phase="hydrate-four-persisted-owner-views";
  let v=await controller.refresh(org.id);
  assert.equal(v.phase,"ready");assert.equal(v.members.length,1);
  assert.equal(v.members[0]?.role,"SALES_REP");
  assert.equal(v.counts?.activeMembers,1);
  assert.deepEqual(v.invitations,[]);assert.deepEqual(v.activity,[]);
  phase="real-member-manager-change-and-revoke";
  v=await controller.changeRole(org.id,"user_demo_bob","SALES_MANAGER");
  assert.equal(v.phase,"ready");assert.equal(v.members[0]?.revision,1);
  assert.equal(v.counts?.salesManagers,1);assert.equal(v.activity.length,1);
  v=await controller.revokeMember(org.id,"user_demo_bob");
  assert.equal(v.phase,"ready");assert.equal(v.members[0]?.active,false);
  assert.equal(v.counts?.membershipEvents,1);
  phase="issue-cancel-renew-automatic-refresh";
  v=await controller.issue(org.id,"bob@example.com");
  assert.equal(v.phase,"ready");assert.equal(v.counts?.pendingInvites,1);
  const pending=v.invitations.find(x=>x.status==="pending");
  assert.ok(pending);
  v=await controller.cancel(org.id,pending.id);
  assert.equal(v.phase,"ready");assert.equal(v.counts?.cancellations,1);
  v=await controller.renew(org.id,pending.id);
  assert.equal(v.phase,"ready");assert.equal(v.counts?.renewals,1);
  phase="recipient-bound-reaccept-and-least-privilege-reset";
  const token=await deliver("bob@example.com");
  assert.ok(token);
  assert.deepEqual(await recipient.accept(token),{
   accepted:true,membershipActivated:true,
  });
  v=await controller.refresh(org.id);
  assert.equal(v.phase,"ready");assert.equal(v.counts?.activeMembers,1);
  assert.equal(v.counts?.revokedMembers,0);
  assert.equal(v.counts?.salesManagers,0);
  assert.equal(v.counts?.acceptedInvites,1);
  assert.equal(v.counts?.membershipEvents,2);
  assert.equal(v.members[0]?.role,"SALES_REP");
  assert.ok(v.members[0]!.revision>1);
  assert.equal(v.activity.length,5);
  phase="SSR-real-react-owner-ui-no-secrets";
  const noop=()=>{};
  const html=renderToStaticMarkup(createElement(P4R53CiOwnerWorkspacePanel,{
   snapshot:v,onRefresh:noop,onInvite:noop,onCancel:noop,
   onRenew:noop,onRole:noop,onRevoke:noop,onMore:noop,
   onMemberFilter:noop,onInvitationFilter:noop,onActivityFilter:noop,
  }));
  for(const label of ["Owner operations","Organization overview",
   "Team members","Invitations","Recent activity",
   "bob@example.com","SALES_REP","member.reactivated",
   "invitation.renewed","CI only",'data-metric="activeMembers"']){
   assert.ok(html.includes(label),"missing UI "+label);
  }
  for(const secret of [token,ownerJwt,bobJwt,
   "encrypted_token","token_hash","postgresql://","auth0|"])
   assert.equal(html.includes(secret),false);
  phase="tenant-switch-and-nonowner-denial";
  v=await controller.refresh(foreign.id);
  assert.equal(v.phase,"ready");assert.equal(v.counts?.activeMembers,0);
  assert.deepEqual(v.members,[]);assert.deepEqual(v.invitations,[]);
  assert.deepEqual(v.activity,[]);
  const notOwner=new P4R53CiOwnerWorkspaceController(clients(bobJwt));
  const denied=await notOwner.refresh(org.id);
  assert.equal(denied.phase,"denied");assert.equal(denied.counts,null);
  assert.deepEqual(denied.members,[]);
  phase="owner-revocation-clears-entire-ui-state";
  assert.equal((await controller.refresh(org.id)).phase,"ready");
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  try{
   const deniedOwner=await controller.refresh(org.id);
   assert.equal(deniedOwner.phase,"denied");assert.equal(deniedOwner.counts,null);
   assert.deepEqual(deniedOwner.members,[]);
   assert.deepEqual(deniedOwner.invitations,[]);
   assert.deepEqual(deniedOwner.activity,[]);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  }
  phase="role-and-tenant-context-cleanup";
  const scoped=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scoped.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R53 signed React owner workspace with four real CI Postgres read models, role/revoke/issue/cancel/renew/recipient reactivation and SSR PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=false,canonical_email='alice@example.com'"+
   " WHERE user_id='user_demo_bob'");
  aes.fill(0);inviteHmac.fill(0);memberHmac.fill(0);auditHmac.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(e=>{
 const x=e as {name?:string;code?:string;status?:number};
 process.stderr.write("P4 R53 signed React owner workspace smoke FAILED at "+phase+
  " type="+(x?.name??"unknown")+" code="+(x?.code??"none")+
  " status="+(x?.status??"none")+"\n");
 process.exitCode=1;
});
