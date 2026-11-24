/** R65 signed React CRM full lifecycle with 25 notes, tasks, stages and tenants. */
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
import {P4R63CiNotePager}
 from "../backend/src/platform/p4-r63-ci-note-pager.js";
import {P4R64CiLeadTasks}
 from "../backend/src/platform/p4-r64-ci-lead-tasks.js";
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
import {P4R63CiNotePageClient}
 from "../frontend/src/lib/p4-r63-ci-note-page-client.js";
import {P4R64CiTaskClient}
 from "../frontend/src/lib/p4-r64-ci-task-client.js";
import {P4R62CiCrmWorkspaceController}
 from "../frontend/src/lib/p4-r62-ci-crm-workspace-controller.js";
import {P4R65CiFollowUpWorkspaceController}
 from "../frontend/src/lib/p4-r65-ci-followup-workspace-controller.js";
import {P4R65CiFollowUpWorkspacePanel}
 from "../frontend/src/components/p4-r65-ci-followup-workspace.js";
let phase="start";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32),leadsKey=randomBytes(32),notesKey=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r65",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const now=Math.floor(Date.now()/1000);
 const enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const jwt=(sub:string)=>{
  const h=enc({typ:"JWT",alg:"RS256",kid:jwk.kid});
  const p=enc({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,
   iat:now-5,exp:now+300,email_verified:true});
  const msg=h+"."+p;
  return msg+"."+sign("RSA-SHA256",Buffer.from(msg),pair.privateKey)
   .toString("base64url");
 };
 const ownerJwt=jwt("auth0|demo-alice"),memberJwt=jwt("auth0|demo-bob");
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer:new P4R32CiOutboxIssuer(pool,aes,process.env),
  acceptance:new P4R30CiAcceptanceService(pool,process.env),
  ownerOrganizations:new P4R54CiOwnedOrganizations(pool,process.env),
  crmLeads:new P4R57CiCrmLeads(pool,process.env),
  crmLeadStages:new P4R58CiCrmLeadStages(pool,process.env),
  crmLeadPages:new P4R60CiCrmLeadPager(pool,leadsKey,process.env),
  crmLeadNotes:new P4R61CiLeadNotes(pool,process.env),
  crmNotePages:new P4R63CiNotePager(pool,notesKey,process.env),
  crmLeadTasks:new P4R64CiLeadTasks(pool,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port+"/";
 const clients=(jwtToken:string)=>{
  const get=async()=>jwtToken;
  return {
   owners:new P4R54CiOwnedOrganizationsClient(base,get,fetch,process.env),
   pages:new P4R60CiCrmLeadPageClient(base,get,fetch,process.env),
   leads:new P4R57CiCrmLeadClient(base,get,fetch,process.env),
   stages:new P4R58CiLeadStageClient(base,get,fetch,process.env),
   notes:new P4R61CiLeadNotesClient(base,get,fetch,process.env),
   notePages:new P4R63CiNotePageClient(base,get,fetch,process.env),
   tasks:new P4R64CiTaskClient(base,get,fetch,process.env),
  };
 };
 const owner=clients(ownerJwt);
 const makeController=(c:ReturnType<typeof clients>)=>
  new P4R65CiFollowUpWorkspaceController(
   new P4R62CiCrmWorkspaceController(
    c.owners,c.pages,c.leads,c.stages,c.notes,c.notePages),
   c.notePages,c.tasks);
 const controller=makeController(owner);
 try{
  phase="two-verified-fictional-tenants-and-member";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const a=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R65 Follow Ups",slug:"demo-r65-follow-ups",
  });
  const b=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R65 Secondary",slug:"demo-r65-secondary",
  });
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES($1,'user_demo_bob','MEMBER',true)",
   [a.id]);
  const aLead=await owner.leads.create(a.id,{
   companyName:"Demo R65 Alpha Client",
   contactEmail:"r65alpha@example.com",source:"WEBSITE"});
  phase="write-25-notes-on-real-persisted-lead";
  for(let i=0;i<25;i++){
   const saved=await owner.notes.add(a.id,aLead.leadId,
    "Demo follow up number "+i+" for alpha");
   assert.equal(saved.leadId,aLead.leadId);
  }
  phase="signed-React-selection-succeeds-beyond-20-notes";
  let v=await controller.discover(a.id);
  assert.equal(v.phase,"ready");assert.equal(v.crm.leads.length,1);
  v=await controller.selectLead(aLead.leadId);
  assert.equal(v.phase,"ready");assert.equal(v.notes.length,20);
  assert.ok(v.noteNextCursor);
  v=await controller.moreNotes();
  assert.equal(v.phase,"ready");assert.equal(v.notes.length,25);
  assert.equal(v.noteNextCursor,null);
  phase="real-follow-up-task-added-to-selected-lead";
  const due={title:"Demo call alpha about agreement",dueDate:"2026-12-15"};
  v=await controller.createTask(due);
  assert.equal(v.phase,"ready");assert.equal(v.tasks.length,1);
  const task=v.tasks[0]!;
  assert.equal(task.title,due.title);assert.equal(task.dueDate,due.dueDate);
  assert.equal(task.status,"OPEN");
  phase="task-completed-with-one-use-audit";
  v=await controller.completeTask(task.taskId);
  assert.equal(v.phase,"ready");assert.equal(v.tasks[0]?.status,"DONE");
  assert.equal(v.tasks[0]?.revision,1);
  const events=await pool.query("SELECT event_kind,revision"+
   " FROM p4_r64_ci.task_events WHERE org_id=$1 AND task_id=$2"+
   " ORDER BY revision",[a.id,task.taskId]);
  assert.deepEqual(events.rows,[{event_kind:"CREATED",revision:0},
   {event_kind:"COMPLETED",revision:1}]);
  phase="lead-contacted-qualified-and-tasks-persist";
  v=await controller.changeStage("CONTACTED");
  assert.equal(v.phase,"ready");assert.equal(v.crm.leads[0]?.status,"CONTACTED");
  v=await controller.changeStage("QUALIFIED");
  assert.equal(v.phase,"ready");assert.equal(v.crm.leads[0]?.status,"QUALIFIED");
  assert.equal(v.tasks[0]?.status,"DONE");
  assert.equal(v.noteNextCursor!==null,true);
  v=await controller.moreNotes();
  assert.equal(v.notes.length,25);
  phase="React-SSR-complete-workspace-sanitized";
  const noop=()=>{};
  const html=renderToStaticMarkup(createElement(P4R65CiFollowUpWorkspacePanel,{
   view:v,onOrg:noop,onRefresh:noop,onCreateLead:noop,
   onSelectLead:noop,onFilter:noop,onStage:noop,onSearch:noop,
   onMoreLeads:noop,onAddNote:noop,onMoreNotes:noop,
   onCreateTask:noop,onCompleteTask:noop,
  }));
  for(const label of ["Lead follow-up tasks","Completed",
   "Load more notes","Save follow-up note","Lead directory",
   "QUALIFIED",due.title,due.dueDate,
   'data-ci-crm-followups="fictional-only"'])
   assert.ok(html.includes(label),"React followup missing "+label);
  for(const secret of [ownerJwt,memberJwt,"auth0|",
   "postgresql://","token_hash","encrypted_token"])
   assert.equal(html.includes(secret),false);
  phase="tenant-switch-clears-all-lead-task-and-note-data";
  v=await controller.selectOrg(b.id);
  assert.equal(v.phase,"ready");assert.equal(v.crm.orgId,b.id);
  assert.deepEqual(v.crm.leads,[]);assert.deepEqual(v.notes,[]);
  assert.deepEqual(v.tasks,[]);assert.equal(v.crm.selectedLeadId,null);
  phase="second-organization-own-task-without-leakage";
  v=await controller.createLead({
   companyName:"Demo R65 Beta Client",
   contactEmail:"r65beta@example.com",source:"REFERRAL",
  });
  assert.equal(v.phase,"ready");assert.equal(v.crm.leads.length,1);
  assert.equal(v.crm.selectedLeadId,v.crm.leads[0]?.leadId);
  v=await controller.createTask({
   title:"Demo contact beta for next steps",dueDate:"2026-12-20",
  });
  assert.equal(v.tasks.length,1);assert.equal(v.tasks[0]?.status,"OPEN");
  const counts=await pool.query("SELECT org_id::text,count(*)::integer AS n"+
   " FROM p4_r64_ci.lead_tasks WHERE org_id IN($1,$2)"+
   " GROUP BY org_id",[a.id,b.id]);
  assert.equal(counts.rows.length,2);
  assert.ok(counts.rows.every(x=>x.n===1));
  phase="member-revoked-owner-and-forged-identity-denial";
  const outsider=makeController(clients(memberJwt));
  assert.equal((await outsider.discover(a.id)).phase,"denied");
  assert.deepEqual(outsider.snapshot().tasks,[]);
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[b.id]);
  try{
   const denied=await controller.refresh();
   assert.equal(denied.phase,"denied");assert.deepEqual(denied.tasks,[]);
   assert.deepEqual(denied.notes,[]);assert.deepEqual(denied.crm.leads,[]);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[b.id]);
  }
  phase="no-signed-context-persists-in-pool";
  const scope=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R65 real React CRM 25 paged notes, persisted due tasks, one-use completion, lead qualification and two-tenant signed PostgreSQL PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=false,canonical_email='alice@example.com'"+
   " WHERE user_id='user_demo_bob'");
  aes.fill(0);leadsKey.fill(0);notesKey.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(e=>{
 const x=e as {name?:string;status?:number;code?:string};
 process.stderr.write("P4 R65 follow-up React smoke FAILED at "+phase+
  " type="+(x.name??"unknown")+" status="+(x.status??"none")+
  " code="+(x.code??"none")+"\n");process.exitCode=1;
});
