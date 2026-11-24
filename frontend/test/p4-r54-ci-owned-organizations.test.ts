import assert from "node:assert/strict";
import {test} from "node:test";
import {parseP4R54OwnedOrganizations,P4R54CiOwnedOrganizationsClient,
 P4R54CiOrganizationError} from "../src/lib/p4-r54-ci-owned-organizations-client";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",NODE_ENV:"test"};
const A={id:"10000000-0000-4000-8000-000000000001",
 name:"Demo Alpha Office",slug:"demo-alpha-office",ownerRole:"OWNER" as const};
const B={id:"10000000-0000-4000-8000-000000000002",
 name:"Demo Beta Office",slug:"demo-beta-office",ownerRole:"OWNER" as const};
const HEADERS={"Cache-Control":"no-store, private",
 "X-Content-Type-Options":"nosniff"};
const response=(data:unknown,status=200)=>
 new Response(JSON.stringify(data),{status,headers:HEADERS});
const client=(fn:typeof fetch)=>new P4R54CiOwnedOrganizationsClient(
 "http://127.0.0.1:5554/",async()=>"abc.def.ghi",fn,ENV);
const err=(status:number,code:string)=>(e:unknown)=>
 e instanceof P4R54CiOrganizationError&&e.status===status&&e.code===code;
test("R54 strict owner org list is stable, frozen and limited to 20",()=>{
 const orgs=parseP4R54OwnedOrganizations([A,B]);
 assert.deepEqual(orgs,[A,B]);assert.ok(Object.isFrozen(orgs));
 for(const data of [[B,A],[A,A],[{...A,token_hash:"x"}],
  [{...A,ownerRole:"MEMBER"}],[{...A,name:"secret customer"}],
  Array.from({length:21},()=>A)]){
  assert.equal(parseP4R54OwnedOrganizations(data),null);
 }
});
test("R54 client uses signed localhost GET with no cookies/cache",async()=>{
 let seen:RequestInit|undefined;
 const fn=(async(_url:unknown,options?:RequestInit)=>{
  seen=options;return response({scope:"disposable-ci-only",data:[A,B]});
 }) as typeof fetch;
 assert.deepEqual(await client(fn).list(),[A,B]);
 assert.equal(seen?.method,"GET");assert.equal(seen?.credentials,"omit");
 assert.equal(seen?.cache,"no-store");assert.equal(seen?.redirect,"error");
});
test("R54 rejects offshore URLs, leaked fields and unauthorized error envelopes",async()=>{
 const fn=(async()=>response({scope:"disposable-ci-only",
  data:[{...A,externalSubject:"auth0|private"}]})) as typeof fetch;
 await assert.rejects(client(fn).list(),err(503,"INVALID_RESPONSE"));
 const denied=(async()=>response({error:{code:"ACCESS_DENIED"}},403)) as typeof fetch;
 await assert.rejects(client(denied).list(),err(403,"ACCESS_DENIED"));
 assert.throws(()=>new P4R54CiOwnedOrganizationsClient(
  "https://example.com",async()=>"a.b.c",fn,ENV),P4R54CiOrganizationError);
});
