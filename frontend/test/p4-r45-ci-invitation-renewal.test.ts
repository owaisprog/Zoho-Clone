import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R34CiHttpClient,P4R34CiClientError}
 from "../src/lib/p4-r34-ci-http-client";
import {P4R45CiRenewalController}
 from "../src/lib/p4-r45-ci-invitation-renewal-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG="10000000-0000-4000-8000-000000000001";
const OLD="10000000-0000-4000-8000-000000000002";
const NEW="10000000-0000-4000-8000-000000000003";
const invite={id:NEW,organizationId:ORG,recipientEmail:"bob@example.com",
 role:"MEMBER",status:"pending",issuedAt:"2030-01-01T00:00:00.000Z",
 expiresAt:"2030-01-03T00:00:00.000Z",version:1} as const;
const headers={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
function result(data:unknown,status=201){
 return new Response(JSON.stringify(data),{status,headers});
}
function client(transport:typeof fetch){
 return new P4R34CiHttpClient("http://127.0.0.1:5000/",
  async()=>"abc.def.ghi",transport,ENV);
}
test("R45 renewal sends only signed owner, invite ID and expected version",async()=>{
 let seen:RequestInit|undefined;
 const transport=(async(_url:unknown,options?:RequestInit)=>{
  seen=options;
  return result({scope:"disposable-ci-only",data:invite});
 }) as typeof fetch;
 assert.deepEqual(await client(transport).renew(ORG,OLD,1),invite);
 assert.equal(seen?.method,"POST");
 assert.equal(seen?.credentials,"omit");
 assert.equal(seen?.cache,"no-store");
 assert.deepEqual(JSON.parse(String(seen?.body)),{
  invitationId:OLD,expectedVersion:1,
 });
 assert.equal((seen?.headers as Record<string,string>).Authorization,
  "Bearer abc.def.ghi");
});
test("R45 rejects malformed input before network or credentials",async()=>{
 let calls=0;
 const transport=(async()=>{calls++;return result({});}) as typeof fetch;
 for(const [org,id,version] of [[ORG,"bad",1],
  ["wrong",OLD,1],[ORG,OLD,0],[ORG,OLD,10000001],
  [ORG,OLD,NaN]] as const){
  await assert.rejects(client(transport).renew(org,id,version),
   e=>e instanceof P4R34CiClientError&&e.status===400);
 }
 assert.equal(calls,0);
});
test("R45 rejects extra JSON fields, same ID, foreign org and status drift",async()=>{
 for(const data of [{...invite,id:OLD},{...invite,organizationId:OLD},
  {...invite,status:"accepted"},{...invite,token_hash:"secret"}]){
  const transport=(async()=>result({scope:"disposable-ci-only",data})) as typeof fetch;
  await assert.rejects(client(transport).renew(ORG,OLD,1),
   e=>e instanceof P4R34CiClientError&&e.code==="INVALID_RESPONSE");
 }
});
test("R45 stale revision 409 maps to safe error and clears prior invitation",async()=>{
 let calls=0;
 const transport=(async()=>{
  calls++;
  return calls===1?result({scope:"disposable-ci-only",data:invite}):
   result({error:{code:"CONFLICT"}},409);
 }) as typeof fetch;
 const ctl=new P4R45CiRenewalController(client(transport));
 assert.equal((await ctl.renew(ORG,OLD,1)).phase,"renewed");
 const denied=await ctl.renew(ORG,OLD,1);
 assert.equal(denied.phase,"denied");
 assert.equal(denied.invitation,null);
 assert.equal(JSON.stringify(denied).includes("abc.def.ghi"),false);
 ctl.reset();assert.equal(ctl.snapshot().phase,"idle");
});
