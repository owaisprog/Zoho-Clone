import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDemoApplications, getDemoLeads, isSyntheticLead } from "../src/lib/demo-api";
import { DEMO_APPLICATIONS, DEMO_LEADS } from "../src/lib/synthetic-data";

describe("P3.02 server-side synthetic Express data adapter", () => {
  it("uses a verified fictional Express payload, not browser fetching", async () => {
    const oldFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (input) => {
        assert.match(String(input), /\/api\/v1\/demo\/leads$/);
        return Response.json({ scope: "synthetic-only", dataset: "leads", records: DEMO_LEADS });
      };
      const result = await getDemoLeads();
      assert.equal(result.source, "express-demo-api");
      assert.deepEqual(result.records, DEMO_LEADS);
    } finally { globalThis.fetch = oldFetch; }
  });

  it("falls back safely when the local API is offline", async () => {
    const oldFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => { throw new Error("private local connection details"); };
      const result = await getDemoApplications();
      assert.equal(result.source, "local-fixtures");
      assert.deepEqual(result.records, DEMO_APPLICATIONS);
    } finally { globalThis.fetch = oldFetch; }
  });

  it("rejects wrong labels, extra fields, and any non-example address", async () => {
    assert.equal(isSyntheticLead({ ...DEMO_LEADS[0], email: "real@company.com" }), false);
    const oldFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => Response.json({
        scope: "synthetic-only",
        dataset: "leads",
        records: DEMO_LEADS.map((row, index) =>
          index === 0 ? { ...row, email: "real@company.com", secret: "do-not-show" } : row),
      });
      const result = await getDemoLeads();
      assert.equal(result.source, "local-fixtures");
      assert.ok(!JSON.stringify(result).includes("do-not-show"));
      globalThis.fetch = async () => Response.json({ scope: "production", dataset: "leads", records: DEMO_LEADS });
      assert.equal((await getDemoLeads()).source, "local-fixtures");
    } finally { globalThis.fetch = oldFetch; }
  });

  it("rejects wrong dataset and duplicate demo identifiers", async () => {
    const oldFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => Response.json({
        scope: "synthetic-only", dataset: "applications", records: DEMO_LEADS,
      });
      assert.equal((await getDemoLeads()).source, "local-fixtures");
      globalThis.fetch = async () => Response.json({
        scope: "synthetic-only", dataset: "applications",
        records: [DEMO_APPLICATIONS[0], DEMO_APPLICATIONS[0], ...DEMO_APPLICATIONS.slice(2)],
      });
      assert.equal((await getDemoApplications()).source, "local-fixtures");
    } finally { globalThis.fetch = oldFetch; }
  });
});
