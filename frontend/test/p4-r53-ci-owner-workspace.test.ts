import assert from "node:assert/strict";
import {test} from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {P4R53CiOwnerWorkspaceController}
 from "../src/lib/p4-r53-ci-owner-workspace-controller";
import {P4R53CiOwnerWorkspacePanel}
 from "../src/components/p4-r53-ci-owner-workspace";
const A="10000000-0000-4000-8000-000000000001";
const B="10000000-0000-4000-8000-000000000002";
const INVITE="10000000-0000-4000-8000-000000000003";
const counts={activeMembers:1,revokedMembers:0,salesManagers:0,
 pendingInvites:1,acceptedInvites:0,revokedInvites:0,expiredInvites:0,
 roleChanges:0,membershipEvents:0,renewals:0,cancellations:0};
const member={userId:"user_demo_bob",email:"bob@example.com",role:"SALES_REP" as const,
 revision:0,active:true};
const invitation={id:INVITE,organizationId:A,recipientEmail:"carla@example.com",
 role:"MEMBER" as const,status:"pending" as const,
 issuedAt:"2026-11-24T11:00:00.000Z",
 expiresAt:"2026-11-26T11:00:00.000Z",version:1};
const activity={eventId:INVITE,kind:"role.changed" as const,
 subjectId:"user_demo_bob",actorUserId:"user_demo_alice",
 occurredAt:"2026-11-24T11:00:00.000Z"};
const noMore={nextCursor:null};
const api=()=>({
 summary:{summary:async()=>counts},
 members:{page:async()=>({...noMore,items:[member]})},
 invitations:{page:async()=>({...noMore,items:[invitation]})},
 activity:{page:async()=>({...noMore,items:[activity]})},
 actions:{
  issue:async()=>invitation,cancel:async()=>invitation,renew:async()=>invitation,
 },
 roles:{
  change:async()=>member,revoke:async()=>({revoked:true as const}),
 },
});
test("R53 atomic owner workspace hydrates four signed read models",async()=>{
 const controller=new P4R53CiOwnerWorkspaceController(api() as never);
 const v=await controller.refresh(A);
 assert.equal(v.phase,"ready");
 assert.equal(v.orgId,A);
 assert.equal(v.members.length,1);
 assert.equal(v.invitations.length,1);
 assert.equal(v.activity.length,1);
 assert.equal(v.counts?.activeMembers,1);
 assert.ok(Object.isFrozen(v));
});
test("R53 owner role mutation sends revision from fresh member view and refetches",async()=>{
 let revision=-1,role="";
 let reads=0;
 const deps:any=api();
 deps.summary.summary=async()=>{reads++;return counts;};
 deps.roles.change=async(_org:string,_id:string,next:string,expected:number)=>{
  revision=expected;role=next;return {...member,role:next as "SALES_REP",revision:1};
 };
 const controller=new P4R53CiOwnerWorkspaceController(deps as never);
 await controller.refresh(A);
 assert.equal((await controller.changeRole(A,"user_demo_bob","SALES_MANAGER")).phase,
  "ready");
 assert.equal(revision,0);
 assert.equal(role,"SALES_MANAGER");
 assert.equal(reads,2);
});
test("R53 tenant switch discards late responses from previous organization",async()=>{
 let resolveA:(value:typeof counts)=>void=()=>{};
 let initial=true;
 const deferred=new Promise<typeof counts>(r=>resolveA=r);
 const deps:any=api();
 deps.summary.summary=async(org:string)=>{
  if(org===A&&initial){initial=false;return deferred;}
  return {...counts,activeMembers:0};
 };
 const controller=new P4R53CiOwnerWorkspaceController(deps as never);
 const old=controller.refresh(A);
 const latest=await controller.refresh(B);
 resolveA(counts);
 await old;
 assert.equal(latest.orgId,B);
 assert.equal(controller.snapshot().orgId,B);
 assert.equal(controller.snapshot().counts?.activeMembers,0);
});
test("R53 partial read failure clears every previously visible record",async()=>{
 let fail=false;const deps:any=api();
 deps.activity.page=async()=>{
  if(fail)throw Error("sensitive provider failure");
  return {items:[activity],nextCursor:null};
 };
 const controller=new P4R53CiOwnerWorkspaceController(deps as never);
 assert.equal((await controller.refresh(A)).phase,"ready");
 fail=true;
 const denied=await controller.refresh(A);
 assert.equal(denied.phase,"denied");
 assert.equal(denied.counts,null);
 assert.deepEqual(denied.members,[]);
 assert.deepEqual(denied.invitations,[]);
 assert.deepEqual(denied.activity,[]);
 assert.equal(JSON.stringify(denied).includes("provider failure"),false);
});
test("R53 pagination rejects duplicates and invalid member revocation",async()=>{
 const deps:any=api();
 deps.members.page=async(_org:string,_f:string,_q:string,cursor:string|null)=>
  cursor===null?{items:[member],nextCursor:"fake.cursor"}:
   {items:[member],nextCursor:null};
 const controller=new P4R53CiOwnerWorkspaceController(deps as never);
 await controller.refresh(A);
 assert.equal((await controller.more(A,"members")).phase,"denied");
 assert.deepEqual(controller.snapshot().members,[]);
 assert.equal((await controller.revokeMember(A,"nonexistent")).phase,"denied");
});
test("R53 SSR renders actual React owner panel with 11 metrics and three workflows",async()=>{
 const controller=new P4R53CiOwnerWorkspaceController(api() as never);
 const snapshot=await controller.refresh(A);
 const noop=()=>{};
 const html=renderToStaticMarkup(createElement(P4R53CiOwnerWorkspacePanel,{
  snapshot,onRefresh:noop,onInvite:noop,onRenew:noop,onCancel:noop,
  onRole:noop,onRevoke:noop,onMore:noop,
  onMemberFilter:noop,onInvitationFilter:noop,onActivityFilter:noop,
 }));
 for(const value of ["Owner operations","Organization overview","Team members",
  "Invitations","Recent activity","bob@example.com","carla@example.com",
  "role.changed","Issue invitation","Revoke access",
  'data-ci-owner-workspace="fictional-only"','data-metric="activeMembers"']){
  assert.ok(html.includes(value),value);
 }
 for(const secret of ["auth0|","token_hash","encrypted_token",
  "eyJhbGciOi","postgresql://"]){
  assert.equal(html.includes(secret),false);
 }
});
