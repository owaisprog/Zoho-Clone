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
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32),key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r78",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
 const deny=(status:number)=>(e:unknown)=>(e instanceof SalesAccountError||e instanceof SalesContactError||e instanceof SalesDealError||e instanceof SalesLeadError||e instanceof P4R73CiWorkspaceError||e instanceof TeamReportError||e instanceof SharingError||e instanceof SalesTaskError||e instanceof SearchError||e instanceof ManagerWorkError)&&e.status===status;
 try{
  phase="setup explicit sales rep and entitlement";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const a=await orgs.create({userId:"user_demo_alice",verified:true},{name:"Demo R78 Primary",slug:"demo-r78-primary"});
  const b=await orgs.create({userId:"user_demo_alice",verified:true},{name:"Demo R78 Foreign",slug:"demo-r78-foreign"});
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
  const ac=await contacts.create(a.id,{displayName:"Demo Bob Contact",email:"r78bob@example.com",accountId:aa.id});
  const ea=await eveAccounts.create(a.id,{name:"Demo Eve Reporting",websiteLabel:null});
  const ec=await eveContacts.create(a.id,{displayName:"Demo Eve Contact",email:"r78eve@example.com",accountId:ea.id});
  const visible=await deals.create(a.id,{title:"Demo Visible Deal",accountId:aa.id,contactId:ac.id});
  const hidden=await deals.create(a.id,{title:"Demo Private Deal",accountId:aa.id,contactId:ac.id});
  await deals.create(a.id,{title:"Demo Unassigned Deal",accountId:aa.id,contactId:ac.id});
  const eve=await eveDeals.create(a.id,{title:"Demo Eve Deal",accountId:ea.id,contactId:ec.id});
  await eveDeals.changeStage(a.id,eve.id,"DISCOVERY",0);
  for(const [id,team] of [[visible.id,"team_demo_visible"],[hidden.id,"team_demo_private"],[eve.id,"team_demo_visible"]]){
   await pool.query("INSERT INTO p4_r74_ci.deal_team_assignments(org_id,deal_id,team_id) VALUES($1,$2,$3)",[a.id,id,team]);
  }
  phase="manager stage scope and shared revision";
  const team="team_demo_visible";
  assert.deepEqual(await managerWork.members(a.id,team),["user_demo_bob","user_demo_eve"]);
  const ds=await managerWork.work(a.id,team,"DEAL");assert.equal(ds.items.length,2);assert.ok(!ds.items.some(x=>x.id===hidden.id));
  await assert.rejects(repWork.stage(a.id,visible.id,team,"DISCOVERY",0),deny(403));
  await assert.rejects(managerWork.stage(a.id,hidden.id,team,"DISCOVERY",0),deny(403));
  await assert.rejects(managerWork.stage(a.id,visible.id,team,"WON",0),deny(409));
  assert.equal((await managerWork.stage(a.id,visible.id,team,"DISCOVERY",0)).revision,1);
  await assert.rejects(deals.changeStage(a.id,visible.id,"DISCOVERY",0),deny(409));
  assert.equal((await deals.page(a.id)).items.find(x=>x.id===visible.id)?.stage,"DISCOVERY");
  const audit=await pool.query("SELECT actor_user_id,after_stage FROM p4_r71_ci.deal_events WHERE org_id=$1 AND deal_id=$2 AND revision=1",[a.id,visible.id]);assert.deepEqual(audit.rows,[{actor_user_id:"user_demo_manager",after_stage:"DISCOVERY"}]);
  phase="manager assigns and reassigns scoped task";
  const input={team,dealId:visible.id,title:"Demo Manager Followup",dueDate:"2026-12-15",assignee:"user_demo_bob"};
  const task=await managerWork.create(a.id,input);assert.equal(task.owner,"user_demo_bob");
  assert.ok((await tasks.page(a.id)).items.some(x=>x.id===task.id));
  assert.equal((await managerWork.work(a.id,team,"TASK")).items.length,1);
  await assert.rejects(managerWork.create(a.id,{...input,dealId:hidden.id}),deny(403));
  await assert.rejects(managerWork.create(a.id,{...input,assignee:"user_demo_alice"}),deny(403));
  await pool.query("UPDATE p4_synthetic.memberships SET active=false WHERE org_id=$1 AND user_id='user_demo_eve'",[a.id]);
  await assert.rejects(managerWork.create(a.id,{...input,assignee:"user_demo_eve"}),deny(403));
  await assert.rejects(managerWork.reassign(a.id,task.id,team,"user_demo_eve",0),deny(403));
  assert.equal((await managerWork.work(a.id,team,"TASK")).items.length,1);
  await pool.query("UPDATE p4_synthetic.memberships SET active=true WHERE org_id=$1 AND user_id='user_demo_eve'",[a.id]);
  const moved=await managerWork.reassign(a.id,task.id,team,"user_demo_eve",0);assert.equal(moved.revision,1);
  assert.equal((await tasks.page(a.id)).items.some(x=>x.id===task.id),false);
  assert.equal((await eveTasks.page(a.id)).items.some(x=>x.id===task.id),true);
  assert.ok((await eveSearch.search(a.id,{kind:"TASK",q:"Manager",status:"OPEN",after:null})).items.some(x=>x.id===task.id));
  await assert.rejects(tasks.change(a.id,task.id,{action:"COMPLETED",dueDate:null,expectedRevision:1}),deny(403));
  assert.equal((await eveTasks.change(a.id,task.id,{action:"COMPLETED",dueDate:null,expectedRevision:1})).status,"COMPLETED");
  const events=await pool.query("SELECT action,actor_user_id,before_assignee,after_assignee FROM p4_r75_ci.events WHERE org_id=$1 AND task_id=$2 ORDER BY revision",[a.id,task.id]);
  assert.deepEqual(events.rows,[{action:"CREATED",actor_user_id:"user_demo_manager",before_assignee:null,after_assignee:"user_demo_bob"},{action:"REASSIGNED",actor_user_id:"user_demo_manager",before_assignee:"user_demo_bob",after_assignee:"user_demo_eve"},{action:"COMPLETED",actor_user_id:"user_demo_eve",before_assignee:null,after_assignee:null}]);
  await pool.query("UPDATE p4_r74_ci.deal_team_assignments SET active=false WHERE org_id=$1 AND deal_id=$2",[a.id,visible.id]);
  assert.equal((await eveTasks.page(a.id)).items.some(x=>x.id===task.id),false);
  assert.equal((await managerWork.work(a.id,team,"TASK")).items.length,0);
  const html=renderToStaticMarkup(createElement(P4R78ManagerWorkPanel,{client:managerWork,reports,orgId:a.id}));assert.ok(html.includes("Manager team work"));
  process.stdout.write("R78 manager stage CAS and task assignment/reassignment, AC-069 revoked target denial, rep completion and revocation PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects SET email_verified=false,canonical_email='alice@example.com' WHERE user_id='user_demo_bob'");
  aes.fill(0);key.fill(0);await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await pool.end();
 }
}
main().catch(e=>{process.stderr.write("R78 manager work smoke failed at "+phase+" "+String(e?.name)+" status="+String(e?.status??"none")+"\n");process.exitCode=1;});
