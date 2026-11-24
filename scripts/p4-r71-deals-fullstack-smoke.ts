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
import {randomUUID} from "node:crypto";
import {P4R71CiDeals} from "../backend/src/platform/p4-r71-ci-deals.js";
import {P4R71CiDealsClient,SalesDealError} from "../frontend/src/lib/p4-r71-ci-deals-client.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32),key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r71",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
  salesDeals:new P4R71CiDeals(pool,process.env),
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
 const deals=new P4R71CiDealsClient(base,async()=>bobJwt,fetch,process.env);
 const ownerDeals=new P4R71CiDealsClient(base,async()=>ownerJwt,fetch,process.env);
 const deny=(status:number)=>(e:unknown)=>(e instanceof SalesAccountError||e instanceof SalesContactError||e instanceof SalesDealError)&&e.status===status;
 try{
  phase="setup explicit sales rep and entitlement";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const a=await orgs.create({userId:"user_demo_alice",verified:true},{name:"Demo R71 Primary",slug:"demo-r71-primary"});
  const b=await orgs.create({userId:"user_demo_alice",verified:true},{name:"Demo R71 Foreign",slug:"demo-r71-foreign"});
  await pool.query("UPDATE p4_synthetic.identity_subjects SET email_verified=true,canonical_email='bob@example.com' WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships(org_id,user_id,role,active) VALUES($1,'user_demo_bob','MEMBER',true),($2,'user_demo_bob','MEMBER',true)",[a.id,b.id]);
  await pool.query("INSERT INTO p4_r69_ci.crm_entitlements VALUES($1,true),($2,true)",[a.id,b.id]);
  await assert.rejects(accounts.page(a.id),deny(403));
  await assert.rejects(owner.page(a.id),deny(403));
  await pool.query("INSERT INTO p4_r40_ci.sales_roles(org_id,user_id,role_code) VALUES($1,'user_demo_bob','SALES_REP'),($2,'user_demo_bob','SALES_REP')",[a.id,b.id]);
  phase="provision fictional pipeline fixtures";
  for(const org of [a,b]){
   const pipe=randomUUID();
   await pool.query("INSERT INTO p4_r71_ci.pipelines(org_id,id,code) VALUES($1,$2,'DEMO_SALES')",[org.id,pipe]);
   for(const stage of ["OPEN","DISCOVERY","PROPOSAL","NEGOTIATION","WON","LOST"]){
    await pool.query("INSERT INTO p4_r71_ci.stages(org_id,pipeline_id,id,code) VALUES($1,$2,$3,$4)",[org.id,pipe,randomUUID(),stage]);
   }
  }
  phase="create same-org Account and Contact";
  const a1=await accounts.create(a.id,{name:"Demo Alpha Deal Account",websiteLabel:null});
  const a2=await accounts.create(a.id,{name:"Demo Alternate Deal Account",websiteLabel:null});
  const b1=await accounts.create(b.id,{name:"Demo Foreign Deal Account",websiteLabel:null});
  const ca=await contacts.create(a.id,{displayName:"Demo Alpha Deal Contact",email:"r71alpha@example.com",accountId:a1.id});
  const cb=await contacts.create(b.id,{displayName:"Demo Foreign Deal Contact",email:"r71foreign@example.com",accountId:b1.id});
  const input={title:"Demo Alpha Opportunity",accountId:a1.id,contactId:ca.id};
  await assert.rejects(ownerDeals.page(a.id),deny(403));
  await assert.rejects(deals.create(a.id,{...input,accountId:b1.id,contactId:cb.id}),deny(409));
  await assert.rejects(deals.create(a.id,{...input,accountId:a2.id}),deny(409));
  await assert.rejects(deals.create(a.id,{...input,contactId:cb.id}),deny(409));
  const d=await deals.create(a.id,input);assert.equal(d.stage,"OPEN");assert.equal(d.revision,0);
  phase="atomic allowed stages and immutable history";
  await assert.rejects(deals.changeStage(a.id,d.id,"WON",0),deny(409));
  await assert.rejects(deals.changeStage(b.id,d.id,"DISCOVERY",0),deny(409));
  let current=await deals.changeStage(a.id,d.id,"DISCOVERY",0);
  assert.equal(current.stage,"DISCOVERY");assert.equal(current.revision,1);
  await assert.rejects(deals.changeStage(a.id,d.id,"PROPOSAL",0),deny(409));
  current=await deals.changeStage(a.id,d.id,"PROPOSAL",1);
  current=await deals.changeStage(a.id,d.id,"NEGOTIATION",2);
  current=await deals.changeStage(a.id,d.id,"WON",3);
  assert.equal(current.stage,"WON");assert.equal(current.revision,4);
  await assert.rejects(deals.changeStage(a.id,d.id,"LOST",4),deny(409));
  const audit=await pool.query("SELECT revision,before_stage,after_stage FROM p4_r71_ci.deal_events WHERE org_id=$1 AND deal_id=$2 ORDER BY revision",[a.id,d.id]);
  assert.deepEqual(audit.rows,[{revision:0,before_stage:null,after_stage:"OPEN"},{revision:1,before_stage:"OPEN",after_stage:"DISCOVERY"},{revision:2,before_stage:"DISCOVERY",after_stage:"PROPOSAL"},{revision:3,before_stage:"PROPOSAL",after_stage:"NEGOTIATION"},{revision:4,before_stage:"NEGOTIATION",after_stage:"WON"}]);
  phase="25 paged deals and separate organization";
  for(let i=0;i<24;i++)await deals.create(a.id,{...input,title:"Demo Opportunity "+i});
  const p=await deals.page(a.id);assert.equal(p.items.length,20);assert.ok(p.nextCursor);
  const q=await deals.page(a.id,p.nextCursor);assert.equal(q.items.length,5);assert.equal(q.nextCursor,null);
  assert.equal(new Set([...p.items,...q.items].map(x=>x.id)).size,25);
  assert.equal((await deals.page(b.id)).items.length,0);
  const lost=await deals.create(b.id,{title:"Demo Other Opportunity",accountId:b1.id,contactId:cb.id});
  assert.equal((await deals.changeStage(b.id,lost.id,"LOST",0)).stage,"LOST");
  await pool.query("UPDATE p4_r69_ci.crm_entitlements SET active=false WHERE org_id=$1",[a.id]);
  await assert.rejects(deals.page(a.id),deny(403));
  assert.equal((await deals.page(b.id)).items.length,1);
  process.stdout.write("R71 signed Deals create, same-account Contact, 25 pages, CAS stage transitions and history PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects SET email_verified=false,canonical_email='alice@example.com' WHERE user_id='user_demo_bob'");
  aes.fill(0);key.fill(0);await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await pool.end();
 }
}
main().catch(e=>{process.stderr.write("R71 deals smoke failed at "+phase+" "+String(e?.name)+" status="+String(e?.status??"none")+"\n");process.exitCode=1;});
