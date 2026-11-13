import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { readServerConfig } from "../src/config.js";

describe("P3.01 synthetic-only API foundation", () => {
  const app = createApp();

  it("serves the versioned process health endpoint", async () => {
    const response = await request(app).get("/api/v1/health");
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "ok");
    assert.equal(response.body.scope, "synthetic-only");
    assert.equal(response.body.checks.process, "up");
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.headers["x-powered-by"], undefined);
  });

  it("does not expose future tenant, CRM, merchant, payment, or KYC routes", async () => {
    for (const path of [
      "/api/v1/organizations",
      "/api/v1/leads",
      "/api/v1/merchants",
      "/api/v1/payments",
      "/api/v1/kyc",
    ]) {
      const response = await request(app).get(path);
      assert.equal(response.status, 404, path);
      assert.deepEqual(response.body, {
        error: { code: "NOT_FOUND", message: "Endpoint is not available" },
      });
    }
  });

  it("does not reflect untrusted path content in 404 responses", async () => {
    const response = await request(app).get("/api/v1/private-secret-123");
    assert.equal(response.status, 404);
    assert.ok(!JSON.stringify(response.body).includes("private-secret-123"));
  });

  it("rejects malformed and privileged network bind configuration", () => {
    assert.deepEqual(readServerConfig({ PORT: "4000", HOST: "127.0.0.1" }), {
      host: "127.0.0.1",
      port: 4000,
    });
    assert.throws(() => readServerConfig({ PORT: "4000abc" }));
    assert.throws(() => readServerConfig({ PORT: "0" }));
    assert.throws(() => readServerConfig({ PORT: "65536" }));
    assert.throws(() => readServerConfig({ PORT: "4000", HOST: "0.0.0.0" }));
  });
});
