import assert from "node:assert/strict";
import {test} from "node:test";
import React,{createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {P4R62CiCrmWorkspaceController}
 from "../src/lib/p4-r62-ci-crm-workspace-controller";
import {P4R62CiCrmWorkspacePanel}
 from "../src/components/p4-r62-ci-crm-workspace";
const A="10000000-0000-4000-8000-000000000001";
const B="10000000-0000-4000-8000-000000000002";
const ID="10000000-0000-4000-8000-000000000003";
const TIME="2026-11-24T12:00:00.000Z";
const CURSOR="abc."+("a".repeat(43));
const ORGS=[
 {id:A,name:"Demo Alpha Team",slug:"demo-alpha-team",ownerRole:"OWNER" as const},
 {id:B,name:"Demo Beta Team",slug:"demo-beta-team",ownerRole:"OWNER" as const},
];
const item=(i:number)=>({leadId:i===1?ID:"10000000-0000-4000-8000-"+
 String(i).padStart(12,"0"),companyName:"Demo Lead Number "+i,
 contactEmail:"lead"+i+"@example.com",source:"WEBSITE" as const,
 status:"NEW" as const,revision:0,createdAt:TIME});
const event={eventId:ID,eventKind:"CREATED" as const,
 beforeStatus:null,afterStatus:"NEW" as const,revision:0,
 actorUserId:"user_demo_alice",occurredAt:TIME};
const note={noteId:"10000000-0000-4000-8000-000000000099",
 leadId:ID,noteText:"Demo called for follow up",
 actorUserId:"user_demo_alice",createdAt:TIME};
const fixture=()=>{
 let created=false,withNote=false,progressed=false;
 const deps:any={
  owners:{list:async()=>ORGS},
  pager:{page:async(org:string,filter:string,q:string,cursor:string|null)=>{
   if(org===B)return {items:[],nextCursor:null};
   const rows=created?[item(1)]:[item(1)];
   return cursor===null?{items:rows,nextCursor:null}:
    {items:[],nextCursor:null};
  }},
  leads:{create:async()=>{created=true;return item(1);}},
  stages:{
   history:async()=>progressed?[event,{...event,
    eventId:"10000000-0000-4000-8000-000000000004",
    eventKind:"STATUS_CHANGED" as const,beforeStatus:"NEW" as const,
    afterStatus:"CONTACTED" as const,revision:1}]:[event],
   change:async()=>{progressed=true;return {...item(1),
    status:"CONTACTED" as const,revision:1};},
  },
  notes:{
   list:async()=>withNote?[note]:[],
   add:async()=>{withNote=true;return note;},
  },
 };
 return deps;
};
const model=(deps:any=fixture())=>new P4R62CiCrmWorkspaceController(
 deps.owners,deps.pager,deps.leads,deps.stages,deps.notes);
test("R62 discovers verified tenant and clears first org records on switching",async()=>{
 const ctl=model();
 let v=await ctl.discover(A);
 assert.equal(v.phase,"ready");assert.equal(v.leads.length,1);
 v=await ctl.selectOrg(B);
 assert.equal(v.orgId,B);assert.equal(v.leads.length,0);
 assert.equal(v.selectedLeadId,null);assert.deepEqual(v.notes,[]);
});
test("R62 verifies immutable history and rereads notes after append",async()=>{
 const ctl=model();
 await ctl.discover(A);
 assert.equal((await ctl.selectLead(ID)).history.length,1);
 const v=await ctl.addNote(note.noteText);
 assert.equal(v.phase,"ready");assert.equal(v.notes.length,1);
 assert.equal(v.notes[0]?.leadId,ID);
});
test("R62 status transition retains cursor scope and fresh history",async()=>{
 const ctl=model();
 await ctl.discover(A);await ctl.selectLead(ID);
 const v=await ctl.changeStage("CONTACTED");
 assert.equal(v.phase,"ready");assert.equal(v.leads[0]?.status,"CONTACTED");
 assert.equal(v.history.at(-1)?.afterStatus,"CONTACTED");
 assert.equal(v.filter,"all");
 assert.equal(v.nextCursor,null);
});
test("R62 appends 20+5 pages without duplicate ID or contact email",async()=>{
 const a=Array.from({length:20},(_,i)=>item(i+1));
 const b=Array.from({length:5},(_,i)=>item(i+21));
 const deps=fixture();deps.pager.page=async(_org:string,_f:string,_q:string,cursor:string|null)=>
  cursor===null?{items:a,nextCursor:CURSOR}:{items:b,nextCursor:null};
 const ctl=model(deps);
 assert.equal((await ctl.discover(A)).leads.length,20);
 const v=await ctl.more();
 assert.equal(v.leads.length,25);assert.equal(v.nextCursor,null);
});
test("R62 forged org, revoked owner and notes denial clear all workspace data",async()=>{
 const deps=fixture();
 const ctl=model(deps);
 await ctl.discover(A);
 assert.equal((await ctl.selectOrg("forged")).phase,"denied");
 assert.deepEqual(ctl.snapshot().leads,[]);
 await ctl.discover(A);await ctl.selectLead(ID);
 deps.notes.list=async()=>{throw Error("secret JWT from provider");};
 assert.equal((await ctl.selectLead(ID)).phase,"denied");
 assert.deepEqual(ctl.snapshot().notes,[]);
 assert.equal(JSON.stringify(ctl.snapshot()).includes("JWT"),false);
});
test("R62 React SSR integrates CRM lead form, pages, status and notes without tokens",async()=>{
 const ctl=model();
 await ctl.discover(A);const v=await ctl.selectLead(ID);
 const noop=()=>{};
 const html=renderToStaticMarkup(createElement(P4R62CiCrmWorkspacePanel,{
  view:v,onOrg:noop,onRefresh:noop,onCreate:noop,onSelect:noop,
  onFilter:noop,onStage:noop,onSearch:noop,onMore:noop,onAddNote:noop,
 }));
 for(const label of ["CRM Leads","Lead directory","Create Lead",
  "Load more leads","Lead follow-up notes","Save follow-up note",
  "Mark Contacted","Lead details","Search persisted leads",
  'data-ci-crm-complete="fictional-only"'])
  assert.ok(html.includes(label),label);
 for(const secret of ["auth0|","postgresql://","token_hash","Bearer "])
  assert.equal(html.includes(secret),false);
});
