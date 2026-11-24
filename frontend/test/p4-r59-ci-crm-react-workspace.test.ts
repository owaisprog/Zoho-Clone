import assert from "node:assert/strict";
import {test} from "node:test";
import React,{createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {P4R59CiCrmWorkspaceController}
 from "../src/lib/p4-r59-ci-crm-workspace-controller";
import {P4R59CiCrmWorkspacePanel}
 from "../src/components/p4-r59-ci-crm-workspace";
const A="10000000-0000-4000-8000-000000000001";
const B="10000000-0000-4000-8000-000000000002";
const ID="10000000-0000-4000-8000-000000000003";
const ISO="2026-11-24T16:00:00.000Z";
const orgs=[
 {id:A,name:"Demo Alpha Office",slug:"demo-alpha-office",ownerRole:"OWNER" as const},
 {id:B,name:"Demo Beta Office",slug:"demo-beta-office",ownerRole:"OWNER" as const},
];
const lead={leadId:ID,companyName:"Demo Alpha Payments",
 contactEmail:"alpha@example.com",source:"WEBSITE" as const,
 status:"NEW" as const,revision:0,createdAt:ISO};
const createEvent={eventId:ID,eventKind:"CREATED" as const,
 beforeStatus:null,afterStatus:"NEW" as const,revision:0,
 actorUserId:"user_demo_alice",occurredAt:ISO};
const fake=()=>({
 owners:{list:async()=>orgs},
 leads:{list:async(org:string)=>org===A?[lead]:[],
  create:async()=>lead},
 stages:{history:async()=>[createEvent],change:async()=>lead},
});
const model=(deps:any=fake())=>
 new P4R59CiCrmWorkspaceController(deps.owners,deps.leads,deps.stages);
test("R59 initializes signed owner CRM and switches without prior tenant leads",async()=>{
 const m=model();
 let v=await m.discover(A);
 assert.equal(v.phase,"ready");
 assert.equal(v.orgId,A);assert.equal(v.leads.length,1);
 v=await m.selectOrg(B);
 assert.equal(v.phase,"ready");assert.equal(v.orgId,B);
 assert.deepEqual(v.leads,[]);assert.equal(v.selectedLeadId,null);
});
test("R59 history selection validates persisted row against latest audit",async()=>{
 const m=model();
 await m.discover(A);
 let state=await m.selectLead(ID);
 assert.equal(state.selectedLeadId,ID);
 assert.equal(state.history.length,1);
 assert.equal(m.setFilter("CONTACTED").filter,"CONTACTED");
 assert.equal(m.setFilter("FORGED" as "all").phase,"denied");
 state=await m.discover(A);
 assert.equal(state.phase,"ready");
});
test("R59 creation refetches persisted lead and selects it with source history",async()=>{
 let added=false;
 const deps:any=fake();
 deps.leads.list=async()=>added?[lead]:[];
 deps.leads.create=async()=>{added=true;return lead;};
 const m=model(deps);
 await m.discover(A);
 const v=await m.create({companyName:lead.companyName,
  contactEmail:lead.contactEmail,source:lead.source});
 assert.equal(v.phase,"ready");
 assert.equal(v.selectedLeadId,ID);
 assert.equal(v.history.length,1);
 assert.equal(v.leads.length,1);
});
test("R59 stale read failure or wrong organization clears prior data",async()=>{
 const deps:any=fake();
 const m=model(deps);
 await m.discover(A);
 assert.equal((await m.selectOrg("not-approved")).phase,"denied");
 assert.deepEqual(m.snapshot().leads,[]);
 await m.discover(A);
 deps.owners.list=async()=>[];
 assert.equal((await m.refresh()).phase,"denied");
 assert.equal(m.snapshot().orgId,null);
});
test("R59 signed stage change reads CAS revision and reloads persisted audit",async()=>{
 let progressed=false,expected=-1;
 const next={...lead,status:"CONTACTED" as const,revision:1};
 const transition={...createEvent,
  eventId:"10000000-0000-4000-8000-000000000004",
  eventKind:"STATUS_CHANGED" as const,
  beforeStatus:"NEW" as const,afterStatus:"CONTACTED" as const,revision:1};
 const deps:any=fake();
 deps.leads.list=async()=>[progressed?next:lead];
 deps.stages.history=async()=>progressed?[createEvent,transition]:[createEvent];
 deps.stages.change=async(_org:string,_id:string,_status:string,rev:number)=>{
  expected=rev;progressed=true;return next;
 };
 const m=model(deps);
 await m.discover(A);await m.selectLead(ID);
 const state=await m.changeStage("CONTACTED");
 assert.equal(expected,0);
 assert.equal(state.phase,"ready");
 assert.equal(state.history.length,2);
 assert.equal(state.leads[0]?.status,"CONTACTED");
});
test("R59 React SSR shows functional lead form, counts, stage buttons, no secrets",async()=>{
 const m=model();await m.discover(A);
 const v=await m.selectLead(ID);
 const noop=()=>{};
 const html=renderToStaticMarkup(createElement(P4R59CiCrmWorkspacePanel,{
  view:v,onOrg:noop,onRefresh:noop,onCreate:noop,
  onSelect:noop,onFilter:noop,onStage:noop,
 }));
 for(const required of ["CRM Leads","Lead directory","New lead",
  "Create Lead","Mark Contacted","Lead details",
  "Demo Alpha Payments","alpha@example.com",
  'data-ci-crm-workspace="fictional-only"','data-ci-crm-count="NEW"'])
  assert.ok(html.includes(required),required);
 for(const secret of ["auth0|","postgresql://","token_hash",
  "encrypted_token","Bearer "])
  assert.equal(html.includes(secret),false);
});
