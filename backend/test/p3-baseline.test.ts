import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("master roadmap P3.04 and P3.11 baseline", () => {
  it("keeps liveness separate from fail-closed readiness", async () => {
    const app = createApp({ logRequest: () => {} });
    const live = await request(app).get("/health/live");
    assert.equal(live.status, 200);
    assert.equal(live.body.status, "alive");
    assert.equal(live.headers["cache-control"], "no-store");
    const ready = await request(app).get("/health/ready");
    assert.equal(ready.status, 503);
    assert.deepEqual(ready.body, { status: "not_ready", scope: "synthetic-only" });
  });

  it("accepts only an explicit, healthy dependency readiness probe", async () => {
    const healthy = createApp({ readinessProbe: async () => true, logRequest: () => {} });
    assert.equal((await request(healthy).get("/health/ready")).status, 200);
    const degraded = createApp({ readinessProbe: async () => { throw new Error("sensitive DB password"); }, logRequest: () => {} });
    const response = await request(degraded).get("/health/ready");
    assert.equal(response.status, 503);
    assert.ok(!JSON.stringify(response.body).includes("password"));
  });

  it("generates new trace IDs and logs no path, query, headers or credentials", async () => {
    const entries: string[] = [];
    const app = createApp({ logRequest: (entry) => entries.push(entry) });
    const first = await request(app)
      .get("/no-such-route/secret-in-path?token=very-secret")
      .set("X-Request-Id", "ATTACKER-CHOSEN-ID")
      .set("Authorization", "Bearer very-secret");
    const second = await request(app).get("/health/live");
    const id = first.headers["x-request-id"];
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.notEqual(id, "ATTACKER-CHOSEN-ID");
    assert.notEqual(id, second.headers["x-request-id"]);
    assert.equal(entries.length, 2);
    const log = JSON.parse(entries[0]!) as Record<string, unknown>;
    assert.equal(log.requestId, id);
    assert.equal(log.status, 404);
    assert.equal(log.method, "GET");
    for (const forbidden of ["very-secret", "secret-in-path", "ATTACKER-CHOSEN-ID", "Authorization", "token"]) {
      assert.ok(!entries.join(" ").includes(forbidden), forbidden);
    }
  });
});
