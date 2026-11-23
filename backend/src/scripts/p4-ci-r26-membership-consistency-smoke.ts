/**
 * Batch 26: fresh membership/role/app evidence across concurrent disposable tenant reads.
 * Verified-token evidence is INJECTED BY CI, not a real Auth0 login.
 * No real invites, recipient emails, audit payloads or customer files.
 */
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import pg from "pg";
import type { P4VerifiedProviderToken } from "../platform/p4-auth0-subject-bridge.js";
import { assertP4V1CiPrismaEnvironment } from "../platform/p4-v1-ci-prisma.js";
import { createP4R7CiPrismaClient,P4R7CiReadDeniedError } from "../platform/p4-r7-ci-prisma-reader.js";
import { createP4V1CiIdentityPool,createP4V1CiSubjectLookup } from "../platform/p4-v1-ci-identity.js";
import { createP4R8CiTestRouter } from "../platform/p4-r8-ci-test-router.js";
import {
  readP4R11CiInvitationStatus,readP4R11CiAuditMetadata,
  readP4R11CiMembershipStatus,
} from "../platform/p4-r11-ci-iam-reader.js";

const ORCHID="20000000-0000-4000-8000-000000000001";
const CEDAR="20000000-0000-4000-8000-000000000002";
const ALICE="10000000-0000-4000-8000-0000000000a1";
const EMMA="10000000-0000-4000-8000-0000000000e1";
const FELIX="10000000-0000-4000-8000-0000000000f1";
const NOW=2_000_000_000;
const EXPECTED={issuer:"https://demo.us.auth0.com/",audience:"urn:zoho-clone:demo"};
function fakeToken(subject:string):P4VerifiedProviderToken {
  return {issuer:EXPECTED.issuer,audience:EXPECTED.audience,subject,
    expiresAtEpochSeconds:NOW+100,cryptographicallyVerified:true};
}
async function main(){
  assertP4V1CiPrismaEnvironment(process.env);
  const prisma=createP4R7CiPrismaClient(process.env);
  const lookupPool=createP4V1CiIdentityPool(process.env);
  const setup=new pg.Pool({
    host:"127.0.0.1",port:5432,database:"zoho_clone_synthetic_ci",
    user:"demo_ci",password:"fake_ci_not_for_real_accounts",max:1,
  });
  try{
    const lookup=createP4V1CiSubjectLookup(lookupPool,process.env);
    function app(token:P4VerifiedProviderToken|null){
      const e=express();
      e.use("/_p4_r11_ci",createP4R8CiTestRouter({
        prisma,mappingLookup:lookup,
        resolveVerifiedSdkEvidence:async()=>token,
        expectedIssuer:EXPECTED.issuer,expectedAudience:EXPECTED.audience,
        nowEpochSeconds:()=>NOW,
      }));
      return e;
    }
    const owner=app(fakeToken("auth0|demo-alice"));
    const admin=app(fakeToken("auth0|demo-emma"));
    const reviewer=app(fakeToken("auth0|demo-felix"));
    const rep=app(fakeToken("auth0|demo-charlie"));
    const base="/_p4_r11_ci/"+ORCHID+"/iam";
    const ownerMembers=await request(owner).get(base+"/members");
    assert.equal(ownerMembers.status,200);
    assert.equal(ownerMembers.headers["cache-control"],"no-store");
    assert.equal(ownerMembers.body.data.length,5);
    assert.equal(ownerMembers.body.data.some((r:{roleCode:string})=>
      r.roleCode==="ORG_OWNER"),true);
    assert.deepEqual(Object.keys(ownerMembers.body.data[0]).sort(),
      ["active","roleCode","userId"]);

    const ownerInvites=await request(owner).get(base+"/invitations");
    assert.equal(ownerInvites.status,200);
    assert.equal(ownerInvites.body.data.length,1);
    assert.equal(ownerInvites.body.data[0].status,"pending");
    assert.deepEqual(Object.keys(ownerInvites.body.data[0]).sort(),
      ["expiresAt","id","roleCode","status"]);
    const ownerAudit=await request(owner).get(base+"/audit");
    assert.equal(ownerAudit.status,200);
    assert.equal(ownerAudit.body.data.length,1);
    assert.equal(ownerAudit.body.data[0].action,"role_grant.revoked");
    assert.deepEqual(Object.keys(ownerAudit.body.data[0]).sort(),
      ["action","actorId","id","occurredAt"]);
    for(const r of [ownerMembers,ownerInvites,ownerAudit]){
      const data=JSON.stringify(r.body);
      assert.equal(data.includes("token_hash"),false);
      assert.equal(data.includes("recipient_email"),false);
      assert.equal(data.includes("private@example"),false);
      assert.equal(data.includes("PRIVATE request"),false);
      assert.equal(data.includes("external_subject"),false);
    }
    const cedar="/_p4_r11_ci/"+CEDAR+"/iam";
    for(const kind of ["members","invitations","audit"]){
      const r=await request(owner).get(cedar+"/"+kind);
      assert.equal(r.status,200);
      assert.equal(r.body.data.length,1);
      assert.equal(JSON.stringify(r.body).includes("70000000-0000-4000-8000-000000000001"),false);
    }

    assert.equal((await request(admin).get(base+"/members")).status,200);
    const adminMembers=(await request(admin).get(base+"/members")).body.data;
    assert.deepEqual(adminMembers.map((r:{roleCode:string})=>r.roleCode).sort(),
      ["SALES_MANAGER","SALES_REP"]);
    assert.equal((await request(admin).get(base+"/invitations")).status,200);
    assert.equal((await request(admin).get(base+"/audit")).status,403);

    assert.equal((await request(reviewer).get(base+"/members")).status,200);
    assert.equal((await request(reviewer).get(base+"/audit")).status,200);
    assert.equal((await request(reviewer).get(base+"/invitations")).status,403);
    for(const kind of ["members","invitations","audit"]){
      assert.equal((await request(rep).get(base+"/"+kind)
        .set("x-role","ORG_OWNER")).status,403);
      assert.equal((await request(reviewer).get(cedar+"/"+kind)).status,403);
      assert.equal((await request(app(null)).get(base+"/"+kind)).status,401);
      assert.equal((await request(owner).get(base+"/"+kind+"?export=csv")).status,403);
      assert.equal((await request(owner).post(base+"/"+kind)).status,404);
    }
    assert.equal((await request(owner).get(
      "/_p4_r11_ci/not-a-uuid/iam/members")).status,403);
    assert.equal((await request(app(fakeToken("auth0|unknown"))).get(
      base+"/audit")).status,401);
    assert.equal((await request(app({
      ...fakeToken("auth0|demo-alice"),cryptographicallyVerified:false as never,
    })).get(base+"/audit")).status,401);

    // Fake active membership revocation is checked anew on the next read.
    try{
      await setup.query("UPDATE p4_r7_ci.memberships SET active=false"+
        " WHERE organization_id=$1 AND actor_id=$2",[ORCHID,EMMA]);
      assert.equal((await request(admin).get(base+"/members")).status,403);
      await assert.rejects(readP4R11CiInvitationStatus(prisma,{
        organizationId:ORCHID,actorId:EMMA,
      },20,process.env),P4R7CiReadDeniedError);
    } finally{
      await setup.query("UPDATE p4_r7_ci.memberships SET active=true"+
        " WHERE organization_id=$1 AND actor_id=$2",[ORCHID,EMMA]);
    }
    try{
      await setup.query("UPDATE p4_r7_ci.app_grants SET active=false"+
        " WHERE organization_id=$1 AND app_code='platform'",[ORCHID]);
      assert.equal((await request(owner).get(base+"/audit")).status,403);
      assert.equal((await request(reviewer).get(base+"/members")).status,403);
    } finally{
      await setup.query("UPDATE p4_r7_ci.app_grants SET active=true"+
        " WHERE organization_id=$1 AND app_code='platform'",[ORCHID]);
    }
    assert.equal((await readP4R11CiAuditMetadata(prisma,{
      organizationId:ORCHID,actorId:ALICE,
    },20,process.env)).length,1);
    assert.equal((await readP4R11CiMembershipStatus(prisma,{
      organizationId:ORCHID,actorId:EMMA,
    },20,process.env)).length,2);

    // Batch 26: alternating identities, organizations, and read surfaces must
    // never borrow a previous request's tenant or role grants from the pool.
    const combinations=[
      {app:owner,org:ORCHID,kind:"members",status:200},
      {app:owner,org:CEDAR,kind:"invitations",status:200},
      {app:admin,org:ORCHID,kind:"members",status:200},
      {app:admin,org:CEDAR,kind:"members",status:403},
      {app:reviewer,org:ORCHID,kind:"audit",status:200},
      {app:reviewer,org:ORCHID,kind:"invitations",status:403},
      {app:rep,org:ORCHID,kind:"members",status:403},
      {app:reviewer,org:CEDAR,kind:"audit",status:403},
    ];
    const concurrent=await Promise.all(Array.from({length:24},(_,i)=>{
      const t=combinations[i%combinations.length]!;
      return request(t.app).get("/_p4_r11_ci/"+t.org+"/iam/"+t.kind)
        .set("x-tenant",t.org).set("x-role","ORG_OWNER");
    }));
    concurrent.forEach((result,i)=>{
      const t=combinations[i%combinations.length]!;
      assert.equal(result.status,t.status,t.kind+" "+t.org+" "+i);
      assert.equal(result.headers["cache-control"],"no-store");
      if(result.status===403)
        assert.deepEqual(result.body,{error:{code:"P4_ACCESS_DENIED"}});
      else{
        const rows=result.body.data as Array<Record<string,unknown>>;
        assert.ok(Array.isArray(rows));
        const output=JSON.stringify(rows);
        for(const key of ["token_hash_private","recipient_email_private",
          "raw_payload_private","auth0|","external_subject"]){
          assert.equal(output.includes(key),false);
        }
      }
    });
    // Membership revocation must invalidate all three IAM reader surfaces,
    // not only the member listing. Cedar's independent owner remains valid.
    try{
      await setup.query("UPDATE p4_r7_ci.memberships SET active=false"+
        " WHERE organization_id=$1 AND actor_id=$2",[ORCHID,EMMA]);
      for(const kind of ["members","invitations","audit"]){
        const r=await request(admin).get(base+"/"+kind)
          .set("x-role","ORG_OWNER");
        assert.equal(r.status,403);
        assert.deepEqual(r.body,{error:{code:"P4_ACCESS_DENIED"}});
      }
      assert.equal((await request(owner).get(cedar+"/members")).status,200);
    }finally{
      await setup.query("UPDATE p4_r7_ci.memberships SET active=true"+
        " WHERE organization_id=$1 AND actor_id=$2",[ORCHID,EMMA]);
    }
    assert.equal((await request(admin).get(base+"/members")).status,200);
    // Current app entitlement is checked afresh for all three protected reads.
    try{
      await setup.query("UPDATE p4_r7_ci.app_grants SET active=false"+
        " WHERE organization_id=$1 AND app_code='platform'",[ORCHID]);
      for(const [actor,kind] of [[owner,"members"],[admin,"invitations"],
        [reviewer,"audit"]] as const){
        const r=await request(actor).get(base+"/"+kind);
        assert.equal(r.status,403);
        assert.deepEqual(r.body,{error:{code:"P4_ACCESS_DENIED"}});
      }
      assert.equal((await request(owner).get(cedar+"/invitations")).status,200);
    }finally{
      await setup.query("UPDATE p4_r7_ci.app_grants SET active=true"+
        " WHERE organization_id=$1 AND app_code='platform'",[ORCHID]);
    }
    assert.equal((await request(owner).get(base+"/audit")).status,200);
    // CI-only pooled connection must NOT preserve actor or tenant context.
    const state=await prisma.$queryRawUnsafe<Array<{
      role:string;tenant:string|null;actor:string|null;
    }>>('SELECT current_user AS role,'+
      " nullif(current_setting('app.tenant_id',true),'') AS tenant,"+
      " nullif(current_setting('app.actor_id',true),'') AS actor");
    assert.deepEqual(state,[{role:"demo_ci",tenant:null,actor:null}]);
    process.stdout.write("P4 R26 CI-only Auth0-subject mapped IAM metadata,"+
      " role/invite/audit minimization, revocation, two-org HTTP 401/403 PASS\n");
  } finally{
    await Promise.all([prisma.$disconnect(),lookupPool.end(),setup.end()]);
  }
}
main().catch(()=>{
  process.stderr.write("P4 R26 CI-only IAM integration FAILED\n");
  process.exitCode=1;
});
