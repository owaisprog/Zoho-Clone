import assert from "node:assert/strict";
import {test} from "node:test";
import {parseP4R41Member,parseP4R41Members}
 from "../src/lib/p4-r41-ci-member-role-contract";
import {P4R41CiMemberRoleClient,P4R41CiError}
 from "../src/lib/p4-r41-ci-member-role-client";
import {P4R41CiRoleController}
 from "../src/lib/p4-r41-ci-member-role-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG="10000000-0000-4000-8000-000000000001";
const ROW={userId:"user_demo_bob",role:"SALES_REP" as const,revision:0};
const headers={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
function response(data:unknown,status=200,override:Record<string,string>=headers){
 return new Response(JSON.stringify(data),{status,headers:override});
}
const token=async()=>"abc.def.ghi";
function make(transport:typeof fetch,env=ENV,
 origin="http://127.0.0.1:5555/"){
 return new P4R41CiMemberRoleClient(origin,token,transport,env);
}
async function denied(promise:Promise<unknown>,status:number,code:string){
 await assert.rejects(promise,e=>e instanceof P4R41CiError&&
  e.status===status&&e.code===code);
}
test("R41 strict member projection rejects extra fields, invalid role and unsafe revisions",()=>{
 assert.deepEqual(parseP4R41Member(ROW),ROW);
 assert.ok(Object.isFrozen(parseP4R41Member(ROW)));
 for(const input of [{...ROW,token_hash:"private"},{...ROW,role:"ORG_OWNER"},
  {...ROW,revision:NaN},{...ROW,userId:"someone@example.com"}]){
  assert.equal(parseP4R41Member(input),null);
 }
 assert.equal(parseP4R41Members([{...ROW},{...ROW}]),null);
 assert.equal(parseP4R41Members([{
  ...ROW,userId:"user_demo_carla"},ROW]),null);
});
test("R41 client is hard-disabled for real hosts, production, malformed CI",()=>{
 const transport=(async()=>response({scope:"disposable-ci-only",data:[ROW]})) as typeof fetch;
 for(const origin of ["https://example.com/","http://localhost:5555/",
  "http://127.0.0.1:5555/path","http://127.0.0.1:5555/?key=1"]){
  assert.throws(()=>make(transport,ENV,origin),P4R41CiError);
 }
 assert.throws(()=>make(transport,{...ENV,NODE_ENV:"production"}),P4R41CiError);
 assert.throws(()=>make(transport,{...ENV,CI:"false"}),P4R41CiError);
});
test("R41 request sends only injected signed identity with no cookies",async()=>{
 let observed:RequestInit|undefined;
 const transport=(async(_url:unknown,options?:RequestInit)=>{
  observed=options;
  return response({scope:"disposable-ci-only",data:[ROW]});
 }) as typeof fetch;
 assert.deepEqual(await make(transport).members(ORG),[ROW]);
 assert.equal(observed?.method,"GET");
 assert.equal((observed?.headers as Record<string,string>).Authorization,"Bearer abc.def.ghi");
 assert.equal(observed?.credentials,"omit");
 assert.equal(observed?.cache,"no-store");
 assert.equal(observed?.redirect,"error");
});
test("R41 role change checks CAS response and sends no identity in body",async()=>{
 let observed:RequestInit|undefined;
 const transport=(async(_url:unknown,options?:RequestInit)=>{
  observed=options;
  return response({scope:"disposable-ci-only",data:{...ROW,
   role:"SALES_MANAGER",revision:1}});
 }) as typeof fetch;
 const result=await make(transport).change(ORG,ROW.userId,"SALES_MANAGER",0);
 assert.deepEqual(result,{...ROW,role:"SALES_MANAGER",revision:1});
 assert.equal(observed?.method,"PATCH");
 assert.deepEqual(JSON.parse(String(observed?.body)),{
  role:"SALES_MANAGER",expectedRevision:0,
 });
});
test("R41 unsafe responses and extra secrets fail closed",async()=>{
 for(const data of [[{...ROW,token:"private"}],
  [{...ROW,role:"ORG_OWNER"}],{...ROW,revision:1},
  {error:{code:"ACCESS_DENIED"}}]){
  const transport=(async()=>response({scope:"disposable-ci-only",data})) as typeof fetch;
  await denied(make(transport).members(ORG),503,"INVALID_RESPONSE");
 }
 const transport=(async()=>response({scope:"disposable-ci-only",data:{
  ...ROW,role:"SALES_MANAGER",revision:2,
 }})) as typeof fetch;
 await denied(make(transport).change(ORG,ROW.userId,"SALES_MANAGER",0),
  503,"INVALID_RESPONSE");
});
test("R41 rejects bad response headers, unrecognized status and wrong error code",async()=>{
 const transports=[
  (async()=>response({scope:"disposable-ci-only",data:[ROW]},200,{})) as typeof fetch,
  (async()=>response({error:{code:"ACCESS_DENIED"}},401)) as typeof fetch,
  (async()=>response({error:{code:"ACCESS_DENIED"}},500)) as typeof fetch,
 ];
 for(const transport of transports)
  await denied(make(transport).members(ORG),503,"INVALID_RESPONSE");
 const deniedTransport=(async()=>response({error:{code:"CONFLICT"}},409)) as typeof fetch;
 await denied(make(deniedTransport).members(ORG),409,"CONFLICT");
});
test("R41 input rejection happens before credentials or network",async()=>{
 let touches=0;
 const transport=(async()=>{touches++;return response({})}) as typeof fetch;
 const client=make(transport);
 await denied(client.members("bad"),400,"INVALID_INPUT");
 await denied(client.change(ORG,"bad","SALES_REP",0),400,"INVALID_INPUT");
 await denied(client.change(ORG,ROW.userId,"ORG_OWNER" as "SALES_REP",0),
  400,"INVALID_INPUT");
 await denied(client.change(ORG,ROW.userId,"SALES_REP",NaN),400,"INVALID_INPUT");
 assert.equal(touches,0);
});
test("R41 controller clears stale members on any denied response, no secrets retained",async()=>{
 const fake={members:async()=>Object.freeze([ROW]),
  change:async()=>({...ROW,role:"SALES_MANAGER",revision:1} as const)};
 const ctl=new P4R41CiRoleController(fake as never);
 assert.equal((await ctl.refresh(ORG)).phase,"ready");
 assert.equal((await ctl.change(ORG,ROW.userId,"SALES_MANAGER",0)).phase,"changed");
 assert.equal(ctl.snapshot().members[0]?.role,"SALES_MANAGER");
 ctl.reset();assert.equal(ctl.snapshot().phase,"idle");
 const bad=new P4R41CiRoleController({
  members:async()=>{throw Error("private data");},
  change:async()=>{throw Error("private data");},
 } as never);
 assert.equal((await bad.refresh(ORG)).phase,"denied");
 assert.deepEqual(bad.snapshot().members,[]);
 assert.equal(JSON.stringify(bad.snapshot()).includes("private data"),false);
});
