import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import {P4R63CiNotePageClient,P4R63CiPageError}
 from "../src/lib/p4-r63-ci-note-page-client";
import {P4R63CiNotePageController}
 from "../src/lib/p4-r63-ci-note-page-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG=randomUUID(),LEAD=randomUUID(),T="2026-11-25T00:00:00.000Z";
const CURSOR="e30."+("a".repeat(43));
const note=(id:number)=>({noteId:randomUUID(),leadId:LEAD,
 noteText:"Demo follow up number "+id,
 actorUserId:"user_demo_alice",createdAt:T});
const HEAD={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:HEAD});
const client=(transport:typeof fetch)=>new P4R63CiNotePageClient(
 "http://127.0.0.1:5563/",async()=>"abc.def.ghi",transport,ENV);
const fails=(code:string)=>(e:unknown)=>
 e instanceof P4R63CiPageError&&e.code===code;
test("R63 signed notes client enforces localhost and owner JWT",async()=>{
 let url="",options:RequestInit|undefined;
 const transport=(async(x:unknown,init?:RequestInit)=>{
  url=String(x);options=init;
  return reply({scope:"disposable-ci-only",data:{
   items:[note(1)],nextCursor:null}});
 }) as typeof fetch;
 assert.equal((await client(transport).page(ORG,LEAD)).items.length,1);
 assert.ok(url.includes("/notes/page?cursor="));
 assert.equal(options?.credentials,"omit");
 assert.equal(options?.cache,"no-store");
 assert.equal(options?.redirect,"error");
});
test("R63 rejects malformed cursor or hidden fields before leaking them",async()=>{
 let requests=0;
 const transport=(async()=>{
  requests++;
  return reply({scope:"disposable-ci-only",data:{
   items:[{...note(1),jwt:"private"}],nextCursor:null}});
 }) as typeof fetch;
 await assert.rejects(client(transport).page(ORG,LEAD,"evil"),
  fails("INVALID_INPUT"));
 assert.equal(requests,0);
 await assert.rejects(client(transport).page(ORG,LEAD),fails("INVALID_RESPONSE"));
});
test("R63 append 20+5, detect duplicate and clear stale cross-lead data",async()=>{
 const first=Array.from({length:20},(_,i)=>note(i));
 const second=Array.from({length:5},(_,i)=>note(i+20));
 const pager={page:async(_o:string,_l:string,cursor:string|null)=>
  cursor===null?{items:first,nextCursor:CURSOR}:
  {items:second,nextCursor:null}};
 const ctrl=new P4R63CiNotePageController(pager as never);
 assert.equal((await ctrl.refresh(ORG,LEAD)).notes.length,20);
 assert.equal((await ctrl.more()).notes.length,25);
 assert.equal(ctrl.snapshot().nextCursor,null);
 const bad=new P4R63CiNotePageController({page:async(
  _o:string,_l:string,cursor:string|null)=>
   cursor===null?{items:first,nextCursor:CURSOR}:
   {items:[first[0]],nextCursor:null}} as never);
 await bad.refresh(ORG,LEAD);
 assert.equal((await bad.more()).phase,"denied");
 assert.deepEqual(bad.snapshot().notes,[]);
});
test("R63 denied refresh always clears previous organization notes",async()=>{
 let shouldDeny=false;
 const ctrl=new P4R63CiNotePageController({
  page:async()=>{if(shouldDeny)throw Error("secret bearer JWT");
   return {items:[note(1)],nextCursor:null};},
 } as never);
 await ctrl.refresh(ORG,LEAD);
 shouldDeny=true;
 assert.equal((await ctrl.refresh(randomUUID(),LEAD)).phase,"denied");
 assert.equal(JSON.stringify(ctrl.snapshot()).includes("JWT"),false);
});
