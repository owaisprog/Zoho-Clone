import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { advanceDemoApplication, nextDemoStage } from "../src/lib/demo-application-actions";
import { DEMO_APPLICATIONS } from "../src/lib/synthetic-data";

describe("P3.09 internal queue preview", () => {
  it("advances only an invented internal stage without mutating fixtures", () => {
    const before = DEMO_APPLICATIONS[0];
    const result = advanceDemoApplication(DEMO_APPLICATIONS, "APP-DEMO-101");
    assert.equal(result.ok, true);
    assert.equal(result.records[0]?.stage, "needs_more_info");
    assert.equal(result.records[0]?.updatedLabel, "Just now (demo)");
    assert.equal(DEMO_APPLICATIONS[0]?.stage, before?.stage);
  });
  it("blocks unknown IDs and the final internal stage", () => {
    assert.equal(advanceDemoApplication(DEMO_APPLICATIONS, "APP-REAL-1").ok, false);
    assert.equal(advanceDemoApplication(DEMO_APPLICATIONS, "APP-DEMO-105").ok, false);
    assert.equal(nextDemoStage("active_internal"), null);
  });
  it("never claims processor underwriting or payment activation", () => {
    const result = advanceDemoApplication(DEMO_APPLICATIONS, "APP-DEMO-103");
    assert.equal(result.ok, true);
    assert.ok(!/processor approved|payment enabled|underwriting approved/i.test(JSON.stringify(result)));
  });
});