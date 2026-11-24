import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R58CiLeadStageClient,P4R58CiLeadStageError,
 parseP4R58LeadHistory} from "../src/lib/p4-r58-ci-crm-lead-stage-client";
import {P4R58CiLeadDetailController}
 from "../src/lib/p4-r58-ci-crm-lead-detail-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG="10000000-0000-4000-8000-000000000001";
const ID="10000000-0000-4000-8000-000000000002";
const DATE="2026-11-24T16:00:00.000Z";
const lead={leadId:ID,companyName:"Demo Alpha Payments",
 contactEmail:"alpha@example.com",source:"WEBSITE" as const,
 status:"NEW" as const,revision:0,createdAt:DATE};
const event={eventId:ID,eventKind:"CREATED" as const,
 beforeStatus:null,afterStatus:"NEW" as const,
 revision:0,actorUserId:"user_demo_alice",occurredAt:DATE};
const HEAD={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),
 {status,headers:HEAD});
const client=(f:typeof fetch)=>new P4R58CiLeadStageClient(
 "http://127.0.0.1:5558/",async()=>"abc.def.ghi",f,ENV);
const denied=(code:string)=>(e:unknown)=>
 e instanceof P4R58CiLeadStageError&&e.code===code;
test("R58 history parser validates contiguous stage revisions and transitions",()=>{
 const second={...event,eventId:"10000000-0000-4000-8000-000000000003",
  eventKind:"STATUS_CHANGED" as const,beforeStatus:"NEW" as const,
  afterStatus:"CONTACTED" as const,revision:1};
 assert.deepEqual(parseP4R58LeadHistory([event,second]),[event,second]);
 assert.equal(parseP4R58LeadHistory([event,{...second,revision:2}]),null);
 assert.equal(parseP4R58LeadHistory([event,{...second,token_hash:"secret"}]),null);
 assert.equal(parseP4R58LeadHistory([event,{...second,afterStatus:"QUALIFIED"}]),null);
});
test("R58 signed PATCH and history GET omit cookies and validate exact responses",async()=>{
 const requests:RequestInit[]=[];
 const f=(async(_url:unknown,opts?:RequestInit)=>{
  requests.push(opts!);
  return response({scope:"disposable-ci-only",data:
   opts?.method==="GET"?[event]:{...lead,status:"CONTACTED",revision:1}});
 }) as typeof fetch;
 assert.deepEqual(await client(f).history(ORG,ID),[event]);
 const value=await client(f).change(ORG,ID,"CONTACTED",0);
 assert.equal(value.status,"CONTACTED");
 assert.deepEqual(requests.map(x=>x.method),["GET","PATCH"]);
 assert.ok(requests.every(x=>x.credentials==="omit"&&x.cache==="no-store"));
});
test("R58 invalid transitions and malformed IDs denied before HTTP",async()=>{
 let n=0;
 const f=(async()=>{n++;return response({})}) as typeof fetch;
 await assert.rejects(client(f).change(ORG,ID,"NEW" as "CONTACTED",0),
  denied("INVALID_INPUT"));
 await assert.rejects(client(f).history(ORG,"bad"),denied("INVALID_INPUT"));
 assert.equal(n,0);
});
test("R58 detail controller persists stage change, then clears on audit mismatch",async()=>{
 let next=false,invalid=false;
 const deps={list:async()=>[{...lead,status:next?"CONTACTED":"NEW",
  revision:next?1:0}]};
 const stages={history:async()=>invalid?[]:next?[
  event,{...event,eventId:"10000000-0000-4000-8000-000000000003",
   eventKind:"STATUS_CHANGED",beforeStatus:"NEW",
   afterStatus:"CONTACTED",revision:1}]:[event],
 change:async()=>{next=true;return {...lead,status:"CONTACTED",revision:1};}};
 const ctl=new P4R58CiLeadDetailController(deps as never,stages as never);
 assert.equal((await ctl.load(ORG,ID)).lead?.status,"NEW");
 assert.equal((await ctl.change(ORG,"CONTACTED")).lead?.status,"CONTACTED");
 invalid=true;
 assert.equal((await ctl.load(ORG,ID)).phase,"denied");
 assert.equal(ctl.snapshot().lead,null);
});
