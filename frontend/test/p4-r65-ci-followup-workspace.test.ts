import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import React,{createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {P4R62CiCrmWorkspaceController}
 from "../src/lib/p4-r62-ci-crm-workspace-controller";
import {P4R65CiFollowUpWorkspaceController}
 from "../src/lib/p4-r65-ci-followup-workspace-controller";
import {P4R65CiFollowUpWorkspacePanel}
 from "../src/components/p4-r65-ci-followup-workspace";
const A=randomUUID(),B=randomUUID(),LEAD=randomUUID(),TASK=randomUUID();
const DATE="2026-11-25T00:00:00.000Z",CURSOR="e30."+("a".repeat(43));
const company={leadId:LEAD,companyName:"Demo Payments Agency",
 contactEmail:"agency@example.com",source:"WEBSITE" as const,
 status:"NEW" as const,revision:0,createdAt:DATE};
const entry={eventId:randomUUID(),eventKind:"CREATED" as const,
 beforeStatus:null,afterStatus:"NEW" as const,revision:0,
 actorUserId:"user_demo_alice",occurredAt:DATE};
const note=(n:number)=>({noteId:randomUUID(),leadId:LEAD,
 noteText:"Demo follow up number "+n,actorUserId:"user_demo_alice",createdAt:DATE});
const allNotes=Array.from({length:25},(_,i)=>note(i));
const task={taskId:TASK,leadId:LEAD,title:"Demo contact company next week",
 dueDate:"2026-12-05",status:"OPEN" as const,revision:0,
 createdBy:"user_demo_alice",updatedBy:null,
 createdAt:DATE,completedAt:null};
const done={...task,status:"DONE" as const,revision:1,
 updatedBy:"user_demo_alice",completedAt:"2026-11-25T00:01:00.000Z"};
const orgs=[
 {id:A,name:"Demo Alpha",slug:"demo-alpha",ownerRole:"OWNER" as const},
 {id:B,name:"Demo Beta",slug:"demo-beta",ownerRole:"OWNER" as const},
];
const ready=(org=A,selected:string|null=LEAD)=>({
 phase:"ready" as const,orgId:org,organizations:orgs,
 leads:org===A?[company]:[],selectedLeadId:selected,
 history:selected?[entry]:[],notes:[],
 filter:"all" as const,search:"",nextCursor:null,message:"Verified fictional CRM",
});
const page=(org:string,lead:string,cursor:string|null)=>{
 if(org!==A||lead!==LEAD)throw Error("invalid");
 return cursor===null?{items:allNotes.slice(0,20),nextCursor:CURSOR}:
  {items:allNotes.slice(20),nextCursor:null};
};
const deps=()=>{
 let created=false,completed=false,revoked=false;
 const crm={
  discover:async()=>ready(A,null),
  selectLead:async()=>ready(A,LEAD),
  selectOrg:async(org:string)=>ready(org,null),
  refresh:async()=>ready(A,null),
  search:async()=>ready(A,null),
  more:async()=>ready(A,LEAD),
  create:async()=>ready(A,LEAD),
  changeStage:async()=>ready(A,LEAD),
  addNote:async()=>ready(A,LEAD),
  reset:()=>{},
 };
 const taskApi={
  list:async()=>{if(revoked)throw Error("private JWT");
   return created?[completed?done:task]:[];},
  create:async()=>{created=true;return task;},
  complete:async()=>{completed=true;return done;},
 };
 return {crm,taskApi,deny:()=>{revoked=true;}};
};
test("R65 R62 optional signed note pager avoids the 20-note list barrier",async()=>{
 let oldListCalls=0;
 const r62=new P4R62CiCrmWorkspaceController(
  {list:async()=>orgs} as never,
  {page:async()=>({items:[company],nextCursor:null})} as never,
  {create:async()=>company} as never,
  {history:async()=>[entry],change:async()=>company} as never,
  {list:async()=>{oldListCalls++;throw Error("old 20-note barrier");},
   add:async()=>allNotes[0]} as never,
  {page:async()=>page(A,LEAD,null)} as never,
 );
 await r62.discover(A);
 const v=await r62.selectLead(LEAD);
 assert.equal(v.phase,"ready");assert.equal(v.notes.length,20);
 assert.equal(oldListCalls,0);
});
test("R65 paginated notes append 20+5 and tasks create+complete persisted readback",async()=>{
 const fixture=deps();
 const ctl=new P4R65CiFollowUpWorkspaceController(
  fixture.crm as never,{page} as never,fixture.taskApi as never);
 await ctl.discover();
 let v=await ctl.selectLead(LEAD);
 assert.equal(v.notes.length,20);assert.equal(v.tasks.length,0);
 v=await ctl.moreNotes();
 assert.equal(v.notes.length,25);assert.equal(v.noteNextCursor,null);
 v=await ctl.createTask({title:task.title,dueDate:task.dueDate});
 assert.equal(v.tasks.length,1);assert.equal(v.tasks[0]?.status,"OPEN");
 v=await ctl.completeTask(TASK);
 assert.equal(v.tasks[0]?.status,"DONE");
 assert.equal(v.tasks[0]?.revision,1);
});
test("R65 organization switching removes selected notes and completed tasks",async()=>{
 const fixture=deps();
 const ctl=new P4R65CiFollowUpWorkspaceController(
  fixture.crm as never,{page} as never,fixture.taskApi as never);
 await ctl.discover();await ctl.selectLead(LEAD);
 await ctl.createTask({title:task.title,dueDate:task.dueDate});
 const v=await ctl.selectOrg(B);
 assert.equal(v.phase,"ready");assert.equal(v.crm.orgId,B);
 assert.deepEqual(v.notes,[]);assert.deepEqual(v.tasks,[]);
 assert.equal(v.crm.selectedLeadId,null);
});
test("R65 denied task read clears old notes and resets CRM",async()=>{
 const fixture=deps();
 const ctl=new P4R65CiFollowUpWorkspaceController(
  fixture.crm as never,{page} as never,fixture.taskApi as never);
 await ctl.discover();await ctl.selectLead(LEAD);
 fixture.deny();
 const v=await ctl.selectLead(LEAD);
 assert.equal(v.phase,"denied");assert.deepEqual(v.tasks,[]);
 assert.deepEqual(v.notes,[]);assert.equal(v.crm.orgId,null);
 assert.equal(JSON.stringify(v).includes("JWT"),false);
});
test("R65 React SSR shows stage, paginated notes, due task and no secrets",async()=>{
 const fixture=deps();
 const ctl=new P4R65CiFollowUpWorkspaceController(
  fixture.crm as never,{page} as never,fixture.taskApi as never);
 await ctl.discover();await ctl.selectLead(LEAD);
 const v=await ctl.createTask({title:task.title,dueDate:task.dueDate});
 const noop=()=>{};
 const html=renderToStaticMarkup(createElement(P4R65CiFollowUpWorkspacePanel,{
  view:v,onOrg:noop,onRefresh:noop,onCreateLead:noop,
  onSelectLead:noop,onFilter:noop,onStage:noop,
  onSearch:noop,onMoreLeads:noop,onAddNote:noop,onMoreNotes:noop,
  onCreateTask:noop,onCompleteTask:noop,
 }));
 for(const label of ["CRM Leads","Load more notes",
  "Lead follow-up tasks","Add follow-up task",
  "Mark Done","Due 2026-12-05",
  'data-ci-crm-followups="fictional-only"'])
  assert.ok(html.includes(label),label);
 for(const secret of ["auth0|","postgresql://","token_hash","Bearer "])
  assert.equal(html.includes(secret),false);
});
