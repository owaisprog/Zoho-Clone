import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { disabledStorage } from "../src/platform/storage.js";
import { StorageCandidateRejectedError, validatePrivateUploadCandidate } from "../src/platform/storage-policy.js";

const ctx = {
  organizationId: "org_demo_orchid",
  actorId: "user_demo_alice",
  recordType: "lead",
  recordId: "LEAD-DEMO-201",
  permissionVerified: true as const,
};
const valid = { name: "Demo document.pdf", mime: "application/pdf", sizeBytes: 120,
  sha256: "A".repeat(64) };

describe("P3.12 provider-neutral private upload policy", () => {
  it("validates metadata but still cannot grant real signed URLs", async () => {
    const candidate = validatePrivateUploadCandidate(ctx, valid);
    assert.equal(candidate.sha256, "a".repeat(64));
    assert.equal(Object.isFrozen(candidate), true);
    await assert.rejects(disabledStorage().prepareUpload(ctx, candidate), /Private storage is not configured/);
  });
  it("rejects unverified access, traversal, active content and oversized objects", () => {
    const invalid = [
      [ { ...ctx, permissionVerified: false as never }, valid ],
      [ ctx, { ...valid, name: "../private.pdf" } ],
      [ ctx, { ...valid, name: ".hidden" } ],
      [ ctx, { ...valid, name: "customer/secret.pdf" } ],
      [ ctx, { ...valid, mime: "image/svg+xml" } ],
      [ ctx, { ...valid, mime: "text/html" } ],
      [ ctx, { ...valid, sizeBytes: 0 } ],
      [ ctx, { ...valid, sizeBytes: 10 * 1024 * 1024 + 1 } ],
      [ ctx, { ...valid, sha256: "unsafe" } ],
    ] as const;
    for (const [context, candidate] of invalid) {
      assert.throws(() => validatePrivateUploadCandidate(context, candidate), StorageCandidateRejectedError);
    }
  });
});
