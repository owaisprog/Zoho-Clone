import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R52CiActivityPageClient,P4R52CiActivityPageError}
 from "../src/lib/p4-r52-ci-activity-page-client";
import {P4R52CiActivityPageController}
 from "../src/lib/p4-r52-ci-activity-page-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG="10000000-0000-4000-8000-000000000001";
const DATA=(n:number)=>({eventId:"10000000-0000-4000-8000-"+
 String(n).padStart(12,"0"),kind:"role.changed" as const,
 subjectId:"user_demo_bob",actorUserId:"user_demo_alice",
 occurredAt:"2026-11-24T12:00:00.000Z"});
const CURSOR="eyJpbmZfc3ludGhldGljIjp0cnVlfQ."+("a".repeat(43));
const HEAD={"Cache-Control":"no-store, private",
 "X-Content-Type-Options":"nosniff"};
const result=(body:unknown,status=200)=>new Response(JSON.stringify(body),
 {status,headers:HEAD});
const client=(fetcher:typeof fetch)=>new P4R52CiActivityPageClient(
 "http://127.0.0.1:5592/",async()=>"abc.def.ghi",fetcher,ENV);
const bad=(status:number,code:string)=>(e:unknown)=>
 e instanceof P4R52CiActivityPageError&&e.status===status&&e.code===code;
test("R52 signed page uses exactly a no-cookie owner GET and filter",async()=>{
 let opts:RequestInit|undefined,url="";
 const transport=(async(path:unknown,options?:RequestInit)=>{
  opts=options;url=String(path);
  return result({scope:"disposable-ci-only",data:{
   items:[DATA(1)],nextCursor:null}});
 }) as typeof fetch;
 assert.deepEqual(await client(transport).page(ORG,"role.changed"),{
  items:[DATA(1)],nextCursor:null});
 assert.equal(opts?.credentials,"omit");assert.equal(opts?.cache,"no-store");
 assert.equal(opts?.method,"GET");
 assert.ok(url.includes("/activity/page?kind=role.changed&cursor="));
});
test("R52 rejects invalid cursor, untrusted kind, and nonloopback origins",async()=>{
 let calls=0;const fn=(async()=>{calls++;return result({})}) as typeof fetch;
 await assert.rejects(client(fn).page(ORG,"OWNER" as "all"),
  bad(400,"INVALID_INPUT"));
 await assert.rejects(client(fn).page(ORG,"all","bad"),
  bad(400,"INVALID_INPUT"));
 assert.equal(calls,0);
 assert.throws(()=>new P4R52CiActivityPageClient(
  "https://example.com/",async()=>"a.b.c",fn,ENV),
  P4R52CiActivityPageError);
});
test("R52 refuses private fields, duplicate IDs and unbounded next links",async()=>{
 const fixtures=[
  {items:[{...DATA(1),email:"real@customer.com"}],nextCursor:null},
  {items:[DATA(1),DATA(1)],nextCursor:null},
  {items:[DATA(1)],nextCursor:CURSOR},
  {items:[{...DATA(1),kind:"member.revoked"}],nextCursor:null},
 ];
 for(const data of fixtures){
  const fn=(async()=>result({scope:"disposable-ci-only",data})) as typeof fetch;
  await assert.rejects(client(fn).page(ORG,"role.changed"),
   bad(503,"INVALID_RESPONSE"));
 }
});
test("R52 controller concatenates distinct events and clears stale timeline",async()=>{
 let calls=0;const a=Array.from({length:20},(_,i)=>DATA(i+1));
 const api={page:async()=>{calls++;
  if(calls===1)return {items:a,nextCursor:CURSOR};
  if(calls===2)return {items:[DATA(21)],nextCursor:null};
  throw Error("private signed token");}};
 const ctl=new P4R52CiActivityPageController(api as never);
 assert.equal((await ctl.refresh(ORG,"all")).events.length,20);
 assert.equal((await ctl.more(ORG)).events.length,21);
 assert.equal((await ctl.more(ORG)).phase,"denied");
 assert.deepEqual(ctl.snapshot().events,[]);
});
test("R52 controller rejects duplicate events across page boundaries",async()=>{
 const api={page:async(_org:string,_kind:string,next:string|null)=>
  next===null?{items:[DATA(1)],nextCursor:CURSOR}:
   {items:[DATA(1)],nextCursor:null}};
 const ctl=new P4R52CiActivityPageController(api as never);
 assert.equal((await ctl.refresh(ORG)).phase,"ready");
 assert.equal((await ctl.more(ORG)).phase,"denied");
 assert.equal(ctl.snapshot().events.length,0);
});
