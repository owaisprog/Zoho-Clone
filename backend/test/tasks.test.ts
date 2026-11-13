import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { DEMO_CONTRACT, parseSyntheticEnvelope } from "@zoho-clone/demo-contracts";
import { createApp } from "../src/app.js";
import { demoTasks } from "../src/demo-fixtures.js";

describe("P3.10 fictional task endpoint and P3.12 negative routes", () => {
  const app = createApp();
  it("returns fixed invented tasks with strict contract and no-store cache", async () => {
    const response = await request(app).get("/api/v1/demo/tasks");
    assert.equal(response.status, 200);
    assert.equal(response.body.scope, "synthetic-only");
    assert.equal(response.body.contract, DEMO_CONTRACT);
    assert.equal(response.body.dataset, "tasks");
    assert.equal(response.headers["cache-control"], "no-store");
    assert.deepEqual(parseSyntheticEnvelope(response.body, "tasks", demoTasks), demoTasks);
    assert.ok(response.body.records.every((task: { id: string; title: string }) =>
      task.id.startsWith("TASK-DEMO-") && task.title.startsWith("Demo ")));
  });
  it("does not expose task CRUD or protected business APIs", async () => {
    for (const method of ["post", "put", "patch", "delete"] as const) {
      const response = await request(app)[method]("/api/v1/demo/tasks").send({title:"Real task"});
      assert.equal(response.status, 404, method);
      assert.equal(response.body.error.code, "NOT_FOUND");
    }
    for (const path of ["/api/v1/tasks", "/api/v1/users", "/api/v1/tenant-tasks"]) {
      const response = await request(app).get(path);
      assert.equal(response.status, 404, path);
    }
  });
});