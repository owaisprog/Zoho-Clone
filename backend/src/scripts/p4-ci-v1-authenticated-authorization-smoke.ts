/**
 * P4 exit integration 05:
 * - synthetic verified SDK payload -> low-privilege exact Auth0 subject lookup
 * - mapped internal UUIDv4 -> restricted Prisma txn -> active membership
 * - tenant app grant AND role permission -> read-only CRM projection
 * - mock-only Express HTTP path with explicit 401/403 tests.
 *
 * DISPOSABLE GITHUB CI ONLY; no real JWT is decoded/verified here.
 * A real Auth0 JWKS middleware must be reviewed before any live API mount.
 */
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import type { P4VerifiedProviderToken } from "../platform/p4-auth0-subject-bridge.js";
import {
  resolveP4V1CiActor,
  createP4V1CiIdentityPool, createP4V1CiSubjectLookup,
  P4V1CiIdentityDeniedError,
} from "../platform/p4-v1-ci-identity.js";
import {
  assertP4V1CiPrismaEnvironment,
  createP4V1CiPrismaClient, withP4V1CiPrismaTenant,
  P4V1CiPrismaDeniedError,
} from "../platform/p4-v1-ci-prisma.js";
import {
  readP4V1CiAppManifest, readP4V1CiAuthorizedApp,
  readP4V1CiAuthorizedLead,
  P4V1CiAppDeniedError,
} from "../platform/p4-v1-ci-authorized-app.js";
import { createP4V1CiTestOnlyRouter } from "../platform/p4-v1-ci-authenticated-router.js";

const EXPECTED = {
  issuer: "https://demo.us.auth0.com/",
  audience: "urn:zoho-clone:demo",
} as const;
const NOW = 2_000_000_000;
const ALICE = "10000000-0000-4000-8000-0000000000a1";
const CHARLIE = "10000000-0000-4000-8000-0000000000c1";
const ORCHID_LEAD = "40000000-0000-4000-8000-000000000001";
const CEDAR_LEAD = "40000000-0000-4000-8000-000000000002";
const ORCHID = "20000000-0000-4000-8000-000000000001";
const CEDAR = "20000000-0000-4000-8000-000000000002";
const FOREIGN = "20000000-0000-4000-8000-000000000099";
const alice: P4VerifiedProviderToken = {
  issuer: EXPECTED.issuer,
  subject: "auth0|demo-alice",
  audience: EXPECTED.audience,
  expiresAtEpochSeconds: NOW + 120,
  cryptographicallyVerified: true,
};
async function main() {
  assertP4V1CiPrismaEnvironment(process.env);
  const lookupPool = createP4V1CiIdentityPool(process.env);
  const prisma = createP4V1CiPrismaClient(process.env);
  try {
    const lookup = createP4V1CiSubjectLookup(lookupPool, process.env);
    const actor = await resolveP4V1CiActor(alice, EXPECTED, lookup, NOW);
    assert.equal(actor, ALICE);

    const orchid = await readP4V1CiAppManifest(prisma, {
      organizationId: ORCHID, actorId: actor,
    }, process.env);
    const cedar = await readP4V1CiAppManifest(prisma, {
      organizationId: CEDAR, actorId: actor,
    }, process.env);
    assert.deepEqual(orchid.map(x => [x.code,x.status]), [
      ["crm","available"],["teams","locked"],
    ]);
    assert.deepEqual(cedar.map(x => [x.code,x.status]), [
      ["crm","available"],["teams","locked"],
    ]);
    const dataA = await readP4V1CiAuthorizedApp(prisma, {
      organizationId: ORCHID, actorId: actor,
    }, "crm", process.env);
    const dataB = await readP4V1CiAuthorizedApp(prisma, {
      organizationId: CEDAR, actorId: actor,
    }, "crm", process.env);
    assert.equal(dataA.leads.length, 2);
    assert.equal(dataB.leads.length, 1);
    assert.ok(dataA.leads.every(x => !dataB.leads.some(y => x.id === y.id)));
    assert.equal("email" in dataA.leads[0]!, false);
    await assert.rejects(readP4V1CiAuthorizedApp(prisma, {
      organizationId: ORCHID, actorId: actor,
    }, "teams", process.env), P4V1CiAppDeniedError);
    await assert.rejects(readP4V1CiAuthorizedApp(prisma, {
      organizationId: ORCHID, actorId: actor,
    }, "finance", process.env), P4V1CiAppDeniedError);


    // Provisional TEAM/RECORD ABAC: Charlie has no owned leads, yet is
    // assigned to Orchid's team. File/audit data must stay private.
    const charlie = await resolveP4V1CiActor(
      { ...alice, subject:"auth0|demo-charlie" }, EXPECTED, lookup, NOW,
    );
    assert.equal(charlie,CHARLIE);
    const memberScope = { organizationId: ORCHID, actorId: charlie };
    const assigned = await readP4V1CiAuthorizedApp(
      prisma, memberScope, "crm", process.env,
    );
    assert.equal(assigned.leads.length, 2);
    const assignedRecord = await readP4V1CiAuthorizedLead(
      prisma, memberScope, ORCHID_LEAD, process.env,
    );
    assert.equal(assignedRecord.id,ORCHID_LEAD);
    assert.deepEqual(Object.keys(assignedRecord).sort(),[
      "id","label","organizationId",
    ]);
    await assert.rejects(readP4V1CiAuthorizedLead(
      prisma, memberScope, CEDAR_LEAD, process.env,
    ),P4V1CiAppDeniedError);
    await assert.rejects(readP4V1CiAuthorizedLead(
      prisma, memberScope, "40000000-0000-1000-8000-000000000001", process.env,
    ),P4V1CiAppDeniedError);
    await assert.rejects(readP4V1CiAppManifest(prisma, {
      organizationId: CEDAR, actorId: charlie,
    },process.env),P4V1CiAppDeniedError);

    // SQL column grants deny private fields even if developer code bypasses
    // explicit ORM selects and requests raw SQL inside the protected tx.
    for(const statement of [
      "SELECT confidential_note FROM p4_v1_ci.crm_leads LIMIT 1",
      "SELECT private_object_locator FROM p4_v1_ci.file_metadata LIMIT 1",
    ]) {
      await assert.rejects(
        withP4V1CiPrismaTenant(prisma, memberScope, async tx => {
          await tx.$queryRawUnsafe(statement);
        },process.env),
        P4V1CiPrismaDeniedError,
      );
    }

    // Subject is mapped globally, but revoked membership still denies access.
    const bob = await resolveP4V1CiActor(
      { ...alice, subject: "auth0|demo-bob" }, EXPECTED, lookup, NOW,
    );
    await assert.rejects(readP4V1CiAppManifest(prisma, {
      organizationId: ORCHID, actorId: bob,
    }, process.env), P4V1CiAppDeniedError);
    await assert.rejects(readP4V1CiAppManifest(prisma, {
      organizationId: CEDAR, actorId: bob,
    }, process.env), P4V1CiAppDeniedError);
    for (const invalid of [
      { ...alice, cryptographicallyVerified: false as never },
      { ...alice, issuer: "https://other.us.auth0.com/" },
      { ...alice, audience: "urn:wrong:audience" },
      { ...alice, expiresAtEpochSeconds: NOW },
      { ...alice, expiresAtEpochSeconds: NOW + 90_000 },
      { ...alice, subject: "auth0|unknown" },
    ]) {
      await assert.rejects(
        resolveP4V1CiActor(invalid, EXPECTED, lookup, NOW),
        P4V1CiIdentityDeniedError,
      );
    }

    function testApp(token: P4VerifiedProviderToken | null) {
      const app = express();
      app.use("/_p4_ci", createP4V1CiTestOnlyRouter({
        prisma, mappingLookup: lookup,
        resolveVerifiedSdkEvidence: async () => token,
        expectedIssuer: EXPECTED.issuer,
        expectedAudience: EXPECTED.audience,
        nowEpochSeconds: () => NOW,
        env: process.env,
      }));
      return app;
    }
    const good = testApp(alice);
    const manifest = await request(good).get("/_p4_ci/" + ORCHID + "/apps");
    assert.equal(manifest.status, 200);
    assert.equal(manifest.headers["cache-control"], "no-store");
    assert.deepEqual(manifest.body.data.map((a: { code: string; status: string }) =>
      [a.code,a.status]), [["crm","available"],["teams","locked"]]);
    const allowed = await request(good).get("/_p4_ci/" + ORCHID + "/apps/crm");
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.data.leads.length, 2);
    const signedMemberApp = testApp({ ...alice, subject:"auth0|demo-charlie" });
    const allowedRecord = await request(signedMemberApp).get(
      "/_p4_ci/" + ORCHID + "/apps/crm/leads/" + ORCHID_LEAD,
    );
    assert.equal(allowedRecord.status,200);
    assert.equal(allowedRecord.body.data.id,ORCHID_LEAD);
    const foreignRecord = await request(signedMemberApp).get(
      "/_p4_ci/" + ORCHID + "/apps/crm/leads/" + CEDAR_LEAD,
    );
    assert.equal(foreignRecord.status,403);
    const foreignTenantRecord = await request(signedMemberApp).get(
      "/_p4_ci/" + CEDAR + "/apps/crm/leads/" + CEDAR_LEAD,
    ).set("x-role","OWNER");
    assert.equal(foreignTenantRecord.status,403);
    const invalidRecord = await request(good).get(
      "/_p4_ci/" + ORCHID + "/apps/crm/leads/not-a-uuid",
    );
    assert.equal(invalidRecord.status,403);
    const noRecordMutation = await request(good).post(
      "/_p4_ci/" + ORCHID + "/apps/crm/leads/" + ORCHID_LEAD,
    );
    assert.equal(noRecordMutation.status,404);
    const wrong = await request(good).get("/_p4_ci/" + FOREIGN + "/apps/crm")
      .set("x-org-id", ORCHID).set("x-role","OWNER");
    assert.equal(wrong.status, 403);
    const locked = await request(good).get("/_p4_ci/" + ORCHID + "/apps/teams")
      .set("x-entitlement", "teams").set("x-role", "OWNER");
    assert.equal(locked.status, 403);
    assert.deepEqual(locked.body, { error: { code: "P4_ACCESS_DENIED" } });
    assert.equal((await request(good).post("/_p4_ci/" + ORCHID + "/apps/crm")).status,404);
    assert.equal((await request(good).get("/_p4_ci/" + ORCHID + "/files/download")).status,404);
    assert.equal((await request(testApp({ ...alice, subject: "auth0|demo-bob" }))
      .get("/_p4_ci/" + ORCHID + "/apps/crm")).status,403);
    assert.equal((await request(testApp({ ...alice, expiresAtEpochSeconds: NOW }))
      .get("/_p4_ci/" + ORCHID + "/apps/crm")).status,401);
    assert.equal((await request(testApp({ ...alice, audience: "urn:wrong" }))
      .get("/_p4_ci/" + ORCHID + "/apps/crm")).status,401);
    assert.equal((await request(testApp(null))
      .get("/_p4_ci/" + ORCHID + "/apps")).status,401);

    // CI pool connections are clean after both denied and approved requests.
    const leftover = await prisma.$queryRawUnsafe<Array<{ role: string; actor: string | null; tenant: string | null }>>(
      "SELECT current_user AS role," +
      " nullif(current_setting('app.actor_id',true),'') AS actor," +
      " nullif(current_setting('app.tenant_id',true),'') AS tenant",
    );
    assert.deepEqual(leftover, [{ role: "demo_ci", actor: null, tenant: null }]);
    process.stdout.write(
      "P4 integration 06: Auth0 subject, TEAM/RECORD RLS, sensitive-column denial," +
      " independent app grants/RBAC and synthetic HTTP 401/403 checks PASS\n",
    );
  } finally {
    await Promise.all([lookupPool.end(),prisma.$disconnect()]);
  }
}
main().catch(() => {
  process.stderr.write("P4 integration 05 disposable CI Auth0 mapping/application smoke FAIL\n");
  process.exitCode = 1;
});
