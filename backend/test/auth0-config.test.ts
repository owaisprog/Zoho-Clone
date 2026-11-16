import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { readAuth0ApiConfiguration } from "../src/auth/auth0-config.js";

describe("P3.13 Auth0 issuer and API audience configuration", () => {
  it("denies missing, partial or untrusted issuer configurations", () => {
    assert.equal(readAuth0ApiConfiguration({}), null);
    assert.equal(readAuth0ApiConfiguration({ AUTH0_DOMAIN: "tenant.auth0.com" }), null);
    assert.equal(readAuth0ApiConfiguration({ AUTH0_DOMAIN: "evil.test", AUTH0_AUDIENCE: "https://api.zoho-clone.local" }), null);
    assert.equal(readAuth0ApiConfiguration({ AUTH0_DOMAIN: "tenant.auth0.com@evil.test", AUTH0_AUDIENCE: "https://api.zoho-clone.local" }), null);
    assert.equal(readAuth0ApiConfiguration({ AUTH0_DOMAIN: "tenant.auth0.com", AUTH0_AUDIENCE: "https://api.test\nheader" }), null);
  });
  it("normalizes a normal Auth0 regional tenant and API identifier", () => {
    assert.deepEqual(
      readAuth0ApiConfiguration({ AUTH0_DOMAIN: "sample.us.auth0.com", AUTH0_AUDIENCE: "https://api.zoho-clone.local" }),
      { issuerBaseURL: "https://sample.us.auth0.com/", audience: "https://api.zoho-clone.local" },
    );
  });
  it("does not accept bearer strings when the provider is not configured", async () => {
    const response = await request(createApp({ logRequest: () => {} }))
      .get("/api/v1/auth/check")
      .set("Authorization", "Bearer arbitrary-not-a-real-token");
    assert.equal(response.status, 503);
    assert.equal(response.body.error.code, "AUTH_NOT_CONFIGURED");
    assert.ok(!JSON.stringify(response.body).includes("arbitrary-not-a-real-token"));
  });
});
