import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fictionalOrganizationPreview, suggestFictionalSlug } from "../src/lib/p4-organization-preview";

describe("P4.05 fictional organization creation UI preview", () => {
  it("formats a safe demo slug without persisting or allocating an org", () => {
    const name = "Demo Maple Payments";
    const slug = suggestFictionalSlug(name);
    assert.equal(slug, "demo-maple-payments");
    assert.deepEqual(fictionalOrganizationPreview(name, slug), {
      name, slug, isValid: true,
    });
  });
  it("blocks real company names, traversal, reserved slugs and injected fields", () => {
    for (const [name, slug] of [
      ["Real Merchant", "demo-real"],
      ["Demo Maple Payments", "../admin"],
      ["Demo Maple Payments", "demo--maple"],
      ["Demo Maple Payments", "demo-admin"],
      ["Demo <script>alert(1)</script>", "demo-script"],
      ["Demo Maple Payments ", "demo-maple-payments"],
    ]) {
      assert.equal(fictionalOrganizationPreview(name, slug).isValid, false);
    }
  });
});
