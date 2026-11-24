/** R57 signed owner creates persisted fictional CRM leads in real disposable PG. */
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
import {P4R32CiOutboxIssuer} from "../backend/src/platform/p4-r32-ci-outbox.js";
import {P4R30CiAcceptanceService}
 from "../backend/src/platform/p4-r30-ci-invitation-acceptance.js";
import {P4R57CiCrmLeads} from "../backend/src/platform/p4-r57-ci-crm-leads.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R57CiCrmLeadClient,P4R57CiCrmError}
 from "../frontend/src/lib/p4-r57-ci-crm-lead-client.js";
import {P4R57CiCrmLeadController}
 from "../frontend/src/lib/p4-r57-ci-crm-lead-controller.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:6});
 const aes=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r57",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port+"/";
 const owner=new P4R57CiCrmLeadClient(base,async()=>alice,fetch,process.env);
 const nonOwner=new P4R57CiCrmLeadClient(base,async()=>bob,fetch,process.env);
 const ctl=new P4R57CiCrmLeadController(owner);
 try{
  phase="create-fake-owner-and-second-tenant";
  const orgService=new P4R28CiOrganizationService(pool,process.env);
  const a=await orgService.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R57 Alpha Leads",slug:"demo-r57-alpha",
  });
  const b=await orgService.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R57 Beta Leads",slug:"demo-r57-beta",
  });
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES($1,'user_demo_bob','MEMBER',true)",
   [a.id]);
  phase="signed-owner-create-and-transactional-readback";
  assert.equal((await ctl.refresh(a.id)).leads.length,0);
  const create={companyName:"Demo Alpha Payments",
   contactEmail:"alpha@example.com",source:"WEBSITE" as const};
  const after=await ctl.create(a.id,create);
  assert.equal(after.phase,"ready");assert.equal(after.leads.length,1);
  assert.deepEqual({...after.leads[0],leadId:undefined,createdAt:undefined},
   {...create,status:"NEW",revision:0,leadId:undefined,createdAt:undefined});
  assert.equal((await owner.list(b.id)).length,0);
  phase="immutable-create-event";
  const audit=await pool.query("SELECT event_kind,before_status,after_status,"+
   " revision FROM p4_r57_ci.lead_events WHERE org_id=$1",[a.id]);
  assert.deepEqual(audit.rows,[{event_kind:"CREATED",before_status:null,
   after_status:"NEW",revision:0}]);
  phase="duplicate-and-invalid-real-email-rejected";
  await assert.rejects(owner.create(a.id,create),
   e=>e instanceof P4R57CiCrmError&&e.status===409);
  await assert.rejects(owner.create(a.id,{
   ...create,contactEmail:"real@merchant.com",
  }),e=>e instanceof P4R57CiCrmError&&e.status===400);
  phase="verified-member-and-forged-JWT-denied";
  await assert.rejects(nonOwner.list(a.id),
   e=>e instanceof P4R57CiCrmError&&e.status===403);
  const forged=new P4R57CiCrmLeadClient(base,async()=>"a.b.c",fetch,process.env);
  await assert.rejects(forged.list(a.id),
   e=>e instanceof P4R57CiCrmError&&e.status===401);
  phase="owner-revocation-clears-all-local-CRM";
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[a.id]);
  try{
   const denied=await ctl.refresh(a.id);
   assert.equal(denied.phase,"denied");assert.deepEqual(denied.leads,[]);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[a.id]);
  }
  phase="redacted-scope-and-runtime-grants";
  const data=JSON.stringify(after);
  for(const secret of [alice,bob,"auth0|","token_hash","postgresql://"])
   assert.equal(data.includes(secret),false);
  const scope=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R57 signed real CRM lead PostgreSQL create/list, immutable audit, duplicate/tenant/owner denial and safe frontend PASS; NO_GO\n");
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
 process.stderr.write("P4 R57 CRM persisted lead smoke FAILED at "+phase+
  " type="+(x.name??"unknown")+" status="+(x.status??"none")+
  " code="+(x.code??"none")+"\n");process.exitCode=1;
});
