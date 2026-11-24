/** R68 real RS256->Express->Postgres owner CRM multi-lead due work queue. */
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
import {P4R57CiCrmLeads}
 from "../backend/src/platform/p4-r57-ci-crm-leads.js";
import {P4R64CiLeadTasks}
 from "../backend/src/platform/p4-r64-ci-lead-tasks.js";
import {P4R68CiDueQueue}
 from "../backend/src/platform/p4-r68-ci-due-queue.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R57CiCrmLeadClient}
 from "../frontend/src/lib/p4-r57-ci-crm-lead-client.js";
import {P4R64CiTaskClient}
 from "../frontend/src/lib/p4-r64-ci-task-client.js";
import {P4R68CiDueQueueClient,P4R68CiQueueError}
 from "../frontend/src/lib/p4-r68-ci-due-queue-client.js";
import {P4R68CiDueQueueController}
 from "../frontend/src/lib/p4-r68-ci-due-queue-controller.js";
import {P4R68CiDueQueuePanel}
 from "../frontend/src/components/p4-r68-ci-due-queue.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32),key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r68",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const now=Math.floor(Date.now()/1000);let clock=Date.now();
 const enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const jwt=(sub:string)=>{
  const h=enc({typ:"JWT",alg:"RS256",kid:jwk.kid});
  const p=enc({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,
   iat:now-5,exp:now+300,email_verified:true});
  const msg=h+"."+p;
  return msg+"."+sign("RSA-SHA256",Buffer.from(msg),pair.privateKey)
   .toString("base64url");
 };
 const ownerJwt=jwt("auth0|demo-alice"),bobJwt=jwt("auth0|demo-bob");
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer:new P4R32CiOutboxIssuer(pool,aes,process.env),
  acceptance:new P4R30CiAcceptanceService(pool,process.env),
  crmLeads:new P4R57CiCrmLeads(pool,process.env),
  crmLeadTasks:new P4R64CiLeadTasks(pool,process.env),
  crmDueQueue:new P4R68CiDueQueue(pool,key,process.env,()=>clock),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port+"/";
 const leads=new P4R57CiCrmLeadClient(base,async()=>ownerJwt,fetch,process.env);
 const tasks=new P4R64CiTaskClient(base,async()=>ownerJwt,fetch,process.env);
 const pages=new P4R68CiDueQueueClient(base,async()=>ownerJwt,fetch,process.env);
 const member=new P4R68CiDueQueueClient(base,async()=>bobJwt,fetch,process.env);
 const ctl=new P4R68CiDueQueueController(pages,tasks);
 const denied=(status:number)=>(e:unknown)=>
  e instanceof P4R68CiQueueError&&e.status===status;
 try{
  phase="create-two-verified-fictional-organizations";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const a=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R68 Primary",slug:"demo-r68-primary"});
  const b=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R68 Secondary",slug:"demo-r68-secondary"});
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES($1,'user_demo_bob','MEMBER',true)",
   [a.id]);
  const alpha=await leads.create(a.id,{
   companyName:"Demo Alpha Payments",contactEmail:"r68alpha@example.com",
   source:"WEBSITE"});
  const beta=await leads.create(a.id,{
   companyName:"Demo Beta Payments",contactEmail:"r68beta@example.com",
   source:"EVENT"});
  const foreign=await leads.create(b.id,{
   companyName:"Demo Other Payments",contactEmail:"r68other@example.com",
   source:"REFERRAL"});
  phase="25-real-open-tasks-on-two-leads-and-out-of-window";
  for(let i=0;i<25;i++){
   const lead=i%2===0?alpha:beta;
   const saved=await tasks.create(a.id,lead.leadId,{
    title:"Demo call payment client number "+i,
    dueDate:i<13?"2026-11-30":"2026-12-05"});
   assert.equal(saved.leadId,lead.leadId);
  }
  await tasks.create(a.id,alpha.leadId,{
   title:"Demo call client after due window",dueDate:"2027-01-02"});
  await tasks.create(b.id,foreign.leadId,{
   title:"Demo separate customer follow up",dueDate:"2026-12-10"});
  phase="signed-owner-due-page-twenty-plus-five";
  let v=await ctl.load(a.id,"2026-12-31");
  assert.equal(v.phase,"ready");assert.equal(v.items.length,20);
  assert.ok(v.nextCursor);
  const cursor=v.nextCursor!;
  v=await ctl.more();
  assert.equal(v.phase,"ready");assert.equal(v.items.length,25);
  assert.equal(v.nextCursor,null);
  assert.equal(new Set(v.items.map(x=>x.task.taskId)).size,25);
  assert.equal(new Set(v.items.map(x=>x.task.leadId)).size,2);
  assert.ok(v.items.every(x=>x.task.status==="OPEN"&&
   x.task.dueDate<="2026-12-31"));
  phase="signed-due-filter-and-cursor-binding";
  const early=await pages.page(a.id,"2026-11-30");
  assert.equal(early.items.length,13);assert.equal(early.nextCursor,null);
  await assert.rejects(pages.page(b.id,"2026-12-31",cursor),denied(400));
  await assert.rejects(pages.page(a.id,"2026-11-30",cursor),denied(400));
  const altered=cursor.slice(0,-1)+(cursor.endsWith("a")?"b":"a");
  await assert.rejects(pages.page(a.id,"2026-12-31",altered),denied(400));
  clock+=11*60*1000;
  await assert.rejects(pages.page(a.id,"2026-12-31",cursor),denied(400));
  clock-=11*60*1000;
  phase="complete-open-task-from-older-queue-page-with-immutable-audit";
  const older=v.items[24]!;
  v=await ctl.complete(older.task.taskId);
  assert.equal(v.phase,"ready");assert.equal(v.items.length,24);
  assert.equal(v.items.some(x=>x.task.taskId===older.task.taskId),false);
  const audit=await pool.query("SELECT event_kind,revision FROM"+
   " p4_r64_ci.task_events WHERE org_id=$1 AND task_id=$2"+
   " ORDER BY revision",[a.id,older.task.taskId]);
  assert.deepEqual(audit.rows,[{event_kind:"CREATED",revision:0},
   {event_kind:"COMPLETED",revision:1}]);
  phase="React-render-multi-lead-due-queue-without-private-auth";
  const noop=()=>{};
  const html=renderToStaticMarkup(createElement(P4R68CiDueQueuePanel,{
   view:v,onThrough:noop,onMore:noop,onComplete:noop,onOpenLead:noop,
  }));
  for(const label of ["Follow-up work queue","Demo Alpha Payments",
   "Demo Beta Payments","Open tasks shown","Mark Done","Due 2026-11-30"])
   assert.ok(html.includes(label),"missing React work queue "+label);
  for(const secret of [ownerJwt,bobJwt,"auth0|",
   "postgresql://","token_hash","encrypted_token"])
   assert.equal(html.includes(secret),false);
  phase="same-owner-switch-second-org-with-no-cross-tenant-task-leak";
  v=await ctl.load(b.id,"2026-12-31");
  assert.equal(v.phase,"ready");assert.equal(v.items.length,1);
  assert.equal(v.items[0]?.companyName,"Demo Other Payments");
  assert.deepEqual(new Set(v.items.map(x=>x.task.leadId)),
   new Set([foreign.leadId]));
  phase="signed-member-forged-token-and-revoked-owner";
  await assert.rejects(member.page(a.id,"2026-12-31"),denied(403));
  const forged=new P4R68CiDueQueueClient(base,async()=>"abc.def.ghi",
   fetch,process.env);
  await assert.rejects(forged.page(a.id,"2026-12-31"),denied(401));
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[b.id]);
  try{
   v=await ctl.load(b.id,"2026-12-31");
   assert.equal(v.phase,"denied");assert.deepEqual(v.items,[]);
   assert.equal(v.orgId,null);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[b.id]);
  }
  phase="transaction-local-tenant-context-cleanup";
  const scope=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R68 actual signed cross-lead 25 due tasks 20+5, safe completion, owner/org scope and React PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=false,canonical_email='alice@example.com'"+
   " WHERE user_id='user_demo_bob'");
  aes.fill(0);key.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(e=>{
 const x=e as {name?:string;status?:number;code?:string};
 process.stderr.write("P4 R68 due queue smoke FAILED at "+phase+
  " type="+(x.name??"unknown")+" status="+(x.status??"none")+
  " code="+(x.code??"none")+"\n");process.exitCode=1;
});
