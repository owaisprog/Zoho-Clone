/** R63 real signed owner 25 fictional immutable notes paged 20+5. */
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
import {P4R61CiLeadNotes}
 from "../backend/src/platform/p4-r61-ci-lead-notes.js";
import {P4R63CiNotePager}
 from "../backend/src/platform/p4-r63-ci-note-pager.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R57CiCrmLeadClient}
 from "../frontend/src/lib/p4-r57-ci-crm-lead-client.js";
import {P4R61CiLeadNotesClient,P4R61CiNoteError}
 from "../frontend/src/lib/p4-r61-ci-lead-notes-client.js";
import {P4R63CiNotePageClient,P4R63CiPageError}
 from "../frontend/src/lib/p4-r63-ci-note-page-client.js";
import {P4R63CiNotePageController}
 from "../frontend/src/lib/p4-r63-ci-note-page-controller.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32),key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r63",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
  crmLeadNotes:new P4R61CiLeadNotes(pool,process.env),
  crmNotePages:new P4R63CiNotePager(pool,key,process.env,()=>clock),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port+"/";
 const leads=new P4R57CiCrmLeadClient(base,async()=>ownerJwt,fetch,process.env);
 const writer=new P4R61CiLeadNotesClient(base,async()=>ownerJwt,fetch,process.env);
 const pages=new P4R63CiNotePageClient(base,async()=>ownerJwt,fetch,process.env);
 const member=new P4R63CiNotePageClient(base,async()=>bobJwt,fetch,process.env);
 const controller=new P4R63CiNotePageController(pages);
 const denied=(status:number)=>(e:unknown)=>
  e instanceof P4R63CiPageError&&e.status===status;
 try{
  phase="owner-and-member-fixtures";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const org=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R63 Notes Page",slug:"demo-r63-notes-page",
  });
  const other=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R63 Notes Other",slug:"demo-r63-notes-other",
  });
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES($1,'user_demo_bob','MEMBER',true)",
   [org.id]);
  const lead=await leads.create(org.id,{companyName:"Demo Notes Pager",
   contactEmail:"notepager@example.com",source:"WEBSITE"});
  const another=await leads.create(org.id,{companyName:"Demo Other Lead",
   contactEmail:"otherlead@example.com",source:"EVENT"});
  phase="write-25-persisted-immutable-notes";
  for(let i=0;i<25;i++){
   const saved=await writer.add(org.id,lead.leadId,
    "Demo follow up number "+i+" for owner");
   assert.equal(saved.leadId,lead.leadId);
  }
  phase="old-unpaged-note-reader-fails-closed";
  await assert.rejects(writer.list(org.id,lead.leadId),
   e=>e instanceof P4R61CiNoteError&&e.status===503);
  phase="owner-reads-20-plus-five-no-truncation";
  let view=await controller.refresh(org.id,lead.leadId);
  assert.equal(view.phase,"ready");
  assert.equal(view.notes.length,20);
  assert.ok(view.nextCursor);
  const cursor=view.nextCursor!;
  view=await controller.more();
  assert.equal(view.phase,"ready");assert.equal(view.notes.length,25);
  assert.equal(view.nextCursor,null);
  assert.equal(new Set(view.notes.map(x=>x.noteId)).size,25);
  phase="cursor-HMAC-lead-and-org-binding";
  await assert.rejects(pages.page(org.id,another.leadId,cursor),denied(400));
  await assert.rejects(pages.page(other.id,lead.leadId,cursor),denied(400));
  const bad=cursor.slice(0,-1)+(cursor.endsWith("a")?"b":"a");
  await assert.rejects(pages.page(org.id,lead.leadId,bad),denied(400));
  clock+=11*60*1000;
  await assert.rejects(pages.page(org.id,lead.leadId,cursor),denied(400));
  clock-=11*60*1000;
  phase="member-forgery-and-revoked-owner-clearing";
  await assert.rejects(member.page(org.id,lead.leadId),denied(403));
  const fake=new P4R63CiNotePageClient(base,async()=>"abc.def.ghi",
   fetch,process.env);
  await assert.rejects(fake.page(org.id,lead.leadId),denied(401));
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  try{
   assert.equal((await controller.refresh(org.id,lead.leadId)).phase,"denied");
   assert.deepEqual(controller.snapshot().notes,[]);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  }
  phase="no-server-context-leak";
  const check=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(check.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R63 real signed 25 immutable CRM notes 20+5 HMAC pagination and tenant owner denial PASS; NO_GO\n");
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
 process.stderr.write("P4 R63 note page smoke FAILED at "+phase+
  " type="+(x.name??"unknown")+" status="+(x.status??"none")+
  " code="+(x.code??"none")+"\n");process.exitCode=1;
});
