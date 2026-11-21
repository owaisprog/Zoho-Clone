import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import request from "supertest";
import { createP4Auth0DevelopmentReadRouter } from "../src/platform/p4-auth0-development-router.js";

describe("P4 Auth0 SDK-backed development router safety", () => {
  it("returns 503 without Auth0 configuration, even with browser-supplied identity and owner headers", async () => {
    const app = express();
    app.use("/_test", createP4Auth0DevelopmentReadRouter({
      mappingLookup: { async findByIssuerAndSubject() { throw Error("not reached"); } },
      memberships: {
        async listForUser() { throw Error("not reached"); },
        async findForUserInOrg() { throw Error("not reached"); },
      },
      tenantPool: { async connect() { throw Error("not reached"); } },
      nowEpochSeconds: () => 2_000_000_000,
    }, {}));
    const response = await request(app).get(
      "/_test/10000000-0000-4000-8000-000000000001/settings",
    ).set("x-role", "OWNER").set("x-actor-id", "user_demo_alice").set("Authorization", "Bearer fake");
    assert.equal(response.status, 503);
    assert.deepEqual(response.body, { error: { code: "AUTH_NOT_CONFIGURED" } });
    assert.equal(response.headers["cache-control"], "no-store");
  });
});
