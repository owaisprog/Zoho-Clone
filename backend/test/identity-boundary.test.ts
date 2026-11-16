import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveSyntheticManagedIdentity, type ManagedIdentityAdapter, type VerifiedProviderClaims,
} from "../src/internal/identity-boundary.js";

const config = { issuer: "https://auth.example.test", audience: "zoho-synthetic-ci" };
const valid: VerifiedProviderClaims = {
  subject: "user_demo_alice",
  issuer: config.issuer,
  audience: config.audience,
  expiresAtEpochSeconds: 2200000000,
  cryptographicallyVerified: true,
};

describe("P3.21 managed identity integration seam (synthetic-only)", () => {
  it("accepts only server-verified claims with matching issuer/audience/future expiry", async () => {
    const adapter: ManagedIdentityAdapter = { verifyBearerToken: async token =>
      token === "fixture.token.123456" ? valid : null };
    assert.deepEqual(await resolveSyntheticManagedIdentity(
      "Bearer fixture.token.123456", adapter, config, 2100000000,
    ), { userId:"user_demo_alice", verified:true });
    assert.equal(await resolveSyntheticManagedIdentity(
      "Bearer fixture.token.123456", adapter, config, 2200000001,
    ), null);
  });
  it("rejects arbitrary headers, wrong issuer/audience/subject and unverified mock claims", async () => {
    const adapter: ManagedIdentityAdapter = { verifyBearerToken: async () => valid };
    for (const header of [
      null, undefined, 42, "", "Basic abcdef123456",
      "Bearer abc def", "Bearer short", "Bearer abc\nX-Admin: true",
    ]) {
      assert.equal(await resolveSyntheticManagedIdentity(header, adapter, config), null);
    }
    for (const claims of [
      {...valid, issuer:"https://attacker.test"},
      {...valid, audience:"different"},
      {...valid, subject:"real-user-id"},
      {...valid, cryptographicallyVerified:false},
      {...valid, expiresAtEpochSeconds:2200000000.5},
    ]) {
      const fake = {verifyBearerToken:async() => claims as VerifiedProviderClaims};
      assert.equal(await resolveSyntheticManagedIdentity("Bearer fixture.token.123456",fake,config,2100000000),null);
    }
  });
  it("denies when a provider throws; no JWT parser or permission escalation", async () => {
    const fake: ManagedIdentityAdapter = {
      verifyBearerToken: async () => { throw new Error("injected-private-token"); },
    };
    assert.equal(await resolveSyntheticManagedIdentity(
      "Bearer private-token-1234",fake,config,
    ), null);
    // No local data in adapter can grant a tenant membership or role.
    const malicious = {verifyBearerToken:async() => ({
      ...valid, roles:["ORG_OWNER"], tenantId:"org_demo_cedar",
    })};
    const actor = await resolveSyntheticManagedIdentity("Bearer fixture.token.123456",malicious,config,2100000000);
    assert.deepEqual(actor,{userId:"user_demo_alice",verified:true});
  });
});