import assert from "node:assert/strict";
import {test} from "node:test";
import React,{createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {P4R53CiOwnerWorkspaceController}
 from "../src/lib/p4-r53-ci-owner-workspace-controller";
import {P4R55CiOwnerOrgSwitcher}
 from "../src/lib/p4-r55-ci-owner-org-switcher";
import {P4R55CiOwnerSwitcherPanel}
 from "../src/components/p4-r55-ci-owner-org-switcher";
const A="10000000-0000-4000-8000-000000000001";
const B="10000000-0000-4000-8000-000000000002";
const C="10000000-0000-4000-8000-000000000003";
const ORGS=[
 {id:A,name:"Demo Alpha Office",slug:"demo-alpha-office",ownerRole:"OWNER" as const},
 {id:B,name:"Demo Beta Office",slug:"demo-beta-office",ownerRole:"OWNER" as const},
];
const metrics=(n:number)=>({activeMembers:n,revokedMembers:0,salesManagers:0,
 pendingInvites:0,acceptedInvites:0,revokedInvites:0,expiredInvites:0,
 roleChanges:0,membershipEvents:0,renewals:0,cancellations:0});
const member=(name:string)=>({userId:name,email:null,
 role:"SALES_REP" as const,revision:0,active:true});
const deps=()=>({
 summary:{summary:async(org:string)=>metrics(org===A?1:2)},
 members:{page:async(org:string)=>({
  items:[member(org===A?"user_demo_carla":"user_demo_bob")],nextCursor:null,
 })},
 invitations:{page:async()=>({items:[],nextCursor:null})},
 activity:{page:async()=>({items:[],nextCursor:null})},
 actions:{issue:async()=>({}),cancel:async()=>({}),renew:async()=>({})},
 roles:{change:async()=>({}),revoke:async()=>({revoked:true})},
});
const model=(owned:()=>Promise<typeof ORGS>=async()=>ORGS)=>
 new P4R55CiOwnerOrgSwitcher({list:owned},
  new P4R53CiOwnerWorkspaceController(deps() as never));
test("R55 initial discovery picks owner organization and renders only scoped records",async()=>{
 const m=model();
 let state=await m.discover();
 assert.equal(state.phase,"ready");assert.equal(state.selectedId,A);
 assert.equal(state.workspace.counts?.activeMembers,1);
 assert.deepEqual(state.workspace.members.map(x=>x.userId),["user_demo_carla"]);
 state=await m.select(B);
 assert.equal(state.phase,"ready");assert.equal(state.selectedId,B);
 assert.equal(state.workspace.counts?.activeMembers,2);
 assert.deepEqual(state.workspace.members.map(x=>x.userId),["user_demo_bob"]);
});
test("R55 unknown org selection clears all previous tenant state",async()=>{
 const m=model();await m.discover();
 const v=await m.select(C);
 assert.equal(v.phase,"denied");assert.equal(v.selectedId,null);
 assert.equal(v.workspace.counts,null);assert.deepEqual(v.workspace.members,[]);
 assert.deepEqual(v.organizations,[]);
});
test("R55 revoked owner is removed at signed refresh and all records cleared",async()=>{
 let allowed=ORGS;
 const m=model(async()=>allowed);
 await m.discover(B);
 assert.equal(m.snapshot().selectedId,B);
 allowed=[ORGS[0]!];
 const v=await m.refresh();
 assert.equal(v.phase,"denied");
 assert.equal(v.workspace.counts,null);
 assert.deepEqual(v.workspace.members,[]);
});
test("R55 late owner list cannot overwrite a newer discovery",async()=>{
 let resolve:(value:typeof ORGS)=>void=()=>{};
 let first=true;
 const hold=new Promise<typeof ORGS>(r=>resolve=r);
 const m=model(async()=>{
  if(first){first=false;return hold;}
  return ORGS;
 });
 const older=m.discover(A);
 const newer=await m.discover(B);
 resolve(ORGS);
 await older;
 assert.equal(newer.selectedId,B);
 assert.equal(m.snapshot().selectedId,B);
 assert.equal(m.snapshot().workspace.counts?.activeMembers,2);
});
test("R55 pending write blocks tenant switch and never executes wrong-org action",async()=>{
 let resolve:(value:unknown)=>void=()=>{};
 const pending=new Promise<unknown>(r=>resolve=r);
 let called="";
 const app:any=deps();
 app.roles.revoke=async(org:string,user:string)=>{
  called=org+":"+user;await pending;return {revoked:true};
 };
 const m=new P4R55CiOwnerOrgSwitcher({list:async()=>ORGS},
  new P4R53CiOwnerWorkspaceController(app as never));
 await m.discover(A);
 const writing=m.revokeMember("user_demo_carla");
 assert.equal(m.snapshot().phase,"loading");
 assert.equal((await m.select(B)).phase,"loading");
 resolve(null);
 assert.equal((await writing).selectedId,A);
 assert.equal(called,A+":user_demo_carla");
});
test("R55 SSR shows actual owner organization selector and full owner UI",async()=>{
 const m=model();
 const v=await m.discover(B);
 const noop=()=>{};
 const html=renderToStaticMarkup(createElement(P4R55CiOwnerSwitcherPanel,{
  view:v,onSelect:noop,onReload:noop,onInvite:noop,onCancel:noop,
  onRenew:noop,onRole:noop,onRevoke:noop,onMore:noop,
  onMemberFilter:noop,onInvitationFilter:noop,onActivityFilter:noop,
 }));
 for(const value of ["Active owner organization","Demo Alpha Office",
  "Demo Beta Office","Owner operations","Team members",
  "Organization overview","Recent activity",
  'data-ci-owner-switcher="fictional-only"'])
  assert.ok(html.includes(value),value);
 for(const privateData of ["auth0|","postgresql://","token_hash"])
  assert.equal(html.includes(privateData),false);
});
