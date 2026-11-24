import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R48CiInvitationPageClient,P4R48CiPageError}
 from "../src/lib/p4-r48-ci-invitation-page-client";
import {P4R48CiInvitationPageController}
 from "../src/lib/p4-r48-ci-invitation-page-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG="10000000-0000-4000-8000-000000000001";
const makeRow=(n:number)=>({id:"10000000-0000-4000-8000-"+String(n).padStart(12,"0"),
 organizationId:ORG,recipientEmail:"bob"+n+"@example.com",
 role:"MEMBER" as const,status:"revoked" as const,
 issuedAt:"2030-01-01T00:00:00.000Z",
 expiresAt:"2030-01-03T00:00:00.000Z",version:2});
const CURSOR="eyJvcmciOiJkZW1vIn0."+("a".repeat(43));
const HEADERS={"Cache-Control":"no-store, private",
 "X-Content-Type-Options":"nosniff"};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),
 {status,headers:HEADERS});
const client=(transport:typeof fetch)=>
 new P4R48CiInvitationPageClient("http://127.0.0.1:5500/",
  async()=>"abc.def.ghi",transport,ENV);
const isError=(status:number,code:string)=>(e:unknown)=>
 e instanceof P4R48CiPageError&&e.status===status&&e.code===code;
test("R48 strict signed GET page uses no cookies and sanitized next cursor",async()=>{
 let observed:RequestInit|undefined;let uri="";
 const transport=(async(u:unknown,options?:RequestInit)=>{
  uri=String(u);observed=options;
  return response({scope:"disposable-ci-only",data:{
   items:[makeRow(1)],nextCursor:null}});
 }) as typeof fetch;
 assert.deepEqual(await client(transport).page(ORG,"revoked","BOB1"),
  {items:[makeRow(1)],nextCursor:null});
 assert.equal(observed?.method,"GET");
 assert.equal(observed?.credentials,"omit");
 assert.equal(observed?.cache,"no-store");
 assert.equal(observed?.redirect,"error");
 assert.ok(uri.includes("q=bob1&cursor="));
});
test("R48 strictly rejects offsite host and untrusted filters/cursor",async()=>{
 const transport=(async()=>response({scope:"disposable-ci-only",data:{
  items:[],nextCursor:null}})) as typeof fetch;
 assert.throws(()=>new P4R48CiInvitationPageClient(
  "https://merchant.example.com",async()=>"a.b.c",transport,ENV),
  P4R48CiPageError);
 for(const [org,filter,q,cursor] of [
  ["bad","all","",null],[ORG,"OWNER","",null],
  [ORG,"all","%",null],[ORG,"all","a".repeat(41),null],
  [ORG,"all","","tampered"],
 ] as const){
  await assert.rejects(client(transport).page(
   org,filter as "all",q,cursor),isError(400,"INVALID_INPUT"));
 }
});
test("R48 strict envelope forbids secrets, wrong tenants and malformed next links",async()=>{
 const bad=[
  {scope:"disposable-ci-only",data:{items:[{...makeRow(1),hash:"x"}],nextCursor:null}},
  {scope:"disposable-ci-only",data:{items:[makeRow(1),makeRow(1)],nextCursor:null}},
  {scope:"disposable-ci-only",data:{items:[makeRow(1)],nextCursor:CURSOR}},
  {scope:"production",data:{items:[],nextCursor:null}},
  {scope:"disposable-ci-only",data:{items:[{...makeRow(1),organizationId:"bad"}],
    nextCursor:null}},
 ];
 for(const x of bad){
  const transport=(async()=>response(x)) as typeof fetch;
  await assert.rejects(client(transport).page(ORG,"all",""),
   isError(503,"INVALID_RESPONSE"));
 }
});
test("R48 controller concatenates distinct pages and clears stale data on error",async()=>{
 let hits=0;
 const api={
  page:async()=>{
   hits++;
   if(hits===1)return {items:Object.freeze(Array.from({length:20},(_,i)=>makeRow(i+1))),
    nextCursor:CURSOR};
   if(hits===2)return {items:Object.freeze([makeRow(21)]),nextCursor:null};
   throw Error("private JWT");
  },
 };
 const ctl=new P4R48CiInvitationPageController(api as never);
 assert.equal((await ctl.refresh(ORG,"all","")).items.length,20);
 assert.equal((await ctl.more(ORG)).items.length,21);
 assert.equal(ctl.snapshot().nextCursor,null);
 assert.equal((await ctl.more(ORG)).phase,"denied");
 assert.equal(ctl.snapshot().items.length,0);
 assert.equal((await ctl.refresh(ORG,"all","")).phase,"denied");
 assert.equal(JSON.stringify(ctl.snapshot()).includes("JWT"),false);
});
test("R48 controller fails closed when page overlaps previous records",async()=>{
 const api={
  page:async(_org:string,_filter:string,_q:string,cursor:string|null)=>
   cursor===null?{items:[makeRow(1)],nextCursor:CURSOR}:
    {items:[makeRow(1)],nextCursor:null},
 };
 const ctl=new P4R48CiInvitationPageController(api as never);
 assert.equal((await ctl.refresh(ORG,"all","")).phase,"ready");
 assert.equal((await ctl.more(ORG)).phase,"denied");
 assert.deepEqual(ctl.snapshot().items,[]);
});
