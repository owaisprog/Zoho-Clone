import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acceptSyntheticInvitation, issueSyntheticInvitation,
  resendSyntheticInvitation, revokeSyntheticInvitation,
  SyntheticInvitationConflictError, SyntheticInvitationRejectedError,
  type SyntheticInvitation, type SyntheticInvitationRepository,
} from "../src/platform/p4-invitations.js";

const orchid = "10000000-0000-4000-8000-000000000001";
const cedar = "10000000-0000-4000-8000-000000000002";
const alice = { userId: "user_demo_alice", providerVerified: true as const, emailVerified: true as const };
const bob = { userId: "user_demo_bob", providerVerified: true as const, emailVerified: true as const };
const recipient = { userId: "user_demo_carla", providerVerified: true as const, emailVerified: true as const, verifiedEmail: "carla@example.com" };
const t0 = 2_000_000_000_000;
const tokens = { one: "A".repeat(43), two: "B".repeat(43), three: "C".repeat(43) };
const ids = { one: "10000000-0000-4000-8000-000000000011", two: "10000000-0000-4000-8000-000000000012" };

function fixture() {
  let invitations = new Map<string, SyntheticInvitation>();
  let membership = new Map<string, { role: "OWNER" | "MEMBER"; active: boolean }>([
    [orchid + "|" + alice.userId, { role: "OWNER", active: true }],
    [orchid + "|" + bob.userId, { role: "MEMBER", active: true }],
    [cedar + "|" + alice.userId, { role: "MEMBER", active: true }],
  ]);
  let failMemberInsert = false;
  const repository: SyntheticInvitationRepository = {
    async transaction(callback) {
      // CI synthetic model of an all-or-nothing transaction. A real DB
      // requires row locking, serialization and UNIQUE constraints.
      const invites = new Map([...invitations].map(([k, v]) => [k, { ...v }]));
      const memberships = new Map([...membership].map(([k, v]) => [k, { ...v }]));
      const result = await callback({
        async getMembership(orgId, userId) {
          const m = memberships.get(orgId + "|" + userId);
          return m ? { ...m, orgId, userId } : null;
        },
        async findPendingByEmail(orgId, email) {
          return [...invites.values()].find(x => x.orgId === orgId && x.canonicalEmail === email && x.status === "pending") ?? null;
        },
        async findById(id) { return invites.get(id) ?? null; },
        async findByTokenHash(hash) { return [...invites.values()].find(x => x.tokenHash === hash) ?? null; },
        async countRecentSends(orgId, senderId, since) {
          return [...invites.values()].filter(x =>
            x.orgId === orgId && x.invitedByUserId === senderId && x.issuedAtMs >= since).length;
        },
        async insertInvitation(row) {
          if (invites.has(row.id)) throw new Error("unique invite violation");
          invites.set(row.id, { ...row });
        },
        async replaceInvitation(row) {
          if (!invites.has(row.id)) throw new Error("missing invite");
          invites.set(row.id, { ...row });
        },
        async insertMembershipIfAbsent(orgId, userId, role) {
          if (failMemberInsert) throw new Error("synthetic storage failure");
          const key = orgId + "|" + userId;
          if (memberships.has(key)) return false;
          memberships.set(key, { role, active: true });
          return true;
        },
      });
      invitations = invites;
      membership = memberships;
      return result;
    },
  };
  return {
    repository,
    setFailure(value: boolean) { failMemberInsert = value; },
    revokeOwner() { membership.set(orchid + "|" + alice.userId, { role: "OWNER", active: false }); },
    invites: () => [...invitations.values()].map(x => ({ ...x })),
    member: (orgId: string, userId: string) => membership.get(orgId + "|" + userId),
  };
}

describe("P4.08-09 owner-only invitations, resend, single-use acceptance and revocation", () => {
  it("issues a strong fictional token, stores only its hash, and accepts once as MEMBER", async () => {
    const store = fixture();
    const issued = await issueSyntheticInvitation(
      alice, orchid, "Carla@Example.com", store.repository, t0, () => tokens.one, () => ids.one,
    );
    assert.equal(issued.invitationId, ids.one);
    assert.equal(issued.tokenForEmailOnly, tokens.one);
    const persisted = store.invites()[0]!;
    assert.equal(persisted.canonicalEmail, "carla@example.com");
    assert.equal(persisted.role, "MEMBER");
    assert.match(persisted.tokenHash, /^[0-9a-f]{64}$/);
    assert.ok(!JSON.stringify(persisted).includes(tokens.one));
    assert.deepEqual(await acceptSyntheticInvitation(recipient, tokens.one, store.repository, t0 + 15_000),
      { orgId: orchid, role: "MEMBER" });
    assert.deepEqual(store.member(orchid, recipient.userId), { role: "MEMBER", active: true });
    assert.equal(store.invites()[0]!.status, "accepted");
    await assert.rejects(acceptSyntheticInvitation(recipient, tokens.one, store.repository, t0 + 20_000), SyntheticInvitationRejectedError);
  });
  it("blocks non-owner issuance, duplicate pending email, and user-controlled role or URL", async () => {
    const store = fixture();
    await assert.rejects(issueSyntheticInvitation(bob, orchid, recipient.verifiedEmail, store.repository, t0), SyntheticInvitationRejectedError);
    await assert.rejects(issueSyntheticInvitation(alice, cedar, recipient.verifiedEmail, store.repository, t0), SyntheticInvitationRejectedError);
    await assert.rejects(issueSyntheticInvitation(alice, orchid, "real@company.com", store.repository, t0), SyntheticInvitationRejectedError);
    await assert.rejects(issueSyntheticInvitation(alice, orchid, "carla@example.com\nx-role:OWNER", store.repository, t0), SyntheticInvitationRejectedError);
    await issueSyntheticInvitation(alice, orchid, recipient.verifiedEmail, store.repository, t0, () => tokens.one, () => ids.one);
    await assert.rejects(issueSyntheticInvitation(alice, orchid, "CARLA@example.com", store.repository, t0 + 3_000, () => tokens.two, () => ids.two), SyntheticInvitationConflictError);
    assert.equal(store.invites().length, 1);
  });
  it("rotates invite token on delayed owner resend, invalidating the old one", async () => {
    const store = fixture();
    await issueSyntheticInvitation(alice, orchid, recipient.verifiedEmail, store.repository, t0, () => tokens.one, () => ids.one);
    await assert.rejects(resendSyntheticInvitation(alice, orchid, ids.one, store.repository, t0 + 30_000), SyntheticInvitationRejectedError);
    await assert.rejects(resendSyntheticInvitation(bob, orchid, ids.one, store.repository, t0 + 65_000), SyntheticInvitationRejectedError);
    const updated = await resendSyntheticInvitation(alice, orchid, ids.one, store.repository, t0 + 65_000, () => tokens.two);
    assert.equal(updated.tokenForEmailOnly, tokens.two);
    assert.equal(store.invites()[0]!.resendCount, 1);
    await assert.rejects(acceptSyntheticInvitation(recipient, tokens.one, store.repository, t0 + 70_000), SyntheticInvitationRejectedError);
    assert.deepEqual(await acceptSyntheticInvitation(recipient, tokens.two, store.repository, t0 + 80_000),
      { orgId: orchid, role: "MEMBER" });
  });
  it("blocks wrong verified recipient, expired token and revoked invite", async () => {
    const store = fixture();
    await issueSyntheticInvitation(alice, orchid, recipient.verifiedEmail, store.repository, t0, () => tokens.one, () => ids.one);
    await assert.rejects(acceptSyntheticInvitation({ ...recipient, verifiedEmail: "bob@example.com" }, tokens.one, store.repository, t0 + 1000), SyntheticInvitationRejectedError);
    await assert.rejects(acceptSyntheticInvitation(recipient, tokens.one, store.repository, t0 + 49 * 60 * 60 * 1000), SyntheticInvitationRejectedError);
    await revokeSyntheticInvitation(alice, orchid, ids.one, store.repository, t0 + 1000);
    await assert.rejects(acceptSyntheticInvitation(recipient, tokens.one, store.repository, t0 + 2000), SyntheticInvitationRejectedError);
  });
  it("rolls back both membership + invite consumption when storage rejects the insert", async () => {
    const store = fixture();
    await issueSyntheticInvitation(alice, orchid, recipient.verifiedEmail, store.repository, t0, () => tokens.one, () => ids.one);
    store.setFailure(true);
    await assert.rejects(acceptSyntheticInvitation(recipient, tokens.one, store.repository, t0 + 1000));
    assert.equal(store.member(orchid, recipient.userId), undefined);
    assert.equal(store.invites()[0]!.status, "pending");
  });
  it("denies revoked owner before issue or revoke, even if they previously had access", async () => {
    const store = fixture();
    await issueSyntheticInvitation(alice, orchid, recipient.verifiedEmail, store.repository, t0, () => tokens.one, () => ids.one);
    store.revokeOwner();
    await assert.rejects(revokeSyntheticInvitation(alice, orchid, ids.one, store.repository, t0 + 1000), SyntheticInvitationRejectedError);
    await assert.rejects(issueSyntheticInvitation(alice, orchid, "dana@example.com", store.repository, t0 + 1000), SyntheticInvitationRejectedError);
    assert.equal(store.invites()[0]!.status, "pending");
  });
});
