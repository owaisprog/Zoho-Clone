import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { demoApplications, demoLeads } from "../src/demo-fixtures.js";

describe("P3.02 explicitly synthetic read-only demo API", () => {
  const app = createApp();

  it("returns only invented leads with no-store headers", async () => {
    const response = await request(app).get("/api/v1/demo/leads");
    assert.equal(response.status, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.body.scope, "synthetic-only");
    assert.equal(response.body.dataset, "leads");
    assert.deepEqual(response.body.records, demoLeads);
    assert.ok(response.body.records.every((row: { email: string; id: string }) =>
      row.email.endsWith("@example.com") && row.id.startsWith("LEAD-DEMO-")));
  });

  it("returns only invented internal applications without provider claims", async () => {
    const response = await request(app).get("/api/v1/demo/applications");
    assert.equal(response.status, 200);
    assert.equal(response.body.scope, "synthetic-only");
    assert.equal(response.body.dataset, "applications");
    assert.deepEqual(response.body.records, demoApplications);
    assert.ok(response.body.records.every((row: { id: string }) => row.id.startsWith("APP-DEMO-")));
    assert.ok(!JSON.stringify(response.body).includes("processor_approved"));
  });

  it("never offers demo writes or production CRM read routes", async () => {
    for (const [method, path] of [
      ["post", "/api/v1/demo/leads"],
      ["patch", "/api/v1/demo/applications/APP-DEMO-101"],
      ["delete", "/api/v1/demo/leads/LEAD-DEMO-101"],
      ["get", "/api/v1/leads"],
      ["get", "/api/v1/applications"],
    ] as const) {
      const response = await request(app)[method](path);
      assert.equal(response.status, 404, method + " " + path);
      assert.equal(response.body.error.code, "NOT_FOUND");
    }
  });
});
