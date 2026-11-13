import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_CONTRACT } from "@zoho-clone/demo-contracts";
import { getDemoTasks } from "../src/lib/demo-api";
import { DEMO_TASKS } from "../src/lib/synthetic-data";

describe("P3.10/P3.12 trusted synthetic tasks adapter", () => {
  it("accepts exactly the fictional local Express task contract", async () => {
    const prior = globalThis.fetch;
    try {
      globalThis.fetch = async (url) => {
        assert.match(String(url), /\/api\/v1\/demo\/tasks$/);
        return Response.json({contract:DEMO_CONTRACT,scope:"synthetic-only",dataset:"tasks",records:DEMO_TASKS});
      };
      const response = await getDemoTasks();
      assert.equal(response.source, "express-demo-api");
      assert.deepEqual(response.records, DEMO_TASKS);
    } finally { globalThis.fetch = prior; }
  });
  it("rejects unexpected fields, titles and real reference IDs without exposing them", async () => {
    const prior = globalThis.fetch;
    try {
      globalThis.fetch = async () => Response.json({
        contract:DEMO_CONTRACT,scope:"synthetic-only",dataset:"tasks",
        records:DEMO_TASKS.map((row,index) => index === 0
          ? {...row,relatedId:"REAL-CLIENT-10",secret:"private"} : row),
      });
      const response = await getDemoTasks();
      assert.equal(response.source, "local-fixtures");
      assert.ok(!JSON.stringify(response).includes("private"));
      assert.deepEqual(response.records, DEMO_TASKS);
    } finally { globalThis.fetch = prior; }
  });
  it("fails closed if process is offline", async () => {
    const prior = globalThis.fetch;
    try {
      globalThis.fetch = async () => { throw Error("network data should not leak"); };
      assert.equal((await getDemoTasks()).source, "local-fixtures");
    } finally { globalThis.fetch = prior; }
  });
});