import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inspectP4SyntheticUpload, prepareP4SyntheticUpload,
  requireP4ScannedPrivateFile, P4UploadDeniedError,
  P4UploadNotConfiguredError,
} from "../src/platform/p4-file-upload.js";
const org = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const tenant = { verified: true as const, orgId: org, orgSlug: "demo-orchid",
  userId: "user_demo_alice", role: "OWNER" as const };
const record = { orgId: org, ownerUserId: tenant.userId, recordType: "lead" as const,
  recordId: "LEAD-DEMO-201", canAttach: true as const };
const file = { name: "Demo document.pdf", mime: "application/pdf",
  sizeBytes: 128, sha256: "a".repeat(64) };
describe("P4.20 private file upload candidate and deny-by-default provider", () => {
  it("validates fictional same-org same-owner metadata without generating an object URL", () => {
    const result = inspectP4SyntheticUpload(tenant, record, file);
    assert.equal(result.orgId, org);
    assert.equal(result.status, "pending_provider_approval");
    assert.equal("uploadUrl" in result, false);
    assert.equal("objectKey" in result, false);
    assert.equal("signedUrl" in result, false);
  });
  it("rejects cross-tenant, unowned, unverified and unsupported file metadata", () => {
    const bad = [
      [tenant, { ...record, orgId: other }, file],
      [tenant, { ...record, ownerUserId: "user_demo_bob" }, file],
      [tenant, { ...record, canAttach: false as never }, file],
      [{ ...tenant, verified: false as never }, record, file],
      [tenant, record, { ...file, mime: "text/html" }],
      [tenant, record, { ...file, name: "../secret.pdf" }],
      [tenant, record, { ...file, sizeBytes: 100_000_000 }],
      [tenant, record, { ...file, sha256: "invalid" }],
    ] as const;
    for(const [ctx, ownership, draft] of bad)
      assert.throws(() => inspectP4SyntheticUpload(ctx, ownership, draft), P4UploadDeniedError);
  });
  it("does not issue a signed upload or download URL, even for a verified owner and clean scan", async () => {
    await assert.rejects(prepareP4SyntheticUpload(tenant, record, file), P4UploadNotConfiguredError);
    assert.throws(() => requireP4ScannedPrivateFile(tenant,
      { orgId: org, ownerUserId: tenant.userId, scanStatus: "clean" }),
      P4UploadNotConfiguredError);
    assert.throws(() => requireP4ScannedPrivateFile(tenant,
      { orgId: other, ownerUserId: "user_demo_bob", scanStatus: "clean" }),
      P4UploadNotConfiguredError);
  });
});
