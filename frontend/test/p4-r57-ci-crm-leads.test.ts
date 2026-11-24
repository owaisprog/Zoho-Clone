import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R57CiCrmLeadClient,P4R57CiCrmError,
 parseP4R57LeadList} from "../src/lib/p4-r57-ci-crm-lead-client";
import {P4R57CiCrmLeadController} from "../src/lib/p4-r57-ci-crm-lead-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG="10000000-0000-4000-8000-000000000001";
const DATA={leadId:"10000000-0000-4000-8000-000000000002",
 companyName:"Demo Alpha Payments",contactEmail:"alpha@example.com",
 source:"WEBSITE" as const,status:"NEW" as const,revision:0,
 createdAt:"2026-11-24T10:00:00.000Z"};
const HEAD={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),
 {status,headers:HEAD});
const client=(fetcher:typeof fetch)=>new P4R57CiCrmLeadClient(
 "http://127.0.0.1:5557/",async()=>"abc.def.ghi",fetcher,ENV);
const denied=(code:string)=>(e:unknown)=>
 e instanceof P4R57CiCrmError&&e.code===code;
test("R57 fictional CRM parser validates exact safe lead shape and dates",()=>{
 assert.deepEqual(parseP4R57LeadList([DATA]),[DATA]);
 assert.equal(parseP4R57LeadList([DATA,DATA]),null);
 assert.equal(parseP4R57LeadList([{...DATA,providerSub:"auth0|private"}]),null);
 assert.equal(parseP4R57LeadList([{...DATA,contactEmail:"client@gmail.com"}]),null);
 assert.equal(parseP4R57LeadList([{...DATA,status:"OWNER"}]),null);
});
test("R57 signed owner GET/POST use no cookies, no redirect, no cache",async()=>{
 const calls:RequestInit[]=[];
 const f=(async(_url:unknown,opts?:RequestInit)=>{
  calls.push(opts!);return response({scope:"disposable-ci-only",
   data:opts?.method==="GET"?[DATA]:DATA});
 }) as typeof fetch;
 assert.deepEqual(await client(f).list(ORG),[DATA]);
 assert.deepEqual(await client(f).create(ORG,{
  companyName:DATA.companyName,contactEmail:DATA.contactEmail,
  source:DATA.source}),DATA);
 assert.deepEqual(calls.map(x=>x.method),["GET","POST"]);
 assert.ok(calls.every(x=>x.credentials==="omit"&&
  x.cache==="no-store"&&x.redirect==="error"));
});
test("R57 rejects malformed synthetic input before network",async()=>{
 let requests=0;
 const f=(async()=>{requests++;return response({});}) as typeof fetch;
 await assert.rejects(client(f).create(ORG,{
  companyName:"Client Real",
  contactEmail:"real@gmail.com",source:"WEBSITE",
 }),denied("INVALID_INPUT"));
 await assert.rejects(client(f).list("wrong"),denied("INVALID_INPUT"));
 assert.equal(requests,0);
});
test("R57 controller refreshes persisted state and clears upon denied tenant",async()=>{
 let deniedNow=false,created=false;
 const api={list:async()=>{
  if(deniedNow)throw Error("secret JWT");
  return created?[DATA]:[];
 },create:async()=>{created=true;return DATA;}};
 const ctl=new P4R57CiCrmLeadController(api as never);
 assert.equal((await ctl.refresh(ORG)).leads.length,0);
 assert.equal((await ctl.create(ORG,{
  companyName:DATA.companyName,contactEmail:DATA.contactEmail,
  source:DATA.source})).leads.length,1);
 deniedNow=true;
 assert.equal((await ctl.refresh(ORG)).phase,"denied");
 assert.deepEqual(ctl.snapshot().leads,[]);
 assert.equal(JSON.stringify(ctl.snapshot()).includes("JWT"),false);
});
