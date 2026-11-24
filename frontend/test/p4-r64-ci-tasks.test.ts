import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import {P4R64CiTaskClient,P4R64CiTaskError,parseP4R64Tasks}
 from "../src/lib/p4-r64-ci-task-client";
import {P4R64CiTaskController}
 from "../src/lib/p4-r64-ci-task-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG=randomUUID(),LEAD=randomUUID(),ID=randomUUID();
const t="2026-11-25T00:00:00.000Z",done="2026-11-25T00:02:00.000Z";
const task={taskId:ID,leadId:LEAD,title:"Demo call merchant for update",
 dueDate:"2026-12-02",status:"OPEN" as const,revision:0,
 createdBy:"user_demo_alice",updatedBy:null,createdAt:t,completedAt:null};
const completed={...task,status:"DONE" as const,revision:1,
 updatedBy:"user_demo_alice",completedAt:done};
const headers={"Cache-Control":"no-store, private",
 "X-Content-Type-Options":"nosniff"};
const respond=(v:unknown,status=200)=>new Response(JSON.stringify(v),
 {status,headers});
const client=(fetcher:typeof fetch)=>new P4R64CiTaskClient(
 "http://127.0.0.1:5564/",async()=>"abc.def.ghi",fetcher,ENV);
const denied=(code:string)=>(e:unknown)=>
 e instanceof P4R64CiTaskError&&e.code===code;
test("R64 parser enforces exact fictional task and terminal completion shape",()=>{
 assert.deepEqual(parseP4R64Tasks([task,{...completed,taskId:randomUUID()}]).map(x=>x.status),["OPEN","DONE"]);
 assert.equal(parseP4R64Tasks([{...task,secretJwt:"x"}]),null);
 assert.equal(parseP4R64Tasks([{...task,title:"Actual client"}]),null);
 assert.equal(parseP4R64Tasks([{...completed,completedAt:null}]),null);
 assert.equal(parseP4R64Tasks([{...task,dueDate:"2026-02-30"}]),null);
});
test("R64 signed API GET POST PATCH has no cookies, cache or redirects",async()=>{
 const calls:RequestInit[]=[];
 const fetcher=(async(_url:unknown,opt?:RequestInit)=>{
  calls.push(opt!);
  return respond({scope:"disposable-ci-only",data:opt?.method==="GET"?
   [task]:opt?.method==="POST"?task:completed});
 }) as typeof fetch;
 const api=client(fetcher);
 assert.deepEqual(await api.list(ORG,LEAD),[task]);
 assert.deepEqual(await api.create(ORG,LEAD,{
  title:task.title,dueDate:task.dueDate}),task);
 assert.deepEqual(await api.complete(ORG,LEAD,ID,0),completed);
 assert.deepEqual(calls.map(x=>x.method),["GET","POST","PATCH"]);
 assert.ok(calls.every(x=>x.credentials==="omit"&&x.redirect==="error"&&
  x.cache==="no-store"));
});
test("R64 non-fictional titles, bad due dates and stale revisions denied before HTTP",async()=>{
 let calls=0;
 const api=client((async()=>{calls++;return respond({});}) as typeof fetch);
 await assert.rejects(api.create(ORG,LEAD,{
  title:"Real patient Jane",dueDate:"2026-12-01"}),denied("INVALID_INPUT"));
 await assert.rejects(api.create(ORG,LEAD,{
  title:task.title,dueDate:"2026-02-30"}),denied("INVALID_INPUT"));
 await assert.rejects(api.complete(ORG,LEAD,ID,1),denied("INVALID_INPUT"));
 assert.equal(calls,0);
});
test("R64 controller create and complete refetch persisted state and clear on denial",async()=>{
 let created=false,closed=false,blocked=false;
 const fake={list:async()=>{
  if(blocked)throw Error("secret JWT");
  return created?[closed?completed:task]:[];
 },create:async()=>{created=true;return task;},
 complete:async()=>{closed=true;return completed;}};
 const controller=new P4R64CiTaskController(fake as never);
 assert.equal((await controller.load(ORG,LEAD)).tasks.length,0);
 assert.equal((await controller.create(ORG,LEAD,{
  title:task.title,dueDate:task.dueDate})).tasks.length,1);
 assert.equal((await controller.complete(ORG,LEAD,ID)).tasks[0]?.status,"DONE");
 blocked=true;
 assert.equal((await controller.load(ORG,LEAD)).phase,"denied");
 assert.deepEqual(controller.snapshot().tasks,[]);
 assert.equal(JSON.stringify(controller.snapshot()).includes("JWT"),false);
});
