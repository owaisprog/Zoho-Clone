import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalizeVerifiedEmail, classifyIdentitySession,
  verifyRegistrationIdentity, hasFreshPrivilegedAssurance,
  type ProviderIdentityEvidence,
} from "../src/platform/p4-identity-policy.js";

const issuer = "https://demo.us.auth0.com/";
const base: ProviderIdentityEvidence = {
  issuer,
  subject: "auth0|demo-alice",
  email: "Example.User@EXAMPLE.com",
  emailVerified: true,
  cryptographicallyVerified: true,
  expiresAtEpochSeconds: 2_000_000_000,
};

describe("P4.01 registration subject binding and verified email", () => {
  it("accepts one trusted unexpired identity with normalized email", () => {
    assert.deepEqual(verifyRegistrationIdentity(base, issuer, 1_999_999_000), {
      issuer, subject: "auth0|demo-alice", canonicalEmail: "example.user@example.com", verified: true,
    });
  });
  it("rejects unverified, expired, forged, and wrong-provider identities", () => {
    for (const record of [
      { ...base, emailVerified: false },
      { ...base, cryptographicallyVerified: false },
      { ...base, subject: "" },
      { ...base, subject: "malicious\nsubject" },
      { ...base, issuer: "https://evil.test/" },
      { ...base, email: "malformed" },
      { ...base, email: "x@example.com\nX-Auth: true" },
      { ...base, expiresAtEpochSeconds: 1_999_998_999 },
      { ...base, expiresAtEpochSeconds: 2_000_086_401 },
    ]) assert.equal(verifyRegistrationIdentity(record, issuer, 1_999_999_000), null);
    assert.equal(verifyRegistrationIdentity(base, "https://attacker.test/", 1_999_999_000), null);
  });
  it("does not merge two identities merely because an email matches", () => {
    const a = verifyRegistrationIdentity(base, issuer, 1_999_999_000)!;
    const b = verifyRegistrationIdentity({ ...base, subject: "auth0|demo-bob" }, issuer, 1_999_999_000)!;
    assert.equal(a.canonicalEmail, b.canonicalEmail);
    assert.notEqual(a.subject, b.subject);
    assert.equal(canonicalizeVerifiedEmail(" invalid@example.com "), null);
  });
});

describe("P4.02-P4.03 identity session and MFA assurance gate", () => {
  it("reports safe status only, never assumes org access", () => {
    assert.equal(classifyIdentitySession(false, true, true), "not_configured");
    assert.equal(classifyIdentitySession(true, false, true), "unauthenticated");
    assert.equal(classifyIdentitySession(true, true, false), "verification_required");
    assert.equal(classifyIdentitySession(true, true, undefined), "verification_required");
    assert.equal(classifyIdentitySession(true, true, true), "verified_identity");
  });
  it("denies MFA if missing, stale, revoked, invalid, future-dated or too old", () => {
    const verified = {
      providerVerified: true as const,
      emailVerified: true as const,
      mfaVerifiedAtEpochSeconds: 1_999_999_900,
      authenticationRevoked: false,
    };
    assert.equal(hasFreshPrivilegedAssurance(verified, 2_000_000_000), true);
    for (const evidence of [
      null,
      { ...verified, mfaVerifiedAtEpochSeconds: null },
      { ...verified, mfaVerifiedAtEpochSeconds: 1_999_990_000 },
      { ...verified, mfaVerifiedAtEpochSeconds: 2_000_000_001 },
      { ...verified, authenticationRevoked: true },
      { ...verified, emailVerified: false as never },
      { ...verified, providerVerified: false as never },
    ]) assert.equal(hasFreshPrivilegedAssurance(evidence, 2_000_000_000), false);
    assert.equal(hasFreshPrivilegedAssurance(verified, 2_000_000_000, 999_999), false);
  });
});
