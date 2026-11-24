/** R61 real signed immutable fictional CRM notes, owner and cross-tenant checks. */
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
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R57CiCrmLeadClient}
 from "../frontend/src/lib/p4-r57-ci-crm-lead-client.js";
import {P4R61CiLeadNotesClient,P4R61CiNoteError}
 from "../frontend/src/lib/p4-r61-ci-lead-notes-client.js";
import {P4R61CiLeadNotesController}
 from "../frontend/src/lib/p4-r61-ci-lead-notes-controller.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r61",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer:new P4R32CiOutboxIssuer(pool,aes,process.env),
  acceptance:new P4R30CiAcceptanceService(pool,process.env),
  crmLeads:new P4R57CiCrmLeads(pool,process.env),
  crmLeadNotes:new P4R61CiLeadNotes(pool,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port+"/";
 const writer=new P4R57CiCrmLeadClient(base,async()=>ownerJwt,fetch,process.env);
 const owner=new P4R61CiLeadNotesClient(base,async()=>ownerJwt,fetch,process.env);
 const member=new P4R61CiLeadNotesClient(base,async()=>bobJwt,fetch,process.env);
 const controller=new P4R61CiLeadNotesController(owner);
 const denied=(status:number)=>(e:unknown)=>
  e instanceof P4R61CiNoteError&&e.status===status;
 try{
  phase="create-verified-fictional-tenant";
  const orgService=new P4R28CiOrganizationService(pool,process.env);
  const a=await orgService.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R61 Lead Notes",slug:"demo-r61-lead-notes",
  });
  const b=await orgService.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R61 Other",slug:"demo-r61-other",
  });
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES($1,'user_demo_bob','MEMBER',true)",
   [a.id]);
  const lead=await writer.create(a.id,{companyName:"Demo Notes Payments",
   contactEmail:"notes@example.com",source:"WEBSITE"});
  phase="signed-owner-add-immutable-follow-up-notes";
  assert.equal((await controller.load(a.id,lead.leadId)).notes.length,0);
  let v=await controller.add(a.id,lead.leadId,"Demo called for a follow up");
  assert.equal(v.phase,"ready");assert.equal(v.notes.length,1);
  v=await controller.add(a.id,lead.leadId,"Demo sent a meeting reminder");
  assert.equal(v.phase,"ready");assert.equal(v.notes.length,2);
  assert.equal(new Set(v.notes.map(n=>n.noteId)).size,2);
  assert.ok(v.notes.every(n=>n.leadId===lead.leadId&&
   n.actorUserId==="user_demo_alice"));
  phase="note-update-delete-rejected-by-Postgres-trigger";
  const c=await pool.connect();
  try{
   await c.query("BEGIN");
   await assert.rejects(c.query("DELETE FROM p4_r61_ci.lead_notes"+
    " WHERE org_id=$1 AND lead_id=$2",[a.id,lead.leadId]));
   await c.query("ROLLBACK");
   await c.query("BEGIN");
   await assert.rejects(c.query("UPDATE p4_r61_ci.lead_notes"+
    " SET note_text='Demo unauthorized modification'"+
    " WHERE org_id=$1 AND lead_id=$2",[a.id,lead.leadId]));
   await c.query("ROLLBACK");
  }finally{c.release();}
  assert.equal((await owner.list(a.id,lead.leadId)).length,2);
  phase="non-owner-and-other-tenant-denied";
  await assert.rejects(member.list(a.id,lead.leadId),denied(403));
  await assert.rejects(owner.list(b.id,lead.leadId),denied(409));
  await assert.rejects(owner.add(b.id,lead.leadId,"Demo fake other tenant"),
   denied(409));
  const forged=new P4R61CiLeadNotesClient(base,async()=>"a.b.c",fetch,process.env);
  await assert.rejects(forged.list(a.id,lead.leadId),denied(401));
  phase="real-email-pii-is-rejected";
  await assert.rejects(owner.add(a.id,lead.leadId,"real.customer@gmail.com"),
   denied(400));
  phase="revoked-owner-clears-note-view";
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[a.id]);
  try{
   assert.equal((await controller.load(a.id,lead.leadId)).phase,"denied");
   assert.deepEqual(controller.snapshot().notes,[]);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[a.id]);
  }
  phase="redacted-transactions";
  const serialized=JSON.stringify(v);
  for(const sensitive of [ownerJwt,bobJwt,"auth0|","token_hash","postgresql://"])
   assert.equal(serialized.includes(sensitive),false);
  const scope=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R61 signed real CRM immutable follow-up notes and cross-tenant owner denial PASS; NO_GO\n");
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
 process.stderr.write("P4 R61 CRM lead notes smoke FAILED at "+phase+
  " type="+(x.name??"unknown")+" status="+(x.status??"none")+
  " code="+(x.code??"none")+"\n");process.exitCode=1;
});
