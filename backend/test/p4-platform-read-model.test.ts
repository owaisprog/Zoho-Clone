import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import request from "supertest";
import {
  P4_PERMISSION_CODES,
} from "../src/platform/p4-roles-catalog.js";
import {
  readP4SyntheticPlatformShell, readP4SyntheticOwnerAudit,
  authorizeP4DirectAppRoute, P4ReadModelDeniedError,
} from "../src/platform/p4-platform-read-model.js";
import { createP4IntegrationTestRouter } from "../src/platform/p4-integration-test-router.js";
import type { ScopedPgPool } from "../src/platform/p4-rls-transaction.js";
import type { P4VerifiedProviderToken } from "../src/platform/p4-auth0-subject-bridge.js";

const org = "10000000-0000-4000-8000-000000000001";
const foreign = "10000000-0000-4000-8000-000000000002";
const owner = { verified: true as const, orgId: org, orgSlug: "demo-maple-payments",
  userId: "user_demo_alice", role: "OWNER" as const };
const now = 2_000_000_000;
const issuer = "https://demo.us.auth0.com/";
const audience = "urn:zoho-clone:demo";
const token: P4VerifiedProviderToken = {
  cryptographicallyVerified: true, issuer, audience, subject: "auth0|demo-alice",
  expiresAtEpochSeconds: now + 120,
};
function fixture(overrides: { privileged?: boolean; revoked?: boolean; malformedNotice?: boolean;
  foreignFile?: boolean; extraPermission?: boolean; rawAudit?: boolean } = {}) {
  let rollbacks = 0, releases = 0;
  const pool: ScopedPgPool = { async connect() {
    let actor = "", orgId = "";
    return {
      async query(sql, values) {
        if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
        if (sql === "ROLLBACK") { rollbacks++; return { rows: [] }; }
        if (sql.includes("set_config('app.actor_id'")) {
          actor = values?.[0] ?? ""; return { rows: [] };
        }
        if (sql.includes("set_config('app.tenant_id'")) {
          orgId = values?.[0] ?? ""; return { rows: [] };
        }
        if (sql.includes("current_user")) return { rows: [{
          name: overrides.privileged ? "demo_ci" : "p4_synthetic_ci_runtime",
          privileged: overrides.privileged === true,
        }] };
        if (sql.includes("FROM p4_synthetic.memberships")) return { rows:
          orgId === org && actor === owner.userId && !overrides.revoked
            ? [{ role: "OWNER", active: true }] : [],
        };
        if (sql.includes("FROM p4_synthetic.role_assignments")) return { rows: [{ code: "OWNER" }] };
        if (sql.includes("FROM p4_synthetic.role_permissions")) return { rows: [
          ...P4_PERMISSION_CODES.map(code => ({ code })),
          ...(overrides.extraPermission ? [{ code: "platform.superadmin" }] : []),
        ] };
        if (sql.includes("FROM p4_synthetic.app_grants")) return { rows: [
          { appCode: "crm", active: true }, { appCode: "teams", active: false },
        ] };
        if (sql.includes("FROM p4_synthetic.notifications")) return { rows: [{
          id: "10000000-0000-4000-8000-000000000061", category: "task",
          linkCode: overrides.malformedNotice ? "https://evil.example" : "tasks", read: false,
        }] };
        if (sql.includes("FROM p4_synthetic.files")) return { rows: [{
          id: "10000000-0000-4000-8000-000000000031",
          label: overrides.foreignFile ? "secret/external.pdf" : "Demo file.pdf",
          mediaType: "application/pdf", sizeBytes: 128, lifecycle: "quarantined",
        }] };
        if (sql.includes("FROM p4_synthetic.audit_logs")) return { rows: [{
          id: "10000000-0000-4000-8000-000000000041",
          action: "team.created", objectType: "team",
          before: overrides.rawAudit ? "actual-secret" : "[REDACTED]",
          after: "[REDACTED]",
        }] };
        throw new Error("Unexpected query");
      },
      release() { releases++; },
    };
  }};
  return { pool, get rollbacks() { return rollbacks; }, get releases() { return releases; } };
}
describe("P4 exit integration 02 read-only RLS platform service", () => {
  it("requires fresh database membership and nonprivileged role, then returns server-owned manifest", async () => {
    const f = fixture();
    const shell = await readP4SyntheticPlatformShell(f.pool, owner);
    assert.equal(shell.orgId, org);
    assert.deepEqual(shell.navigation.map(n => n.code), ["crm"]);
    assert.deepEqual(shell.apps.filter(a => a.status === "available").map(a => a.code), ["crm"]);
    assert.equal(shell.files[0]?.downloadEnabled, false);
    assert.equal("privateObjectKey" in shell.files[0]!, false);
    assert.deepEqual(shell.notifications.map(n => n.href), ["/app/tasks"]);
    assert.equal("recipientUserId" in shell.notifications[0]!, false);
    authorizeP4DirectAppRoute(shell, "crm");
    assert.throws(() => authorizeP4DirectAppRoute(shell, "finance"), P4ReadModelDeniedError);
    assert.throws(() => authorizeP4DirectAppRoute(shell, "teams"), P4ReadModelDeniedError);
    assert.equal(f.releases, 1);
  });
  it("denies privileged pool roles, missing memberships, tampered permissions, forged links and file labels", async () => {
    for (const flags of [
      { privileged: true }, { revoked: true }, { extraPermission: true },
      { malformedNotice: true }, { foreignFile: true },
    ]) {
      const f = fixture(flags);
      await assert.rejects(readP4SyntheticPlatformShell(f.pool, owner), P4ReadModelDeniedError);
      assert.equal(f.releases, 1);
      assert.equal(f.rollbacks, 1);
    }
    await assert.rejects(readP4SyntheticPlatformShell(fixture().pool, {
      ...owner, orgId: foreign,
    }), P4ReadModelDeniedError);
  });
  it("reads only redacted events for an owner, never a member or raw values", async () => {
    const f = fixture();
    const items = await readP4SyntheticOwnerAudit(f.pool, owner);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.before, "[REDACTED]");
    assert.equal("objectRef" in items[0]!, false);
    await assert.rejects(readP4SyntheticOwnerAudit(f.pool, {
      ...owner, role: "MEMBER",
    }), P4ReadModelDeniedError);
    await assert.rejects(readP4SyntheticOwnerAudit(fixture({ rawAudit: true }).pool, owner),
      P4ReadModelDeniedError);
  });
});
describe("P4 exit integration 02 test-only HTTP guarded read routes", () => {
  function router() {
    const f = fixture();
    const app = express();
    app.use("/_test/organizations", createP4IntegrationTestRouter({
      resolveVerifiedToken: async () => token,
      mappingLookup: { async findByIssuerAndSubject(i, s) {
        return i === issuer && s === token.subject
          ? { userId: owner.userId, emailVerified: true } : null;
      } },
      memberships: {
        async listForUser() { return []; },
        async findForUserInOrg(userId, orgId) {
          return userId === owner.userId && orgId === org ? {
            orgId: org, orgSlug: owner.orgSlug, orgName: "Demo Maple Payments",
            userId, role: "OWNER" as const, active: true,
          } : null;
        },
      },
      tenantPool: f.pool, expectedIssuer: issuer,
      expectedAudience: audience, nowEpochSeconds: () => now,
    }));
    return app;
  }
  it("denies a direct locked route regardless of client headers", async () => {
    const app = router();
    const ok = await request(app).get("/_test/organizations/" + org + "/apps/crm");
    const locked = await request(app).get("/_test/organizations/" + org + "/apps/finance")
      .set("x-role", "OWNER").set("x-permission", "finance.superuser");
    const forged = await request(app).get("/_test/organizations/" + foreign + "/apps/crm")
      .set("x-org-id", org);
    assert.equal(ok.status, 200);
    assert.equal(locked.status, 403);
    assert.equal(forged.status, 403);
    assert.deepEqual(locked.body, { error: { code: "P4_TENANT_ACCESS_DENIED" } });
  });
  it("returns scrubbed owner read model; no writes or file download APIs are mounted", async () => {
    const app = router();
    const shell = await request(app).get("/_test/organizations/" + org + "/shell");
    const audit = await request(app).get("/_test/organizations/" + org + "/audit-logs");
    assert.equal(shell.status, 200);
    assert.equal(audit.status, 200);
    assert.equal(shell.headers["cache-control"], "no-store");
    assert.equal(shell.body.data.notifications.length, 1);
    assert.equal(audit.body.data[0].before, "[REDACTED]");
    assert.equal((await request(app).post("/_test/organizations/" + org + "/settings")).status, 404);
    assert.equal((await request(app).get("/_test/organizations/" + org +
      "/files/10000000-0000-4000-8000-000000000031/download")).status, 404);
  });
});
