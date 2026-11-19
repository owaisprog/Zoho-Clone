import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPublicAccountState, publicAccountResponse } from "../src/lib/p4-account-view";

describe("P4.01-03 session, registration and verification public status", () => {
  it("keeps provider configuration, session and verified email distinct", () => {
    assert.equal(getPublicAccountState(false, true, true), "not_configured");
    assert.equal(getPublicAccountState(true, false, true), "signed_out");
    assert.equal(getPublicAccountState(true, true, undefined), "verification_required");
    assert.equal(getPublicAccountState(true, true, false), "verification_required");
    assert.equal(getPublicAccountState(true, true, true), "identity_verified");
  });
  it("never publishes subject, claims, email, token, tenant or roles", () => {
    const response = publicAccountResponse(true, true, true);
    assert.deepEqual(response, {
      state: "identity_verified", identityOnly: true, organizationAccess: false,
    });
    const serialized = JSON.stringify(response);
    for (const forbidden of ["sub", "email", "access_token", "id_token", "role", "org_demo_"]) {
      assert.ok(!serialized.includes(forbidden));
    }
  });
});
