import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  listActiveSyntheticMemberships, resolveSyntheticTenantContext,
  SyntheticMembershipDeniedError, type SyntheticMembership,
  type MembershipLookup,
} from "../src/platform/p4-membership.js";

const orchid = "10000000-0000-4000-8000-000000000001";
const cedar = "10000000-0000-4000-8000-000000000002";
const alice = { userId: "user_demo_alice", providerVerified: true as const, emailVerified: true as const };
const bob = { userId: "user_demo_bob", providerVerified: true as const, emailVerified: true as const };
const rows: SyntheticMembership[] = [
  { orgId: orchid, orgSlug: "demo-orchid", orgName: "Demo Orchid Payments", userId: alice.userId, role: "OWNER", active: true },
  { orgId: cedar, orgSlug: "demo-cedar", orgName: "Demo Cedar Payments", userId: alice.userId, role: "MEMBER", active: true },
  { orgId: orchid, orgSlug: "demo-orchid", orgName: "Demo Orchid Payments", userId: bob.userId, role: "MEMBER", active: true },
];

function store(): MembershipLookup & { revoke(orgId: string, userId: string): void } {
  let data = rows.map(x => ({ ...x }));
  return {
    async listForUser(userId) { return data.filter(x => x.userId === userId); },
    async findForUserInOrg(userId, orgId) { return data.find(x => x.orgId === orgId && x.userId === userId) ?? null; },
    revoke(orgId, userId) { data = data.map(x => x.orgId === orgId && x.userId === userId ? { ...x, active: false } : x); },
  };
}
describe("P4.06-07 membership list and tenant switching", () => {
  it("keeps each user's role distinct in each organization", async () => {
    const repo = store();
    const items = await listActiveSyntheticMemberships(alice, repo);
    assert.deepEqual(items.map(m => [m.orgId, m.role]), [[orchid, "OWNER"], [cedar, "MEMBER"]]);
    assert.equal((await resolveSyntheticTenantContext(alice, orchid, repo)).role, "OWNER");
    assert.equal((await resolveSyntheticTenantContext(alice, cedar, repo)).role, "MEMBER");
    assert.deepEqual((await listActiveSyntheticMemberships(bob, repo)).map(m => m.orgId), [orchid]);
  });
  it("requires fresh active membership on every switch and denies guessed org IDs", async () => {
    const repo = store();
    await assert.rejects(resolveSyntheticTenantContext(bob, cedar, repo), SyntheticMembershipDeniedError);
    await assert.rejects(resolveSyntheticTenantContext(bob, "demo-cedar", repo), SyntheticMembershipDeniedError);
    await resolveSyntheticTenantContext(alice, cedar, repo);
    repo.revoke(cedar, alice.userId);
    await assert.rejects(resolveSyntheticTenantContext(alice, cedar, repo), SyntheticMembershipDeniedError);
    assert.deepEqual((await listActiveSyntheticMemberships(alice, repo)).map(m => m.orgId), [orchid]);
  });
  it("rejects forged actor and wrong-owner rows returned by a compromised adapter", async () => {
    const repo: MembershipLookup = {
      async listForUser() { return [{ ...rows[0]!, userId: bob.userId }]; },
      async findForUserInOrg() { return { ...rows[0]!, userId: bob.userId }; },
    };
    await assert.rejects(listActiveSyntheticMemberships(alice, repo), SyntheticMembershipDeniedError);
    await assert.rejects(resolveSyntheticTenantContext(alice, orchid, repo), SyntheticMembershipDeniedError);
    await assert.rejects(resolveSyntheticTenantContext({ ...alice, providerVerified: false as never }, orchid, repo), SyntheticMembershipDeniedError);
  });
  it("does not inherit OWNER role from a different tenant", async () => {
    const repo = store();
    const cedarContext = await resolveSyntheticTenantContext(alice, cedar, repo);
    assert.equal(cedarContext.role, "MEMBER");
    assert.equal("claims" in cedarContext, false);
    assert.equal("email" in cedarContext, false);
  });
});
