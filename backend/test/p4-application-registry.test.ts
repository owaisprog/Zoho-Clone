import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import request from "supertest";
import {
  p4ApplicationManifest, requireP4ApplicationAccess, p4AppCodeForPath,
  P4ApplicationDeniedError, type P4AppAccessEvidence,
} from "../src/platform/p4-application-registry.js";
const org = "10000000-0000-4000-8000-000000000001";
const evidence: P4AppAccessEvidence = {
  serverResolved: true,
  tenant: { verified: true, orgId: org, orgSlug: "demo-orchid", userId: "user_demo_alice", role: "OWNER" },
  grants: [{ orgId: org, appCode: "crm", active: true }, { orgId: org, appCode: "teams", active: false }],
  permissions: ["crm.leads.read.own", "teams.read.assigned"],
};
describe("P4.17 application entitlement separate from permissions", () => {
  it("unlocks only granted AND permitted apps, not finance/files", () => {
    assert.deepEqual(p4ApplicationManifest(evidence).map(a => [a.code,a.status]),
      [["crm","available"],["teams","locked"],["finance","locked"],["files","locked"]]);
    assert.doesNotThrow(() => requireP4ApplicationAccess(evidence, "crm"));
    assert.throws(() => requireP4ApplicationAccess(evidence, "teams"), P4ApplicationDeniedError);
  });
  it("denies missing entitlement even when permission exists, and vice versa", () => {
    const noRights = { ...evidence, permissions: [] };
    assert.equal(p4ApplicationManifest(noRights).find(a => a.code === "crm")?.status, "locked");
    const withTeamGrant = {
      ...evidence, grants: [...evidence.grants.slice(0,1), { orgId: org, appCode: "teams" as const, active: true }],
    };
    assert.equal(p4ApplicationManifest(withTeamGrant).find(a => a.code === "teams")?.status, "available");
  });
  it("denies invalid tenant evidence and cross-org grants", () => {
    for (const bad of [
      { ...evidence, serverResolved: false as never },
      { ...evidence, tenant: { ...evidence.tenant, verified: false as never } },
      { ...evidence, grants: [{ orgId: "10000000-0000-4000-8000-000000000002", appCode: "crm" as const, active: true }] },
      { ...evidence, permissions: ["*"] as never },
      { ...evidence, grants: [evidence.grants[0]!, evidence.grants[0]!] },
    ]) assert.throws(() => p4ApplicationManifest(bad), P4ApplicationDeniedError);
  });
  it("denies direct route access to locked apps in a test-only Express boundary", async () => {
    const app = express();
    app.get("/_test/app/:app", (req, res) => {
      try {
        requireP4ApplicationAccess(evidence, req.params.app as "crm" | "finance");
        res.status(200).json({ scope: "synthetic-only" });
      } catch { res.status(403).json({ error: { code: "APPLICATION_LOCKED" } }); }
    });
    assert.equal((await request(app).get("/_test/app/crm")).status, 200);
    assert.equal((await request(app).get("/_test/app/finance")).status, 403);
    assert.equal((await request(app).get("/_test/app/files")).status, 403);
    assert.equal(p4AppCodeForPath("/app/sales/leads"), "crm");
    assert.equal(p4AppCodeForPath("/app/sales/leads/anything"), null);
  });
});
