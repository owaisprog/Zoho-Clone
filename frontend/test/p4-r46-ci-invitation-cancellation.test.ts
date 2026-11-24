import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R34CiHttpClient,P4R34CiClientError}
 from "../src/lib/p4-r34-ci-http-client";
import {P4R46CiCancelController}
 from "../src/lib/p4-r46-ci-invitation-cancel-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG="10000000-0000-4000-8000-000000000001";
const ID="10000000-0000-4000-8000-000000000002";
const row={id:ID,organizationId:ORG,recipientEmail:"bob@example.com",
 role:"MEMBER",status:"revoked",issuedAt:"2030-01-01T00:00:00.000Z",
 expiresAt:"2030-01-03T00:00:00.000Z",version:2};
const headers={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),
 {status,headers});
const api=(transport:typeof fetch)=>new P4R34CiHttpClient(
 "http://127.0.0.1:4009/",async()=>"abc.def.ghi",transport,ENV);
test("R46 cancellation sends signed owner POST and exact optimistic version",async()=>{
 let opts:RequestInit|undefined;
 const transport=(async(_url:unknown,init?:RequestInit)=>{
  opts=init;return response({scope:"disposable-ci-only",data:row});
 }) as typeof fetch;
 assert.deepEqual(await api(transport).cancel(ORG,ID,1),row);
 assert.equal(opts?.method,"POST");
 assert.equal(opts?.credentials,"omit");
 assert.equal(opts?.cache,"no-store");
 assert.deepEqual(JSON.parse(String(opts?.body)),{
  invitationId:ID,expectedVersion:1,
 });
 assert.equal((opts?.headers as Record<string,string>).Authorization,
  "Bearer abc.def.ghi");
});
test("R46 client rejects incorrect version, foreign tenant and extra secret",async()=>{
 for(const data of [{...row,version:3},{...row,status:"accepted"},
  {...row,organizationId:ID},{...row,token_hash:"bad"},
  {...row,id:ORG}]){
  const transport=(async()=>response({scope:"disposable-ci-only",data})) as typeof fetch;
  await assert.rejects(api(transport).cancel(ORG,ID,1),
   e=>e instanceof P4R34CiClientError&&e.code==="INVALID_RESPONSE");
 }
});
test("R46 rejects malformed UUID, unexpected version before HTTP",async()=>{
 let count=0;
 const transport=(async()=>{count++;return response({})}) as typeof fetch;
 for(const [org,id,v] of [["bad",ID,1],[ORG,"bad",1],
  [ORG,ID,NaN],[ORG,ID,0],[ORG,ID,10000001]] as const){
  await assert.rejects(api(transport).cancel(org,id,v),
   e=>e instanceof P4R34CiClientError&&e.status===400);
 }
 assert.equal(count,0);
});
test("R46 cancellation controller does not cache a stale success on 409",async()=>{
 let calls=0;
 const transport=(async()=>{
  calls++;return calls===1?
   response({scope:"disposable-ci-only",data:row}):
   response({error:{code:"CONFLICT"}},409);
 }) as typeof fetch;
 const ctl=new P4R46CiCancelController(api(transport));
 assert.equal((await ctl.cancel(ORG,ID,1)).phase,"canceled");
 const denied=await ctl.cancel(ORG,ID,1);
 assert.equal(denied.phase,"denied");
 assert.equal(denied.invitation,null);
 assert.equal(JSON.stringify(denied).includes("abc.def.ghi"),false);
 ctl.reset();assert.equal(ctl.snapshot().phase,"idle");
});
