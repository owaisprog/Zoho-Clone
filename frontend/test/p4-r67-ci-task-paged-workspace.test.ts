/** R67 React + controller behavior across multiple saved task pages. */
import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import React,{createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {P4R65CiFollowUpWorkspaceController}
 from "../src/lib/p4-r65-ci-followup-workspace-controller";
import {P4R65CiFollowUpWorkspacePanel}
 from "../src/components/p4-r65-ci-followup-workspace";
const ORG=randomUUID(),OTHER=randomUUID(),LEAD=randomUUID();
const DATE="2026-11-25T12:00:00.000Z";
const CURSOR="e30."+("a".repeat(43));
const lead={leadId:LEAD,companyName:"Demo R67 Payments",
 contactEmail:"r67@example.com",source:"WEBSITE" as const,
 status:"NEW" as const,revision:0,createdAt:DATE};
const history={eventId:randomUUID(),eventKind:"CREATED" as const,
 beforeStatus:null,afterStatus:"NEW" as const,revision:0,
 actorUserId:"user_demo_alice",occurredAt:DATE};
const organizations=[
 {id:ORG,name:"Demo Owner",slug:"demo-owner",ownerRole:"OWNER" as const},
 {id:OTHER,name:"Demo Foreign",slug:"demo-foreign",ownerRole:"OWNER" as const},
];
const crmView=(org:string,selected:boolean)=>({
 phase:"ready" as const,orgId:org,organizations,
 leads:org===ORG?[lead]:[],selectedLeadId:selected?LEAD:null,
 history:selected?[history]:[],notes:[],
 filter:"all" as const,search:"",nextCursor:null,message:"CI synthetic CRM",
});
function createFixture(){
 let revoked=false;let completed:string|null=null;
 const tasks=Array.from({length:25},(_,i)=>({
  taskId:randomUUID(),leadId:LEAD,title:"Demo follow up task number "+i,
  dueDate:"2026-12-05",status:"OPEN" as "OPEN"|"DONE",
  revision:0,createdBy:"user_demo_alice",updatedBy:null as string|null,
  createdAt:new Date(Date.parse(DATE)-i*1000).toISOString(),
  completedAt:null as string|null,
 }));
 const crm={
  discover:async()=>crmView(ORG,false),
  selectLead:async()=>crmView(ORG,true),
  selectOrg:async(org:string)=>crmView(org,false),
  refresh:async()=>crmView(ORG,true),
  reset:()=>{},
 };
 const taskPages={page:async(org:string,leadId:string,cursor:string|null)=>{
  if(revoked||org!==ORG||leadId!==LEAD)throw Error("revoked");
  return cursor===null?
   {items:tasks.slice(0,20),nextCursor:CURSOR}:
   {items:tasks.slice(20),nextCursor:null};
 }};
 const api={
  list:async()=>{throw Error("legacy capped task list must never execute");},
  create:async()=>{throw Error("creation unused here");},
  complete:async(_org:string,_lead:string,id:string)=>{
   const task=tasks.find(t=>t.taskId===id);
   if(!task||task.status!=="OPEN")throw Error("stale");
   task.status="DONE";task.revision=1;task.updatedBy="user_demo_alice";
   task.completedAt="2026-11-25T12:30:00.000Z";completed=id;
   return task;
  },
 };
 const ctl=new P4R65CiFollowUpWorkspaceController(crm as never,
  {page:async()=>({items:[],nextCursor:null})} as never,
  api as never,taskPages as never);
 return {ctl,tasks,deny:()=>{revoked=true;},completed:()=>completed};
}
test("R67 signed paged React loads 25 tasks, marks older task complete and rereads",async()=>{
 const f=createFixture();
 await f.ctl.discover();
 let v=await f.ctl.selectLead(LEAD);
 assert.equal(v.phase,"ready");assert.equal(v.tasks.length,20);
 assert.equal(v.taskNextCursor,CURSOR);
 const noop=()=>{};
 const html=renderToStaticMarkup(createElement(P4R65CiFollowUpWorkspacePanel,{
  view:v,onOrg:noop,onRefresh:noop,onCreateLead:noop,
  onSelectLead:noop,onFilter:noop,onStage:noop,
  onSearch:noop,onMoreLeads:noop,onAddNote:noop,onMoreNotes:noop,
  onCreateTask:noop,onCompleteTask:noop,onMoreTasks:noop,
 }));
 assert.ok(html.includes("Load more tasks"));
 assert.ok(html.includes("Open tasks shown"));
 for(const secret of ["auth0|","postgresql://","Bearer ","token_hash"])
  assert.equal(html.includes(secret),false);
 v=await f.ctl.moreTasks();
 assert.equal(v.phase,"ready");assert.equal(v.tasks.length,25);
 assert.equal(v.taskNextCursor,null);
 assert.equal(new Set(v.tasks.map(t=>t.taskId)).size,25);
 const older=f.tasks[24]!.taskId;
 v=await f.ctl.completeTask(older);
 assert.equal(v.phase,"ready");assert.equal(v.tasks.length,25);
 assert.equal(v.tasks.find(t=>t.taskId===older)?.status,"DONE");
 assert.equal(v.tasks.find(t=>t.taskId===older)?.revision,1);
 assert.equal(f.completed(),older);
});
test("R67 switching organization or losing owner permission removes paged tasks",async()=>{
 const f=createFixture();
 await f.ctl.discover();await f.ctl.selectLead(LEAD);
 await f.ctl.moreTasks();
 let v=await f.ctl.selectOrg(OTHER);
 assert.equal(v.phase,"ready");
 assert.equal(v.crm.orgId,OTHER);assert.deepEqual(v.tasks,[]);
 assert.equal(v.taskNextCursor,null);
 const second=createFixture();
 await second.ctl.discover();await second.ctl.selectLead(LEAD);
 second.deny();
 v=await second.ctl.moreTasks();
 assert.equal(v.phase,"denied");
 assert.deepEqual(v.tasks,[]);assert.equal(v.taskNextCursor,null);
 assert.equal(v.crm.orgId,null);
});
