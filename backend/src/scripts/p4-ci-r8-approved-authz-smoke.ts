/**
 * Approved ADR 0008 D1/D2/D4/D5: REAL PostgreSQL + Prisma + HTTP CI smoke.
 * Uses fictional identities and only disposable local GitHub PostgreSQL.
 * NOT a signed real Auth0 session or staging authorization acceptance.
 */
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import pg from "pg";
import type { P4VerifiedProviderToken } from "../platform/p4-auth0-subject-bridge.js";
import {
  assertP4V1CiPrismaEnvironment,
} from "../platform/p4-v1-ci-prisma.js";
import {
  createP4R7CiPrismaClient, readP4R7CiLead, readP4R7CiLeads,
  P4R7CiReadDeniedError,
} from "../platform/p4-r7-ci-prisma-reader.js";
import {
  createP4V1CiIdentityPool, createP4V1CiSubjectLookup,
  resolveP4V1CiActor,
} from "../platform/p4-v1-ci-identity.js";
import { createP4R8CiTestRouter } from "../platform/p4-r8-ci-test-router.js";
import { readP4R9CiVisibleReport,searchP4R9CiLeads } from "../platform/p4-r9-ci-search-report.js";

const ORCHID = "20000000-0000-4000-8000-000000000001";
const CEDAR = "20000000-0000-4000-8000-000000000002";
const ALICE = "10000000-0000-4000-8000-0000000000a1";
const CHARLIE = "10000000-0000-4000-8000-0000000000c1";
const DANA = "10000000-0000-4000-8000-0000000000d1";
const SHARED = "80000000-0000-4000-8000-000000000001";
const PRIVATE = "80000000-0000-4000-8000-000000000002";
const OWNED = "80000000-0000-4000-8000-000000000003";
const ASSIGNED = "80000000-0000-4000-8000-000000000004";
const CEDAR_LEAD = "80000000-0000-4000-8000-000000000005";
const TEAM = "30000000-0000-4000-8000-000000000001";
const EXPECTED = { issuer: "https://demo.us.auth0.com/", audience: "urn:zoho-clone:demo" };
const NOW = 2_000_000_000;
const token: P4VerifiedProviderToken = {
  issuer: EXPECTED.issuer, audience: EXPECTED.audience,
  subject: "auth0|demo-charlie", expiresAtEpochSeconds: NOW+120,
  cryptographicallyVerified: true,
};

async function main() {
  assertP4V1CiPrismaEnvironment(process.env);
  const prisma = createP4R7CiPrismaClient(process.env);
  const lookupPool = createP4V1CiIdentityPool(process.env);
  const fixturePool = new pg.Pool({
    host:"127.0.0.1",port:5432,database:"zoho_clone_synthetic_ci",
    user:"demo_ci",password:"fake_ci_not_for_real_accounts",max:1,
  });
  try {
    const lookup = createP4V1CiSubjectLookup(lookupPool,process.env);
    const charlie = await resolveP4V1CiActor(token,EXPECTED,lookup,NOW);
    assert.equal(charlie,CHARLIE);
    const rep = {organizationId:ORCHID,actorId:charlie};
    const owner = {organizationId:ORCHID,actorId:ALICE};
    const manager = {organizationId:ORCHID,actorId:DANA};

    // D3 from previously approved P1.06: org ownership is NOT CRM read.
    await assert.rejects(readP4R7CiLeads(prisma,owner),P4R7CiReadDeniedError);
    await assert.rejects(readP4R7CiLead(prisma,owner,SHARED),P4R7CiReadDeniedError);
    await assert.rejects(readP4R7CiLeads(prisma,{organizationId:CEDAR,actorId:ALICE}),
      P4R7CiReadDeniedError);

    const repRows = await readP4R7CiLeads(prisma,rep);
    assert.deepEqual(repRows.map(r=>r.id),[SHARED,OWNED,ASSIGNED]);
    for(const row of repRows) {
      assert.deepEqual(Object.keys(row).sort(),["displayName","id"]);
      assert.ok(row.displayName.startsWith("Demo "));
    }
    assert.deepEqual(await readP4R7CiLead(prisma,rep,SHARED),{
      id:SHARED,displayName:"Demo Shared Orchid Lead",
    });
    for(const id of [PRIVATE,CEDAR_LEAD,"not-a-uuid"]) {
      await assert.rejects(readP4R7CiLead(prisma,rep,id),P4R7CiReadDeniedError);
    }
    await assert.rejects(readP4R7CiLeads(prisma,{
      organizationId:CEDAR,actorId:charlie,
    }),P4R7CiReadDeniedError);

    const managed = await readP4R7CiLeads(prisma,manager);
    assert.deepEqual(managed.map(x=>x.id),[SHARED]);
    await assert.rejects(readP4R7CiLead(prisma,manager,PRIVATE),P4R7CiReadDeniedError);

    // D5 — all changes are disposable fixture mutations by CI bootstrap.
    // Every subsequent Prisma request must recheck current entitlements.
    async function toggle(table:"team_grants"|"app_grants"|"role_grants"|"memberships",
      predicate:string,off:boolean) {
      // The table/predicate strings are ONLY internal static test definitions,
      // never route inputs, credentials, customer data or user parameters.
      if (!["team_grants","app_grants","role_grants","memberships"].includes(table) ||
          !["team","app","role","member"].includes(predicate))
        throw new Error("INVALID_CI_FIXTURE");
      const where = {
        team:"actor_id=$1 AND organization_id=$2 AND team_id=$3",
        app:"organization_id=$1 AND app_code='crm'",
        role:"actor_id=$1 AND organization_id=$2 AND role_code='SALES_REP'",
        member:"actor_id=$1 AND organization_id=$2",
      }[predicate]!;
      const q="UPDATE p4_r7_ci."+table+" SET active="+(off?"false":"true")+
        " WHERE "+where;
      const params=predicate==="team"?[CHARLIE,ORCHID,TEAM]:
        predicate==="app"?[ORCHID]:[CHARLIE,ORCHID];
      await fixturePool.query(q,params);
    }
    try {
      await toggle("team_grants","team",true);
      assert.deepEqual((await readP4R7CiLeads(prisma,rep)).map(r=>r.id),[OWNED,ASSIGNED]);
      await assert.rejects(readP4R7CiLead(prisma,rep,SHARED),P4R7CiReadDeniedError);
    } finally { await toggle("team_grants","team",false); }
    try {
      await fixturePool.query(
        "UPDATE p4_r7_ci.leads SET assigned_user_id=NULL WHERE organization_id=$1 AND id=$2",
        [ORCHID,ASSIGNED],
      );
      assert.deepEqual((await readP4R7CiLeads(prisma,rep)).map(r=>r.id),[SHARED,OWNED]);
      await assert.rejects(readP4R7CiLead(prisma,rep,ASSIGNED),P4R7CiReadDeniedError);
    } finally {
      await fixturePool.query(
        "UPDATE p4_r7_ci.leads SET assigned_user_id=$1 WHERE organization_id=$2 AND id=$3",
        [CHARLIE,ORCHID,ASSIGNED],
      );
    }
    for(const [table,predicate] of [
      ["app_grants","app"],["role_grants","role"],["memberships","member"],
    ] as const) {
      try {
        await toggle(table,predicate,true);
        await assert.rejects(readP4R7CiLeads(prisma,rep),P4R7CiReadDeniedError);
      } finally { await toggle(table,predicate,false); }
      assert.deepEqual((await readP4R7CiLeads(prisma,rep)).map(r=>r.id),[
        SHARED,OWNED,ASSIGNED,
      ]);
    }

    function makeApp(evidence: P4VerifiedProviderToken|null) {
      const app=express();
      app.use("/_p4_r8_ci",createP4R8CiTestRouter({
        prisma,mappingLookup:lookup,
        resolveVerifiedSdkEvidence:async()=>evidence,
        expectedIssuer:EXPECTED.issuer,expectedAudience:EXPECTED.audience,
        nowEpochSeconds:()=>NOW,
      }));
      return app;
    }
    const good=makeApp(token);
    const got=await request(good).get("/_p4_r8_ci/"+ORCHID+"/crm/leads");
    assert.equal(got.status,200);
    assert.equal(got.headers["cache-control"],"no-store");
    assert.deepEqual(got.body.data.map((r:{id:string})=>r.id),[SHARED,OWNED,ASSIGNED]);
    assert.equal(JSON.stringify(got.body).includes("confidential_note"),false);
    assert.equal(JSON.stringify(got.body).includes("PRIVATE placeholder"),false);
    assert.equal(JSON.stringify(got.body).includes("ownerUserId"),false);
    assert.equal(JSON.stringify(got.body).includes("assigned_user_id"),false);

    // D1/D2: search and report cannot count hidden leads, and keyset
    // pagination must be over RLS-filtered rows (not the tenant inventory).
    const first=await request(good).get(
      "/_p4_r8_ci/"+ORCHID+"/crm/search?q=Demo&limit=2",
    );
    assert.equal(first.status,200);
    assert.equal(first.headers["cache-control"],"no-store");
    assert.deepEqual(first.body.data.records.map((r:{id:string})=>r.id),[SHARED,OWNED]);
    assert.equal(first.body.data.nextCursor,OWNED);
    const second=await request(good).get(
      "/_p4_r8_ci/"+ORCHID+"/crm/search?q=Demo&limit=2&afterId="+OWNED,
    );
    assert.equal(second.status,200);
    assert.deepEqual(second.body.data.records.map((r:{id:string})=>r.id),[ASSIGNED]);
    assert.equal(second.body.data.nextCursor,null);
    assert.equal(JSON.stringify(first.body).includes("confidential"),false);
    const report=await request(good).get("/_p4_r8_ci/"+ORCHID+"/crm/report");
    assert.equal(report.status,200);
    assert.deepEqual(report.body.data,{
      metric:"visible_crm_leads",totalVisible:3,
      privateVisible:2,explicitlyTeamSharedVisible:1,
    });
    const managerReport=await readP4R9CiVisibleReport(prisma,manager,process.env);
    assert.equal(managerReport.totalVisible,1);
    assert.equal(managerReport.privateVisible,0);
    assert.deepEqual((await searchP4R9CiLeads(prisma,rep,{text:"orchid"},process.env))
      .records.map(x=>x.id),[SHARED]);
    for(const q of [
      "/_p4_r8_ci/"+ORCHID+"/crm/search?q=%25",
      "/_p4_r8_ci/"+ORCHID+"/crm/search?q=Demo&limit=50",
      "/_p4_r8_ci/"+ORCHID+"/crm/search?q=Demo&role=ORG_OWNER",
      "/_p4_r8_ci/"+ORCHID+"/crm/search?q=Demo&afterId=not-a-uuid",
      "/_p4_r8_ci/"+CEDAR+"/crm/report",
    ]){
      assert.equal((await request(good).get(q).set("x-role","ORG_OWNER")).status,403);
    }
    const ownerApp=makeApp({...token,subject:"auth0|demo-alice"});
    assert.equal((await request(ownerApp).get(
      "/_p4_r8_ci/"+ORCHID+"/crm/search?q=Demo")).status,403);
    assert.equal((await request(ownerApp).get(
      "/_p4_r8_ci/"+ORCHID+"/crm/report")).status,403);
    assert.equal((await request(makeApp(null)).get(
      "/_p4_r8_ci/"+ORCHID+"/crm/report")).status,401);
    assert.equal((await request(good).post(
      "/_p4_r8_ci/"+ORCHID+"/crm/report")).status,404);
    assert.equal((await request(good).get(
      "/_p4_r8_ci/"+ORCHID+"/crm/report?export=csv")).status,403);
    // Search/report are read-only, not an authorization to create exports.
    assert.equal((await request(good).get(
      "/_p4_r8_ci/"+ORCHID+"/crm/leads/"+SHARED)).status,200);
    for(const target of [PRIVATE,CEDAR_LEAD,"not-a-uuid"]) {
      const denied=await request(good).get(
        "/_p4_r8_ci/"+ORCHID+"/crm/leads/"+target,
      ).set("x-role","ORG_OWNER").set("x-tenant",ORCHID);
      assert.equal(denied.status,403);
      assert.deepEqual(denied.body,{error:{code:"P4_ACCESS_DENIED"}});
    }
    assert.equal((await request(good).get(
      "/_p4_r8_ci/"+CEDAR+"/crm/leads").set("x-role","ORG_OWNER")).status,403);
    assert.equal((await request(good).post(
      "/_p4_r8_ci/"+ORCHID+"/crm/leads")).status,404);
    assert.equal((await request(good).get(
      "/_p4_r8_ci/"+ORCHID+"/crm/leads/export")).status,403);
    assert.equal((await request(makeApp(null)).get(
      "/_p4_r8_ci/"+ORCHID+"/crm/leads")).status,401);
    assert.equal((await request(makeApp({...token,cryptographicallyVerified:false as never})).get(
      "/_p4_r8_ci/"+ORCHID+"/crm/leads")).status,401);
    assert.equal((await request(makeApp({...token,expiresAtEpochSeconds:NOW})).get(
      "/_p4_r8_ci/"+ORCHID+"/crm/leads")).status,401);
    assert.equal((await request(makeApp({...token,subject:"auth0|unknown"})).get(
      "/_p4_r8_ci/"+ORCHID+"/crm/leads")).status,401);

    // Same pooled session after successful + rejected requests MUST return
    // to CI bootstrap role, with transaction-local tenant/actor reset.
    const role=await prisma.$queryRawUnsafe<Array<{
      role:string;tenant:string|null;actor:string|null;
    }>>(
      "SELECT current_user AS role,"+
      " nullif(current_setting('app.tenant_id',true),'') AS tenant,"+
      " nullif(current_setting('app.actor_id',true),'') AS actor",
    );
    assert.deepEqual(role,[{role:"demo_ci",tenant:null,actor:null}]);
    process.stdout.write(
      "P4 R8 approved D1/D2/D4/D5: real Prisma P1.06 roles, private/team/assigned"+
      " RLS, field denial, revocation and isolated HTTP 401/403 PASS\n",
    );
  } finally {
    await Promise.all([prisma.$disconnect(),lookupPool.end(),fixturePool.end()]);
  }
}
main().catch(()=>{
  process.stderr.write("P4 R8 synthetic CI-only approved role integration FAILED\n");
  process.exitCode=1;
});
