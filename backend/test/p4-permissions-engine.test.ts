import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authorizeSyntheticAction, type P4SyntheticPolicySnapshot,
  type P4SyntheticRecord,
} from "../src/platform/p4-permissions-engine.js";
import { reservedRole } from "../src/platform/p4-roles-catalog.js";

const aliceOwner: P4SyntheticPolicySnapshot = {
  serverResolved: true,
  tenant: { verified: true, orgId: "10000000-0000-4000-8000-000000000001", orgSlug: "demo-orchid",
    userId: "user_demo_alice", role: "OWNER" },
  roleDefinition: reservedRole("OWNER")!,
};
const bobMember: P4SyntheticPolicySnapshot = {
  serverResolved: true,
  tenant: { ...aliceOwner.tenant, userId: "user_demo_bob", role: "MEMBER" },
  roleDefinition: reservedRole("MEMBER")!,
};
const lead: P4SyntheticRecord = {
  orgId: aliceOwner.tenant.orgId, recordId: "LEAD-DEMO-201", ownerUserId: aliceOwner.tenant.userId,
};
const team: P4SyntheticRecord = {
  orgId: aliceOwner.tenant.orgId, recordId: "LEAD-DEMO-201",
  ownerUserId: aliceOwner.tenant.userId, teamId: "team_demo_sales",
};
const teamAssignments = [
  { orgId: aliceOwner.tenant.orgId, userId: aliceOwner.tenant.userId, teamId: "team_demo_sales", active: true as const, teamManager: true },
  { orgId: aliceOwner.tenant.orgId, userId: bobMember.tenant.userId, teamId: "team_demo_sales", active: true as const, teamManager: false },
];
const permit = (s: P4SyntheticPolicySnapshot | null, permission: string, r?: P4SyntheticRecord) =>
  authorizeSyntheticAction(s, permission, r, teamAssignments).allowed;

describe("P4.13 synthetic RBAC + record and team ABAC", () => {
  it("allows explicit tenant-scoped owner and reader privileges without a wildcard", () => {
    assert.equal(permit(aliceOwner, "org.members.read"), true);
    assert.equal(permit(aliceOwner, "org.members.manage"), true);
    assert.equal(permit(bobMember, "org.members.manage"), false);
    assert.equal(permit(bobMember, "crm.leads.read.own", { ...lead, ownerUserId: "user_demo_bob" }), true);
    assert.equal(permit(aliceOwner, "crm.leads.read.all", lead), true);
    assert.equal(permit(aliceOwner, "crm.leads.edit.own", lead), true);
  });
  it("never grants cross-org or non-owned record access even to a global OWNER template", () => {
    const other = { ...lead, orgId: "10000000-0000-4000-8000-000000000002" };
    assert.equal(permit(aliceOwner, "crm.leads.read.all", other), false);
    assert.equal(permit(aliceOwner, "crm.leads.edit.own", other), false);
    assert.equal(permit(aliceOwner, "crm.leads.edit.own", { ...lead, ownerUserId: "user_demo_bob" }), false);
    assert.equal(permit(bobMember, "crm.leads.read.own", lead), false);
    assert.equal(permit(aliceOwner, "crm.leads.read.all"), false);
  });
  it("requires current explicit team assignment and manager flag to manage team resources", () => {
    assert.equal(permit(aliceOwner, "teams.read.assigned", team), true);
    assert.equal(permit(aliceOwner, "teams.manage.assigned", team), true);
    assert.equal(permit(bobMember, "teams.read.assigned", team), true);
    assert.equal(permit(bobMember, "teams.manage.assigned", team), false);
    assert.equal(authorizeSyntheticAction(aliceOwner, "teams.manage.assigned", team, []).allowed, false);
    assert.equal(authorizeSyntheticAction(aliceOwner, "teams.manage.assigned",
      { ...team, orgId: "10000000-0000-4000-8000-000000000002" }, teamAssignments).allowed, false);
  });
  it("denies unverified context, unknown permission, forged reserved grants and wrong role", () => {
    assert.equal(permit(null, "org.members.read"), false);
    assert.equal(permit(aliceOwner, "*"), false);
    assert.equal(permit({ ...aliceOwner, serverResolved: false as never }, "org.members.read"), false);
    assert.equal(permit({ ...aliceOwner, tenant: { ...aliceOwner.tenant, verified: false as never } }, "org.members.read"), false);
    assert.equal(permit({
      ...bobMember, roleDefinition: { ...reservedRole("MEMBER")!, permissions: ["org.members.manage"] },
    }, "org.members.manage"), false);
    assert.equal(permit({ ...bobMember, roleDefinition: reservedRole("OWNER")! }, "org.members.manage"), false);
    assert.equal(permit({
      ...aliceOwner, roleDefinition: {
        code: "demo_admin", label: "Demo Admin", reserved: false,
        permissions: ["crm.leads.read.all"],
      },
    }, "crm.leads.read.all", lead), false);

  });
});
