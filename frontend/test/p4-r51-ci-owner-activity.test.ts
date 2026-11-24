import assert from "node:assert/strict";
import {test} from "node:test";
import {parseP4R51Activity,P4R51CiOwnerActivityClient,P4R51CiActivityError}
 from "../src/lib/p4-r51-ci-owner-activity-client";
import {P4R51CiOwnerActivityController}
 from "../src/lib/p4-r51-ci-owner-activity-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG="10000000-0000-4000-8000-000000000001";
const ID="10000000-0000-4000-8000-000000000002";
const event={eventId:ID,kind:"member.revoked" as const,
 subjectId:"user_demo_bob",actorUserId:"user_demo_alice",
 occurredAt:"2026-11-24T11:00:00.000Z"};
const HEAD={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
const result=(data:unknown,status=200)=>new Response(JSON.stringify(data),
 {status,headers:HEAD});
const client=(fn:typeof fetch)=>new P4R51CiOwnerActivityClient(
 "http://127.0.0.1:5591/",async()=>"abc.def.ghi",fn,ENV);
const bad=(status:number,code:string)=>(e:unknown)=>
 e instanceof P4R51CiActivityError&&e.status===status&&e.code===code;
test("R51 role/member and invite event parser rejects secret and inconsistent actor",()=>{
 assert.deepEqual(parseP4R51Activity(event),event);
 assert.equal(parseP4R51Activity({...event,token_hash:"secret"}),null);
 assert.equal(parseP4R51Activity({...event,subjectId:"alice@example.com"}),null);
 assert.equal(parseP4R51Activity({...event,kind:"member.reactivated"}),null);
 assert.equal(parseP4R51Activity({...event,eventId:"not-uuid"}),null);
 assert.deepEqual(parseP4R51Activity({...event,kind:"member.reactivated",
  actorUserId:null}),{...event,kind:"member.reactivated",actorUserId:null});
});
test("R51 typed owner GET is no-cache, signed, exact 5-field event response",async()=>{
 let seen:RequestInit|undefined;
 const fn=(async(_url:unknown,options?:RequestInit)=>{
  seen=options;return result({scope:"disposable-ci-only",data:[event]});
 }) as typeof fetch;
 assert.deepEqual(await client(fn).list(ORG,"member.revoked"),[event]);
 assert.equal(seen?.method,"GET");
 assert.equal(seen?.credentials,"omit");assert.equal(seen?.cache,"no-store");
 assert.equal((seen?.headers as Record<string,string>).Authorization,
  "Bearer abc.def.ghi");
});
test("R51 malformed org, kind or offsite origin fails before network",async()=>{
 let calls=0;const fn=(async()=>{calls++;return result({});}) as typeof fetch;
 await assert.rejects(client(fn).list("nope","all"),bad(400,"INVALID_INPUT"));
 await assert.rejects(client(fn).list(ORG,"OWNER" as "all"),
  bad(400,"INVALID_INPUT"));
 assert.equal(calls,0);
 assert.throws(()=>new P4R51CiOwnerActivityClient(
  "https://merchant.example.com/",async()=>"a.b.c",fn,ENV),
  P4R51CiActivityError);
});
test("R51 rejects duplicate, malformed events, wrong filter and bad envelope",async()=>{
 for(const data of [
  {scope:"disposable-ci-only",data:[event,event]},
  {scope:"disposable-ci-only",data:[{...event,kind:"role.changed"}]},
  {scope:"disposable-ci-only",data:[{...event,encrypted_token:"x"}]},
  {scope:"production",data:[event]},
 ]){
  const fn=(async()=>result(data)) as typeof fetch;
  await assert.rejects(client(fn).list(ORG,"member.revoked"),
   bad(503,"INVALID_RESPONSE"));
 }
});
test("R51 owner activity controller clears previously loaded activity on denial",async()=>{
 let hit=0;const api={list:async()=>{hit++;if(hit>1)throw Error("private jwt");
  return [event];}};
 const ctl=new P4R51CiOwnerActivityController(api as never);
 assert.equal((await ctl.refresh(ORG,"all")).events.length,1);
 const next=await ctl.refresh(ORG,"all");
 assert.equal(next.phase,"denied");assert.deepEqual(next.events,[]);
 assert.equal(JSON.stringify(next).includes("jwt"),false);
});
