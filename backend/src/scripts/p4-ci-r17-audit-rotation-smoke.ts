/**
 * P4 Batch 17 rotating cursor HTTP smoke against disposable PostgreSQL.
 * Synthetic SDK evidence and signing key; NEVER real Auth0 or production.
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
import {issueP4R17CiRotatingCursor} from "../platform/p4-r17-ci-audit-keyring.js";
import {createP4R17CiRotatedAuditRouter}
 from "../platform/p4-r17-ci-rotated-audit-router.js";
const ORCHID="20000000-0000-4000-8000-000000000001";
const CEDAR="20000000-0000-4000-8000-000000000002";
const OWNER="10000000-0000-4000-8000-0000000000a1";
const FELIX="10000000-0000-4000-8000-0000000000f1";
const CURSOR="70000000-0000-4000-8000-000000000001";
const NOW=2_000_000_000;
const OLD={current:{id:"oldkey",secret:"p4_R17_fictional_previous_key_abcdefghijklmnopqrstuvwxyz"}};
const RING={current:{id:"newkey",secret:"p4_R17_fictional_current_key_abcdefghijklmnopqrstuvwxyz"},previous:OLD.current};
const cfg={issuer:"https://demo.us.auth0.com/",audience:"urn:zoho-clone:demo"};
function token(subject:string):P4VerifiedProviderToken{
 return {issuer:cfg.issuer,audience:cfg.audience,subject,
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
   e.use("/_p4_r17_ci",createP4R17CiRotatedAuditRouter({
    prisma,mappingLookup:lookup,resolveVerifiedSdkEvidence:async()=>actor,
    expectedIssuer:cfg.issuer,expectedAudience:cfg.audience,
    nowEpochSeconds:()=>NOW,syntheticKeyring:RING,
   }));
   return e;
  }
  const owner=app(token("auth0|demo-alice"));
  const reviewer=app(token("auth0|demo-felix"));
  const admin=app(token("auth0|demo-emma"));
  const base=(org:string)=>"/_p4_r17_ci/"+org+"/iam/rotated-audit";
  const first=await request(owner).get(base(ORCHID)+"?limit=1");
  assert.equal(first.status,200);
  assert.equal(first.headers["cache-control"],"no-store, private");
  assert.equal(first.headers["pragma"],"no-cache");
  assert.equal(first.headers["x-content-type-options"],"nosniff");
  assert.deepEqual(Object.keys(first.body.data[0]).sort(),
   ["action","actorId","id","occurredAt"]);
  assert.equal(first.body.data[0].id,CURSOR);
  assert.equal(first.body.nextCursor,null);
  assert.equal((await request(owner).get(base(CEDAR))).status,200);
  assert.equal((await request(reviewer).get(base(ORCHID))).status,200);
  assert.equal((await request(admin).get(base(ORCHID))).status,403);
  const fakeCursor=issueP4R17CiRotatingCursor(
   {organizationId:ORCHID,actorId:OWNER},CURSOR,1,NOW,RING);
  const oldToken=issueP4R17CiRotatingCursor(
   {organizationId:ORCHID,actorId:OWNER},CURSOR,1,NOW,OLD);
  assert.equal((await request(owner).get(base(ORCHID)+
   "?limit=1&cursor="+oldToken)).status,200);
  const valid=await request(owner).get(base(ORCHID)+
   "?limit=1&cursor="+fakeCursor);
  assert.equal(valid.status,200);
  assert.deepEqual(valid.body.data,[]);
  const retired=express();
  retired.use("/_p4_r17_ci",createP4R17CiRotatedAuditRouter({
   prisma,mappingLookup:lookup,resolveVerifiedSdkEvidence:async()=>token("auth0|demo-alice"),
   expectedIssuer:cfg.issuer,expectedAudience:cfg.audience,
   nowEpochSeconds:()=>NOW,syntheticKeyring:{current:RING.current},
  }));
  assert.equal((await request(retired).get(base(ORCHID)+
    "?limit=1&cursor="+oldToken)).status,403);
  const fakeReviewerCursor=issueP4R17CiRotatingCursor(
   {organizationId:ORCHID,actorId:FELIX},CURSOR,1,NOW,RING);
  for(const route of [
   base(CEDAR)+"?limit=1&cursor="+fakeCursor,
   base(ORCHID)+"?limit=2&cursor="+fakeCursor,
   base(ORCHID)+"?limit=1&cursor="+fakeReviewerCursor,
   base(ORCHID)+"?limit=1&cursor="+fakeCursor.slice(0,fakeCursor.indexOf(".")+1)+"x"+fakeCursor.slice(fakeCursor.indexOf(".")+2),
   base(ORCHID)+"?cursor=bad",
   base(ORCHID)+"?limit=0",
   base(ORCHID)+"?export=csv",
   base(ORCHID)+"?cursor=x&cursor=y",
  ]){
   assert.equal((await request(owner).get(route)).status,403);
  }
  assert.equal((await request(app(null)).get(base(ORCHID))).status,401);
  assert.equal((await request(owner).post(base(ORCHID))).status,404);
  try{
   await setup.query("UPDATE p4_r7_ci.memberships SET active=false"+
    " WHERE organization_id=$1 AND actor_id=$2",[ORCHID,FELIX]);
   assert.equal((await request(reviewer).get(base(ORCHID))).status,403);
   assert.equal((await request(reviewer).get(base(ORCHID)+
    "?limit=1&cursor="+fakeReviewerCursor)).status,403);
  }finally{
   await setup.query("UPDATE p4_r7_ci.memberships SET active=true"+
    " WHERE organization_id=$1 AND actor_id=$2",[ORCHID,FELIX]);
  }
  // Batch 18 concurrency: alternating tenant reads must never borrow a
  // previous request's transaction-local app.actor_id/app.tenant_id.
  const concurrent=await Promise.all(Array.from({length:16},(_,i)=>{
   const chosen=i%4;
   return request(chosen===0?owner:chosen===1?reviewer:chosen===2?admin:owner)
    .get(base(chosen===3?CEDAR:ORCHID));
  }));
  concurrent.forEach((response,i)=>{
   const chosen=i%4;
   assert.equal(response.status,chosen===2?403:200);
   assert.equal(response.headers["cache-control"],"no-store, private");
   assert.equal(response.headers["pragma"],"no-cache");
   assert.equal(response.headers["x-content-type-options"],"nosniff");
   if(response.status===200){
    assert.equal(response.body.data.length,1);
    assert.equal(response.body.data[0].id,chosen===3?
      "70000000-0000-4000-8000-000000000002":CURSOR);
    assert.deepEqual(Object.keys(response.body.data[0]).sort(),
      ["action","actorId","id","occurredAt"]);
   }else{
    assert.deepEqual(response.body,{error:{code:"P4_ACCESS_DENIED"}});
   }
  });
  for(const path of [base(ORCHID)+"?cursor=x&cursor=y",
    base(ORCHID)+"?limit=1&limit=2",base(ORCHID)+"?export=csv"]){
    const denied=await request(owner).get(path);
    assert.equal(denied.status,403);
    assert.deepEqual(denied.body,{error:{code:"P4_ACCESS_DENIED"}});
  }
  const context=await prisma.$queryRawUnsafe<Array<{
   role:string;tenant:string|null;actor:string|null;
  }>>('SELECT current_user AS role,'+
    "nullif(current_setting('app.tenant_id',true),'') AS tenant,"+
    "nullif(current_setting('app.actor_id',true),'') AS actor");
  assert.deepEqual(context,[{role:"demo_ci",tenant:null,actor:null}]);
  process.stdout.write("P4 R17 rotating cursor tenant, actor, integrity, revocation HTTP smoke PASS\n");
 }finally{
  await Promise.all([prisma.$disconnect(),lookups.end(),setup.end()]);
 }
}
main().catch(()=>{
 process.stderr.write("P4 R17 rotating cursor HTTP smoke FAILED\n");
 process.exitCode=1;
});
