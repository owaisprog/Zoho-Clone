/** R62 real signed React CRM: 25 leads, status history, immutable follow-ups. */
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
import {P4R60CiCrmLeadPager}
 from "../backend/src/platform/p4-r60-ci-crm-lead-pager.js";
import {P4R61CiLeadNotes}
 from "../backend/src/platform/p4-r61-ci-lead-notes.js";
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
import {P4R60CiCrmLeadPageClient}
 from "../frontend/src/lib/p4-r60-ci-crm-lead-page-client.js";
import {P4R61CiLeadNotesClient}
 from "../frontend/src/lib/p4-r61-ci-lead-notes-client.js";
import {P4R62CiCrmWorkspaceController}
 from "../frontend/src/lib/p4-r62-ci-crm-workspace-controller.js";
import {P4R62CiCrmWorkspacePanel}
 from "../frontend/src/components/p4-r62-ci-crm-workspace.js";
let phase="start";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32),cursorKey=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r62",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
  crmLeadPages:new P4R60CiCrmLeadPager(pool,cursorKey,process.env),
  crmLeadNotes:new P4R61CiLeadNotes(pool,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port+"/";
 const clients=(token:string)=>({
  owners:new P4R54CiOwnedOrganizationsClient(base,async()=>token,fetch,process.env),
  pager:new P4R60CiCrmLeadPageClient(base,async()=>token,fetch,process.env),
  leads:new P4R57CiCrmLeadClient(base,async()=>token,fetch,process.env),
  stages:new P4R58CiLeadStageClient(base,async()=>token,fetch,process.env),
  notes:new P4R61CiLeadNotesClient(base,async()=>token,fetch,process.env),
 });
 const owner=clients(alice);
 const controller=new P4R62CiCrmWorkspaceController(
  owner.owners,owner.pager,owner.leads,owner.stages,owner.notes);
 try{
  phase="seed-two-fictional-tenants";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const a=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R62 CRM Alpha",slug:"demo-r62-crm-alpha",
  });
  const b=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R62 CRM Beta",slug:"demo-r62-crm-beta",
  });
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES($1,'user_demo_bob','MEMBER',true)",
   [a.id]);
  phase="signed-owner-seeds-25-persisted-leads";
  for(let i=0;i<25;i++){
   const item=await owner.leads.create(a.id,{
    companyName:"Demo R62 Lead Number "+i,
    contactEmail:"r62lead"+i+"@example.com",
    source:i%2===0?"WEBSITE":"EVENT",
   });
   assert.equal(item.status,"NEW");
  }
  phase="React-controller-loads-20-plus-5";
  let v=await controller.discover(a.id);
  assert.equal(v.phase,"ready");assert.equal(v.leads.length,20);
  assert.ok(v.nextCursor);
  v=await controller.more();
  assert.equal(v.phase,"ready");assert.equal(v.leads.length,25);
  assert.equal(v.nextCursor,null);
  assert.equal(new Set(v.leads.map(x=>x.leadId)).size,25);
  phase="select-older-lead-on-page-two";
  const chosen=v.leads.at(-1)!;
  v=await controller.selectLead(chosen.leadId);
  assert.equal(v.phase,"ready");assert.equal(v.history.length,1);
  assert.deepEqual(v.notes,[]);
  phase="write-then-reread-immutable-follow-up-note";
  const noteText="Demo contacted the older lead for a follow up";
  v=await controller.addNote(noteText);
  assert.equal(v.phase,"ready");assert.equal(v.notes.length,1);
  assert.equal(v.notes[0]?.noteText,noteText);
  phase="status-change-old-page-two-lead";
  v=await controller.changeStage("CONTACTED");
  assert.equal(v.phase,"ready");
  assert.equal(v.leads.find(x=>x.leadId===chosen.leadId)?.status,"CONTACTED");
  assert.equal(v.history.length,2);
  v=await controller.changeStage("QUALIFIED");
  assert.equal(v.phase,"ready");
  assert.equal(v.leads.find(x=>x.leadId===chosen.leadId)?.status,"QUALIFIED");
  assert.equal(v.history.length,3);
  assert.equal(v.notes.length,1);
  phase="react-SSR-shows-notes-and-status-no-secret";
  const noop=()=>{};
  const html=renderToStaticMarkup(createElement(P4R62CiCrmWorkspacePanel,{
   view:v,onOrg:noop,onRefresh:noop,onCreate:noop,onSelect:noop,
   onFilter:noop,onStage:noop,onSearch:noop,onMore:noop,onAddNote:noop,
  }));
  for(const text of ["CRM Leads","Load more leads","Lead follow-up notes",
   noteText,"Save follow-up note","QUALIFIED",
   'data-ci-crm-complete="fictional-only"'])
   assert.ok(html.includes(text),"React UI missing "+text);
  for(const secret of [alice,bob,"auth0|","postgresql://",
   "token_hash","encrypted_token"])
   assert.equal(html.includes(secret),false);
  phase="server-scoped-search-and-filter";
  v=await controller.search("NEW","number 1");
  assert.equal(v.phase,"ready");
  assert.ok(v.leads.length>0);
  assert.ok(v.leads.every(x=>x.status==="NEW"&&
   x.companyName.toLowerCase().includes("number 1")));
  phase="tenant-switch-clears-all-data";
  v=await controller.selectOrg(b.id);
  assert.equal(v.phase,"ready");assert.equal(v.orgId,b.id);
  assert.deepEqual(v.leads,[]);assert.deepEqual(v.notes,[]);
  assert.equal(v.selectedLeadId,null);
  phase="create-second-tenant-lead-and-new-note";
  v=await controller.create({companyName:"Demo R62 Beta Payments",
   contactEmail:"r62beta@example.com",source:"REFERRAL"});
  assert.equal(v.phase,"ready");assert.equal(v.leads.length,1);
  assert.equal(v.selectedLeadId,v.leads[0]?.leadId);
  v=await controller.addNote("Demo recorded second tenant follow up");
  assert.equal(v.phase,"ready");assert.equal(v.notes.length,1);
  assert.ok(v.notes.every(n=>n.leadId===v.selectedLeadId));
  phase="real-DB-notes-respect-tenant-boundary";
  const records=await pool.query("SELECT org_id::text,count(*)::integer AS n"+
   " FROM p4_r61_ci.lead_notes WHERE org_id IN($1,$2)"+
   " GROUP BY org_id",[a.id,b.id]);
  assert.equal(records.rows.length,2);
  assert.ok(records.rows.every(x=>x.n===1));
  phase="nonowner-and-revoked-owner-clear-everything";
  const member=clients(bob);
  const denied=new P4R62CiCrmWorkspaceController(
   member.owners,member.pager,member.leads,member.stages,member.notes);
  assert.equal((await denied.discover(a.id)).phase,"denied");
  assert.deepEqual(denied.snapshot().leads,[]);
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[b.id]);
  try{
   const lost=await controller.refresh();
   assert.equal(lost.phase,"denied");assert.deepEqual(lost.leads,[]);
   assert.deepEqual(lost.notes,[]);assert.deepEqual(lost.history,[]);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[b.id]);
  }
  phase="no-transaction-context-leak";
  const scope=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R62 signed actual React CRM 25 leads 20+5, page-two qualification, follow-up notes, search and tenant isolation PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=false,canonical_email='alice@example.com'"+
   " WHERE user_id='user_demo_bob'");
  aes.fill(0);cursorKey.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(e=>{
 const x=e as {name?:string;status?:number;code?:string};
 process.stderr.write("P4 R62 signed React CRM integration FAILED at "+phase+
  " type="+(x.name??"unknown")+" status="+(x.status??"none")+
  " code="+(x.code??"none")+"\n");process.exitCode=1;
});
