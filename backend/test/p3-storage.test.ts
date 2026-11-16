import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { disabledStorage, StorageNotConfiguredError } from "../src/platform/storage.js";

describe("P3.12 private object storage boundary", () => {
  const context = {
    organizationId: "org_demo_orchid",
    actorId: "user_demo_alice",
    recordType: "lead",
    recordId: "LEAD-DEMO-201",
    permissionVerified: true as const,
  };
  it("does not issue upload grants without approved provider", async () => {
    await assert.rejects(
      disabledStorage().prepareUpload(context, {
        name: "fictional.txt", mime: "text/plain", sizeBytes: 20, sha256: "demo-only",
      }),
      StorageNotConfiguredError,
    );
  });
  it("does not issue download grants or delete objects without provider", async () => {
    await assert.rejects(disabledStorage().prepareDownload(context, "obj_demo_a"), StorageNotConfiguredError);
    await assert.rejects(disabledStorage().deleteObject(context, "obj_demo_a"), StorageNotConfiguredError);
  });
});
