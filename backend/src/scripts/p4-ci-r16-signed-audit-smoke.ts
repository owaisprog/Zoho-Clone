/**
 * P4 Batch 16 signed cursor HTTP smoke against disposable PostgreSQL.
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
import {issueP4R16CiAuditCursor} from "../platform/p4-r16-ci-signed-audit-cursor.js";
import {createP4R16CiAuditTestRouter}
 from "../platform/p4-r16-ci-signed-audit-test-router.js";
const ORCHID="20000000-0000-4000-8000-000000000001";
const CEDAR="20000000-0000-4000-8000-000000000002";
const OWNER="10000000-0000-4000-8000-0000000000a1";
const FELIX="10000000-0000-4000-8000-0000000000f1";
const CURSOR="70000000-0000-4000-8000-000000000001";
const NOW=2_000_000_000;
const KEY="p4_R16_fictional_only_signing_key_abcdefghijklmnopqrstuvwxyz";
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
   e.use("/_p4_r16_ci",createP4R16CiAuditTestRouter({
    prisma,mappingLookup:lookup,resolveVerifiedSdkEvidence:async()=>actor,
    expectedIssuer:cfg.issuer,expectedAudience:cfg.audience,
    nowEpochSeconds:()=>NOW,syntheticSigningKey:KEY,
   }));
   return e;
  }
  const owner=app(token("auth0|demo-alice"));
  const reviewer=app(token("auth0|demo-felix"));
  const admin=app(token("auth0|demo-emma"));
  const base=(org:string)=>"/_p4_r16_ci/"+org+"/iam/signed-audit";
  const first=await request(owner).get(base(ORCHID)+"?limit=1");
  assert.equal(first.status,200);
  assert.equal(first.headers["cache-control"],"no-store");
  assert.deepEqual(Object.keys(first.body.data[0]).sort(),
   ["action","actorId","id","occurredAt"]);
  assert.equal(first.body.data[0].id,CURSOR);
  assert.equal(first.body.nextCursor,null);
  assert.equal((await request(owner).get(base(CEDAR))).status,200);
  assert.equal((await request(reviewer).get(base(ORCHID))).status,200);
  assert.equal((await request(admin).get(base(ORCHID))).status,403);
  const fakeCursor=issueP4R16CiAuditCursor(
   {organizationId:ORCHID,actorId:OWNER},CURSOR,1,NOW,KEY);
  const valid=await request(owner).get(base(ORCHID)+
   "?limit=1&cursor="+fakeCursor);
  assert.equal(valid.status,200);
  assert.deepEqual(valid.body.data,[]);
  const fakeReviewerCursor=issueP4R16CiAuditCursor(
   {organizationId:ORCHID,actorId:FELIX},CURSOR,1,NOW,KEY);
  for(const route of [
   base(CEDAR)+"?limit=1&cursor="+fakeCursor,
   base(ORCHID)+"?limit=2&cursor="+fakeCursor,
   base(ORCHID)+"?limit=1&cursor="+fakeReviewerCursor,
   base(ORCHID)+"?limit=1&cursor="+fakeCursor.slice(0,-1)+"x",
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
  const context=await prisma.$queryRawUnsafe<Array<{
   role:string;tenant:string|null;actor:string|null;
  }>>('SELECT current_user AS role,'+
    "nullif(current_setting('app.tenant_id',true),'') AS tenant,"+
    "nullif(current_setting('app.actor_id',true),'') AS actor");
  assert.deepEqual(context,[{role:"demo_ci",tenant:null,actor:null}]);
  process.stdout.write("P4 R16 signed cursor tenant, actor, integrity, revocation HTTP smoke PASS\n");
 }finally{
  await Promise.all([prisma.$disconnect(),lookups.end(),setup.end()]);
 }
}
main().catch(()=>{
 process.stderr.write("P4 R16 signed cursor HTTP smoke FAILED\n");
 process.exitCode=1;
});
