import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R41CiMemberRoleClient,P4R41CiError}
 from "../src/lib/p4-r41-ci-member-role-client";
import {P4R43CiRevokeController}
 from "../src/lib/p4-r43-ci-member-revoke-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG="10000000-0000-4000-8000-000000000001";
const USER="user_demo_bob";
const headers={"Cache-Control":"no-store, private",
 "X-Content-Type-Options":"nosniff"};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),
 {status,headers});
const make=(transport:typeof fetch)=>
 new P4R41CiMemberRoleClient("http://127.0.0.1:4500/",
  async()=>"abc.def.ghi",transport,ENV);
test("R43 revocation posts only to CI-local signed owner endpoint, without body",async()=>{
 let seen:RequestInit|undefined;
 let url="";
 const transport=(async(target:unknown,options?:RequestInit)=>{
  url=String(target);seen=options;
  return response({scope:"disposable-ci-only",data:{revoked:true}});
 }) as typeof fetch;
 const result=await make(transport).revoke(ORG,USER);
 assert.deepEqual(result,{revoked:true});
 assert.equal(seen?.method,"POST");
 assert.equal(seen?.body,undefined);
 assert.equal(seen?.credentials,"omit");
 assert.equal(seen?.cache,"no-store");
 assert.equal((seen?.headers as Record<string,string>).Authorization,
  "Bearer abc.def.ghi");
 assert.ok(url.endsWith("/_p4_r33_ci/owner/"+ORG+"/members/"+USER+"/revoke"));
});
test("R43 response must contain only revoked:true without tokens or metadata",async()=>{
 for(const data of [{revoked:true,actorId:USER},{revoked:false},
  {revoked:"true"},[{revoked:true}],{}]){
  const transport=(async()=>response({scope:"disposable-ci-only",data})) as typeof fetch;
  await assert.rejects(make(transport).revoke(ORG,USER),
   e=>e instanceof P4R41CiError&&e.status===503&&e.code==="INVALID_RESPONSE");
 }
});
test("R43 API input rejects forged tenant/user before any HTTP call",async()=>{
 let count=0;
 const transport=(async()=>{count++;return response({});}) as typeof fetch;
 await assert.rejects(make(transport).revoke("bad",USER),P4R41CiError);
 await assert.rejects(make(transport).revoke(ORG,"real@merchant.com"),
  P4R41CiError);
 assert.equal(count,0);
});
test("R43 revoked member retries and permission errors fail closed",async()=>{
 const transport=(async()=>response({error:{code:"CONFLICT"}},409)) as typeof fetch;
 await assert.rejects(make(transport).revoke(ORG,USER),
  e=>e instanceof P4R41CiError&&e.status===409&&e.code==="CONFLICT");
});
test("R43 controller never carries raw credentials or errors into view",async()=>{
 const ctl=new P4R43CiRevokeController({revoke:async()=>({revoked:true})} as never);
 assert.equal((await ctl.revoke(ORG,USER)).phase,"revoked");
 ctl.reset();assert.equal(ctl.snapshot().phase,"idle");
 const failed=new P4R43CiRevokeController({revoke:async()=>{
  throw Error("private JWT");
 }} as never);
 assert.equal((await failed.revoke(ORG,USER)).phase,"denied");
 assert.equal(JSON.stringify(failed.snapshot()).includes("private JWT"),false);
});
