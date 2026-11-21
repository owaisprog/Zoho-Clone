import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  revokeSyntheticMembership, P4RevocationDeniedError,
  type RevocationRepository,
} from "../src/platform/p4-access-revocation.js";
import { resolveSyntheticTenantContext } from "../src/platform/p4-membership.js";

const org = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const alice = { userId: "user_demo_alice", providerVerified: true as const, emailVerified: true as const };
const bob = { userId: "user_demo_bob", providerVerified: true as const, emailVerified: true as const };
type Member = { orgId: string; userId: string; role: "OWNER" | "MEMBER"; active: boolean };

function fixture() {
  let members: Member[] = [
    { orgId: org, userId: alice.userId, role: "OWNER", active: true },
    { orgId: org, userId: bob.userId, role: "MEMBER", active: true },
    { orgId: other, userId: bob.userId, role: "MEMBER", active: true },
  ];
  let audit: string[] = [];
  let revision = 0;
  let failAudit = false;
  const repository: RevocationRepository = {
    async transaction(operation) {
      const shadow = members.map(x => ({ ...x }));
      const stagedAudit = [...audit];
      let nextRevision = revision;
      const value = await operation({
        async membership(oid, uid) { return shadow.find(x => x.orgId === oid && x.userId === uid) ?? null; },
        async revokeMemberIfActive(oid, uid) {
          const target = shadow.find(x => x.orgId === oid && x.userId === uid && x.active);
          if (!target) return false;
          target.active = false;
          return true;
        },
        async incrementAuthorizationRevision() { nextRevision += 1; },
        async recordAudit(item) {
          if (failAudit) throw new Error("Confidential DB audit error");
          stagedAudit.push(item.orgId + ":" + item.targetUserId);
        },
      });
      members = shadow;
      audit = stagedAudit;
      revision = nextRevision;
      return value;
    },
  };
  return {
    repository,
    access: {
      async listForUser(uid: string) { return members.filter(m => m.userId === uid).map(m =>
        ({ ...m, orgSlug: m.orgId === org ? "demo-orchid" : "demo-cedar",
          orgName: m.orgId === org ? "Demo Orchid Payments" : "Demo Cedar Payments" })); },
      async findForUserInOrg(uid: string, oid: string) {
        const m = members.find(x => x.userId === uid && x.orgId === oid);
        return m ? { ...m, orgSlug: oid === org ? "demo-orchid" : "demo-cedar",
          orgName: oid === org ? "Demo Orchid Payments" : "Demo Cedar Payments" } : null;
      },
    },
    setAuditFailure() { failAudit = true; },
    audit: () => [...audit],
    revision: () => revision,
    members: () => members.map(m => ({ ...m })),
  };
}
describe("P4.14 immediate membership access revocation contract", () => {
  it("revokes target only within current organization and denies fresh context immediately", async () => {
    const db = fixture();
    await resolveSyntheticTenantContext(bob, org, db.access);
    await revokeSyntheticMembership(alice, org, bob.userId, db.repository);
    await assert.rejects(resolveSyntheticTenantContext(bob, org, db.access));
    assert.equal((await resolveSyntheticTenantContext(bob, other, db.access)).orgId, other);
    assert.equal(db.revision(), 1);
    assert.deepEqual(db.audit(), [org + ":" + bob.userId]);
    assert.equal(db.members().find(m => m.orgId === org && m.userId === bob.userId)?.active, false);
  });
  it("blocks member self-elevation, self-revocation, owner removal and unknown targets", async () => {
    const db = fixture();
    for (const [actor, orgId, target] of [
      [bob, org, alice.userId], [alice, org, alice.userId],
      [alice, other, bob.userId], [alice, org, "user_demo_unknown"],
      [{ ...alice, providerVerified: false as never }, org, bob.userId],
    ] as const) {
      await assert.rejects(revokeSyntheticMembership(actor, orgId, target, db.repository),
        P4RevocationDeniedError);
    }
    assert.equal(db.revision(), 0);
    assert.equal(db.audit().length, 0);
  });
  it("rolls back both revoked membership and revision when audit fails", async () => {
    const db = fixture();
    db.setAuditFailure();
    await assert.rejects(revokeSyntheticMembership(alice, org, bob.userId, db.repository),
      error => error instanceof P4RevocationDeniedError &&
        error.message === "P4_ACCESS_REVOCATION_DENIED");
    assert.equal(db.revision(), 0);
    assert.equal(db.members().find(m => m.orgId === org && m.userId === bob.userId)?.active, true);
  });
});
