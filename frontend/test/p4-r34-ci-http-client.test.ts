import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {P4R34CiHttpClient,P4R34CiClientError}
 from "../src/lib/p4-r34-ci-http-client";
import {P4R34CiWorkflowController}
 from "../src/lib/p4-r34-ci-workflow-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG="10000000-0000-4000-8000-000000000001";
const invitation={id:"10000000-0000-4000-8000-000000000002",
 organizationId:ORG,recipientEmail:"carla@example.com",role:"MEMBER",
 status:"pending",issuedAt:"2030-01-01T00:00:00.000Z",
 expiresAt:"2030-01-03T00:00:00.000Z",version:1};
const headers={"Cache-Control":"no-store, private",
 "X-Content-Type-Options":"nosniff"};
const response=(data:unknown,status=201,override=headers)=>
 new Response(JSON.stringify(data),{status,headers:override});
const token=async()=>"abc.def.ghi";
function api(transport:typeof fetch,env:NodeJS.ProcessEnv=ENV,
 origin="http://127.0.0.1:4000/"){
 return new P4R34CiHttpClient(origin,token,transport,env);
}
async function rejected(p:Promise<unknown>,status:number,code:string){
 await assert.rejects(p,e=>e instanceof P4R34CiClientError&&
  e.status===status&&e.code===code);
}
describe("P4 R34 CI-only frontend signed HTTP client contracts",()=>{
 it("refuses real hosts, HTTPS, production or disabled CI",()=>{
  const stub=async()=>response({scope:"disposable-ci-only",data:invitation});
  for(const url of ["https://example.com/","http://localhost:4000/",
   "http://127.0.0.1:4000/path","http://127.0.0.1:4000/?x=1",
   "http://user:pass@127.0.0.1:4000/"]){
   assert.throws(()=>api(stub as typeof fetch,ENV,url),P4R34CiClientError);
  }
  assert.throws(()=>api(stub as typeof fetch,{...ENV,NODE_ENV:"production"}),
   P4R34CiClientError);
 });
 it("issues a pending invitation with a token supplied by the CI provider",async()=>{
  let seen:RequestInit|undefined;
  const transport=async(_url:URL|RequestInfo,opts?:RequestInit)=>{
   seen=opts;return response({scope:"disposable-ci-only",data:invitation});
  };
  const result=await api(transport as typeof fetch).issue(ORG,"carla@example.com");
  assert.deepEqual(result,invitation);
  assert.equal(seen?.method,"POST");
  assert.equal((seen?.headers as Record<string,string>)?.Authorization,
   "Bearer abc.def.ghi");
  assert.equal(seen?.credentials,"omit");
  assert.equal(seen?.redirect,"error");
 });
 it("blocks extra raw token/secret fields and invalid organization projections",async()=>{
  for(const patch of [{token_hash:"private"},{status:"accepted"},
   {organizationId:"10000000-0000-4000-8000-000000000099"},
   {recipientEmail:"mallory@example.com"}]){
   const transport=async()=>response({scope:"disposable-ci-only",
    data:{...invitation,...patch}});
   await rejected(api(transport as typeof fetch).issue(
    ORG,"carla@example.com"),503,"INVALID_RESPONSE");
  }
 });
 it("accepts only safe minimal recipient success contract",async()=>{
  const transport=async()=>response({scope:"disposable-ci-only",
   data:{accepted:true,membershipActivated:true}},200);
  assert.deepEqual(await api(transport as typeof fetch).accept("ab".repeat(32)),
   {accepted:true,membershipActivated:true});
 });
 it("never treats sanitized 401/403/409 responses as success",async()=>{
  for(const status of [401,403,409]){
   const code=status===401?"IDENTITY_REQUIRED":
    status===403?"ACCESS_DENIED":"CONFLICT";
   const transport=async()=>response({error:{code}},status);
   await rejected(api(transport as typeof fetch).issue(
    ORG,"carla@example.com"),status,code);
  }
 });
 it("denies missing no-store/nosniff and malformed HTTP JSON",async()=>{
  const noHeaders=async()=>response({scope:"disposable-ci-only",
   data:invitation},201,{} as typeof headers);
  await rejected(api(noHeaders as typeof fetch).issue(
   ORG,"carla@example.com"),503,"INVALID_RESPONSE");
  const invalid=async()=>new Response("not-json",{status:201,headers});
  await rejected(api(invalid as typeof fetch).issue(
   ORG,"carla@example.com"),503,"INVALID_RESPONSE");
 });
 it("rejects bad input and token before requesting credentials or network",async()=>{
  let touches=0;
  const transport=async()=>{touches++;return response({});};
  const client=api(transport as typeof fetch);
  await rejected(client.issue("bad","carla@example.com"),400,"INVALID_INPUT");
  await rejected(client.issue(ORG,"real@merchant.com"),400,"INVALID_INPUT");
  await rejected(client.accept("bad"),400,"INVALID_INPUT");
  assert.equal(touches,0);
 });
 it("controller handles issued, accepted, failed, and reset without storing tokens",async()=>{
  const fake={issue:async()=>invitation,
   accept:async()=>({accepted:true,membershipActivated:true} as const)};
  const ctl=new P4R34CiWorkflowController(fake as never);
  assert.equal((await ctl.issue(ORG,"carla@example.com")).phase,"issued");
  assert.equal((await ctl.accept("ab".repeat(32))).phase,"accepted");
  assert.equal(JSON.stringify(ctl.snapshot()).includes("ab".repeat(32)),false);
  ctl.reset();assert.equal(ctl.snapshot().phase,"idle");
  const failing=new P4R34CiWorkflowController({
   issue:async()=>{throw Error("private");},
   accept:async()=>{throw Error("private");},
  } as never);
  assert.equal((await failing.issue(ORG,"carla@example.com")).phase,"error");
  assert.equal(JSON.stringify(failing.snapshot()).includes("private"),false);
 });
});
