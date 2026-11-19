import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FICTIONAL_WORKSPACES, chooseFictionalWorkspace, normalizeFictionalInvite,
} from "../src/lib/p4-membership-preview";

describe("P4.06–10 demo-only memberships and invitations UI helpers", () => {
  it("selects only prelisted active demo orgs and preserves per-org roles", () => {
    const maple = chooseFictionalWorkspace(FICTIONAL_WORKSPACES[0].orgId);
    const cedar = chooseFictionalWorkspace(FICTIONAL_WORKSPACES[1].orgId);
    assert.equal(maple?.role, "OWNER");
    assert.equal(cedar?.role, "MEMBER");
    assert.equal(chooseFictionalWorkspace("demo-cedar"), null);
    assert.equal(chooseFictionalWorkspace("10000000-0000-4000-8000-000000000009"), null);
    assert.equal(chooseFictionalWorkspace(FICTIONAL_WORKSPACES[0].orgId,
      [{ ...FICTIONAL_WORKSPACES[0], active: false as never }]), null);
  });
  it("only validates fake example.com invitation drafts for selected OWNER role", () => {
    const maple = FICTIONAL_WORKSPACES[0], cedar = FICTIONAL_WORKSPACES[1];
    assert.equal(normalizeFictionalInvite("Demo.Member@Example.com", maple), "demo.member@example.com");
    assert.equal(normalizeFictionalInvite("test@example.com", cedar), null);
    assert.equal(normalizeFictionalInvite("real@company.com", maple), null);
    assert.equal(normalizeFictionalInvite(" test@example.com ", maple), null);
    assert.equal(normalizeFictionalInvite("demo@example.com\nx-role:ADMIN", maple), null);
  });
});
