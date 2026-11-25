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
import {P4R78CiManagerWork} from "../backend/src/platform/p4-r78-ci-manager-work.js";
import {P4R78CiManagerWorkClient,ManagerWorkError} from "../frontend/src/lib/p4-r78-ci-manager-work-client.js";
import {P4R78ManagerWorkPanel} from "../frontend/src/components/p4-r78-ci-manager-work.js";
import {P4R79CiActivity} from "../backend/src/platform/p4-r79-ci-activity.js";
import {P4R79CiActivityClient,ActivityError} from "../frontend/src/lib/p4-r79-ci-activity-client.js";
import {P4R79Timeline,P4R79WorkloadPanel} from "../frontend/src/components/p4-r79-ci-activity.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32),key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r79",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
  salesManagerWork:new P4R78CiManagerWork(pool,process.env),
  salesActivity:new P4R79CiActivity(pool,process.env),
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
 const managerWork=new P4R78CiManagerWorkClient(base,async()=>jwt("auth0|demo-manager"),fetch,process.env);
 const repWork=new P4R78CiManagerWorkClient(base,async()=>bobJwt,fetch,process.env);
 const eveTasks=new P4R75CiSalesTasksClient(base,async()=>jwt("auth0|demo-eve"),fetch,process.env);
 const eveSearch=new P4R77CiSearchClient(base,async()=>jwt("auth0|demo-eve"),fetch,process.env);
 const activity=new P4R79CiActivityClient(base,async()=>bobJwt,fetch,process.env);
 const managerActivity=new P4R79CiActivityClient(base,async()=>jwt("auth0|demo-manager"),fetch,process.env);
 const eveActivity=new P4R79CiActivityClient(base,async()=>jwt("auth0|demo-eve"),fetch,process.env);
 const deny=(status:number)=>(e:unknown)=>(e instanceof SalesAccountError||e instanceof SalesContactError||e instanceof SalesDealError||e instanceof SalesLeadError||e instanceof P4R73CiWorkspaceError||e instanceof TeamReportError||e instanceof SharingError||e instanceof SalesTaskError||e instanceof SearchError||e instanceof ManagerWorkError||e instanceof ActivityError)&&e.status===status;
 try{
  phase="setup explicit sales rep and entitlement";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const a=await orgs.create({userId:"user_demo_alice",verified:true},{name:"Demo R79 Primary",slug:"demo-r79-primary"});
  const b=await orgs.create({userId:"user_demo_alice",verified:true},{name:"Demo R79 Foreign",slug:"demo-r79-foreign"});
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
  const ac=await contacts.create(a.id,{displayName:"Demo Bob Contact",email:"r79bob@example.com",accountId:aa.id});
  const ea=await eveAccounts.create(a.id,{name:"Demo Eve Reporting",websiteLabel:null});
  const ec=await eveContacts.create(a.id,{displayName:"Demo Eve Contact",email:"r79eve@example.com",accountId:ea.id});
  const visible=await deals.create(a.id,{title:"Demo Visible Deal",accountId:aa.id,contactId:ac.id});
  const hidden=await deals.create(a.id,{title:"Demo Private Deal",accountId:aa.id,contactId:ac.id});
  await deals.create(a.id,{title:"Demo Unassigned Deal",accountId:aa.id,contactId:ac.id});
  const eve=await eveDeals.create(a.id,{title:"Demo Eve Deal",accountId:ea.id,contactId:ec.id});
  await eveDeals.changeStage(a.id,eve.id,"DISCOVERY",0);
  for(const [id,team] of [[visible.id,"team_demo_visible"],[hidden.id,"team_demo_private"],[eve.id,"team_demo_visible"]]){
   await pool.query("INSERT INTO p4_r74_ci.deal_team_assignments(org_id,deal_id,team_id) VALUES($1,$2,$3)",[a.id,id,team]);
  }
  phase="own and manager record history";
  const team="team_demo_visible";
  const lead=await leads.create(a.id,{companyName:"Demo Activity Lead",contactName:"Demo Activity Contact",email:"r79lead@example.com"});
  await leads.changeStage(a.id,lead.id,"CONTACTED",0);
  const leadHistory=await activity.history(a.id,"LEAD",lead.id);assert.deepEqual(leadHistory.items.map(x=>[x.revision,x.action,x.afterValue]),[[1,"STAGE_CHANGED","CONTACTED"],[0,"CREATED","NEW"]]);
  assert.equal((await activity.history(a.id,"ACCOUNT",aa.id)).items[0]?.action,"CREATED");
  assert.equal((await activity.history(a.id,"CONTACT",ac.id)).items[0]?.action,"CREATED");
  await managerWork.stage(a.id,visible.id,team,"DISCOVERY",0);
  const dealHistory=await managerActivity.history(a.id,"DEAL",visible.id,team);assert.deepEqual(dealHistory.items.map(x=>[x.actor,x.afterValue]),[["user_demo_manager","DISCOVERY"],["user_demo_bob","OPEN"]]);
  await assert.rejects(managerActivity.history(a.id,"DEAL",hidden.id,team),deny(403));
  await assert.rejects(eveActivity.history(a.id,"LEAD",lead.id),deny(403));
  await assert.rejects(activity.history(b.id,"ACCOUNT",aa.id),deny(403));
  phase="task timeline and workload buckets";
  const input={team,dealId:visible.id,title:"Demo Activity Task",dueDate:"2026-12-10",assignee:"user_demo_bob"};
  const late=await managerWork.create(a.id,input);
  const today=await managerWork.create(a.id,{...input,dueDate:"2026-12-15",assignee:"user_demo_eve"});
  const upcoming=await managerWork.create(a.id,{...input,dueDate:"2026-12-20"});
  const finished=await managerWork.create(a.id,{...input,assignee:"user_demo_eve"});
  await eveTasks.change(a.id,finished.id,{action:"COMPLETED",dueDate:null,expectedRevision:0});
  await tasks.create(a.id,{parentKind:"DEAL",parentId:hidden.id,title:"Demo Hidden Task",dueDate:"2026-12-10",assignee:"user_demo_bob"});
  for(let i=0;i<24;i++)await tasks.change(a.id,upcoming.id,{action:"RESCHEDULED",dueDate:i%2===0?"2026-12-21":"2026-12-20",expectedRevision:i});
  const h=await activity.history(a.id,"TASK",upcoming.id);assert.equal(h.items.length,20);assert.equal(h.items[0]?.revision,24);assert.equal(h.nextCursor,5);
  const older=await activity.history(a.id,"TASK",upcoming.id,"",h.nextCursor);assert.deepEqual(older.items.map(x=>x.revision),[4,3,2,1,0]);
  assert.deepEqual(await managerActivity.workload(a.id,team,"2026-12-15"),{rows:[{owner:"user_demo_bob",overdue:1,dueToday:0,upcoming:1,completed:0},{owner:"user_demo_eve",overdue:0,dueToday:1,upcoming:0,completed:1}],total:4});
  assert.equal((await managerActivity.workload(a.id,team,"2026-12-15","user_demo_eve")).total,2);
  await assert.rejects(activity.workload(a.id,team,"2026-12-15"),deny(403));
  await assert.rejects(managerActivity.workload(a.id,"team_demo_private","2026-12-15"),deny(403));
  await assert.rejects(managerActivity.workload(a.id,team,"2026-12-15","user_demo_alice"),deny(403));
  await pool.query("UPDATE p4_r74_ci.deal_team_assignments SET active=false WHERE org_id=$1 AND deal_id=$2",[a.id,visible.id]);
  assert.equal((await managerActivity.workload(a.id,team,"2026-12-15")).total,0);
  await assert.rejects(eveActivity.history(a.id,"TASK",today.id),deny(403));await assert.rejects(managerActivity.history(a.id,"TASK",late.id,team),deny(403));
  const html=renderToStaticMarkup(createElement(P4R79Timeline,{client:activity,orgId:a.id,kind:"LEAD",recordId:lead.id}));assert.ok(html.includes("Activity timeline"));
  const dashboard=renderToStaticMarkup(createElement(P4R79WorkloadPanel,{client:managerActivity,reports,orgId:a.id,initialDate:"2026-12-15"}));assert.ok(dashboard.includes("Manager workload dashboard"));
  process.stdout.write("R79 scoped record timeline, 25-event pagination and workload counts/revocation PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects SET email_verified=false,canonical_email='alice@example.com' WHERE user_id='user_demo_bob'");
  aes.fill(0);key.fill(0);await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await pool.end();
 }
}
main().catch(e=>{process.stderr.write("R79 activity smoke failed at "+phase+" "+String(e?.name)+" status="+String(e?.status??"none")+"\n");process.exitCode=1;});
