import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import {P4R60CiCrmLeadPageClient,P4R60CiPageError}
 from "../src/lib/p4-r60-ci-crm-lead-page-client";
import {P4R60CiCrmLeadPageController}
 from "../src/lib/p4-r60-ci-crm-lead-page-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG=randomUUID();
const record=(i:number)=>({leadId:"10000000-0000-4000-8000-"+
 String(i).padStart(12,"0"),companyName:"Demo Lead Number "+i,
 contactEmail:"lead"+i+"@example.com",source:"WEBSITE" as const,
 status:"NEW" as const,revision:0,createdAt:"2026-11-24T12:00:00.000Z"});
const CURSOR="eyJwYWdlIjoyfQ."+("a".repeat(43));
const headers={"Cache-Control":"no-store, private",
 "X-Content-Type-Options":"nosniff"};
const response=(data:unknown,status=200)=>
 new Response(JSON.stringify(data),{status,headers});
const client=(f:typeof fetch)=>new P4R60CiCrmLeadPageClient(
 "http://127.0.0.1:5560/",async()=>"abc.def.ghi",f,ENV);
const denied=(status:number,code:string)=>(x:unknown)=>
 x instanceof P4R60CiPageError&&x.status===status&&x.code===code;
test("R60 signed owner lead page uses exact no-cookie GET and scoped filter",async()=>{
 let seen:RequestInit|undefined,url="";
 const fetcher=(async(x:unknown,opts?:RequestInit)=>{url=String(x);seen=opts;
  return response({scope:"disposable-ci-only",data:{
   items:[record(1)],nextCursor:null}});
 }) as typeof fetch;
 assert.equal((await client(fetcher).page(ORG,"NEW","Lead")).items.length,1);
 assert.equal(seen?.credentials,"omit");assert.equal(seen?.cache,"no-store");
 assert.equal(seen?.method,"GET");
 assert.ok(url.includes("status=NEW&q=lead&cursor="));
});
test("R60 rejects invalid cursor/filter and private response fields",async()=>{
 let count=0;
 const f=(async()=>{count++;return response({scope:"disposable-ci-only",
  data:{items:[{...record(1),privateJwt:"x"}],nextCursor:null}})}) as typeof fetch;
 await assert.rejects(client(f).page(ORG,"BAD" as "all"),denied(400,"INVALID_INPUT"));
 await assert.rejects(client(f).page(ORG,"all","","wrong"),denied(400,"INVALID_INPUT"));
 assert.equal(count,0);
 await assert.rejects(client(f).page(ORG),denied(503,"INVALID_RESPONSE"));
});
test("R60 controller appends distinct rows, clears cross-page duplicates",async()=>{
 let requests=0;
 const page=Array.from({length:20},(_,i)=>record(i+1));
 const api={page:async()=>{requests++;
  if(requests===1)return {items:page,nextCursor:CURSOR};
  if(requests===2)return {items:[record(21)],nextCursor:null};
  return {items:[record(21)],nextCursor:null};}};
 const ctl=new P4R60CiCrmLeadPageController(api as never);
 assert.equal((await ctl.refresh(ORG)).leads.length,20);
 assert.equal((await ctl.more()).leads.length,21);
 assert.equal(ctl.snapshot().nextCursor,null);
 const invalid=new P4R60CiCrmLeadPageController({
  page:async(_org:string,_filter:string,_search:string,cursor:string|null)=>
   cursor===null?{items:page,nextCursor:CURSOR}:
   {items:[record(1)],nextCursor:null},
 } as never);
 await invalid.refresh(ORG);
 assert.equal((await invalid.more()).phase,"denied");
 assert.deepEqual(invalid.snapshot().leads,[]);
});
test("R60 pagination controller clears previous tenant results on failed refresh",async()=>{
 let fail=false;
 const ctl=new P4R60CiCrmLeadPageController({
  page:async()=>{if(fail)throw Error("hidden JWT");return {
   items:[record(1)],nextCursor:null};},
 } as never);
 await ctl.refresh(ORG);
 fail=true;
 const v=await ctl.refresh("10000000-0000-4000-8000-000000000002");
 assert.equal(v.phase,"denied");assert.deepEqual(v.leads,[]);
 assert.equal(JSON.stringify(v).includes("JWT"),false);
});
