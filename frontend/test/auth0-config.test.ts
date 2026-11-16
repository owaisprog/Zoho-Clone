import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readAuth0WebConfiguration } from "../src/lib/auth0-config";

const valid = {
  AUTH0_DOMAIN: "tenant.us.auth0.com",
  AUTH0_CLIENT_ID: "demo-id-only",
  AUTH0_CLIENT_SECRET: "not-a-real-secret",
  AUTH0_SECRET: "0".repeat(64),
  AUTH0_AUDIENCE: "https://api.zoho-clone.local",
};

describe("P3.13 Auth0 Next.js configuration gate", () => {
  it("does not enable login with missing credentials", () => {
    assert.equal(readAuth0WebConfiguration({}), null);
    assert.equal(readAuth0WebConfiguration({ AUTH0_DOMAIN: valid.AUTH0_DOMAIN }), null);
    assert.equal(readAuth0WebConfiguration({ ...valid, AUTH0_CLIENT_SECRET: "" }), null);
    assert.equal(readAuth0WebConfiguration({ ...valid, AUTH0_SECRET: "weak" }), null);
    assert.equal(readAuth0WebConfiguration({ ...valid, AUTH0_DOMAIN: "http://evil.test" }), null);
  });
  it("uses explicit tenant and audience only when complete", () => {
    assert.deepEqual(readAuth0WebConfiguration(valid), {
      domain: valid.AUTH0_DOMAIN, audience: valid.AUTH0_AUDIENCE,
    });
  });
});
