/** R55 signed React owner organization switcher with real CI PostgreSQL. */
import assert from "node:assert/strict";
import {generateKeyPairSync,randomBytes,sign,randomUUID} from "node:crypto";
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
import {P4R32CiOutboxIssuer}
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
import {P4R54CiOwnedOrganizations}
 from "../backend/src/platform/p4-r54-ci-owned-organizations.js";
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
import {P4R54CiOwnedOrganizationsClient}
 from "../frontend/src/lib/p4-r54-ci-owned-organizations-client.js";
import {P4R53CiOwnerWorkspaceController}
 from "../frontend/src/lib/p4-r53-ci-owner-workspace-controller.js";
import {P4R55CiOwnerOrgSwitcher}
 from "../frontend/src/lib/p4-r55-ci-owner-org-switcher.js";
import {P4R55CiOwnerSwitcherPanel}
 from "../frontend/src/components/p4-r55-ci-owner-org-switcher.js";
let phase="start";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32),inviteKey=randomBytes(32),
  memberKey=randomBytes(32),auditKey=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r55",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
 const alice=jwt("auth0|demo-alice"),bob=jwt("auth0|demo-bob");
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer:new P4R32CiOutboxIssuer(pool,aes,process.env),
  acceptance:new P4R30CiAcceptanceService(pool,process.env),
  roles:new P4R40CiMemberRoles(pool,process.env),
  revoker:new P4R43CiMemberRevokeService(pool,process.env),
  renewer:new P4R45CiRenewalIssuer(pool,aes,process.env),
  canceler:new P4R46CiInvitationCanceler(pool,process.env),
  invitationPages:new P4R48CiInvitationPager(pool,inviteKey,process.env),
  memberPages:new P4R49CiMemberPager(pool,memberKey,process.env),
  ownerSummary:new P4R50CiOwnerOperations(pool,process.env),
  ownerActivityPages:new P4R52CiOwnerActivityPager(pool,auditKey,process.env),
  ownerOrganizations:new P4R54CiOwnedOrganizations(pool,process.env),
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
  actions:new P4R34CiHttpClient(base,async kind=>
   kind==="owner"?token:bob,fetch,process.env),
  roles:new P4R41CiMemberRoleClient(base,async()=>token,fetch,process.env),
 });
 const owned=new P4R54CiOwnedOrganizationsClient(base,async()=>alice,fetch,process.env);
 const model=new P4R55CiOwnerOrgSwitcher(owned,
  new P4R53CiOwnerWorkspaceController(clients(alice)));
 try{
  phase="seed-genuine-synthetic-multiowner-orgs";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  const a=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R55 Alpha",slug:"demo-r55-alpha",
  });
  const b=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R55 Beta",slug:"demo-r55-beta",
  });
  const hidden=await orgs.create({userId:"user_demo_bob",verified:true},{
   name:"Demo R55 Foreign",slug:"demo-r55-foreign",
  });
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES($1,'user_demo_bob','MEMBER',true)",[a.id]);
  phase="discover-preferred-and-switch-tenants";
  let state=await model.discover(a.id);
  assert.equal(state.phase,"ready");assert.equal(state.selectedId,a.id);
  assert.equal(state.workspace.counts?.activeMembers,1);
  assert.equal(state.workspace.members[0]?.userId,"user_demo_bob");
  assert.ok(state.organizations.some(x=>x.id===b.id));
  assert.ok(state.organizations.every(x=>x.id!==hidden.id));
  state=await model.select(b.id);
  assert.equal(state.phase,"ready");assert.equal(state.selectedId,b.id);
  assert.equal(state.workspace.counts?.activeMembers,0);
  assert.deepEqual(state.workspace.members,[]);
  assert.deepEqual(state.workspace.invitations,[]);
  phase="write-with-selected-tenant-only";
  state=await model.issue("carla@example.com");
  assert.equal(state.phase,"ready");assert.equal(state.selectedId,b.id);
  assert.equal(state.workspace.counts?.pendingInvites,1);
  assert.equal(state.workspace.invitations.length,1);
  state=await model.select(a.id);
  assert.equal(state.phase,"ready");assert.equal(state.selectedId,a.id);
  assert.equal(state.workspace.counts?.pendingInvites,0);
  assert.deepEqual(state.workspace.invitations,[]);
  phase="render-actual-react-shell-and-verify-redaction";
  const noop=()=>{};
  const html=renderToStaticMarkup(createElement(P4R55CiOwnerSwitcherPanel,{
   view:state,onSelect:noop,onReload:noop,onInvite:noop,
   onCancel:noop,onRenew:noop,onRole:noop,onRevoke:noop,onMore:noop,
   onMemberFilter:noop,onInvitationFilter:noop,onActivityFilter:noop,
  }));
  for(const value of ["Active owner organization","Demo R55 Alpha",
   "Demo R55 Beta","Owner operations","Team members",
   "Recent activity",'data-ci-owner-switcher="fictional-only"'])
   assert.ok(html.includes(value),"missing UI "+value);
  for(const secret of [alice,bob,"auth0|","encrypted_token",
   "token_hash","postgresql://"])
   assert.equal(html.includes(secret),false);
  phase="reject-forged-tenant-selection-and-clear";
  state=await model.select(hidden.id);
  assert.equal(state.phase,"denied");assert.equal(state.selectedId,null);
  assert.equal(state.workspace.counts,null);
  assert.deepEqual(state.workspace.members,[]);
  phase="fresh-owner-check-after-revocation";
  state=await model.discover(b.id);
  assert.equal(state.phase,"ready");assert.equal(state.selectedId,b.id);
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[b.id]);
  state=await model.refresh();
  assert.equal(state.phase,"denied");assert.equal(state.selectedId,null);
  assert.equal(state.workspace.counts,null);
  assert.deepEqual(state.workspace.invitations,[]);
  phase="no-stale-postgres-app-context";
  const scope=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R55 signed React organization switcher actual CI Postgres two-tenant writes, owner revocation, cross-org isolation and SSR PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=false,canonical_email='alice@example.com'"+
   " WHERE user_id='user_demo_bob'");
  aes.fill(0);inviteKey.fill(0);memberKey.fill(0);auditKey.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(e=>{
 const x=e as {name?:string;code?:string;status?:number};
 process.stderr.write("P4 R55 organization React switch smoke FAILED at "+phase+
  " type="+(x.name??"unknown")+" code="+(x.code??"none")+
  " status="+(x.status??"none")+"\n");process.exitCode=1;
});
