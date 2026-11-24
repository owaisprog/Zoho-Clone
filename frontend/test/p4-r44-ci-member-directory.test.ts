import assert from "node:assert/strict";
import {test} from "node:test";
import {parseP4R44DirectoryMember,parseP4R44DirectoryPage}
 from "../src/lib/p4-r44-ci-member-directory-contract";
import {P4R41CiMemberRoleClient,P4R41CiError}
 from "../src/lib/p4-r41-ci-member-role-client";
import {P4R44CiDirectoryController}
 from "../src/lib/p4-r44-ci-member-directory-controller";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const ORG="10000000-0000-4000-8000-000000000001";
const BOB={userId:"user_demo_bob",email:"bob@example.com",
 role:"SALES_REP" as const,revision:0,active:true};
const CARLA={userId:"user_demo_carla",email:"carla@example.com",
 role:"SALES_MANAGER" as const,revision:2,active:false};
const HEADERS={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
const response=(data:unknown,status=200,headers:Record<string,string>=HEADERS)=>
 new Response(JSON.stringify(data),{status,headers});
function api(transport:typeof fetch,env=ENV){
 return new P4R41CiMemberRoleClient("http://127.0.0.1:4567/",
  async()=>"abc.def.ghi",transport,env);
}
async function denied(p:Promise<unknown>,status:number,code:string){
 await assert.rejects(p,e=>e instanceof P4R41CiError&&
  e.status===status&&e.code===code);
}
test("R44 directory parser rejects unexpected fields, real emails and invalid roles",()=>{
 assert.deepEqual(parseP4R44DirectoryMember(BOB),BOB);
 assert.ok(Object.isFrozen(parseP4R44DirectoryMember(BOB)));
 for(const x of [{...BOB,subject:"auth0|alice"},
  {...BOB,email:"human@merchant.com"},{...BOB,role:"ORG_OWNER"},
  {...BOB,active:"true"},{...BOB,revision:-1},
  {...BOB,email:23},{...BOB,userId:"external"}])
  assert.equal(parseP4R44DirectoryMember(x),null);
 assert.deepEqual(parseP4R44DirectoryMember({...BOB,email:null}),
  {...BOB,email:null});
});
test("R44 directory enforces sorted, unique, filtered and <=20 results",()=>{
 assert.deepEqual(parseP4R44DirectoryPage([BOB,CARLA],"all"),[BOB,CARLA]);
 assert.ok(Object.isFrozen(parseP4R44DirectoryPage([BOB,CARLA],"all")));
 for(const rows of [[CARLA,BOB],[BOB,BOB],Array(21).fill(BOB),
  [{...BOB,privateEmail:"leak"}]]){
  assert.equal(parseP4R44DirectoryPage(rows,"all"),null);
 }
 assert.equal(parseP4R44DirectoryPage([CARLA],"active"),null);
 assert.equal(parseP4R44DirectoryPage([BOB],"revoked"),null);
});
test("R44 typed client sends only signed GET for fixed filter + encoded search",async()=>{
 let observed:RequestInit|undefined,url="";
 const transport=(async(path:unknown,options?:RequestInit)=>{
  observed=options;url=String(path);
  return response({scope:"disposable-ci-only",data:[BOB]});
 }) as typeof fetch;
 const result=await api(transport).directory(ORG,"active","BOB");
 assert.deepEqual(result,[BOB]);
 assert.equal(observed?.method,"GET");
 assert.equal(observed?.credentials,"omit");
 assert.equal(observed?.cache,"no-store");
 assert.equal(observed?.redirect,"error");
 assert.equal((observed?.headers as Record<string,string>).Authorization,
  "Bearer abc.def.ghi");
 assert.ok(url.includes("/member-directory?status=active&q=bob"));
});
test("R44 client validates filter and literal search before using credentials",async()=>{
 let hits=0;
 const transport=(async()=>{hits++;return response({});}) as typeof fetch;
 const client=api(transport);
 await denied(client.directory("bad","all",""),400,"INVALID_INPUT");
 await denied(client.directory(ORG,"admins" as "all",""),400,"INVALID_INPUT");
 await denied(client.directory(ORG,"all","%"),400,"INVALID_INPUT");
 await denied(client.directory(ORG,"all","any=1"),400,"INVALID_INPUT");
 await denied(client.directory(ORG,"all","a".repeat(41)),400,"INVALID_INPUT");
 assert.equal(hits,0);
});
test("R44 client rejects wrong filter rows, extra email and mismatched search",async()=>{
 for(const [status,data,q] of [
  ["active",[CARLA],""],["revoked",[BOB],""],
  ["all",[{...BOB,externalSubject:"provider"}],""],
  ["all",[BOB],"carla"],
 ] as const){
  const transport=(async()=>response({scope:"disposable-ci-only",data})) as typeof fetch;
  await denied(api(transport).directory(ORG,status,q),503,"INVALID_RESPONSE");
 }
});
test("R44 client refuses invalid HTTP security headers, status and unexpected envelope",async()=>{
 const noHeaders=(async()=>response({scope:"disposable-ci-only",data:[BOB]},200,{})) as typeof fetch;
 await denied(api(noHeaders).directory(ORG,"all",""),503,"INVALID_RESPONSE");
 const extra=(async()=>response({scope:"disposable-ci-only",
  data:[BOB],accessToken:"leak"})) as typeof fetch;
 await denied(api(extra).directory(ORG,"all",""),503,"INVALID_RESPONSE");
 const badStatus=(async()=>response({error:{code:"ACCESS_DENIED"}},500)) as typeof fetch;
 await denied(api(badStatus).directory(ORG,"all",""),503,"INVALID_RESPONSE");
});
test("R44 controller refreshes active/revoked lists and clears on denied refresh",async()=>{
 const calls:string[]=[];
 const client={
  directory:async(_org:string,filter:string,q:string)=>{
   calls.push(filter+":"+q);
   return Object.freeze(filter==="revoked"?[CARLA]:[BOB]);
  },
  revoke:async()=>({revoked:true as const}),
 };
 const ctl=new P4R44CiDirectoryController(client as never);
 assert.equal((await ctl.refresh(ORG,"active","bob")).phase,"ready");
 assert.equal(ctl.snapshot().members.length,1);
 assert.equal((await ctl.refresh(ORG,"revoked","carla")).phase,"ready");
 assert.deepEqual(calls,["active:bob","revoked:carla"]);
 assert.equal((await ctl.revokeAndRefresh(ORG,BOB.userId)).phase,"updated");
 assert.equal(calls[2],"revoked:carla");
 ctl.reset();assert.equal(ctl.snapshot().phase,"idle");
 const fail=new P4R44CiDirectoryController({
  directory:async()=>{throw Error("token is secret");},
  revoke:async()=>{throw Error("token is secret");},
 } as never);
 const deniedView=await fail.refresh(ORG,"all","");
 assert.equal(deniedView.phase,"denied");
 assert.deepEqual(deniedView.members,[]);
 assert.equal(JSON.stringify(deniedView).includes("token is secret"),false);
});
test("R44 controller does not retain stale directory after revoke refresh fails",async()=>{
 let refreshed=0;
 const api={
  directory:async()=>{refreshed++;if(refreshed===2)throw Error("secret");
   return [BOB];},
  revoke:async()=>({revoked:true as const}),
 };
 const ctl=new P4R44CiDirectoryController(api as never);
 assert.equal((await ctl.refresh(ORG,"all","")).members.length,1);
 assert.equal((await ctl.revokeAndRefresh(ORG,BOB.userId)).phase,"denied");
 assert.deepEqual(ctl.snapshot().members,[]);
 assert.equal(JSON.stringify(ctl.snapshot()).includes("secret"),false);
});
