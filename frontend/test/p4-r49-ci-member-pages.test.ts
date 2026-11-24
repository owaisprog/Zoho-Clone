import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R49CiMemberPageClient,P4R49CiPageError}
 from "../src/lib/p4-r49-ci-member-page-client";
import {P4R49CiMemberPageController}
 from "../src/lib/p4-r49-ci-member-page-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG="10000000-0000-4000-8000-000000000001";
const CURSOR="eyJ0ZXN0IjoidHJ1ZSJ9."+("a".repeat(43));
const row=(s:string)=>({userId:"user_demo_"+s,email:null,
 role:"SALES_REP" as const,revision:0,active:true});
const HEADERS={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),
 {status,headers:HEADERS});
const client=(fn:typeof fetch)=>new P4R49CiMemberPageClient(
 "http://127.0.0.1:5556/",async()=>"abc.def.ghi",fn,ENV);
const denied=(code:string)=>(e:unknown)=>
 e instanceof P4R49CiPageError&&e.code===code;
test("R49 client sends scoped signed GET without cookies",async()=>{
 let seen:RequestInit|undefined;
 let path="";
 const fn=(async(url:unknown,options?:RequestInit)=>{
  path=String(url);seen=options;
  return response({scope:"disposable-ci-only",data:{
   items:[row("aa")],nextCursor:null}});
 }) as typeof fetch;
 assert.deepEqual(await client(fn).page(ORG,"active","AA"),{
  items:[row("aa")],nextCursor:null,
 });
 assert.equal(seen?.credentials,"omit");
 assert.equal(seen?.method,"GET");
 assert.equal(seen?.cache,"no-store");
 assert.ok(path.includes("status=active&q=aa&cursor="));
});
test("R49 client fails on invalid filter, search and cursor before network",async()=>{
 let n=0;
 const fn=(async()=>{n++;return response({})}) as typeof fetch;
 for(const [org,status,q,cursor] of [
  ["bad","all","",null],[ORG,"OWNER","",null],
  [ORG,"all","%",null],[ORG,"revoked","x".repeat(41),null],
  [ORG,"all","","bad"],
 ] as const){
  await assert.rejects(client(fn).page(org,status as "all",q,cursor),
   denied("INVALID_INPUT"));
 }
 assert.equal(n,0);
});
test("R49 response rejects fake email, extra fields, duplicates and mismatched status",async()=>{
 for(const values of [
  [{...row("aa"),email:"real@merchant.com"}],
  [{...row("aa"),providerSub:"auth0|bob"}],
  [row("aa"),row("aa")],
  [{...row("aa"),active:false}],
 ]){
  const fn=(async()=>response({scope:"disposable-ci-only",data:{
   items:values,nextCursor:null}})) as typeof fetch;
  await assert.rejects(client(fn).page(ORG,"active",""),
   denied("INVALID_RESPONSE"));
 }
});
test("R49 controller appends pages and clears after stale cursor and duplicates",async()=>{
 let n=0;
 const data=Array.from({length:20},(_,i)=>row("a"+String.fromCharCode(97+i)));
 const api={page:async()=>{
  n++;
  if(n===1)return {items:data,nextCursor:CURSOR};
  if(n===2)return {items:[row("au")],nextCursor:null};
  return {items:[row("au")],nextCursor:null};
 }};
 const ctl=new P4R49CiMemberPageController(api as never);
 assert.equal((await ctl.refresh(ORG,"all","")).members.length,20);
 assert.equal((await ctl.more(ORG)).members.length,21);
 assert.equal((await ctl.more(ORG)).phase,"denied");
 assert.deepEqual(ctl.snapshot().members,[]);
});
test("R49 unauthorized refresh never retains the previous member view",async()=>{
 let n=0;
 const api={page:async()=>{n++;if(n>1)throw Error("private JWT");
  return {items:[row("aa")],nextCursor:null};}};
 const ctl=new P4R49CiMemberPageController(api as never);
 assert.equal((await ctl.refresh(ORG,"all","")).phase,"ready");
 assert.equal((await ctl.refresh(ORG,"all","")).phase,"denied");
 assert.deepEqual(ctl.snapshot().members,[]);
 assert.equal(JSON.stringify(ctl.snapshot()).includes("JWT"),false);
});
