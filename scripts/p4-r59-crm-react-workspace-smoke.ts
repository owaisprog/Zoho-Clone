/** R59 real signed React fictional CRM, owner tenant switch, create and stage audit. */
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
import {P4R32CiOutboxIssuer}
 from "../backend/src/platform/p4-r32-ci-outbox.js";
import {P4R30CiAcceptanceService}
 from "../backend/src/platform/p4-r30-ci-invitation-acceptance.js";
import {P4R54CiOwnedOrganizations}
 from "../backend/src/platform/p4-r54-ci-owned-organizations.js";
import {P4R57CiCrmLeads}
 from "../backend/src/platform/p4-r57-ci-crm-leads.js";
import {P4R58CiCrmLeadStages}
 from "../backend/src/platform/p4-r58-ci-crm-lead-stages.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R54CiOwnedOrganizationsClient}
 from "../frontend/src/lib/p4-r54-ci-owned-organizations-client.js";
import {P4R57CiCrmLeadClient}
 from "../frontend/src/lib/p4-r57-ci-crm-lead-client.js";
import {P4R58CiLeadStageClient}
 from "../frontend/src/lib/p4-r58-ci-crm-lead-stage-client.js";
import {P4R59CiCrmWorkspaceController}
 from "../frontend/src/lib/p4-r59-ci-crm-workspace-controller.js";
import {P4R59CiCrmWorkspacePanel}
 from "../frontend/src/components/p4-r59-ci-crm-workspace.js";
let phase="start";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r59",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
  ownerOrganizations:new P4R54CiOwnedOrganizations(pool,process.env),
  crmLeads:new P4R57CiCrmLeads(pool,process.env),
  crmLeadStages:new P4R58CiCrmLeadStages(pool,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port+"/";
 const clients=(token:string)=>({
  owners:new P4R54CiOwnedOrganizationsClient(base,async()=>token,fetch,process.env),
  leads:new P4R57CiCrmLeadClient(base,async()=>token,fetch,process.env),
  stages:new P4R58CiLeadStageClient(base,async()=>token,fetch,process.env),
 });
 const signed=clients(alice);
 const controller=new P4R59CiCrmWorkspaceController(
  signed.owners,signed.leads,signed.stages);
 try{
  phase="fictional-owner-2-tenants-and-verified-member";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const a=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R59 CRM Alpha",slug:"demo-r59-crm-alpha",
  });
  const b=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R59 CRM Beta",slug:"demo-r59-crm-beta",
  });
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES($1,'user_demo_bob','MEMBER',true)",
   [a.id]);
  phase="owner-select-tenant-A-and-create-lead";
  let v=await controller.discover(a.id);
  assert.equal(v.phase,"ready");assert.equal(v.orgId,a.id);
  assert.equal(v.leads.length,0);
  v=await controller.create({companyName:"Demo Alpha Payments",
   contactEmail:"alpha59@example.com",source:"WEBSITE"});
  assert.equal(v.phase,"ready");assert.equal(v.leads.length,1);
  assert.equal(v.selectedLeadId,v.leads[0]?.leadId);
  assert.equal(v.history.length,1);
  assert.equal(v.leads[0]?.status,"NEW");
  phase="real-react-workflow-new-contacted-qualified";
  v=await controller.changeStage("CONTACTED");
  assert.equal(v.phase,"ready");assert.equal(v.leads[0]?.status,"CONTACTED");
  assert.equal(v.history.length,2);
  v=await controller.changeStage("QUALIFIED");
  assert.equal(v.phase,"ready");assert.equal(v.leads[0]?.status,"QUALIFIED");
  assert.equal(v.history.length,3);
  assert.deepEqual(v.history.map(x=>x.afterStatus),
   ["NEW","CONTACTED","QUALIFIED"]);
  phase="render-React-CRM-screen-safely";
  const noop=()=>{};
  const html=renderToStaticMarkup(createElement(P4R59CiCrmWorkspacePanel,{
   view:v,onOrg:noop,onRefresh:noop,onCreate:noop,
   onSelect:noop,onFilter:noop,onStage:noop,
  }));
  for(const value of ["CRM Leads","Lead directory","New lead",
   "Create Lead","Lead details","Demo Alpha Payments",
   "QUALIFIED","Lead created","Final stage",
   'data-ci-crm-workspace="fictional-only"',
   'data-ci-crm-count="QUALIFIED"'])
   assert.ok(html.includes(value),"missing React UI "+value);
  for(const secret of [alice,bob,"auth0|","postgresql://",
   "token_hash","encrypted_token"])
   assert.equal(html.includes(secret),false);
  phase="tenant-B-has-no-A-data";
  v=await controller.selectOrg(b.id);
  assert.equal(v.phase,"ready");assert.equal(v.orgId,b.id);
  assert.deepEqual(v.leads,[]);assert.equal(v.selectedLeadId,null);
  phase="new-second-tenant-lead-and-lost-path";
  v=await controller.create({companyName:"Demo Beta Payments",
   contactEmail:"beta59@example.com",source:"REFERRAL"});
  assert.equal(v.phase,"ready");assert.equal(v.leads.length,1);
  v=await controller.changeStage("CONTACTED");
  assert.equal(v.phase,"ready");
  v=await controller.changeStage("LOST");
  assert.equal(v.phase,"ready");assert.equal(v.leads[0]?.status,"LOST");
  assert.deepEqual(v.history.map(x=>x.afterStatus),
   ["NEW","CONTACTED","LOST"]);
  phase="switch-back-and-check-durable-qualified-history";
  v=await controller.selectOrg(a.id);
  assert.equal(v.leads.length,1);assert.equal(v.leads[0]?.status,"QUALIFIED");
  assert.equal(v.leads[0]?.contactEmail,"alpha59@example.com");
  assert.equal(v.leads.some(x=>x.contactEmail==="beta59@example.com"),false);
  v=await controller.selectLead(v.leads[0]!.leadId);
  assert.equal(v.history.length,3);
  phase="unauthorized-member-and-revoked-owner-denial";
  const member=clients(bob);
  const nonowner=new P4R59CiCrmWorkspaceController(
   member.owners,member.leads,member.stages);
  const denied=await nonowner.discover(a.id);
  assert.equal(denied.phase,"denied");assert.deepEqual(denied.leads,[]);
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[a.id]);
  try{
   const rejected=await controller.refresh();
   assert.equal(rejected.phase,"denied");
   assert.deepEqual(rejected.leads,[]);
   assert.equal(rejected.selectedLeadId,null);
   assert.deepEqual(rejected.history,[]);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[a.id]);
  }
  phase="audit-records-and-clean-connection";
  const counts=await pool.query("SELECT org_id::text,event_kind,count(*)::integer AS n"+
   " FROM p4_r57_ci.lead_events WHERE org_id IN($1,$2)"+
   " GROUP BY org_id,event_kind ORDER BY org_id,event_kind",[a.id,b.id]);
  assert.equal(counts.rows.length,4);
  assert.deepEqual(counts.rows.map(x=>x.n).sort((x,y)=>x-y),[1,1,2,2]);
  const scope=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R59 real React CRM lead creation qualification lost audit and two-tenant signed CI PostgreSQL workflow PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=false,canonical_email='alice@example.com'"+
   " WHERE user_id='user_demo_bob'");
  aes.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(e=>{
 const x=e as {name?:string;status?:number;code?:string};
 process.stderr.write("P4 R59 real CRM React smoke FAILED at "+phase+
  " type="+(x.name??"unknown")+" status="+(x.status??"none")+
  " code="+(x.code??"none")+"\n");process.exitCode=1;
});
