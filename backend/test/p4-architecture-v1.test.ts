import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCanonicalUuidV4, requireCanonicalUuidV4, newInternalUuidV4,
  requireTenantRecordKey, validateAuth0SubjectReference, P4ApprovedKeyDeniedError,
} from "../src/platform/p4-approved-uuid.js";
import {
  planP4SyntheticFileTransition, P4FilePlanDeniedError, type P4ProposedFileMetadata,
  type P4ProposedFilePolicyEvidence,
} from "../src/platform/p4-approved-file-workflow.js";
import {
  planP4SyntheticOutboxEvent, P4OutboxPlanDeniedError, type P4OutboxRequest,
} from "../src/platform/p4-approved-outbox.js";
const org = "10000000-0000-4000-8000-000000000001";
const otherOrg = "10000000-0000-4000-8000-000000000002";
const actor = "10000000-0000-4000-8000-000000000003";
const otherActor = "10000000-0000-4000-8000-000000000004";
const fileId = "10000000-0000-4000-8000-000000000031";
const recordId = "10000000-0000-4000-8000-000000000032";
const eventId = "10000000-0000-4000-8000-000000000041";
const file: P4ProposedFileMetadata = {
  organizationId: org, fileId, recordId, ownerUserId: actor,
  state: "quarantined", quarantined: true, revision: 1,
};
const evidence: P4ProposedFilePolicyEvidence = {
  serverResolved: true, organizationId: org, actorId: actor,
  currentMembershipVerified: true, canManageRecord: true, serverScannerAttested: true,
};
const request: P4OutboxRequest = {
  serverResolved: true, eventId, organizationId: org, actorId: actor, resourceId: fileId,
  eventName: "file.scan.requested", aggregateRevision: 1, idempotencyKey: "scan_job_test_0001",
};

describe("ADR0007 approved internal UUIDv4 contract", () => {
  it("generates and accepts only canonical UUIDv4 internal identifiers", () => {
    const generated = newInternalUuidV4();
    assert.equal(isCanonicalUuidV4(generated), true);
    assert.equal(requireCanonicalUuidV4(org), org);
    const invalid: unknown[] = [
      "00000000-0000-0000-0000-000000000000",
      "10000000-0000-1000-8000-000000000001",
      "10000000-0000-5000-8000-000000000001",
      "10000000-0000-4000-0000-000000000001",
      "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA", "demo-alice", "auth0|user", null, 41,
    ];
    for (const value of invalid) {
      assert.equal(isCanonicalUuidV4(value), false);
      assert.throws(() => requireCanonicalUuidV4(value), P4ApprovedKeyDeniedError);
    }
  });
  it("distinguishes tenant-owned record keys and external Auth0 subjects", () => {
    assert.deepEqual(requireTenantRecordKey(org, recordId), {
      organizationId: org, recordId,
    });
    assert.throws(() => requireTenantRecordKey(org, "LEAD-DEMO-101"),
      P4ApprovedKeyDeniedError);
    const provider = validateAuth0SubjectReference({
      issuer: "https://demo.us.auth0.com/", subject: "auth0|identity_abc",
      role: "OWNER", tenant: org,
    });
    assert.deepEqual(provider, {
      issuer: "https://demo.us.auth0.com/", subject: "auth0|identity_abc",
    });
    assert.equal("role" in provider, false);
    assert.throws(() => validateAuth0SubjectReference({
      issuer: "https://attacker.example/", subject: "auth0|identity_abc",
    }), P4ApprovedKeyDeniedError);
  });
});
describe("ADR0007 P4 private-file quarantine policy: inert plan only", () => {
  it("only a current approved scan can plan quarantine → clean or rejected", () => {
    const clean = planP4SyntheticFileTransition(file, evidence, "scan_passed", 1);
    const rejected = planP4SyntheticFileTransition(file, evidence, "scan_failed", 1);
    assert.equal(clean.nextState, "scan_clean");
    assert.equal(rejected.nextState, "rejected");
    assert.equal(clean.nextRevision, 2);
    assert.equal(clean.persistEnabled, false);
    assert.equal(clean.downloadEnabled, false);
    assert.equal(clean.uploadEnabled, false);
    assert.equal(clean.deleteEnabled, false);
    assert.equal(Object.isFrozen(clean), true);
    assert.equal(file.state, "quarantined");
    assert.equal("downloadUrl" in clean || "objectKey" in clean, false);
  });
  it("soft delete is planned for eligible scanned/rejected metadata but never performs deletion", () => {
    for (const state of ["scan_clean", "rejected"] as const) {
      const next = planP4SyntheticFileTransition({
        ...file, state, quarantined: false, revision: 4,
      }, { ...evidence, serverScannerAttested: false }, "soft_delete", 4);
      assert.equal(next.nextState, "soft_deleted");
      assert.equal(next.persistEnabled, false);
      assert.equal(next.deleteEnabled, false);
    }
  });
  it("denies cross-org, other actor, revoked membership and forged scanner attestations", () => {
    for (const [meta, policy] of [
      [{ ...file, organizationId: otherOrg }, evidence],
      [file, { ...evidence, organizationId: otherOrg }],
      [file, { ...evidence, actorId: otherActor }],
      [file, { ...evidence, currentMembershipVerified: false }],
      [file, { ...evidence, canManageRecord: false }],
      [file, { ...evidence, serverScannerAttested: false }],
    ] as const) {
      assert.throws(() => planP4SyntheticFileTransition(
        meta as P4ProposedFileMetadata, policy as P4ProposedFilePolicyEvidence, "scan_passed", 1,
      ), P4FilePlanDeniedError);
    }
  });
  it("denies stale revision, invalid state, too many revisions, restore and premature deletion", () => {
    assert.throws(() => planP4SyntheticFileTransition(file, evidence, "scan_passed", 3), P4FilePlanDeniedError);
    assert.throws(() => planP4SyntheticFileTransition({ ...file, revision: 2_147_483_647 },
      evidence, "scan_passed", 2_147_483_647), P4FilePlanDeniedError);
    assert.throws(() => planP4SyntheticFileTransition(file, evidence, "soft_delete", 1), P4FilePlanDeniedError);
    assert.throws(() => planP4SyntheticFileTransition({
      ...file, state: "soft_deleted", quarantined: false,
    }, evidence, "scan_passed", 1), P4FilePlanDeniedError);
    assert.throws(() => planP4SyntheticFileTransition({ ...file, recordId: "LEAD-DEMO-201" },
      evidence, "scan_passed", 1), P4FilePlanDeniedError);
  });
});
describe("ADR0007 transactional outbox design remains disconnected", () => {
  it("projects only allowlisted opaque metadata with no worker publication", () => {
    const plan = planP4SyntheticOutboxEvent({
      ...request, token: "secret", messageBody: "customer private document",
    } as P4OutboxRequest);
    assert.equal(plan.deliveryState, "not_scheduled");
    assert.equal(plan.canDispatch, false);
    assert.equal(plan.canPersist, false);
    assert.equal(plan.organizationId, org);
    assert.equal(Object.isFrozen(plan), true);
    assert.equal("token" in plan || "messageBody" in plan, false);
  });
  it("denies invalid event, malformed ID, untrusted server and unsafe idempotency token", () => {
    for (const bad of [
      { ...request, eventName: "billing.charge.card" },
      { ...request, serverResolved: false },
      { ...request, actorId: "user_demo_alice" },
      { ...request, organizationId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" },
      { ...request, aggregateRevision: 0 },
      { ...request, idempotencyKey: "raw card number: 4000-0000" },
    ]) {
      assert.throws(() => planP4SyntheticOutboxEvent(bad as P4OutboxRequest), P4OutboxPlanDeniedError);
    }
  });
});
