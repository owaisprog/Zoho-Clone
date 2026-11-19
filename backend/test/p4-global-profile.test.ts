import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  readOwnProfile, updateOwnProfile, validateProfileDraft, GlobalProfileRejectedError,
  type GlobalProfile, type GlobalProfileRepository,
} from "../src/platform/p4-global-profile.js";

function profileStore(): GlobalProfileRepository {
  const records = new Map<string, GlobalProfile>();
  return {
    async getByUserId(userId) { return records.get(userId) ?? null; },
    async updateByUserId(userId, draft) {
      const profile = { userId, ...draft, revision: (records.get(userId)?.revision ?? 0) + 1 };
      records.set(userId, profile);
      return profile;
    },
  };
}
const alice = { userId: "user_demo_alice", providerVerified: true as const, emailVerified: true as const };
const bob = { userId: "user_demo_bob", providerVerified: true as const, emailVerified: true as const };
const draft = { displayName: "Demo Alice", locale: "en-US", timeZone: "Asia/Karachi" };

describe("P4.04 self-only global profile, independent of org membership", () => {
  it("keeps one profile across two org memberships without granting org rights", async () => {
    const store = profileStore();
    assert.equal(await readOwnProfile(alice, store), null);
    const result = await updateOwnProfile(alice, draft, store);
    assert.deepEqual(result, { userId: alice.userId, ...draft, revision: 1 });
    // No orgId is supplied/needed: user's global profile persists across org switches.
    assert.deepEqual(await readOwnProfile(alice, store), result);
    assert.equal(await readOwnProfile(bob, store), null);
    assert.equal((await updateOwnProfile(alice, { ...draft, displayName: "Demo Alice Two" }, store)).revision, 2);
  });

  it("rejects attempts to set userId, orgId, unsafe name, locale and time zone", () => {
    for (const candidate of [
      { ...draft, userId: "user_demo_bob" },
      { ...draft, orgId: "org_demo_cedar" },
      { ...draft, displayName: "<script>alert(1)</script>" },
      { ...draft, displayName: " " },
      { ...draft, timeZone: "Mars/OlympusMons" },
      { ...draft, locale: "en-US-custom" },
      null,
    ]) assert.throws(() => validateProfileDraft(candidate), GlobalProfileRejectedError);
  });

  it("denies profile access for an unverified or forged actor", async () => {
    const store = profileStore();
    await assert.rejects(readOwnProfile({ ...alice, providerVerified: false as never }, store), GlobalProfileRejectedError);
    await assert.rejects(updateOwnProfile({ ...bob, emailVerified: false as never }, draft, store), GlobalProfileRejectedError);
    await assert.rejects(updateOwnProfile({ ...alice, userId: "auth0|live-user" }, draft, store), GlobalProfileRejectedError);
  });
});
