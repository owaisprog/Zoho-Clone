/**
 * P4 Batch 23 role, membership and organization authorization regression evidence.
 * Synthetic injected identity proof IS NOT live Auth0 authentication.
 */
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import pg from "pg";
import type {P4VerifiedProviderToken} from "../platform/p4-auth0-subject-bridge.js";
import {assertP4V1CiPrismaEnvironment} from "../platform/p4-v1-ci-prisma.js";
import {createP4R7CiPrismaClient,readP4R7CiLeads,P4R7CiReadDeniedError} from "../platform/p4-r7-ci-prisma-reader.js";
import {
 createP4V1CiIdentityPool,createP4V1CiSubjectLookup,
} from "../platform/p4-v1-ci-identity.js";
import {createP4R14CiTestRouter} from "../platform/p4-r14-ci-test-router.js";
const ORCHID="20000000-0000-4000-8000-000000000001";
const CEDAR="20000000-0000-4000-8000-000000000002";
const EMMA="10000000-0000-4000-8000-0000000000e1";
const CHARLIE="10000000-0000-4000-8000-0000000000c1";
const NOW=2_000_000_000;
const cfg={issuer:"https://demo.us.auth0.com/",audience:"urn:zoho-clone:demo"};
function fake(subject:string):P4VerifiedProviderToken{
 return {issuer:cfg.issuer,audience:cfg.audience,subject,
  expiresAtEpochSeconds:NOW+100,cryptographicallyVerified:true};
}
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const prisma=createP4R7CiPrismaClient(process.env);
 const lookupPool=createP4V1CiIdentityPool(process.env);
 const setup=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:1});
 try{
  const lookup=createP4V1CiSubjectLookup(lookupPool,process.env);
  function app(token:P4VerifiedProviderToken|null){
   const e=express();
   e.use("/_p4_r14_ci",createP4R14CiTestRouter({
    prisma,mappingLookup:lookup,resolveVerifiedSdkEvidence:async()=>token,
    expectedIssuer:cfg.issuer,expectedAudience:cfg.audience,
    nowEpochSeconds:()=>NOW,
   }));
   return e;
  }
  const owner=app(fake("auth0|demo-alice"));
  const admin=app(fake("auth0|demo-emma"));
  const reviewer=app(fake("auth0|demo-felix"));
  const rep=app(fake("auth0|demo-charlie"));
  const prefix=(org:string)=>"/_p4_r14_ci/"+org+"/iam";
  const org=await request(owner).get(prefix(ORCHID)+"/organization");
  assert.equal(org.status,200);
  assert.equal(org.headers["cache-control"],"no-store");
  assert.deepEqual(org.body.data,{id:ORCHID,displayName:"Demo Orchid"});
  const roles=await request(owner).get(prefix(ORCHID)+"/role-summaries");
  assert.equal(roles.status,200);
  assert.equal(roles.body.data.length,5);
  assert.deepEqual(Object.keys(roles.body.data[0]).sort(),
    ["activeCount","roleCode"]);
  const cedar=await request(owner).get(prefix(CEDAR)+"/organization");
  assert.deepEqual(cedar.body.data,{id:CEDAR,displayName:"Demo Cedar"});
  assert.equal((await request(owner).get(prefix(CEDAR)+"/role-summaries"))
    .body.data.length,1);
  const adminRoles=await request(admin).get(prefix(ORCHID)+"/role-summaries");
  assert.equal(adminRoles.status,200);
  assert.deepEqual(adminRoles.body.data.map((r:{roleCode:string})=>r.roleCode).sort(),
    ["SALES_MANAGER","SALES_REP"]);
  assert.equal((await request(admin).get(prefix(ORCHID)+"/organization")).status,200);
  const reviewerOrg=await request(reviewer).get(prefix(ORCHID)+"/organization");
  assert.deepEqual(reviewerOrg.body.data,{id:ORCHID});
  const reviewerRoles=await request(reviewer).get(prefix(ORCHID)+"/role-summaries");
  assert.equal(reviewerRoles.status,200);
  assert.equal(reviewerRoles.body.data.length,5);
  assert.deepEqual(Object.keys(reviewerRoles.body.data[0]),["roleCode"]);
  for(const r of [org,roles,adminRoles,reviewerOrg,reviewerRoles]){
   const value=JSON.stringify(r.body);
   for(const hidden of ["external_subject","recipient_email","token_hash",
    "creatorId","issued_by","confidential_note","auth0|demo",
    "private_object_locator"]){
    assert.equal(value.includes(hidden),false);
   }
  }
  for(const route of ["/organization","/role-summaries"]){
   assert.equal((await request(rep).get(prefix(ORCHID)+route)
     .set("x-role","ORG_OWNER").set("x-organization-id",ORCHID)).status,403);
   assert.equal((await request(reviewer).get(prefix(CEDAR)+route)).status,403);
   assert.equal((await request(admin).get(prefix(CEDAR)+route)).status,403);
   assert.equal((await request(app(null)).get(prefix(ORCHID)+route)).status,401);
   assert.equal((await request(owner).get(prefix(ORCHID)+route+"?export=csv")).status,403);
   assert.equal((await request(owner).post(prefix(ORCHID)+route)).status,404);
  }
  assert.equal((await request(owner).get(
    "/_p4_r14_ci/not-a-uuid/iam/organization")).status,403);
  assert.equal((await request(app(fake("auth0|not-mapped"))).get(
    prefix(ORCHID)+"/organization")).status,401);
  assert.equal((await request(app({...fake("auth0|demo-alice"),
    cryptographicallyVerified:false as never})).get(
    prefix(ORCHID)+"/role-summaries")).status,401);
  // Batch 22: trust in an injected SDK claim, not HTTP role, org or bearer headers.
  // This remains synthetic test evidence, not real Auth0 JWT validation.
  const claimVariations=[
   {...fake("auth0|demo-alice"),issuer:"https://different.us.auth0.com/"},
   {...fake("auth0|demo-alice"),audience:"urn:wrong-app"},
   {...fake("auth0|demo-alice"),expiresAtEpochSeconds:NOW},
   {...fake("auth0|demo-alice"),expiresAtEpochSeconds:NOW+86_401},
   {...fake("auth0|demo-alice"),cryptographicallyVerified:false as never},
   fake("auth0|unknown-r22"),
  ];
  for(const token of claimVariations){
   for(const path of ["/organization","/role-summaries"]){
    const denied=await request(app(token)).get(prefix(ORCHID)+path)
     .set("x-role","ORG_OWNER").set("x-organization-id",ORCHID)
     .set("Authorization","Bearer forged-synthetic-evidence");
    assert.equal(denied.status,401);
    assert.deepEqual(denied.body,{error:{code:"P4_IDENTITY_REQUIRED"}});
    assert.equal(JSON.stringify(denied.body).includes("forged-synthetic-evidence"),false);
   }
  }
  // Explicit repeated tenant switching never inherits a previous GUC or role.
  const switched=await Promise.all(Array.from({length:12},(_,i)=>
    request(i%3===0?admin:i%3===1?owner:reviewer)
     .get(prefix(i%2===0?ORCHID:CEDAR)+"/organization")));
  switched.forEach((result,i)=>{
   const role=i%3;
   const tenant=i%2;
   const expected=role===1?200:(tenant===0?200:403);
   assert.equal(result.status,expected);
   if(result.status===200){
    assert.equal(result.body.data.id,tenant===0?ORCHID:CEDAR);
    assert.equal(JSON.stringify(result.body).includes("auth0|"),false);
   }else assert.deepEqual(result.body,{error:{code:"P4_ACCESS_DENIED"}});
  });
  try{
   await setup.query("UPDATE p4_r7_ci.memberships SET active=false"+
     " WHERE organization_id=$1 AND actor_id=$2",[ORCHID,EMMA]);
   assert.equal((await request(admin).get(prefix(ORCHID)+"/organization")).status,403);
   assert.equal((await request(admin).get(prefix(ORCHID)+"/role-summaries")).status,403);
  } finally{
   await setup.query("UPDATE p4_r7_ci.memberships SET active=true"+
     " WHERE organization_id=$1 AND actor_id=$2",[ORCHID,EMMA]);
  }
  try{
   await setup.query("UPDATE p4_r7_ci.app_grants SET active=false"+
     " WHERE organization_id=$1 AND app_code='platform'",[ORCHID]);
   assert.equal((await request(owner).get(prefix(ORCHID)+"/organization")).status,403);
   assert.equal((await request(reviewer).get(prefix(ORCHID)+"/role-summaries")).status,403);
  }finally{
   await setup.query("UPDATE p4_r7_ci.app_grants SET active=true"+
     " WHERE organization_id=$1 AND app_code='platform'",[ORCHID]);
  }
  // The R9 CI audit trigger deliberately prevents direct admin-role toggles:
  // only synthetic SALES_REP / SALES_MANAGER changes are owner-audited.
  // Exercise permitted CI role mutation in the same transaction as its owner
  // context and let the server-side R7 reader re-check current privilege.
  const repScope={organizationId:ORCHID,actorId:CHARLIE};
  assert.equal((await readP4R7CiLeads(prisma,repScope)).length,3);
  async function guardedSalesToggle(active:boolean){
   const client=await setup.connect();
   try{
    await client.query("BEGIN");
    await client.query(
     "SELECT set_config('app.tenant_id',$1,true),"+
     " set_config('app.actor_id',$2,true)",
     [ORCHID,"10000000-0000-4000-8000-0000000000a1"]);
    const changed=await client.query(
     "UPDATE p4_r7_ci.role_grants SET active=$1"+
     " WHERE organization_id=$2 AND actor_id=$3"+
     " AND role_code='SALES_REP'",[active,ORCHID,CHARLIE]);
    assert.equal(changed.rowCount,1);
    await client.query("COMMIT");
   }catch(e){await client.query("ROLLBACK");throw e;}
   finally{client.release();}
  }
  try{
   await guardedSalesToggle(false);
   await assert.rejects(readP4R7CiLeads(prisma,repScope),P4R7CiReadDeniedError);
   // The same member cannot impersonate ORG_OWNER for platform IAM.
   const denied=await request(rep).get(prefix(ORCHID)+"/organization")
     .set("x-role","ORG_OWNER");
   assert.equal(denied.status,403);
   assert.deepEqual(denied.body,{error:{code:"P4_ACCESS_DENIED"}});
   assert.equal((await request(owner).get(prefix(ORCHID)+"/organization")).status,200);
  }finally{await guardedSalesToggle(true);}
  assert.equal((await readP4R7CiLeads(prisma,repScope)).length,3);
  // Disable a tenant's platform entitlement: all org/role read paths fail,
  // even if the synthetic role and membership remain valid.
  try{
   await setup.query("UPDATE p4_r7_ci.app_grants SET active=false"+
    " WHERE organization_id=$1 AND app_code='platform'",[ORCHID]);
   const checks=await Promise.all([
    request(owner).get(prefix(ORCHID)+"/organization"),
    request(admin).get(prefix(ORCHID)+"/role-summaries"),
    request(reviewer).get(prefix(ORCHID)+"/organization"),
   ]);
   checks.forEach(r=>{
    assert.equal(r.status,403);
    assert.deepEqual(r.body,{error:{code:"P4_ACCESS_DENIED"}});
   });
   // Cedar remains accessible by its own owner.
   assert.equal((await request(owner).get(prefix(CEDAR)+"/organization")).status,200);
  }finally{
   await setup.query("UPDATE p4_r7_ci.app_grants SET active=true"+
    " WHERE organization_id=$1 AND app_code='platform'",[ORCHID]);
  }
  // Cross-org member and role forgery cannot overcome DB-scoped permissions.
  for(const url of [prefix(CEDAR)+"/organization",
    prefix(CEDAR)+"/role-summaries"]){
   const denied=await request(admin).get(url)
    .set("x-role","ORG_OWNER").set("x-tenant",CEDAR);
   assert.equal(denied.status,403);
   assert.deepEqual(denied.body,{error:{code:"P4_ACCESS_DENIED"}});
  }
  // Sales person is a member but cannot elevate to IAM reader by headers.
  const repResult=await request(rep).get(prefix(ORCHID)+"/organization")
    .set("x-role","ORG_OWNER");
  assert.equal(repResult.status,403);
  assert.deepEqual(repResult.body,{error:{code:"P4_ACCESS_DENIED"}});
  // The synthetic lead grant remains separate from IAM. Do not mutate it,
  // and do not imply that a CRM role authorizes organization administration.
  const repRoles=await setup.query("SELECT role_code FROM p4_r7_ci.role_grants"+
    " WHERE organization_id=$1 AND actor_id=$2 AND active=true",
    [ORCHID,CHARLIE]);
  assert.deepEqual(repRoles.rows.map(r=>r.role_code),["SALES_REP"]);
  const context=await prisma.$queryRawUnsafe<Array<{
   role:string;tenant:string|null;actor:string|null;
  }>>('SELECT current_user AS role,'+
    "nullif(current_setting('app.tenant_id',true),'') AS tenant,"+
    "nullif(current_setting('app.actor_id',true),'') AS actor");
  assert.deepEqual(context,[{role:"demo_ci",tenant:null,actor:null}]);
  process.stdout.write("P4 R23 CI-only organization and role RLS/Prisma/HTTP PASS\n");
 }finally{
  await Promise.all([prisma.$disconnect(),lookupPool.end(),setup.end()]);
 }
}
main().catch(()=>{
 process.stderr.write("P4 R23 CI-only read-boundary verification FAILED\n");
 process.exitCode=1;
});
