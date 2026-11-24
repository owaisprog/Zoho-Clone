import assert from "node:assert/strict";
import {test} from "node:test";
import {parseP4R42RoleHistory,parseP4R42HistoryPage}
 from "../src/lib/p4-r42-ci-role-history-contract";
import {P4R42CiHistoryController}
 from "../src/lib/p4-r42-ci-role-history-controller";
import {P4R41CiMemberRoleClient,P4R41CiError}
 from "../src/lib/p4-r41-ci-member-role-client";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG="10000000-0000-4000-8000-000000000001";
const EVENT={actorUserId:"user_demo_alice",targetUserId:"user_demo_bob",
 beforeRole:"SALES_REP",afterRole:"SALES_MANAGER",revision:1,
 occurredAt:"2030-01-01T00:00:00.000Z"};
const headers={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{
 status,headers,
});
test("R42 history event only allows fixed role and user fields",()=>{
 assert.deepEqual(parseP4R42RoleHistory(EVENT),EVENT);
 assert.ok(Object.isFrozen(parseP4R42RoleHistory(EVENT)));
 for(const extra of [{token_hash:"hidden"},{afterRole:"ORG_OWNER"},
  {beforeRole:"SALES_MANAGER"},{actorUserId:"real@merchant.com"},
  {occurredAt:"2026-13-88T00:00:00.000Z"},{occurredAt:"2030-01-01"},
  {revision:-1}]){
  assert.equal(parseP4R42RoleHistory({...EVENT,...extra}),null);
 }
});
test("R42 history page is bounded and immutable, rejects out-of-order timestamps",()=>{
 const later={...EVENT,revision:2,occurredAt:"2030-01-02T00:00:00.000Z"};
 assert.deepEqual(parseP4R42HistoryPage([later,EVENT]),[later,EVENT]);
 assert.ok(Object.isFrozen(parseP4R42HistoryPage([later,EVENT])));
 assert.equal(parseP4R42HistoryPage([EVENT,later]),null);
 assert.equal(parseP4R42HistoryPage(Array(21).fill(EVENT)),null);
});
test("R42 signed client returns only scoped history without cookies",async()=>{
 let seen:RequestInit|undefined;
 const transport=(async(url:unknown,opts?:RequestInit)=>{
  assert.equal(String(url).includes("/_p4_r33_ci/owner/"+ORG+"/role-history"),true);
  seen=opts;
  return response({scope:"disposable-ci-only",data:[EVENT]});
 }) as typeof fetch;
 const client=new P4R41CiMemberRoleClient("http://127.0.0.1:5000/",
  async()=>"a.b.c",transport,ENV);
 assert.deepEqual(await client.history(ORG),[EVENT]);
 assert.equal(seen?.method,"GET");assert.equal(seen?.credentials,"omit");
 assert.equal(seen?.cache,"no-store");
});
test("R42 history client denies extra data and impossible envelope",async()=>{
 for(const data of [[{...EVENT,privateAudit:"x"}],{...EVENT},
  [{...EVENT,afterRole:"PLATFORM_SUPPORT"}]]){
  const transport=(async()=>response({scope:"disposable-ci-only",data})) as typeof fetch;
  const client=new P4R41CiMemberRoleClient("http://127.0.0.1:5000/",
   async()=>"a.b.c",transport,ENV);
  await assert.rejects(client.history(ORG),e=>e instanceof P4R41CiError&&
   e.status===503&&e.code==="INVALID_RESPONSE");
 }
});
test("R42 denied history clears previous events without echoing errors",async()=>{
 const ok=new P4R42CiHistoryController({history:async()=>Object.freeze([EVENT])} as never);
 assert.equal((await ok.refresh(ORG)).phase,"ready");
 ok.reset();assert.deepEqual(ok.snapshot().entries,[]);
 const fail=new P4R42CiHistoryController({history:async()=>{
  throw Error("secret provider token");
 }} as never);
 const state=await fail.refresh(ORG);
 assert.equal(state.phase,"denied");
 assert.equal(state.entries.length,0);
 assert.equal(JSON.stringify(state).includes("secret provider token"),false);
});
