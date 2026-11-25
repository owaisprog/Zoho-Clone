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
import {P4R74CiTeamReports} from "../backend/src/platform/p4-r74-ci-team-reports.js";
import {P4R74CiTeamReportsClient,P4R73CiWorkspaceError as TeamReportError} from "../frontend/src/lib/p4-r74-ci-team-reports-client.js";
import {P4R74TeamReportPanel} from "../frontend/src/components/p4-r74-ci-team-reports.js";
import {P4R76CiSharing} from "../backend/src/platform/p4-r76-ci-sharing.js";
import {P4R76CiSharingClient,SharingError} from "../frontend/src/lib/p4-r76-ci-sharing-client.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32),key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r76",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
  salesTeamReports:new P4R74CiTeamReports(pool,process.env),
  salesSharing:new P4R76CiSharing(pool,process.env),
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
 const reports=new P4R74CiTeamReportsClient(base,async()=>jwt("auth0|demo-manager"),fetch,process.env);
 const ownerReports=new P4R74CiTeamReportsClient(base,async()=>ownerJwt,fetch,process.env);
 const repReports=new P4R74CiTeamReportsClient(base,async()=>bobJwt,fetch,process.env);
 const sharing=new P4R76CiSharingClient(base,async()=>bobJwt,fetch,process.env);
 const eveSharing=new P4R76CiSharingClient(base,async()=>jwt("auth0|demo-eve"),fetch,process.env);
 const managerSharing=new P4R76CiSharingClient(base,async()=>jwt("auth0|demo-manager"),fetch,process.env);
 const ownerSharing=new P4R76CiSharingClient(base,async()=>ownerJwt,fetch,process.env);
 const deny=(status:number)=>(e:unknown)=>(e instanceof SalesAccountError||e instanceof SalesContactError||e instanceof SalesDealError||e instanceof SalesLeadError||e instanceof P4R73CiWorkspaceError||e instanceof TeamReportError||e instanceof SharingError)&&e.status===status;
 try{
  phase="setup explicit sales rep and entitlement";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const a=await orgs.create({userId:"user_demo_alice",verified:true},{name:"Demo R76 Primary",slug:"demo-r76-primary"});
  const b=await orgs.create({userId:"user_demo_alice",verified:true},{name:"Demo R76 Foreign",slug:"demo-r76-foreign"});
  await pool.query("UPDATE p4_synthetic.identity_subjects SET email_verified=true,canonical_email='bob@example.com' WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships(org_id,user_id,role,active) VALUES($1,'user_demo_bob','MEMBER',true),($2,'user_demo_bob','MEMBER',true)",[a.id,b.id]);
  await pool.query("INSERT INTO p4_r69_ci.crm_entitlements VALUES($1,true),($2,true)",[a.id,b.id]);
  await assert.rejects(accounts.page(a.id),deny(403));
  await assert.rejects(owner.page(a.id),deny(403));
  const existingEligible=(await workspace.list()).map(x=>x.id);
  assert.ok(!existingEligible.includes(a.id)&&!existingEligible.includes(b.id));
  await pool.query("INSERT INTO p4_r40_ci.sales_roles(org_id,user_id,role_code) VALUES($1,'user_demo_bob','SALES_REP'),($2,'user_demo_bob','SALES_REP')",[a.id,b.id]);
  phase="provision fictional pipeline fixtures";
  for(const org of [a,b]){
   const pipe=randomUUID();
   await pool.query("INSERT INTO p4_r71_ci.pipelines(org_id,id,code) VALUES($1,$2,'DEMO_SALES')",[org.id,pipe]);
   for(const stage of ["OPEN","DISCOVERY","PROPOSAL","NEGOTIATION","WON","LOST"]){
    await pool.query("INSERT INTO p4_r71_ci.stages(org_id,pipeline_id,id,code) VALUES($1,$2,$3,$4)",[org.id,pipe,randomUUID(),stage]);
   }
  }
  phase="explicit managed team fixtures";
  for(const user of ["manager","eve"]){
   await pool.query("INSERT INTO p4_synthetic.users(id) VALUES($1) ON CONFLICT DO NOTHING",["user_demo_"+user]);
   await pool.query("INSERT INTO p4_synthetic.identity_subjects(issuer,external_subject,user_id,canonical_email,email_verified) VALUES($1,$2,$3,$4,true) ON CONFLICT(issuer,external_subject) DO UPDATE SET email_verified=true",[CI_ISSUER,"auth0|demo-"+user,"user_demo_"+user,user+"@example.com"]);
   await pool.query("INSERT INTO p4_synthetic.memberships(org_id,user_id,role,active) VALUES($1,$2,'MEMBER',true)",[a.id,"user_demo_"+user]);
   await pool.query("INSERT INTO p4_r40_ci.sales_roles(org_id,user_id,role_code) VALUES($1,$2,$3)",[a.id,"user_demo_"+user,user==="manager"?"SALES_MANAGER":"SALES_REP"]);
  }
  await pool.query("INSERT INTO p4_synthetic.departments(org_id,id,name) VALUES($1,'dept_demo_sales','Demo Sales')",[a.id]);
  await pool.query("INSERT INTO p4_synthetic.teams(org_id,id,department_id,name,manager_user_id) VALUES($1,'team_demo_visible','dept_demo_sales','Demo Visible Team','user_demo_manager'),($1,'team_demo_private','dept_demo_sales','Demo Private Team','user_demo_alice')",[a.id]);
  for(const [team,user] of [["team_demo_visible","user_demo_manager"],["team_demo_visible","user_demo_bob"],["team_demo_visible","user_demo_eve"],["team_demo_private","user_demo_bob"]]){
   await pool.query("INSERT INTO p4_synthetic.team_memberships(org_id,team_id,user_id) VALUES($1,$2,$3)",[a.id,team,user]);
  }
  const eveAccounts=new P4R69CiAccountsClient(base,async()=>jwt("auth0|demo-eve"),fetch,process.env);
  const eveContacts=new P4R70CiContactsClient(base,async()=>jwt("auth0|demo-eve"),fetch,process.env);
  const eveDeals=new P4R71CiDealsClient(base,async()=>jwt("auth0|demo-eve"),fetch,process.env);
  const aa=await accounts.create(a.id,{name:"Demo Bob Reporting",websiteLabel:null});
  const ac=await contacts.create(a.id,{displayName:"Demo Bob Contact",email:"r76bob@example.com",accountId:aa.id});
  const ea=await eveAccounts.create(a.id,{name:"Demo Eve Reporting",websiteLabel:null});
  const ec=await eveContacts.create(a.id,{displayName:"Demo Eve Contact",email:"r76eve@example.com",accountId:ea.id});
  const visible=await deals.create(a.id,{title:"Demo Visible Deal",accountId:aa.id,contactId:ac.id});
  const hidden=await deals.create(a.id,{title:"Demo Private Deal",accountId:aa.id,contactId:ac.id});
  await deals.create(a.id,{title:"Demo Unassigned Deal",accountId:aa.id,contactId:ac.id});
  const eve=await eveDeals.create(a.id,{title:"Demo Eve Deal",accountId:ea.id,contactId:ec.id});
  await eveDeals.changeStage(a.id,eve.id,"DISCOVERY",0);
  for(const [id,team] of [[visible.id,"team_demo_visible"],[hidden.id,"team_demo_private"],[eve.id,"team_demo_visible"]]){
   await pool.query("INSERT INTO p4_r74_ci.deal_team_assignments(org_id,deal_id,team_id) VALUES($1,$2,$3)",[a.id,id,team]);
  }
  phase="real owner share and team reader";
  const lead=await leads.create(a.id,{companyName:"Demo Share Lead",contactName:"Demo Share Person",email:"r76lead@example.com"});
  const team="team_demo_visible";
  const newDeal=await deals.create(a.id,{title:"Demo Shared Via API",accountId:aa.id,contactId:ac.id});
  const records=[["LEAD",lead.id],["ACCOUNT",aa.id],["CONTACT",ac.id],["DEAL",newDeal.id]] as const;
  for(const [kind,id] of records){
   assert.equal(await sharing.get(a.id,kind,id),null);
   const v=await sharing.set(a.id,kind,id,{teamId:team,active:true,expectedRevision:null});
   assert.deepEqual(v,{teamId:team,active:true,revision:0});
   assert.equal((await eveSharing.shared(a.id,team,kind)).items.some(x=>x.id===id),true);
   assert.equal((await managerSharing.shared(a.id,team,kind)).items.some(x=>x.id===id),true);
   await assert.rejects(eveSharing.set(a.id,kind,id,{teamId:team,active:false,expectedRevision:0}),deny(403));
   await assert.rejects(sharing.set(a.id,kind,id,{teamId:team,active:false,expectedRevision:null}),deny(409));
  }
  await assert.rejects(ownerSharing.shared(a.id,team,"DEAL"),deny(403));
  await assert.rejects(eveSharing.shared(a.id,"team_demo_private","DEAL"),deny(403));
  await assert.rejects(sharing.get(b.id,"DEAL",newDeal.id),deny(403));
  assert.equal((await managerSharing.shared(a.id,team,"DEAL")).items.some(x=>x.id===hidden.id),false);
  phase="report uses same assignment, revoke and membership scope";
  const from=new Date(Date.now()-86400000).toISOString().slice(0,10),to=new Date(Date.now()+86400000).toISOString().slice(0,10);
  assert.equal((await reports.report(a.id,{team,owner:"user_demo_bob",stage:"",from,to})).total,2);
  const revoked=await sharing.set(a.id,"DEAL",newDeal.id,{teamId:team,active:false,expectedRevision:0});
  assert.equal(revoked.revision,1);assert.equal(revoked.active,false);
  assert.equal((await eveSharing.shared(a.id,team,"DEAL")).items.some(x=>x.id===newDeal.id),false);
  assert.equal((await reports.report(a.id,{team,owner:"user_demo_bob",stage:"",from,to})).total,1);
  await pool.query("UPDATE p4_synthetic.team_memberships SET active=false WHERE org_id=$1 AND team_id=$2 AND user_id='user_demo_eve'",[a.id,team]);
  await assert.rejects(eveSharing.shared(a.id,team,"LEAD"),deny(403));
  const audit=await pool.query("SELECT revision,active FROM p4_r76_ci.share_events WHERE org_id=$1 AND kind='DEAL' AND record_id=$2 ORDER BY revision",[a.id,newDeal.id]);
  assert.deepEqual(audit.rows,[{revision:0,active:true},{revision:1,active:false}]);
  process.stdout.write("R76 four record kinds explicit share/read/revoke, same report scope, stale and unauthorized denial PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects SET email_verified=false,canonical_email='alice@example.com' WHERE user_id='user_demo_bob'");
  aes.fill(0);key.fill(0);await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await pool.end();
 }
}
main().catch(e=>{process.stderr.write("R76 sharing smoke failed at "+phase+" "+String(e?.name)+" status="+String(e?.status??"none")+"\n");process.exitCode=1;});
