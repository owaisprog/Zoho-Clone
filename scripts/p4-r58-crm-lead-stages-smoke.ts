/** R58 signed fictional CRM lead stage transitions and immutable SQL audit. */
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
import {P4R58CiCrmLeadStages}
 from "../backend/src/platform/p4-r58-ci-crm-lead-stages.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R57CiCrmLeadClient}
 from "../frontend/src/lib/p4-r57-ci-crm-lead-client.js";
import {P4R58CiLeadStageClient,P4R58CiLeadStageError}
 from "../frontend/src/lib/p4-r58-ci-crm-lead-stage-client.js";
import {P4R58CiLeadDetailController}
 from "../frontend/src/lib/p4-r58-ci-crm-lead-detail-controller.js";
let phase="start";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r58",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
  crmLeads:new P4R57CiCrmLeads(pool,process.env),
  crmLeadStages:new P4R58CiCrmLeadStages(pool,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port+"/";
 const leads=new P4R57CiCrmLeadClient(base,async()=>alice,fetch,process.env);
 const stages=new P4R58CiLeadStageClient(base,async()=>alice,fetch,process.env);
 const member=new P4R58CiLeadStageClient(base,async()=>bob,fetch,process.env);
 const detail=new P4R58CiLeadDetailController(leads,stages);
 try{
  phase="create-fictional-owner-and-member";
  const orgSvc=new P4R28CiOrganizationService(pool,process.env);
  const org=await orgSvc.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R58 Lead Stages",slug:"demo-r58-lead-stages",
  });
  const foreign=await orgSvc.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R58 Foreign",slug:"demo-r58-foreign",
  });
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES($1,'user_demo_bob','MEMBER',true)",
   [org.id]);
  phase="persist-new-lead";
  const created=await leads.create(org.id,{companyName:"Demo Lead Alpha",
   contactEmail:"leadalpha@example.com",source:"WEBSITE"});
  assert.equal(created.status,"NEW");assert.equal(created.revision,0);
  assert.equal((await detail.load(org.id,created.leadId)).history.length,1);
  phase="cas-stage-new-to-contacted";
  let v=await detail.change(org.id,"CONTACTED");
  assert.equal(v.phase,"ready");assert.equal(v.lead?.status,"CONTACTED");
  assert.equal(v.lead?.revision,1);
  phase="stale-revision-and-forbidden-skip";
  await assert.rejects(stages.change(org.id,created.leadId,"QUALIFIED",0),
   e=>e instanceof P4R58CiLeadStageError&&e.status===409);
  await assert.rejects(stages.change(org.id,created.leadId,"LOST",0),
   e=>e instanceof P4R58CiLeadStageError&&e.status===409);
  phase="cas-stage-contacted-to-qualified-terminal";
  v=await detail.change(org.id,"QUALIFIED");
  assert.equal(v.phase,"ready");assert.equal(v.lead?.status,"QUALIFIED");
  assert.equal(v.lead?.revision,2);
  assert.deepEqual(v.history.map(e=>e.afterStatus),
   ["NEW","CONTACTED","QUALIFIED"]);
  assert.deepEqual(v.history.map(e=>e.revision),[0,1,2]);
  await assert.rejects(stages.change(org.id,created.leadId,"LOST",2),
   e=>e instanceof P4R58CiLeadStageError&&e.status===409);
  phase="second-lead-contacted-to-lost-terminal";
  const lost=await leads.create(org.id,{companyName:"Demo Lead Lost",
   contactEmail:"leadlost@example.com",source:"EVENT"});
  assert.equal((await stages.change(org.id,lost.leadId,"CONTACTED",0)).revision,1);
  assert.equal((await stages.change(org.id,lost.leadId,"LOST",1)).status,"LOST");
  assert.deepEqual((await stages.history(org.id,lost.leadId)).map(x=>x.afterStatus),
   ["NEW","CONTACTED","LOST"]);
  phase="member-cross-tenant-and-forged-owner-denials";
  await assert.rejects(member.change(org.id,created.leadId,"CONTACTED",2),
   e=>e instanceof P4R58CiLeadStageError&&e.status===403);
  assert.deepEqual(await stages.history(foreign.id,created.leadId),[]);
  await assert.rejects(stages.change(foreign.id,created.leadId,"CONTACTED",2),
   e=>e instanceof P4R58CiLeadStageError&&e.status===409);
  const forged=new P4R58CiLeadStageClient(base,async()=>"a.b.c",fetch,process.env);
  await assert.rejects(forged.history(org.id,created.leadId),
   e=>e instanceof P4R58CiLeadStageError&&e.status===401);
  phase="SQL-audit-is-truly-immutable";
  const client=await pool.connect();
  try{
   await client.query("BEGIN");
   await assert.rejects(client.query("DELETE FROM p4_r57_ci.lead_events"+
    " WHERE org_id=$1 AND lead_id=$2",[org.id,created.leadId]));
   await client.query("ROLLBACK");
  }finally{client.release();}
  const events=await pool.query("SELECT count(*)::integer AS n"+
   " FROM p4_r57_ci.lead_events WHERE org_id=$1 AND lead_id=$2",
   [org.id,created.leadId]);
  assert.equal(events.rows[0]?.n,3);
  phase="owner-revoked-clears-detail";
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  try{
   assert.equal((await detail.load(org.id,created.leadId)).phase,"denied");
   assert.equal(detail.snapshot().lead,null);
   assert.deepEqual(detail.snapshot().history,[]);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  }
  phase="scope-redaction";
  const output=JSON.stringify(v);
  for(const secret of [alice,bob,"auth0|","postgresql://","token_hash"])
   assert.equal(output.includes(secret),false);
  const scope=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R58 signed CRM persisted NEW-CONTACTED-QUALIFIED/LOST, CAS conflict, immutable SQL history and tenant denial PASS; NO_GO\n");
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
 process.stderr.write("P4 R58 CRM lead status smoke FAILED at "+phase+
  " type="+(x.name??"unknown")+" status="+(x.status??"none")+
  " code="+(x.code??"none")+"\n");process.exitCode=1;
});
