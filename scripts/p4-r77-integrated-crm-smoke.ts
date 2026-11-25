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
import {P4R75CiSalesTasks} from "../backend/src/platform/p4-r75-ci-sales-tasks.js";
import {P4R75CiSalesTasksClient,SalesTaskError} from "../frontend/src/lib/p4-r75-ci-sales-tasks-client.js";
import {P4R77CiSearch} from "../backend/src/platform/p4-r77-ci-search.js";
import {P4R77CiSearchClient,SearchError} from "../frontend/src/lib/p4-r77-ci-search-client.js";
import {P4R77WorkspacePanel} from "../frontend/src/components/p4-r77-ci-sales-workspace.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32),key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r77",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
  salesTasks:new P4R75CiSalesTasks(pool,process.env),
  salesSearch:new P4R77CiSearch(pool,process.env),
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
 const search=new P4R77CiSearchClient(base,async()=>bobJwt,fetch,process.env);
 const tasks=new P4R75CiSalesTasksClient(base,async()=>bobJwt,fetch,process.env);
 const ownerSearch=new P4R77CiSearchClient(base,async()=>ownerJwt,fetch,process.env);
 const eveLeads=new P4R72CiSalesLeadsClient(base,async()=>jwt("auth0|demo-eve"),fetch,process.env);
 const deny=(status:number)=>(e:unknown)=>(e instanceof SalesAccountError||e instanceof SalesContactError||e instanceof SalesDealError||e instanceof SalesLeadError||e instanceof P4R73CiWorkspaceError||e instanceof TeamReportError||e instanceof SharingError||e instanceof SalesTaskError||e instanceof SearchError)&&e.status===status;
 try{
  phase="setup explicit sales rep and entitlement";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const a=await orgs.create({userId:"user_demo_alice",verified:true},{name:"Demo R77 Primary",slug:"demo-r77-primary"});
  const b=await orgs.create({userId:"user_demo_alice",verified:true},{name:"Demo R77 Foreign",slug:"demo-r77-foreign"});
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
  const ac=await contacts.create(a.id,{displayName:"Demo Bob Contact",email:"r77bob@example.com",accountId:aa.id});
  const ea=await eveAccounts.create(a.id,{name:"Demo Eve Reporting",websiteLabel:null});
  const ec=await eveContacts.create(a.id,{displayName:"Demo Eve Contact",email:"r77eve@example.com",accountId:ea.id});
  const visible=await deals.create(a.id,{title:"Demo Visible Deal",accountId:aa.id,contactId:ac.id});
  const hidden=await deals.create(a.id,{title:"Demo Private Deal",accountId:aa.id,contactId:ac.id});
  await deals.create(a.id,{title:"Demo Unassigned Deal",accountId:aa.id,contactId:ac.id});
  const eve=await eveDeals.create(a.id,{title:"Demo Eve Deal",accountId:ea.id,contactId:ec.id});
  await eveDeals.changeStage(a.id,eve.id,"DISCOVERY",0);
  for(const [id,team] of [[visible.id,"team_demo_visible"],[hidden.id,"team_demo_private"],[eve.id,"team_demo_visible"]]){
   await pool.query("INSERT INTO p4_r74_ci.deal_team_assignments(org_id,deal_id,team_id) VALUES($1,$2,$3)",[a.id,id,team]);
  }
  phase="AC-062 scoped search and deterministic pagination";
  const lead=await leads.create(a.id,{companyName:"Demo Search Conversion",contactName:"Demo Search Contact",email:"r77convert@example.com"});
  const foreign=await leads.create(b.id,{companyName:"Demo Search Foreign",contactName:"Demo Foreign Contact",email:"r77foreign@example.com"});
  const privateLead=await eveLeads.create(a.id,{companyName:"Demo Search Private",contactName:"Demo Private Contact",email:"r77private@example.com"});
  for(let i=0;i<24;i++)await leads.create(a.id,{companyName:"Demo Search Lead "+i,contactName:"Demo Search Person",email:"r77person"+i+"@example.com"});
  const q={kind:"LEAD" as const,q:"search",status:"",after:null};
  const p=await search.search(a.id,q);assert.equal(p.actorId,"user_demo_bob");assert.equal(p.items.length,20);assert.ok(p.nextCursor);
  const n=await search.search(a.id,{...q,after:p.nextCursor});assert.equal(n.items.length,5);assert.equal(n.nextCursor,null);
  const ids=new Set([...p.items,...n.items].map(x=>x.id));assert.equal(ids.size,25);assert.ok(ids.has(lead.id));assert.ok(!ids.has(foreign.id)&&!ids.has(privateLead.id));
  assert.equal((await search.search(b.id,q)).items[0]?.id,foreign.id);
  await pool.query("UPDATE p4_synthetic.memberships SET active=false WHERE org_id=$1 AND user_id='user_demo_bob'",[b.id]);
  await assert.rejects(search.search(b.id,q),deny(403));await assert.rejects(ownerSearch.search(a.id,q),deny(403));
  phase="integrated qualification conversion task and sharing";
  await leads.changeStage(a.id,lead.id,"CONTACTED",0);await leads.changeStage(a.id,lead.id,"QUALIFIED",1);
  assert.deepEqual((await search.search(a.id,{...q,status:"QUALIFIED"})).items.map(x=>x.id),[lead.id]);
  const conversion=await leads.convert(a.id,lead.id,"Demo Search Deal",2);assert.ok(conversion.dealId);
  const found=await search.search(a.id,{kind:"DEAL",q:"Search Deal",status:"OPEN",after:null});
  assert.equal(found.items[0]?.id,conversion.dealId);
  const task=await tasks.create(a.id,{parentKind:"DEAL",parentId:conversion.dealId!,title:"Demo Search Followup",dueDate:"2026-12-20",assignee:found.actorId});
  await sharing.set(a.id,"DEAL",conversion.dealId!,{teamId:"team_demo_visible",active:true,expectedRevision:null});
  assert.ok((await eveSharing.shared(a.id,"team_demo_visible","DEAL")).items.some(x=>x.id===conversion.dealId));
  await tasks.change(a.id,task.id,{action:"COMPLETED",dueDate:null,expectedRevision:0});
  assert.equal((await search.search(a.id,{kind:"TASK",q:"Search",status:"COMPLETED",after:null})).items[0]?.id,task.id);
  assert.equal((await search.search(a.id,{kind:"CONTACT",q:"Search Contact",status:"",after:null})).items[0]?.id,conversion.contactId);
  phase="integrated module render and current scope";
  const clients={leads,accounts,contacts,deals,search,tasks,sharing},noop=()=>{};
  let view=await ctl.select(a.id);assert.equal(view.phase,"ready");
  for(const tab of ["Search","Tasks","Sharing"] as const){view=await ctl.navigate(tab);assert.equal(view.tab,tab);assert.equal(view.phase,"ready");
   const html=renderToStaticMarkup(createElement(P4R77WorkspacePanel,{view,clients,onOrg:noop,onTab:noop,onReload:noop}));
   assert.ok(html.includes("Search records"));for(const label of ["Tasks","Sharing","Search","Leads","Deals"])assert.ok(html.includes(label));assert.equal(html.includes(bobJwt),false);
  }
  phase="AC-061 unknown field and AC-063 missing sales grant";
  const bad=await fetch(new URL("/_p4_r33_ci/sales/"+a.id+"/leads",base),{method:"POST",headers:{Authorization:"Bearer "+bobJwt,"Content-Type":"application/json"},body:JSON.stringify({companyName:"Demo Rejected Company",contactName:"Demo Rejected Contact",email:"r77rejected@example.com",cardNumber:"DEMO_FORBIDDEN_FIELD_MARKER"})});
  assert.equal(bad.status,400);assert.equal((await bad.text()).includes("DEMO_FORBIDDEN_FIELD_MARKER"),false);
  assert.equal((await search.search(a.id,{...q,q:"Rejected"})).items.length,0);
  const candidate=(await search.search(a.id,{...q,status:"NEW"})).items[0]!;assert.ok(candidate);
  await pool.query("DELETE FROM p4_r40_ci.sales_roles WHERE org_id=$1 AND user_id='user_demo_bob'",[a.id]);
  await assert.rejects(leads.changeStage(a.id,candidate.id,"CONTACTED",0),deny(403));
  await assert.rejects(search.search(a.id,q),deny(403));
  const state=await pool.query("SELECT status,revision FROM p4_r72_ci.leads WHERE org_id=$1 AND id=$2",[a.id,candidate.id]);assert.deepEqual(state.rows,[{status:"NEW",revision:0}]);
  assert.equal((await ctl.navigate("Search")).phase,"denied");
  process.stdout.write("R77 AC-061/062/063 synthetic assertions; integrated conversion, task, sharing, search and SSR PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects SET email_verified=false,canonical_email='alice@example.com' WHERE user_id='user_demo_bob'");
  aes.fill(0);key.fill(0);await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await pool.end();
 }
}
main().catch(e=>{process.stderr.write("R77 integrated CRM smoke failed at "+phase+" "+String(e?.name)+" status="+String(e?.status??"none")+"\n");process.exitCode=1;});
