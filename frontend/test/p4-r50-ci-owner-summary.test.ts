import assert from "node:assert/strict";
import {test} from "node:test";
import {parseP4R50OwnerCounts,P4R50CiOwnerSummaryClient,
 P4R50CiOwnerSummaryError}
 from "../src/lib/p4-r50-ci-owner-summary-client";
import {P4R50CiOwnerSummaryController}
 from "../src/lib/p4-r50-ci-owner-summary-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG="10000000-0000-4000-8000-000000000001";
const COUNTS={activeMembers:2,revokedMembers:1,salesManagers:1,
 pendingInvites:2,acceptedInvites:1,revokedInvites:1,expiredInvites:0,
 roleChanges:3,membershipEvents:2,renewals:1,cancellations:1};
const HEAD={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
const result=(data:unknown,status=200)=>new Response(JSON.stringify(data),
 {status,headers:HEAD});
const api=(transport:typeof fetch)=>new P4R50CiOwnerSummaryClient(
 "http://127.0.0.1:5558/",async()=>"abc.def.ghi",transport,ENV);
const bad=(status:number,code:string)=>(e:unknown)=>
 e instanceof P4R50CiOwnerSummaryError&&e.status===status&&e.code===code;
test("R50 summary projection has precisely 11 safe integer counters",()=>{
 assert.deepEqual(parseP4R50OwnerCounts(COUNTS),COUNTS);
 assert.ok(Object.isFrozen(parseP4R50OwnerCounts(COUNTS)));
 for(const input of [{...COUNTS,externalEmail:"bob@example.com"},
  {...COUNTS,activeMembers:-1},{...COUNTS,roleChanges:NaN},
  {...COUNTS,salesManagers:3},{...COUNTS,pendingInvites:1.5},
  {...COUNTS,cancellations:1000001}]){
  assert.equal(parseP4R50OwnerCounts(input),null);
 }
});
test("R50 signed readonly owner GET has no credential forwarding or caching",async()=>{
 let seen:RequestInit|undefined;
 const fn=(async(_url:unknown,opts?:RequestInit)=>{
  seen=opts;return result({scope:"disposable-ci-only",data:COUNTS});
 }) as typeof fetch;
 assert.deepEqual(await api(fn).summary(ORG),COUNTS);
 assert.equal(seen?.method,"GET");
 assert.equal(seen?.credentials,"omit");
 assert.equal(seen?.cache,"no-store");
 assert.equal(seen?.redirect,"error");
 assert.equal((seen?.headers as Record<string,string>).Authorization,
  "Bearer abc.def.ghi");
});
test("R50 owner summary rejects invalid IDs and non-CI hosts before HTTP",async()=>{
 let calls=0;
 const fn=(async()=>{calls++;return result({})}) as typeof fetch;
 await assert.rejects(api(fn).summary("bad"),bad(400,"INVALID_INPUT"));
 assert.equal(calls,0);
 assert.throws(()=>new P4R50CiOwnerSummaryClient("https://example.com/",
  async()=>"a.b.c",fn,ENV),P4R50CiOwnerSummaryError);
});
test("R50 strict JSON rejects extra identity or error codes",async()=>{
 for(const env of [
  {scope:"disposable-ci-only",data:{...COUNTS,token_hash:"secret"}},
  {scope:"disposable-ci-only",data:{...COUNTS,salesManagers:9}},
  {scope:"production",data:COUNTS},
  {scope:"disposable-ci-only",data:COUNTS,actorId:"user_demo_alice"},
 ]){
  const fn=(async()=>result(env)) as typeof fetch;
  await assert.rejects(api(fn).summary(ORG),bad(503,"INVALID_RESPONSE"));
 }
 const fn=(async()=>result({error:{code:"ACCESS_DENIED"}},403)) as typeof fetch;
 await assert.rejects(api(fn).summary(ORG),bad(403,"ACCESS_DENIED"));
});
test("R50 controller clears stale metrics and does not echo server errors",async()=>{
 let count=0;
 const model={summary:async()=>{
  count++;if(count>1)throw Error("private JWT");
  return COUNTS;
 }};
 const ctl=new P4R50CiOwnerSummaryController(model as never);
 assert.equal((await ctl.refresh(ORG)).counts?.activeMembers,2);
 const state=await ctl.refresh(ORG);
 assert.equal(state.phase,"denied");
 assert.equal(state.counts,null);
 assert.equal(JSON.stringify(state).includes("JWT"),false);
 ctl.reset();assert.equal(ctl.snapshot().phase,"idle");
});
