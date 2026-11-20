import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import request from "supertest";
import {
  resolveP4SyntheticProviderActor, P4IdentityBridgeDeniedError,
  type P4VerifiedProviderToken,
} from "../src/platform/p4-auth0-subject-bridge.js";
import { createP4PgSubjectMappingLookup } from "../src/platform/p4-pg-subject-lookup.js";
import { createP4IntegrationTestRouter } from "../src/platform/p4-integration-test-router.js";
import type { ScopedPgPool } from "../src/platform/p4-rls-transaction.js";
import type { MembershipLookup } from "../src/platform/p4-membership.js";

const issuer = "https://demo.us.auth0.com/";
const audience = "urn:zoho-clone:demo";
const org1 = "10000000-0000-4000-8000-000000000001";
const org2 = "10000000-0000-4000-8000-000000000002";
const now = 2_000_000_000;
const aliceToken: P4VerifiedProviderToken = {
  issuer, audience, subject: "auth0|demo-alice", expiresAtEpochSeconds: now + 1000,
  cryptographicallyVerified: true,
};
const bobToken = { ...aliceToken, subject: "auth0|demo-bob" };
const store = {
  async findByIssuerAndSubject(receivedIssuer: string, subject: string) {
    if (receivedIssuer !== issuer) return null;
    if (subject === aliceToken.subject) return { userId: "user_demo_alice", emailVerified: true };
    if (subject === bobToken.subject) return { userId: "user_demo_bob", emailVerified: false };
    return null;
  },
};
describe("P4 exit: verified provider identity to internal actor", () => {
  it("maps exact issuer+subject with email verification; never uses email or token roles", async () => {
    const a = await resolveP4SyntheticProviderActor(
      { ...aliceToken, audience: [audience, "urn:other"] }, { issuer, audience }, store, now,
    );
    assert.deepEqual(a, { userId: "user_demo_alice", emailVerified: true, providerVerified: true });
    assert.equal("tenantId" in a, false);
  });
  it("fails closed on unverified JWT, mismatched issuer/audience, missing subject, unverified email, expiry", async () => {
    const invalid: (P4VerifiedProviderToken | null)[] = [
      null, { ...aliceToken, cryptographicallyVerified: false as never },
      { ...aliceToken, issuer: "https://evil.us.auth0.com/" },
      { ...aliceToken, audience: "urn:wrong" },
      { ...aliceToken, subject: "auth0|unknown" },
      { ...aliceToken, expiresAtEpochSeconds: now - 1 },
      { ...aliceToken, expiresAtEpochSeconds: now + 86_401 },
      bobToken,
    ];
    for (const evidence of invalid) {
      await assert.rejects(resolveP4SyntheticProviderActor(evidence, { issuer, audience }, store, now),
        P4IdentityBridgeDeniedError);
    }
  });
  it("denies database mapping errors without revealing cause", async () => {
    await assert.rejects(resolveP4SyntheticProviderActor(aliceToken, { issuer, audience }, {
      async findByIssuerAndSubject() { throw new Error("password=private-value"); },
    }, now), (err: unknown) => err instanceof P4IdentityBridgeDeniedError &&
        !String(err).includes("private-value"));
  });
});
describe("P4 exit: separate provider subject SQL lookup", () => {
  it("uses bound parameters and always releases the separate database client", async () => {
    const queries: Array<{ sql: string; values?: readonly string[] }> = [];
    let releases = 0;
    const pool: ScopedPgPool = { async connect() {
      return { async query(sql, values) {
        queries.push({ sql, values });
        return { rows: [{ userId: "user_demo_alice", emailVerified: true }] };
      }, release() { releases++; } };
    } };
    assert.deepEqual(await createP4PgSubjectMappingLookup(pool).findByIssuerAndSubject(issuer, aliceToken.subject),
      { userId: "user_demo_alice", emailVerified: true });
    assert.ok(queries[0]?.sql.includes("lookup_verified_subject($1, $2)"));
    assert.deepEqual(queries[0]?.values, [issuer, aliceToken.subject]);
    assert.equal(releases, 1);
  });
  it("rejects a multi-row or malformed mapping", async () => {
    for (const returned of [{ rows: [{ userId: "user_demo_alice", emailVerified: true }, {}] },
      { rows: [{ userId: "user_demo_alice", emailVerified: "true" }] }]) {
      const pool: ScopedPgPool = { async connect() {
        return { async query() { return returned; }, release() {} };
      } };
      await assert.rejects(createP4PgSubjectMappingLookup(pool).findByIssuerAndSubject(issuer, "auth0|demo-alice"),
        P4IdentityBridgeDeniedError);
    }
  });
});
function buildFixture() {
  let token: P4VerifiedProviderToken | null = aliceToken;
  let revoked = false;
  let privileged = false;
  let releases = 0, rollbacks = 0;
  const membershipRows = [
    { orgId: org1, orgSlug: "demo-maple-payments", orgName: "Demo Maple Payments",
      userId: "user_demo_alice", role: "OWNER" as const, active: true },
    { orgId: org2, orgSlug: "demo-cedar-payments", orgName: "Demo Cedar Payments",
      userId: "user_demo_alice", role: "OWNER" as const, active: true },
  ];
  const memberships: MembershipLookup = {
    async listForUser(userId) { return membershipRows.filter(r => r.userId === userId); },
    async findForUserInOrg(userId, orgId) {
      const m = membershipRows.find(r => r.userId === userId && r.orgId === orgId);
      return m ? { ...m, active: !revoked } : null;
    },
  };
  const tenantPool: ScopedPgPool = { async connect() {
    let actor = "", org = "";
    return {
      async query(sql: string, values?: readonly string[]) {
        if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
        if (sql === "ROLLBACK") { rollbacks++; return { rows: [] }; }
        if (sql.includes("set_config('app.actor_id'")) { actor = values?.[0] ?? ""; return { rows: [] }; }
        if (sql.includes("set_config('app.tenant_id'")) { org = values?.[0] ?? ""; return { rows: [] }; }
        if (sql.includes("current_user")) return { rows: [{
          dbRole: privileged ? "demo_ci" : "p4_synthetic_ci_runtime", privileged,
        }] };
        if (sql.includes("FROM p4_synthetic.memberships")) {
          return { rows: (actor === "user_demo_alice" && !revoked && (org === org1 || org === org2))
            ? [{ role: "OWNER", active: true }] : [] };
        }
        if (sql.includes("FROM p4_synthetic.organization_settings")) {
          return { rows: actor === "user_demo_alice" && !revoked && values?.[0] === org
            ? [{ orgId: org, name: org === org1 ? "Demo Maple Payments" : "Demo Cedar Payments",
              locale: "en-PK", currency: "PKR", timeZone: "Asia/Karachi" }] : [] };
        }
        throw new Error("unexpected query");
      },
      release() { releases++; },
    };
  } };
  const app = express();
  app.use("/_test/p4/orgs", createP4IntegrationTestRouter({
    resolveVerifiedToken: async () => token,
    mappingLookup: store, memberships, tenantPool,
    expectedIssuer: issuer, expectedAudience: audience, nowEpochSeconds: () => now,
  }));
  return {
    app,
    token(v: P4VerifiedProviderToken | null) { token = v; },
    revoke() { revoked = true; },
    privileged() { privileged = true; },
    get released() { return releases; },
    get rollbacks() { return rollbacks; },
  };
}
describe("P4 exit: test-only Express identity → membership → RLS transaction", () => {
  it("reads two separate organizations using transaction-bound actor and tenant IDs", async () => {
    const f = buildFixture();
    const a = await request(f.app).get("/_test/p4/orgs/" + org1 + "/settings");
    const b = await request(f.app).get("/_test/p4/orgs/" + org2 + "/settings");
    assert.equal(a.status, 200);
    assert.equal(a.body.settings.name, "Demo Maple Payments");
    assert.equal(b.status, 200);
    assert.equal(b.body.settings.name, "Demo Cedar Payments");
    assert.equal(f.released, 2);
    assert.equal(a.headers["cache-control"], "no-store");
  });
  it("forged browser role and org headers do not grant identity or tenant access", async () => {
    const f = buildFixture();
    f.token(null);
    const a = await request(f.app).get("/_test/p4/orgs/" + org1 + "/settings")
      .set("x-actor-id", "user_demo_alice").set("x-role", "OWNER")
      .set("authorization", "Bearer forged-token");
    assert.equal(a.status, 401);
    f.token(aliceToken);
    const b = await request(f.app).get("/_test/p4/orgs/10000000-0000-4000-8000-000000000099/settings")
      .set("x-org-id", org1);
    assert.equal(b.status, 403);
    assert.ok(!JSON.stringify(b.body).includes("Demo Maple"));
  });
  it("revocation closes read; a privileged database runtime also fails closed", async () => {
    const f = buildFixture();
    assert.equal((await request(f.app).get("/_test/p4/orgs/" + org1 + "/settings")).status, 200);
    f.revoke();
    assert.equal((await request(f.app).get("/_test/p4/orgs/" + org1 + "/settings")).status, 403);
    const g = buildFixture();
    g.privileged();
    assert.equal((await request(g.app).get("/_test/p4/orgs/" + org1 + "/settings")).status, 403);
    assert.ok(g.rollbacks > 0);
  });
});
