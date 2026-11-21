import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inspectSyntheticFileAccess, planSyntheticFileDeletion, requestSyntheticFileDownload } from "../src/platform/p4-file-lifecycle.js";
import { listSyntheticNotifications, previewSyntheticNotificationRead, validateSyntheticNoticePreference } from "../src/platform/p4-notifications.js";
import { authorizeSyntheticPlatformMutation, authorizeSyntheticPlatformRead } from "../src/platform/p4-platform-administration.js";
import { inspectSyntheticSupportAccess } from "../src/platform/p4-support-access.js";
import { planSyntheticOrganizationClosure } from "../src/platform/p4-organization-closure.js";
import { P4OperationsDeniedError } from "../src/platform/p4-operations-guards.js";
const org = "10000000-0000-4000-8000-000000000001";
const foreignOrg = "10000000-0000-4000-8000-000000000002";
const fileId = "10000000-0000-4000-8000-000000000031";
const now = 2_000_000_000_000;
const owner = { verified: true as const, orgId: org, orgSlug: "demo-orchid", userId: "user_demo_alice", role: "OWNER" as const };
const bob = { ...owner, userId: "user_demo_bob", role: "MEMBER" as const };
const file = { serverResolved: true as const, orgId: org, fileId, ownerUserId: owner.userId,
  recordId: "LEAD-DEMO-201", recordCanRead: true as const, recordCanDelete: true as const,
  scanState: "scan_clean" as const, lifecycle: "active" as const, versionCount: 2 };
const notice = { id: "notice_demo_invite01", orgId: org, recipientUserId: owner.userId,
  kind: "membership" as const, link: "/app/organization/memberships" as const, read: false };
const platform = { userId: "user_demo_support", issuerSubjectVerified: true as const,
  serverResolvedGrant: true as const, platformRole: "PLATFORM_ADMIN" as const,
  grantExpiresAtMs: now + 3600_000, mfaVerifiedAtMs: now - 60_000 };
const consent = { serverResolved: true as const, orgId: org, ownerUserId: owner.userId,
  supportUserId: platform.userId, consentActive: true as const, consentAtMs: now - 60_000,
  expiresAtMs: now + 120_000, scope: "tenant.metadata.read" as const };
const checks = { serverResolved: true as const, orgId: org, hasUnpaidBilling: false,
  hasLegalHold: false, hasPendingFileScans: false, hasActiveSupportAccess: false,
  retentionDays: 30, recoveryRunbookApproved: true, auditWriterApproved: true };

describe("P4.21 file lifecycle is metadata-only and fail-closed", () => {
  it("inspects only current same-org record access and never issues a signed URL", () => {
    const m = inspectSyntheticFileAccess(owner, file);
    assert.equal(m.versionCount, 2);
    assert.equal("url" in m || "objectKey" in m, false);
    assert.throws(() => requestSyntheticFileDownload(owner, file), P4OperationsDeniedError);
    assert.equal(planSyntheticFileDeletion(owner, file).deletableNow, false);
  });
  it("rejects foreign, revoked, unreadable and deleted files", () => {
    for (const [actor, record] of [
      [owner, { ...file, orgId: foreignOrg }],
      [bob, file],
      [{ ...owner, verified: false as never }, file],
      [owner, { ...file, recordCanRead: false as never }],
      [owner, { ...file, lifecycle: "deleted" as never }],
    ] as const) assert.throws(() => inspectSyntheticFileAccess(actor, record), P4OperationsDeniedError);
  });
});
describe("P4.22 recipient-only notification preview", () => {
  it("returns only matching exact recipient and allows local-only read preview", async () => {
    const rows = await listSyntheticNotifications(owner, { async forRecipient() { return [notice]; } });
    assert.equal(rows.length, 1);
    assert.equal(previewSyntheticNotificationRead(owner, rows[0]!).read, true);
    assert.equal(rows[0]!.read, false);
    assert.equal(validateSyntheticNoticePreference(owner, { category: "task", inApp: false }).inApp, false);
  });
  it("rejects cross-tenant data, forged deep links, and other recipients", async () => {
    for (const row of [
      { ...notice, orgId: foreignOrg }, { ...notice, recipientUserId: bob.userId },
      { ...notice, link: "https://evil.example/tokens" as never },
    ]) await assert.rejects(listSyntheticNotifications(owner, {
      async forRecipient() { return [row]; },
    }), P4OperationsDeniedError);
    assert.throws(() => previewSyntheticNotificationRead(bob, notice), P4OperationsDeniedError);
    await assert.rejects(listSyntheticNotifications(owner, {
      async forRecipient() { return [notice, notice]; },
    }), P4OperationsDeniedError);
  });
});
describe("P4.23 independent platform admin boundary", () => {
  it("requires independently server resolved platform grant and fresh step-up", () => {
    assert.equal(authorizeSyntheticPlatformRead(platform, now).tenantDataAccess, false);
    assert.throws(() => authorizeSyntheticPlatformMutation(platform, now), P4OperationsDeniedError);
    assert.throws(() => authorizeSyntheticPlatformRead(null, now), P4OperationsDeniedError);
    assert.throws(() => authorizeSyntheticPlatformRead({ ...platform, serverResolvedGrant: false as never }, now), P4OperationsDeniedError);
    assert.throws(() => authorizeSyntheticPlatformRead({ ...platform, mfaVerifiedAtMs: now - 11 * 60_000 }, now), P4OperationsDeniedError);
    assert.throws(() => authorizeSyntheticPlatformRead({ ...platform, grantExpiresAtMs: now }, now), P4OperationsDeniedError);
    assert.throws(() => authorizeSyntheticPlatformRead(owner as never, now), P4OperationsDeniedError);
  });
});
describe("P4.24 explicit time-bounded support consent", () => {
  it("grants only non-record metadata preview while current consent remains active", () => {
    assert.equal(inspectSyntheticSupportAccess(owner, platform, consent, now).tenantRecordsAccessible, false);
    assert.throws(() => inspectSyntheticSupportAccess(owner, platform, { ...consent, expiresAtMs: now }, now), P4OperationsDeniedError);
    assert.throws(() => inspectSyntheticSupportAccess(owner, platform, { ...consent, orgId: foreignOrg }, now), P4OperationsDeniedError);
    assert.throws(() => inspectSyntheticSupportAccess(owner, platform, { ...consent, consentActive: false as never }, now), P4OperationsDeniedError);
    assert.throws(() => inspectSyntheticSupportAccess(bob, platform, consent, now), P4OperationsDeniedError);
  });
});
describe("P4.25 closure/export planning without irreversible execution", () => {
  it("requires current owner plus MFA and never queues or removes data", () => {
    const plan = planSyntheticOrganizationClosure(owner, "export", checks, now, now - 30_000);
    assert.equal(plan.status, "not_executable");
    assert.equal(plan.jobsCreated, 0);
    assert.deepEqual(plan.blockers, []);
    assert.throws(() => planSyntheticOrganizationClosure(bob, "closure", checks, now, now), P4OperationsDeniedError);
    assert.throws(() => planSyntheticOrganizationClosure(owner, "closure", checks, now, now - 301_000), P4OperationsDeniedError);
  });
  it("exposes blocking dependencies without causing any side effect", () => {
    const plan = planSyntheticOrganizationClosure(owner, "closure", {
      ...checks, hasLegalHold: true, hasUnpaidBilling: true, auditWriterApproved: false,
    }, now, now);
    assert.equal(plan.status, "blocked");
    assert.deepEqual(plan.blockers, ["unpaid_billing", "legal_hold", "audit_writer_approval"]);
    assert.throws(() => planSyntheticOrganizationClosure(owner, "closure",
      { ...checks, orgId: foreignOrg }, now, now), P4OperationsDeniedError);
  });
});
