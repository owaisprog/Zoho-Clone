import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { readAuth0ApiConfiguration } from "../src/auth/auth0-config.js";
import { resolveSyntheticManagedIdentity } from "../src/internal/identity-boundary.js";

describe("P3.13 Auth0 provider hardening checks before P4 real tenant authorization", () => {
  it("rejects issuer URL injection, insecure audience and missing provider settings", () => {
    for (const domain of [
      "http://example.us.auth0.com", "auth0.com.evil.test",
      "example.us.auth0.com@attacker.test", "example.us.auth0.com/",
      "localhost", "example.us.auth0.com:443",
    ]) {
      assert.equal(readAuth0ApiConfiguration({
        AUTH0_DOMAIN: domain, AUTH0_AUDIENCE: "https://synthetic.test",
      }), null);
    }
    assert.equal(readAuth0ApiConfiguration({
      AUTH0_DOMAIN: "example.us.auth0.com", AUTH0_AUDIENCE: "http://insecure.example",
    }), null);
  });

  it("never creates an organization session from a malformed or forged bearer token", async () => {
    const oldDomain = process.env.AUTH0_DOMAIN;
    const oldAudience = process.env.AUTH0_AUDIENCE;
    try {
      process.env.AUTH0_DOMAIN = "synthetic.us.auth0.com";
      process.env.AUTH0_AUDIENCE = "https://synthetic.test";
      const app = createApp({ logRequest: () => {} });
      for (const authorization of [
        "Bearer invalid-not-a-token",
        "Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiT1JHX0FETUlOIn0.fake",
      ]) {
        const r = await request(app).get("/api/v1/auth/check").set("Authorization", authorization);
        assert.equal(r.status, 401);
        assert.equal(r.body.error.code, "UNAUTHENTICATED");
        assert.ok(!JSON.stringify(r.body).includes(authorization));
      }
    } finally {
      if (oldDomain === undefined) delete process.env.AUTH0_DOMAIN;
      else process.env.AUTH0_DOMAIN = oldDomain;
      if (oldAudience === undefined) delete process.env.AUTH0_AUDIENCE;
      else process.env.AUTH0_AUDIENCE = oldAudience;
    }
  });

  it("cannot derive real organization rights from otherwise verified identity-only claims", async () => {
    const actor = await resolveSyntheticManagedIdentity(
      "Bearer synthetic.token.123456",
      { verifyBearerToken: async () => ({
        subject: "user_demo_alice",
        issuer: "https://synthetic.test",
        audience: "synthetic-only",
        expiresAtEpochSeconds: 2_200_000_000,
        cryptographicallyVerified: true,
        tenantId: "org_demo_cedar",
        roles: ["ORG_ADMIN"],
      }) },
      { issuer: "https://synthetic.test", audience: "synthetic-only" },
      2_100_000_000,
    );
    assert.deepEqual(actor, { userId: "user_demo_alice", verified: true });
    assert.equal("organizationId" in (actor ?? {}), false);
    assert.equal("roles" in (actor ?? {}), false);
  });
});
