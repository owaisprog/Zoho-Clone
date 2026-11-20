import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  P4_OPERATIONS_FILE, P4_OPERATIONS_NOTICES, markFakeNoticeRead, simulateFakeClosure,
} from "../src/lib/p4-operations-preview";
describe("P4.21-25 browser-only preview helpers", () => {
  it("never grants file access", () => {
    assert.equal(P4_OPERATIONS_FILE.downloadEnabled, false);
    assert.equal(P4_OPERATIONS_FILE.deleteEnabled, false);
    assert.equal("signedUrl" in P4_OPERATIONS_FILE, false);
  });
  it("marks only one fictional notice locally and preserves the original", () => {
    const next = markFakeNoticeRead(P4_OPERATIONS_NOTICES, "notice_demo_invite01");
    assert.equal(next[0]?.read, true);
    assert.equal(next[1]?.read, false);
    assert.equal(P4_OPERATIONS_NOTICES[0]?.read, false);
    assert.equal(Object.isFrozen(next), true);
  });
  it("cannot create an export or deletion job for any choice", () => {
    for (const intent of ["export", "closure"] as const) {
      for (const deps of [true, false]) {
        const result = simulateFakeClosure(intent, deps);
        assert.equal(result.runnable, false);
        assert.equal(result.jobsCreated, 0);
      }
    }
  });
});
