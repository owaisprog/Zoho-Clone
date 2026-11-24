import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R47CiInvitationDirectoryClient,P4R47CiInvitationError}
 from "../src/lib/p4-r47-ci-invitation-directory-client";
import {P4R47CiInvitationController}
 from "../src/lib/p4-r47-ci-invitation-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG="10000000-0000-4000-8000-000000000001";
const ID="10000000-0000-4000-8000-000000000002";
const invite={id:ID,organizationId:ORG,recipientEmail:"bob@example.com",
 role:"MEMBER",status:"pending",issuedAt:"2030-01-01T00:00:00.000Z",
 expiresAt:"2030-01-03T00:00:00.000Z",version:1} as const;
const headers={"Cache-Control":"no-store, private",
 "X-Content-Type-Options":"nosniff"};
const response=(body:unknown,status=200,other:Record<string,string>=headers)=>
 new Response(JSON.stringify(body),{status,headers:other});
const client=(transport:typeof fetch,env=ENV)=>
 new P4R47CiInvitationDirectoryClient("http://127.0.0.1:5001/",
  async()=>"abc.def.ghi",transport,env);
const denied=(status:number,code:string)=>(e:unknown)=>
 e instanceof P4R47CiInvitationError&&e.status===status&&e.code===code;
test("R47 owner GET sends verified actor only, no cookies, no cache",async()=>{
 let opts:RequestInit|undefined;let url="";
 const transport=(async(path:unknown,options?:RequestInit)=>{
  opts=options;url=String(path);
  return response({scope:"disposable-ci-only",data:[invite]});
 }) as typeof fetch;
 assert.deepEqual(await client(transport).list(ORG,"pending","BOB"),[invite]);
 assert.equal(opts?.method,"GET");assert.equal(opts?.credentials,"omit");
 assert.equal(opts?.cache,"no-store");assert.equal(opts?.redirect,"error");
 assert.equal((opts?.headers as Record<string,string>).Authorization,
  "Bearer abc.def.ghi");
 assert.ok(url.endsWith("/invitations?status=pending&q=bob"));
});
test("R47 rejects real network origin or production environment",()=>{
 const transport=(async()=>response({scope:"disposable-ci-only",data:[]})) as typeof fetch;
 assert.throws(()=>new P4R47CiInvitationDirectoryClient(
  "https://merchant.example.com/",async()=>"a.b.c",transport,ENV),
  P4R47CiInvitationError);
 assert.throws(()=>client(transport,{...ENV,NODE_ENV:"production"}),
  P4R47CiInvitationError);
});
test("R47 filters and search must be safe literal strings before credentials",async()=>{
 let count=0;
 const transport=(async()=>{count++;return response({});}) as typeof fetch;
 for(const [org,status,q] of [[ORG,"owners",""],
  ["invalid","all",""],[ORG,"pending","%"],
  [ORG,"all","?status=OWNER"],[ORG,"all","a".repeat(41)]] as const){
  await assert.rejects(client(transport).list(org,status as "all",q),
   denied(400,"INVALID_INPUT"));
 }
 assert.equal(count,0);
});
test("R47 strict response denies extra columns, duplicate IDs and wrong filters",async()=>{
 for(const data of [
  [{...invite,token_hash:"hidden"}],
  [{...invite,recipientEmail:"real@merchant.com"}],
  [{...invite,status:"accepted"}],
  [invite,invite],
  [{...invite,organizationId:ID}],
  [{...invite,recipientEmail:"carla@example.com"}],
 ]){
  const transport=(async()=>response({
   scope:"disposable-ci-only",data,
  })) as typeof fetch;
  await assert.rejects(client(transport).list(ORG,"pending","bob"),
   denied(503,"INVALID_RESPONSE"));
 }
});
test("R47 strict envelope rejects malformed HTTP statuses and caching",async()=>{
 const missingHeaders=(async()=>response({scope:"disposable-ci-only",data:[]},
  200,{})) as typeof fetch;
 await assert.rejects(client(missingHeaders).list(ORG,"all",""),
  denied(503,"INVALID_RESPONSE"));
 const missingScope=(async()=>response({scope:"production",data:[]})) as typeof fetch;
 await assert.rejects(client(missingScope).list(ORG,"all",""),
  denied(503,"INVALID_RESPONSE"));
 const wrongCode=(async()=>response({error:{code:"CONFLICT"}},401)) as typeof fetch;
 await assert.rejects(client(wrongCode).list(ORG,"all",""),
  denied(503,"INVALID_RESPONSE"));
 const forbidden=(async()=>response({error:{code:"ACCESS_DENIED"}},403)) as typeof fetch;
 await assert.rejects(client(forbidden).list(ORG,"all",""),
  denied(403,"ACCESS_DENIED"));
});
test("R47 owner workflow re-fetches real rows after issue, renew and cancel",async()=>{
 let reads=0;const actions:string[]=[];
 const directory={list:async()=>{
  reads++;return Object.freeze([invite]);
 }};
 const owner={
  issue:async()=>{actions.push("issue");return invite;},
  renew:async()=>{actions.push("renew");return invite;},
  cancel:async()=>{actions.push("cancel");return invite;},
 };
 const ctl=new P4R47CiInvitationController(directory as never,owner as never);
 assert.equal((await ctl.refresh(ORG,"all","")).phase,"ready");
 assert.equal((await ctl.issue(ORG,"bob@example.com")).phase,"updated");
 assert.equal((await ctl.renew(ORG,ID,1)).phase,"updated");
 assert.equal((await ctl.cancel(ORG,ID,1)).phase,"updated");
 assert.deepEqual(actions,["issue","renew","cancel"]);
 assert.equal(reads,4);
 ctl.reset();assert.equal(ctl.snapshot().phase,"idle");
});
test("R47 controller clears stale invites when write or refresh fails",async()=>{
 let reads=0;
 const directory={list:async()=>{
  reads++;if(reads===2)throw Error("secret JWT");
  return Object.freeze([invite]);
 }};
 const owner={
  issue:async()=>invite,
  renew:async()=>{throw Error("private token");},
  cancel:async()=>invite,
 };
 const ctl=new P4R47CiInvitationController(directory as never,owner as never);
 assert.equal((await ctl.refresh(ORG,"all","")).invitations.length,1);
 assert.equal((await ctl.issue(ORG,"bob@example.com")).phase,"denied");
 assert.deepEqual(ctl.snapshot().invitations,[]);
 assert.equal((await ctl.renew(ORG,ID,1)).phase,"denied");
 assert.equal(JSON.stringify(ctl.snapshot()).includes("token"),false);
});
