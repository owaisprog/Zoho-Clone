/** R64 real signed fictional CRM task creation, due-date and atomic completion. */
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
import {P4R32CiOutboxIssuer}
 from "../backend/src/platform/p4-r32-ci-outbox.js";
import {P4R30CiAcceptanceService}
 from "../backend/src/platform/p4-r30-ci-invitation-acceptance.js";
import {P4R57CiCrmLeads}
 from "../backend/src/platform/p4-r57-ci-crm-leads.js";
import {P4R64CiLeadTasks}
 from "../backend/src/platform/p4-r64-ci-lead-tasks.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R57CiCrmLeadClient}
 from "../frontend/src/lib/p4-r57-ci-crm-lead-client.js";
import {P4R64CiTaskClient,P4R64CiTaskError}
 from "../frontend/src/lib/p4-r64-ci-task-client.js";
import {P4R64CiTaskController}
 from "../frontend/src/lib/p4-r64-ci-task-controller.js";
let phase="start";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r64",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
 const ownerJwt=jwt("auth0|demo-alice"),bobJwt=jwt("auth0|demo-bob");
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer:new P4R32CiOutboxIssuer(pool,aes,process.env),
  acceptance:new P4R30CiAcceptanceService(pool,process.env),
  crmLeads:new P4R57CiCrmLeads(pool,process.env),
  crmLeadTasks:new P4R64CiLeadTasks(pool,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port+"/";
 const leads=new P4R57CiCrmLeadClient(base,async()=>ownerJwt,fetch,process.env);
 const tasks=new P4R64CiTaskClient(base,async()=>ownerJwt,fetch,process.env);
 const member=new P4R64CiTaskClient(base,async()=>bobJwt,fetch,process.env);
 const ctl=new P4R64CiTaskController(tasks);
 const fail=(status:number)=>(e:unknown)=>e instanceof P4R64CiTaskError&&e.status===status;
 try{
  phase="synthetic-organizations-and-member";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const a=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R64 Follow Up",slug:"demo-r64-follow-up",
  });
  const b=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R64 Foreign",slug:"demo-r64-foreign",
  });
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES($1,'user_demo_bob','MEMBER',true)",
   [a.id]);
  const lead=await leads.create(a.id,{companyName:"Demo R64 Lead",
   contactEmail:"followup@example.com",source:"WEBSITE"});
  const other=await leads.create(a.id,{companyName:"Demo R64 Other",
   contactEmail:"separate@example.com",source:"EVENT"});
  phase="signed-create-due-date-task-and-persisted-readback";
  assert.equal((await ctl.load(a.id,lead.leadId)).tasks.length,0);
  const input={title:"Demo call client about next steps",dueDate:"2026-12-05"};
  let view=await ctl.create(a.id,lead.leadId,input);
  assert.equal(view.phase,"ready");assert.equal(view.tasks.length,1);
  const task=view.tasks[0]!;
  assert.equal(task.status,"OPEN");assert.equal(task.revision,0);
  assert.equal(task.dueDate,input.dueDate);
  assert.equal(task.title,input.title);
  phase="second-open-task-separated-by-lead";
  const second=await tasks.create(a.id,other.leadId,{
   title:"Demo arrange second lead meeting",dueDate:"2027-01-10"});
  assert.equal((await tasks.list(a.id,lead.leadId)).length,1);
  assert.equal((await tasks.list(a.id,other.leadId)).length,1);
  phase="atomic-revision-checked-completion";
  view=await ctl.complete(a.id,lead.leadId,task.taskId);
  assert.equal(view.phase,"ready");assert.equal(view.tasks.length,1);
  assert.equal(view.tasks[0]?.status,"DONE");
  assert.equal(view.tasks[0]?.revision,1);
  assert.equal(view.tasks[0]?.updatedBy,"user_demo_alice");
  assert.ok(view.tasks[0]?.completedAt);
  phase="duplicate-and-wrong-lead-completion-rejected";
  await assert.rejects(tasks.complete(a.id,lead.leadId,task.taskId,0),fail(409));
  await assert.rejects(tasks.complete(a.id,other.leadId,task.taskId,0),fail(409));
  await assert.rejects(tasks.complete(a.id,lead.leadId,second.taskId,0),fail(409));
  await assert.rejects(tasks.create(a.id,lead.leadId,{
   title:"Demo invalid due date",dueDate:"2026-02-30"}),fail(400));
  phase="real-immutable-task-event-audit";
  const events=await pool.query("SELECT event_kind,revision FROM"+
   " p4_r64_ci.task_events WHERE org_id=$1 AND task_id=$2"+
   " ORDER BY revision",[a.id,task.taskId]);
  assert.deepEqual(events.rows,[{event_kind:"CREATED",revision:0},
   {event_kind:"COMPLETED",revision:1}]);
  const c=await pool.connect();
  try{
   await c.query("BEGIN");
   await assert.rejects(c.query("DELETE FROM p4_r64_ci.task_events"+
    " WHERE org_id=$1 AND task_id=$2",[a.id,task.taskId]));
   await c.query("ROLLBACK");
  }finally{c.release();}
  phase="member-wrong-tenant-and-forged-JWT-denials";
  await assert.rejects(member.list(a.id,lead.leadId),fail(403));
  await assert.rejects(tasks.list(b.id,lead.leadId),fail(409));
  const forged=new P4R64CiTaskClient(base,async()=>"a.b.c",fetch,process.env);
  await assert.rejects(forged.list(a.id,lead.leadId),fail(401));
  phase="revoked-owner-and-fail-close-task-list";
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[a.id]);
  try{
   assert.equal((await ctl.load(a.id,lead.leadId)).phase,"denied");
   assert.deepEqual(ctl.snapshot().tasks,[]);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[a.id]);
  }
  phase="safe-context-and-secret-projection";
  const serial=JSON.stringify(view);
  for(const privateText of [ownerJwt,bobJwt,"auth0|","postgresql://","token_hash"])
   assert.equal(serial.includes(privateText),false);
  const scope=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R64 signed real CRM follow-up due tasks, atomic one-use completion, immutable audit and tenant denial PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=false,canonical_email='alice@example.com'"+
   " WHERE user_id='user_demo_bob'");
  aes.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(e=>{
 const x=e as {name?:string;status?:number;code?:string};
 process.stderr.write("P4 R64 follow-up task smoke FAILED at "+phase+
  " type="+(x.name??"unknown")+" status="+(x.status??"none")+
  " code="+(x.code??"none")+"\n");process.exitCode=1;
});
