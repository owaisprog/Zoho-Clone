import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("P3.07 bounded Express error and header behaviors", () => {
  const app = createApp();
  it("returns a generic error for invalid JSON without leaking the request", async () => {
    const response = await request(app).post("/api/v1/demo/leads")
      .set("Content-Type", "application/json")
      .send('{"password":"TOP-SECRET",');
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "INVALID_JSON");
    assert.ok(!JSON.stringify(response.body).includes("TOP-SECRET"));
    assert.equal(response.headers["x-powered-by"], undefined);
  });
  it("enforces the 16kb JSON limit before a nonexistent write endpoint", async () => {
    const response = await request(app).post("/api/v1/demo/leads")
      .send({ padding: "X".repeat(20_000) });
    assert.equal(response.status, 413);
    assert.equal(response.body.error.code, "PAYLOAD_TOO_LARGE");
    assert.ok(!JSON.stringify(response.body).includes("XXXXX"));
  });
  it("returns the same safe 404 envelope for arbitrary prohibited routes", async () => {
    for (const path of ["/api/v1/organizations", "/api/v1/tenant-private", "/api/v1/real-leads"]) {
      const response = await request(app).get(path);
      assert.equal(response.status, 404);
      assert.deepEqual(response.body, {error:{code:"NOT_FOUND",message:"Endpoint is not available"}});
      assert.equal(response.headers["cache-control"], "no-store");
    }
  });
  it("sets a no-store policy for read-only fictional datasets", async () => {
    const response = await request(app).get("/api/v1/demo/leads");
    assert.equal(response.status, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.ok(response.headers["content-security-policy"]);
  });
});
