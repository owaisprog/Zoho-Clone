/**
 * Actual disposable PostgreSQL/Prisma/HTTP audit page regression.
 * Synthetic verified evidence injected by CI is NOT real Auth0 verification.
 */
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import pg from "pg";
import type {P4VerifiedProviderToken} from "../platform/p4-auth0-subject-bridge.js";
import {assertP4V1CiPrismaEnvironment} from "../platform/p4-v1-ci-prisma.js";
import {createP4R7CiPrismaClient} from "../platform/p4-r7-ci-prisma-reader.js";
import {createP4V1CiIdentityPool,createP4V1CiSubjectLookup}
 from "../platform/p4-v1-ci-identity.js";
import {createP4R15CiAuditTestRouter}
 from "../platform/p4-r15-ci-audit-test-router.js";
const ORCHID="20000000-0000-4000-8000-000000000001";
const CEDAR="20000000-0000-4000-8000-000000000002";
const FELIX="10000000-0000-4000-8000-0000000000f1";
const CURSOR="70000000-0000-4000-8000-000000000001";
const EXPECTED={issuer:"https://demo.us.auth0.com/",audience:"urn:zoho-clone:demo"};
const NOW=2_000_000_000;
function token(subject:string):P4VerifiedProviderToken{
 return {issuer:EXPECTED.issuer,audience:EXPECTED.audience,subject,
  expiresAtEpochSeconds:NOW+100,cryptographicallyVerified:true};
}
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const prisma=createP4R7CiPrismaClient(process.env);
 const lookups=createP4V1CiIdentityPool(process.env);
 const setup=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:1});
 try{
  const lookup=createP4V1CiSubjectLookup(lookups,process.env);
  function app(actor:P4VerifiedProviderToken|null){
   const e=express();
   e.use("/_p4_r15_ci",createP4R15CiAuditTestRouter({
    prisma,mappingLookup:lookup,resolveVerifiedSdkEvidence:async()=>actor,
    expectedIssuer:EXPECTED.issuer,expectedAudience:EXPECTED.audience,
    nowEpochSeconds:()=>NOW,
   }));
   return e;
  }
  const owner=app(token("auth0|demo-alice"));
  const reviewer=app(token("auth0|demo-felix"));
  const admin=app(token("auth0|demo-emma"));
  const rep=app(token("auth0|demo-charlie"));
  const base=(o:string)=>"/_p4_r15_ci/"+o+"/iam/audit-page";
  const first=await request(owner).get(base(ORCHID)+"?limit=1");
  assert.equal(first.status,200);
  assert.equal(first.headers["cache-control"],"no-store");
  assert.equal(first.body.data.length,1);
  assert.equal(first.body.nextCursor,null);
  assert.deepEqual(Object.keys(first.body.data[0]).sort(),
   ["action","actorId","id","occurredAt"]);
  assert.equal(first.body.data[0].id,CURSOR);
  const next=await request(owner).get(base(ORCHID)+"?afterId="+CURSOR);
  assert.equal(next.status,200);
  assert.deepEqual(next.body.data,[]);
  const cedar=await request(owner).get(base(CEDAR));
  assert.equal(cedar.status,200);
  assert.equal(cedar.body.data.length,1);
  assert.equal(cedar.body.data[0].id,
   "70000000-0000-4000-8000-000000000002");
  assert.equal((await request(reviewer).get(base(ORCHID))).status,200);
  for(const item of [first,cedar]){
   const body=JSON.stringify(item.body);
   for(const privateTerm of [
    "raw_payload_private","recipient_email","token_hash",
    "Demo PRIVATE request body","external_subject"
   ])assert.equal(body.includes(privateTerm),false);
  }
  for(const who of [admin,rep]){
   assert.equal((await request(who).get(base(ORCHID))
    .set("x-role","ORG_OWNER")).status,403);
  }
  for(const path of [base(CEDAR),base(ORCHID)+"?limit=0",
    base(ORCHID)+"?limit=21",base(ORCHID)+"?afterId=not-uuid",
    base(ORCHID)+"?export=csv",base(ORCHID)+"?limit=1&limit=2"]){
   assert.equal((await request(reviewer).get(path)).status,403);
  }
  assert.equal((await request(app(null)).get(base(ORCHID))).status,401);
  assert.equal((await request(app(token("auth0|unknown"))).get(base(ORCHID))).status,401);
  assert.equal((await request(owner).post(base(ORCHID))).status,404);
  assert.equal((await request(owner).get(
   "/_p4_r15_ci/not-uuid/iam/audit-page")).status,403);
  try{
   await setup.query("UPDATE p4_r7_ci.memberships SET active=false"+
    " WHERE organization_id=$1 AND actor_id=$2",[ORCHID,FELIX]);
   assert.equal((await request(reviewer).get(base(ORCHID))).status,403);
  }finally{
   await setup.query("UPDATE p4_r7_ci.memberships SET active=true"+
    " WHERE organization_id=$1 AND actor_id=$2",[ORCHID,FELIX]);
  }
  try{
   await setup.query("UPDATE p4_r7_ci.app_grants SET active=false"+
    " WHERE organization_id=$1 AND app_code='platform'",[ORCHID]);
   assert.equal((await request(owner).get(base(ORCHID))).status,403);
  }finally{
   await setup.query("UPDATE p4_r7_ci.app_grants SET active=true"+
    " WHERE organization_id=$1 AND app_code='platform'",[ORCHID]);
  }
  const ctx=await prisma.$queryRawUnsafe<Array<{
   role:string;tenant:string|null;actor:string|null;
  }>>('SELECT current_user AS role,'+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor");
  assert.deepEqual(ctx,[{role:"demo_ci",tenant:null,actor:null}]);
  process.stdout.write("P4 R15 synthetic restricted audit pagination, revocation and HTTP PASS\n");
 }finally{
  await Promise.all([prisma.$disconnect(),lookups.end(),setup.end()]);
 }
}
main().catch(()=>{
 process.stderr.write("P4 R15 synthetic audit integration FAILED\n");
 process.exitCode=1;
});
