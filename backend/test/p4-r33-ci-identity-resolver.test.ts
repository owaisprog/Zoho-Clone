import assert from "node:assert/strict";
import {describe,it} from "node:test";
import type pg from "pg";
import {P4R33CiActorMapper} from "../src/platform/p4-r33-ci-verified-workflow.js";
import type {P4R33CiJwk} from "../src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R28Denied} from "../src/platform/p4-r28-ci-org-service.js";
const ENV={CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
 PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",PGUSER:"demo_ci",
 PGPASSWORD:"fake_ci_not_for_real_accounts"};
const invalidRequest=(header?:string)=>({
 header:(name:string)=>name==="authorization"?header:undefined,
}) as never;
const fakeJwk={kty:"RSA",alg:"RS256",use:"sig",kid:"r33-ci-key-one",
 n:"fake",e:"AQAB"} as P4R33CiJwk;
function mapper(env:NodeJS.ProcessEnv=ENV){
 let queries=0;
 const pool={async query(){queries++;throw Error("MUST_NOT_QUERY");}} as unknown as pg.Pool;
 return {m:new P4R33CiActorMapper(pool,[fakeJwk],()=>2_000_000_000,env),
  get queries(){return queries;}};
}
const deny=async(promise:Promise<unknown>)=>
 assert.rejects(promise,e=>e instanceof P4R28Denied&&e.status===401);
describe("P4 R33 signed identity resolver cannot trust request headers",()=>{
 it("never opens DB for absent Authorization header",async()=>{
  const f=mapper();
  await deny(f.m.resolve(invalidRequest()));
  assert.equal(f.queries,0);
 });
 it("rejects browser role, organization, malformed or Basic authorization",async()=>{
  const f=mapper();
  for(const h of ["Basic abc","Bearer","bearer abc","Bearer abc",
   "Bearer a.b.c extra","Bearer abc\nfoo","Bearer "+ "a".repeat(11000)]){
   await deny(f.m.resolve(invalidRequest(h)));
  }
  assert.equal(f.queries,0);
 });
 it("cannot map identities in a non-CI or real-database environment",async()=>{
  for(const patch of [{NODE_ENV:"production"},{PGHOST:"neon.tech"},
   {CI:"false"},{GITHUB_ACTIONS:"false"}]){
   const f=mapper({...ENV,...patch});
   await deny(f.m.resolve(invalidRequest("Bearer a.b.c")));
   assert.equal(f.queries,0);
  }
 });
});
