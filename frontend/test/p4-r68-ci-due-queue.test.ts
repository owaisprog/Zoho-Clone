import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import React,{createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {P4R68CiDueQueueController}
 from "../src/lib/p4-r68-ci-due-queue-controller";
import {P4R68CiDueQueuePanel}
 from "../src/components/p4-r68-ci-due-queue";
const ORG=randomUUID(),OTHER=randomUUID(),L1=randomUUID(),L2=randomUUID();
const DATE="2026-11-25T00:00:00.000Z";
const CURSOR="e30."+("a".repeat(43));
const items=Array.from({length:25},(_,i)=>({
 companyName:i%2===0?"Demo Alpha Payments":"Demo Beta Payments",
 task:{
  taskId:randomUUID(),leadId:i%2===0?L1:L2,
  title:"Demo call prospect for update "+i,
  dueDate:i<12?"2026-12-01":"2026-12-05",
  status:"OPEN" as const,revision:0,createdBy:"user_demo_alice",
  updatedBy:null,createdAt:DATE,completedAt:null,
 },
})).sort((a,b)=>a.task.dueDate.localeCompare(b.task.dueDate)||
 a.task.taskId.localeCompare(b.task.taskId));
function fixture(){
 let revoked=false;let completed:string|null=null;
 const paging={page:async(org:string,through:string,cursor:string|null)=>{
  if(revoked||org!==ORG||through!=="2026-12-31")throw Error("access denied");
  const open=items.filter(x=>x.task.taskId!==completed);
  return cursor===null?{
   items:open.slice(0,20),nextCursor:open.length>20?CURSOR:null,
  }:{items:open.slice(20),nextCursor:null};
 }};
 const taskApi={complete:async(_org:string,_lead:string,id:string)=>{
  const found=items.find(x=>x.task.taskId===id)!;
  completed=id;
  return {...found.task,status:"DONE",revision:1,
   updatedBy:"user_demo_alice",completedAt:"2026-11-25T00:01:00.000Z"};
 }};
 const ctl=new P4R68CiDueQueueController(paging as never,taskApi as never);
 return {ctl,deny:()=>{revoked=true;},completed:()=>completed};
}
test("R68 multi-lead due queue pages and safely marks a task complete",async()=>{
 const f=fixture();
 let v=await f.ctl.load(ORG);
 assert.equal(v.phase,"ready");assert.equal(v.items.length,20);
 assert.equal(v.nextCursor,CURSOR);
 const noop=()=>{};
 const html=renderToStaticMarkup(createElement(P4R68CiDueQueuePanel,{
  view:v,onThrough:noop,onMore:noop,onComplete:noop,
 }));
 for(const label of ["Follow-up work queue","Load more due tasks",
  "Open tasks shown","Demo Alpha Payments","Mark Done"])
  assert.ok(html.includes(label),label);
 for(const secret of ["Bearer ","auth0|","postgresql://"])
  assert.equal(html.includes(secret),false);
 v=await f.ctl.more();
 assert.equal(v.items.length,25);assert.equal(v.nextCursor,null);
 const target=v.items[24]!.task.taskId;
 v=await f.ctl.complete(target);
 assert.equal(f.completed(),target);
 assert.equal(v.phase,"ready");assert.equal(v.items.length,24);
 assert.equal(v.items.some(x=>x.task.taskId===target),false);
});
test("R68 permission revocation and tenant switch clear all prior tasks",async()=>{
 const f=fixture();
 await f.ctl.load(ORG);await f.ctl.more();
 let v=await f.ctl.load(OTHER);
 assert.equal(v.phase,"denied");assert.deepEqual(v.items,[]);
 assert.equal(v.orgId,null);
 await f.ctl.load(ORG);f.deny();
 v=await f.ctl.more();
 assert.equal(v.phase,"denied");assert.deepEqual(v.items,[]);
 assert.equal(v.nextCursor,null);
});
