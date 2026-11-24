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
import {P4R72CiSalesLeads} from "../backend/src/platform/p4-r72-ci-sales-leads.js";
import {P4R72CiSalesLeadsClient,SalesLeadError} from "../frontend/src/lib/p4-r72-ci-sales-leads-client.js";
import {P4R73CiSalesWorkspace} from "../backend/src/platform/p4-r73-ci-sales-workspace.js";
import {P4R73CiSalesWorkspaceClient,P4R73CiWorkspaceError} from "../frontend/src/lib/p4-r73-ci-sales-workspace-client.js";
import {P4R73WorkspaceController} from "../frontend/src/lib/p4-r73-ci-sales-workspace-controller.js";
import {P4R73WorkspacePanel} from "../frontend/src/components/p4-r73-ci-sales-workspace.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32),key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r73",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
  salesLeads:new P4R72CiSalesLeads(pool,process.env),
  salesWorkspace:new P4R73CiSalesWorkspace(pool,process.env),
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
 const leads=new P4R72CiSalesLeadsClient(base,async()=>bobJwt,fetch,process.env);
 const ownerLeads=new P4R72CiSalesLeadsClient(base,async()=>ownerJwt,fetch,process.env);
 const workspace=new P4R73CiSalesWorkspaceClient(base,async()=>bobJwt,fetch,process.env);
 const ownerWorkspace=new P4R73CiSalesWorkspaceClient(base,async()=>ownerJwt,fetch,process.env);
 const ctl=new P4R73WorkspaceController(workspace);
 const deny=(status:number)=>(e:unknown)=>(e instanceof SalesAccountError||e instanceof SalesContactError||e instanceof SalesDealError||e instanceof SalesLeadError||e instanceof P4R73CiWorkspaceError)&&e.status===status;
 try{
  phase="setup explicit sales rep and entitlement";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const a=await orgs.create({userId:"user_demo_alice",verified:true},{name:"Demo R73 Primary",slug:"demo-r73-primary"});
  const b=await orgs.create({userId:"user_demo_alice",verified:true},{name:"Demo R73 Foreign",slug:"demo-r73-foreign"});
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
  phase="workspace discovery and scope";
  assert.deepEqual(new Set((await workspace.list()).map(x=>x.id)),new Set([a.id,b.id]));
  assert.deepEqual(await ownerWorkspace.list(),[]);
  await assert.rejects(ownerWorkspace.overview(a.id),deny(403));
  const lead=await leads.create(a.id,{companyName:"Demo Workspace Company",contactName:"Demo Workspace Contact",email:"r73contact@example.com"});
  await leads.changeStage(a.id,lead.id,"CONTACTED",0);await leads.changeStage(a.id,lead.id,"QUALIFIED",1);
  let v=await ctl.select(a.id);
  assert.equal(v.phase,"ready");assert.equal(v.overview?.qualified,1);
  const conversion=await leads.convert(a.id,lead.id,"Demo Workspace Deal",2);
  assert.ok(conversion.dealId);
  v=await ctl.navigate("Deals");
  assert.equal(v.phase,"ready");assert.equal(v.tab,"Deals");
  assert.deepEqual(v.overview,{leads:1,qualified:0,converted:1,accounts:1,contacts:1,deals:1,openDeals:1,wonDeals:0,lostDeals:0});
  assert.equal((await deals.page(a.id)).items[0]?.id,conversion.dealId);
  phase="React integrated module navigation";
  const clients={leads,accounts,contacts,deals},noop=()=>{};
  const html=renderToStaticMarkup(createElement(P4R73WorkspacePanel,{view:v,clients,onOrg:noop,onTab:noop,onReload:noop}));
  for(const label of ["Sales CRM workspace","CRM modules","Overview","Leads","Accounts","Contacts","Deals","CRM Deals"])assert.ok(html.includes(label),label);
  for(const secret of [bobJwt,ownerJwt,"auth0|","postgresql://"])assert.equal(html.includes(secret),false);
  for(const tab of ["Leads","Accounts","Contacts","Overview"] as const){v=await ctl.navigate(tab);assert.equal(v.tab,tab);assert.equal(v.phase,"ready");}
  phase="fresh switch and revoked entitlement";
  v=await ctl.select(b.id);
  assert.equal(v.orgId,b.id);assert.equal(v.overview?.leads,0);assert.equal(v.overview?.deals,0);
  await pool.query("UPDATE p4_r69_ci.crm_entitlements SET active=false WHERE org_id=$1",[a.id]);
  assert.deepEqual((await workspace.list()).map(x=>x.id),[b.id]);
  v=await ctl.select(a.id);assert.equal(v.phase,"denied");assert.equal(v.orgId,null);assert.equal(v.overview,null);
  await assert.rejects(workspace.overview(a.id),deny(403));
  process.stdout.write("R73 workspace discovery, own counts, conversion navigation, fresh tenant selection and entitlement revocation PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects SET email_verified=false,canonical_email='alice@example.com' WHERE user_id='user_demo_bob'");
  aes.fill(0);key.fill(0);await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await pool.end();
 }
}
main().catch(e=>{process.stderr.write("R73 sales workspace smoke failed at "+phase+" "+String(e?.name)+" status="+String(e?.status??"none")+"\n");process.exitCode=1;});
