import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getBackendStatus } from "../src/lib/backend-status";

describe("P3.01 Next.js server-only process health adapter", () => {
  it("recognizes explicitly synthetic healthy process responses", async () => {
    const original = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        Response.json({
          status: "ok",
          scope: "synthetic-only",
          checks: { process: "up" },
        });

      assert.deepEqual(await getBackendStatus(), {
        online: true,
        label: "API process running",
      });
    } finally {
      globalThis.fetch = original;
    }
  });

  it("does not treat a non-synthetic or failed health response as ready", async () => {
    const original = globalThis.fetch;
    try {
      globalThis.fetch = async () => Response.json({ status: "ok", scope: "production" });
      assert.equal((await getBackendStatus()).online, false);
      globalThis.fetch = async () => new Response("not found", { status: 404 });
      assert.equal((await getBackendStatus()).online, false);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("does not expose thrown request errors through the frontend", async () => {
    const original = globalThis.fetch;
    try {
      globalThis.fetch = async () => { throw new Error("secret fake backend error"); };
      const status = await getBackendStatus();
      assert.equal(status.online, false);
      assert.ok(!status.label.includes("secret"));
    } finally {
      globalThis.fetch = original;
    }
  });
});
