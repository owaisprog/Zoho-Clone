import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import request from "supertest";
import { createSyntheticTenantContextMiddleware } from "../src/platform/p4-tenant-context.js";
import type { MembershipLookup, TrustedSyntheticMemberActor } from "../src/platform/p4-membership.js";

const orchid = "10000000-0000-4000-8000-000000000001";
const cedar = "10000000-0000-4000-8000-000000000002";
const alice = { userId: "user_demo_alice", providerVerified: true as const, emailVerified: true as const };
const bob = { userId: "user_demo_bob", providerVerified: true as const, emailVerified: true as const };

function fixture() {
  let actor: TrustedSyntheticMemberActor | null = alice;
  let memberships = [
    { orgId: orchid, orgSlug: "demo-orchid", orgName: "Demo Orchid Payments", userId: alice.userId, role: "OWNER" as const, active: true },
    { orgId: cedar, orgSlug: "demo-cedar", orgName: "Demo Cedar Payments", userId: alice.userId, role: "MEMBER" as const, active: true },
    { orgId: orchid, orgSlug: "demo-orchid", orgName: "Demo Orchid Payments", userId: bob.userId, role: "MEMBER" as const, active: true },
  ];
  const lookup: MembershipLookup = {
    async listForUser(userId) { return memberships.filter(x => x.userId === userId); },
    async findForUserInOrg(userId, orgId) { return memberships.find(x => x.orgId === orgId && x.userId === userId) ?? null; },
  };
  const app = express();
  app.get("/_test/orgs/:orgId/context",
    createSyntheticTenantContextMiddleware({ async resolve() { return actor; } }, lookup),
    (_req, res) => res.status(200).json(res.locals.p4SyntheticTenant));
  return {
    app,
    setActor(value: TrustedSyntheticMemberActor | null) { actor = value; },
    revoke(orgId: string, userId: string) {
      memberships = memberships.map(x =>
        x.orgId === orgId && x.userId === userId ? { ...x, active: false } : x);
    },
  };
}

describe("P4.10 injectable test-only Express tenant context middleware", () => {
  it("resolves the exact org + verified actor membership and preserves role by tenant", async () => {
    const f = fixture();
    const owned = await request(f.app).get("/_test/orgs/" + orchid + "/context");
    assert.equal(owned.status, 200);
    assert.deepEqual(owned.body, {
      orgId: orchid, orgSlug: "demo-orchid", userId: alice.userId, role: "OWNER", verified: true,
    });
    assert.equal(owned.headers["cache-control"], "no-store");
    const shared = await request(f.app).get("/_test/orgs/" + cedar + "/context");
    assert.equal(shared.status, 200);
    assert.equal(shared.body.role, "MEMBER");
  });

  it("rejects client-supplied owner/tenant headers and cross-tenant requests", async () => {
    const f = fixture();
    f.setActor(bob);
    const attack = await request(f.app).get("/_test/orgs/" + cedar + "/context")
      .set("x-org-id", orchid).set("x-actor-id", alice.userId)
      .set("x-role", "OWNER").set("Authorization", "Bearer forged-admin-token");
    assert.equal(attack.status, 403);
    assert.deepEqual(attack.body, { error: { code: "P4_TENANT_ACCESS_DENIED" } });
    assert.ok(!JSON.stringify(attack.body).includes(alice.userId));
    assert.equal((await request(f.app).get("/_test/orgs/" + orchid + "/context").set("x-role", "OWNER")).body.role, "MEMBER");
  });

  it("denies anonymous identity, forged actor and invalid org ID", async () => {
    const f = fixture();
    f.setActor(null);
    assert.equal((await request(f.app).get("/_test/orgs/" + orchid + "/context")).status, 401);
    f.setActor({ ...alice, providerVerified: false as never });
    assert.equal((await request(f.app).get("/_test/orgs/" + orchid + "/context")).status, 401);
    f.setActor(alice);
    assert.equal((await request(f.app).get("/_test/orgs/demo-orchid/context")).status, 403);
  });

  it("rejects previously valid membership immediately after revocation", async () => {
    const f = fixture();
    assert.equal((await request(f.app).get("/_test/orgs/" + cedar + "/context")).status, 200);
    f.revoke(cedar, alice.userId);
    assert.equal((await request(f.app).get("/_test/orgs/" + cedar + "/context")).status, 403);
    assert.equal((await request(f.app).get("/_test/orgs/" + orchid + "/context")).status, 200);
  });
});
