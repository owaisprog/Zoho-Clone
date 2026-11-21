import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  P4_PERMISSION_CODES, reservedRole, validateSyntheticCustomRoleDraft, P4RoleDefinitionDeniedError,
} from "../src/platform/p4-roles-catalog.js";

describe("P4.12 reserved and custom roles catalogue", () => {
  it("provides immutable OWNER and MEMBER templates without wildcard privileges", () => {
    const owner = reservedRole("OWNER")!;
    const member = reservedRole("MEMBER")!;
    assert.equal(owner.reserved, true);
    assert.equal(member.reserved, true);
    assert.equal(owner.permissions.length, P4_PERMISSION_CODES.length);
    assert.equal(owner.permissions.includes("org.members.manage"), true);
    assert.equal(member.permissions.includes("org.members.manage"), false);
    assert.equal(member.permissions.includes("crm.leads.read.own"), true);
    assert.equal(Object.isFrozen(owner.permissions), true);
    assert.equal(reservedRole("SUPER_ADMIN"), null);
    assert.equal(reservedRole("demo_admin"), null);
  });
  it("validates a custom role with only the explicitly supported low-risk permissions", () => {
    const role = validateSyntheticCustomRoleDraft({
      code: "demo_sales_viewer", label: "Demo Sales Viewer",
      permissions: ["crm.leads.read.own", "teams.read.assigned"],
    });
    assert.equal(role.code, "demo_sales_viewer");
    assert.equal(role.reserved, false);
    assert.equal(Object.isFrozen(role.permissions), true);
    assert.deepEqual(role.permissions, ["crm.leads.read.own", "teams.read.assigned"]);
  });
  it("rejects reserved edits, role injection, duplicate grants and unsupported escalation", () => {
    for (const raw of [
      { code: "OWNER", label: "Demo Owner", permissions: ["org.members.manage"] },
      { code: "demo_owner", label: "Demo Owner", permissions: ["org.members.manage"] },
      { code: "demo_super_admin", label: "Demo Super", permissions: ["*"] },
      { code: "demo_x", label: "Demo X", permissions: ["crm.leads.read.all"] },
      { code: "demo_x", label: "Demo X", permissions: ["crm.leads.read.own", "crm.leads.read.own"] },
      { code: "demo_x", label: "<script>", permissions: ["org.members.read"] },
      { code: "demo_x", label: "Demo X", permissions: ["org.members.read"], orgId: "another" },
      { code: "demo_x", label: "Demo X", permissions: [] },
      { code: "demo_x", label: "Demo X", permissions: ["teams.manage.assigned"] },
      null,
    ]) assert.throws(() => validateSyntheticCustomRoleDraft(raw), P4RoleDefinitionDeniedError);
  });
});
