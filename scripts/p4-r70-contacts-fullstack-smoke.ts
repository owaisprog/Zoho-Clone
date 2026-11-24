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
import {P4R69CiAccounts} from "../backend/src/platform/p4-r69-ci-accounts.js";
import {P4R69CiAccountsClient,SalesAccountError} from "../frontend/src/lib/p4-r69-ci-accounts-client.js";
import {P4R70CiContacts} from "../backend/src/platform/p4-r70-ci-contacts.js";
import {P4R70CiContactsClient,SalesContactError} from "../frontend/src/lib/p4-r70-ci-contacts-client.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32),key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r70",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
  salesAccounts:new P4R69CiAccounts(pool,process.env),
  salesContacts:new P4R70CiContacts(pool,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port+"/";

 const accounts=new P4R69CiAccountsClient(base,async()=>bobJwt,fetch,process.env);
 const owner=new P4R69CiAccountsClient(base,async()=>ownerJwt,fetch,process.env);
 const contacts=new P4R70CiContactsClient(base,async()=>bobJwt,fetch,process.env);
 const ownerContacts=new P4R70CiContactsClient(base,async()=>ownerJwt,fetch,process.env);
 const deny=(status:number)=>(e:unknown)=>(e instanceof SalesAccountError||e instanceof SalesContactError)&&e.status===status;
 try{
  phase="setup explicit sales rep and entitlement";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const a=await orgs.create({userId:"user_demo_alice",verified:true},{name:"Demo R70 Primary",slug:"demo-r70-primary"});
  const b=await orgs.create({userId:"user_demo_alice",verified:true},{name:"Demo R70 Foreign",slug:"demo-r70-foreign"});
  await pool.query("UPDATE p4_synthetic.identity_subjects SET email_verified=true,canonical_email='bob@example.com' WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships(org_id,user_id,role,active) VALUES($1,'user_demo_bob','MEMBER',true),($2,'user_demo_bob','MEMBER',true)",[a.id,b.id]);
  await pool.query("INSERT INTO p4_r69_ci.crm_entitlements VALUES($1,true),($2,true)",[a.id,b.id]);
  await assert.rejects(accounts.page(a.id),deny(403));
  await assert.rejects(owner.page(a.id),deny(403));
  await pool.query("INSERT INTO p4_r40_ci.sales_roles(org_id,user_id,role_code) VALUES($1,'user_demo_bob','SALES_REP'),($2,'user_demo_bob','SALES_REP')",[a.id,b.id]);
  phase="same-org account association and revision";
  const a1=await accounts.create(a.id,{name:"Demo Alpha Contact Account",websiteLabel:null});
  const b1=await accounts.create(b.id,{name:"Demo Foreign Contact Account",websiteLabel:null});
  await assert.rejects(ownerContacts.page(a.id),deny(403));
  const first=await contacts.create(a.id,{displayName:"Demo Alice Contact",email:"r70alice@example.com",accountId:a1.id});
  assert.equal(first.accountId,a1.id);assert.equal(first.revision,0);
  await assert.rejects(contacts.create(a.id,{displayName:"Demo Foreign Contact",email:"r70foreign@example.com",accountId:b1.id}),deny(409));
  await assert.rejects(contacts.update(a.id,first.id,{displayName:first.displayName,email:first.email,accountId:b1.id},0),deny(409));
  const updated=await contacts.update(a.id,first.id,{displayName:"Demo Alice Revised",email:first.email,accountId:null},0);
  assert.equal(updated.revision,1);assert.equal(updated.accountId,null);
  await assert.rejects(contacts.update(a.id,first.id,{displayName:first.displayName,email:first.email,accountId:a1.id},0),deny(409));
  await assert.rejects(contacts.create(a.id,{displayName:"Demo Duplicate Contact",email:first.email,accountId:null}),deny(409));
  await assert.rejects(contacts.create(a.id,{displayName:"Demo Invalid Contact",email:"contact@invalid.net",accountId:null}),deny(400));
  phase="25 contacts and no foreign scope";
  for(let i=0;i<24;i++)await contacts.create(a.id,{displayName:"Demo Contact "+i,email:"r70person"+i+"@example.com",accountId:a1.id});
  const p=await contacts.page(a.id);assert.equal(p.items.length,20);assert.ok(p.nextCursor);
  const q=await contacts.page(a.id,p.nextCursor);assert.equal(q.items.length,5);assert.equal(q.nextCursor,null);
  assert.equal(new Set([...p.items,...q.items].map(x=>x.id)).size,25);
  assert.equal((await contacts.page(b.id)).items.length,0);
  await contacts.create(b.id,{displayName:"Demo Other Contact",email:first.email,accountId:b1.id});
  assert.equal((await contacts.page(b.id)).items.length,1);
  const audit=await pool.query("SELECT revision,action FROM p4_r70_ci.contact_events WHERE org_id=$1 AND contact_id=$2 ORDER BY revision",[a.id,first.id]);
  assert.deepEqual(audit.rows,[{revision:0,action:"CREATED"},{revision:1,action:"UPDATED"}]);
  phase="revoke explicit sales role";
  await pool.query("DELETE FROM p4_r40_ci.sales_roles WHERE org_id=$1 AND user_id='user_demo_bob'",[a.id]);
  await assert.rejects(contacts.page(a.id),deny(403));
  assert.equal((await contacts.page(b.id)).items.length,1);
  process.stdout.write("R70 signed Contact create/update, same-org association, duplicate conflict, 25 paged contacts and sales role denial PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects SET email_verified=false,canonical_email='alice@example.com' WHERE user_id='user_demo_bob'");
  aes.fill(0);key.fill(0);await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await pool.end();
 }
}
main().catch(e=>{process.stderr.write("R70 contacts smoke failed at "+phase+" "+String(e?.name)+" status="+String(e?.status??"none")+"\n");process.exitCode=1;});
