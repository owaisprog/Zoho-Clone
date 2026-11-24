/** R66 signed 25 persisted fictional tasks through real localhost HTTP/PG. */
import assert from "node:assert/strict";
import {generateKeyPairSync,randomBytes,sign} from "node:crypto";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import express from "express";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "../backend/src/platform/p4-v1-ci-prisma.js";
import {P4R28CiOrganizationService} from "../backend/src/platform/p4-r28-ci-org-service.js";
import {P4R32CiOutboxIssuer} from "../backend/src/platform/p4-r32-ci-outbox.js";
import {P4R30CiAcceptanceService} from "../backend/src/platform/p4-r30-ci-invitation-acceptance.js";
import {P4R57CiCrmLeads} from "../backend/src/platform/p4-r57-ci-crm-leads.js";
import {P4R64CiLeadTasks} from "../backend/src/platform/p4-r64-ci-lead-tasks.js";
import {P4R66CiTaskPager} from "../backend/src/platform/p4-r66-ci-task-pager.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R57CiCrmLeadClient} from "../frontend/src/lib/p4-r57-ci-crm-lead-client.js";
import {P4R64CiTaskClient,P4R64CiTaskError}
 from "../frontend/src/lib/p4-r64-ci-task-client.js";
import {P4R66CiTaskPageClient,P4R66CiPageError}
 from "../frontend/src/lib/p4-r66-ci-task-page-client.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32),key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r66",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const now=Math.floor(Date.now()/1000);let clock=Date.now();
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
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer:new P4R32CiOutboxIssuer(pool,aes,process.env),
  acceptance:new P4R30CiAcceptanceService(pool,process.env),
  crmLeads:new P4R57CiCrmLeads(pool,process.env),
  crmLeadTasks:new P4R64CiLeadTasks(pool,process.env),
  crmTaskPages:new P4R66CiTaskPager(pool,key,process.env,()=>clock),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port+"/";
 const leads=new P4R57CiCrmLeadClient(base,async()=>ownerJwt,fetch,process.env);
 const writer=new P4R64CiTaskClient(base,async()=>ownerJwt,fetch,process.env);
 const pages=new P4R66CiTaskPageClient(base,async()=>ownerJwt,fetch,process.env);
 const member=new P4R66CiTaskPageClient(base,async()=>bobJwt,fetch,process.env);
 const denied=(status:number)=>(e:unknown)=>
  e instanceof P4R66CiPageError&&e.status===status;
 try{
  phase="synthetic-org-fixtures";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const a=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R66 Task Pager",slug:"demo-r66-task-pager"});
  const b=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R66 Task Foreign",slug:"demo-r66-task-foreign"});
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES($1,'user_demo_bob','MEMBER',true)",
   [a.id]);
  const lead=await leads.create(a.id,{companyName:"Demo R66 Primary",
   contactEmail:"taskpager@example.com",source:"WEBSITE"});
  const other=await leads.create(a.id,{companyName:"Demo R66 Secondary",
   contactEmail:"taskother@example.com",source:"EVENT"});
  phase="write-25-tasks";
  for(let i=0;i<25;i++){
   const saved=await writer.create(a.id,lead.leadId,{
    title:"Demo schedule outreach task number "+i,dueDate:"2026-12-15"});
   assert.equal(saved.leadId,lead.leadId);
  }
  phase="old-limited-list-denies-overflow";
  await assert.rejects(writer.list(a.id,lead.leadId),
   e=>e instanceof P4R64CiTaskError&&e.status===503);
  phase="page-20-plus-5";
  const first=await pages.page(a.id,lead.leadId);
  assert.equal(first.items.length,20);assert.ok(first.nextCursor);
  const next=await pages.page(a.id,lead.leadId,first.nextCursor);
  assert.equal(next.items.length,5);assert.equal(next.nextCursor,null);
  const all=[...first.items,...next.items];
  assert.equal(new Set(all.map(x=>x.taskId)).size,25);
  assert.ok(all.every(x=>x.status==="OPEN"&&x.leadId===lead.leadId));
  phase="cursor-hmac-tenant-lead-binding-and-expiry";
  await assert.rejects(pages.page(a.id,other.leadId,first.nextCursor),denied(400));
  await assert.rejects(pages.page(b.id,lead.leadId,first.nextCursor),denied(400));
  const cursor=first.nextCursor!;
  const altered=cursor.slice(0,-1)+(cursor.endsWith("a")?"b":"a");
  await assert.rejects(pages.page(a.id,lead.leadId,altered),denied(400));
  clock+=11*60*1000;
  await assert.rejects(pages.page(a.id,lead.leadId,cursor),denied(400));
  clock-=11*60*1000;
  phase="member-and-revoked-owner";
  await assert.rejects(member.page(a.id,lead.leadId),denied(403));
  const forged=new P4R66CiTaskPageClient(base,async()=>"a.b.c",
   fetch,process.env);
  await assert.rejects(forged.page(a.id,lead.leadId),denied(401));
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[a.id]);
  try{
   await assert.rejects(pages.page(a.id,lead.leadId),denied(403));
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[a.id]);
  }
  phase="role-and-tenant-context-reset";
  const scope=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R66 signed real 25 tasks 20+5; scoped HMAC, revocation and tenant isolation PASS; NO_GO\n");
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
 process.stderr.write("P4 R66 task pager FAILED at "+phase+
  " type="+(x.name??"unknown")+" status="+(x.status??"none")+
  " code="+(x.code??"none")+"\n");process.exitCode=1;
});
