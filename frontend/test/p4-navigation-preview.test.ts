import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  P4_DEMO_APPS, p4FilterDemoApps, p4PreviewNavigationForRoute,
} from "../src/lib/p4-navigation-preview";

describe("P4.17–18 fictional app launcher and route manifest", () => {
  it("shows available and locked apps distinctly", () => {
    assert.deepEqual(P4_DEMO_APPS.map(a => [a.code, a.available]),
      [["crm",true],["teams",true],["finance",false],["files",false]]);
    assert.equal(p4PreviewNavigationForRoute("/app/sales/leads")?.code, "crm");
    assert.equal(p4PreviewNavigationForRoute("/app/finance"), null);
    assert.equal(p4PreviewNavigationForRoute("/app/files/download"), null);
    assert.equal(p4PreviewNavigationForRoute("/app/sales/leads/secret"), null);
  });
  it("supports case-insensitive launcher search without modifying the manifest", () => {
    assert.deepEqual(p4FilterDemoApps("SALES").map(a => a.code), ["crm"]);
    assert.deepEqual(p4FilterDemoApps("not enabled").map(a => a.code), ["finance"]);
    assert.deepEqual(p4FilterDemoApps("  " ), [...P4_DEMO_APPS]);
    assert.deepEqual(p4FilterDemoApps(null), []);
    assert.equal(Object.isFrozen(P4_DEMO_APPS), true);
  });
});
