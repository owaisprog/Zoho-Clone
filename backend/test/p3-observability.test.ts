import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { categorizeHttpSample, SafeRequestMetrics } from "../src/platform/observability.js";

describe("P3.11 bounded metrics and trace IDs", () => {
  it("aggregates only low-cardinality dimensions", () => {
    const collector = new SafeRequestMetrics();
    collector.observe("GET", 200, 30);
    collector.observe("GET", 201, 50);
    collector.observe("UNKNOWN-SENSITIVE-METHOD", 500, 3000);
    assert.deepEqual(collector.snapshot(), [
      { method: "GET", statusGroup: "2xx", duration: "lt100ms", count: 2 },
      { method: "OTHER", statusGroup: "5xx", duration: "gte2000ms", count: 1 },
    ]);
    assert.deepEqual(categorizeHttpSample(null, -1, Number.NaN),
      { method: "OTHER", statusGroup: "other", duration: "gte2000ms" });
  });
  it("records a request without recording URL, query, token, IP or actor", async () => {
    const metrics = new SafeRequestMetrics();
    const logs: string[] = [];
    const app = createApp({ metrics, logRequest: entry => logs.push(entry) });
    const response = await request(app)
      .get("/unavailable/PASSWORD_IN_PATH?token=TOP_PRIVATE")
      .set("Authorization", "Bearer TOP_PRIVATE")
      .set("X-Request-Id", "TOP_PRIVATE");
    assert.equal(response.status, 404);
    const requestId = String(response.headers["x-request-id"]);
    assert.match(requestId, /^[0-9a-f-]{36}$/);
    assert.equal(metrics.snapshot().length, 1);
    const summary = JSON.stringify(metrics.snapshot());
    assert.ok(summary.includes('"4xx"'));
    for (const marker of ["PASSWORD_IN_PATH", "TOP_PRIVATE", "Authorization", "token", "user_demo_"]) {
      assert.ok(!summary.includes(marker));
      assert.ok(!logs.join("").includes(marker));
    }
    assert.ok(logs[0]?.includes(requestId));
  });
  it("keeps the telemetry store private", async () => {
    const response = await request(createApp({ metrics: new SafeRequestMetrics(), logRequest: () => {} }))
      .get("/internal/metrics");
    assert.equal(response.status, 404);
  });
});
