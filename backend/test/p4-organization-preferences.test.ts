import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  readP4OrganizationPreferences, updateP4OrganizationPreferences, effectiveP4TimeZone,
  validateP4PreferenceInput, P4PreferencesDeniedError,
  type P4OrganizationPreferences, type P4PreferenceRepository,
} from "../src/platform/p4-organization-preferences.js";
const org = "10000000-0000-4000-8000-000000000001";
const owner = { orgId: org, orgSlug: "demo-orchid", userId: "user_demo_alice", role: "OWNER" as const, verified: true as const };
const member = { ...owner, userId: "user_demo_bob", role: "MEMBER" as const };
const candidate = { name: "Demo Orchid Payments", locale: "en-PK", timeZone: "Asia/Karachi", currency: "PKR" as const };
function fixture(): P4PreferenceRepository {
  let row: P4OrganizationPreferences = { orgId: org, revision: 1, ...candidate };
  return {
    async find() { return { ...row }; },
    async replace(orgId, revision, value) {
      if (orgId !== org || revision !== row.revision) return null;
      row = { ...value, orgId, revision: row.revision + 1 };
      return { ...row };
    },
  };
}
describe("P4.16 organization preferences, locale and timezone precedence", () => {
  it("allows member to read, owner to version-update only own org", async () => {
    const repo = fixture();
    assert.deepEqual(await readP4OrganizationPreferences(member, repo), { orgId: org, revision: 1, ...candidate });
    assert.equal((await updateP4OrganizationPreferences(owner, candidate, 1, repo)).revision, 2);
    await assert.rejects(updateP4OrganizationPreferences(owner, candidate, 1, repo), P4PreferencesDeniedError);
    await assert.rejects(updateP4OrganizationPreferences(member, candidate, 2, repo), P4PreferencesDeniedError);
  });
  it("rejects foreign org rows, unverified context and injected billing keys", async () => {
    const repo = fixture();
    await assert.rejects(readP4OrganizationPreferences({ ...owner, orgId: "10000000-0000-4000-8000-000000000002" }, repo),
      P4PreferencesDeniedError);
    await assert.rejects(readP4OrganizationPreferences({ ...owner, verified: false as never }, repo), P4PreferencesDeniedError);
    for (const bad of [
      { ...candidate, currency: "BTC" },
      { ...candidate, name: "Real Customer" },
      { ...candidate, timeZone: "Not/AnIanaZone" },
      { ...candidate, paymentAccount: "secret" },
      { ...candidate, locale: "en-US\nX-Admin" },
    ]) assert.throws(() => validateP4PreferenceInput(bad), P4PreferencesDeniedError);
  });
  it("prefers valid user timezone and falls back to org default", () => {
    assert.equal(effectiveP4TimeZone("America/New_York", "Asia/Karachi"), "America/New_York");
    assert.equal(effectiveP4TimeZone(null, "Asia/Karachi"), "Asia/Karachi");
    assert.equal(effectiveP4TimeZone("Invalid/Zone", "Asia/Karachi"), "Asia/Karachi");
    assert.throws(() => effectiveP4TimeZone("America/New_York", "Invalid/Zone"), P4PreferencesDeniedError);
  });
});
