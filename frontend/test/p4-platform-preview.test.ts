import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  P4_DEMO_AUDIT, P4_FAKE_SETTINGS, p4DemoAuditFilter, p4DemoEffectiveTimeZone,
} from "../src/lib/p4-platform-preview";
describe("P4.16/19/20 fictional platform controls helpers", () => {
  it("shows correct user vs org timezone precedence", () => {
    assert.equal(p4DemoEffectiveTimeZone(null, P4_FAKE_SETTINGS.timeZone), "Asia/Karachi");
    assert.equal(p4DemoEffectiveTimeZone("America/New_York", P4_FAKE_SETTINGS.timeZone), "America/New_York");
    assert.equal(p4DemoEffectiveTimeZone("Invalid/Zone", P4_FAKE_SETTINGS.timeZone), "Asia/Karachi");
  });
  it("only filters static fictional redacted audit events", () => {
    assert.equal(p4DemoAuditFilter("all").length, 3);
    assert.deepEqual(p4DemoAuditFilter("team.created").map(e => e.id), ["audit-demo-01"]);
    assert.deepEqual(p4DemoAuditFilter("secret").map(e => e.id), []);
    assert.equal(P4_DEMO_AUDIT.every(e => e.before === "[REDACTED]" && e.after === "[REDACTED]"), true);
    assert.equal(Object.isFrozen(P4_DEMO_AUDIT), true);
  });
});
