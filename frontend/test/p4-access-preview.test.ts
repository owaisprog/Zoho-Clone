import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fictionalActionPreview, visibleFictionalTeams, FICTIONAL_ACCESS_MATRIX,
} from "../src/lib/p4-access-preview";

const base = { sameOrg: true, ownsRecord: true, memberActive: true,
  teamAssigned: true, teamManager: true };
describe("P4.12-15 fictional permission/team preview (not real access)", () => {
  it("allows only listed permissions, no wildcard or fabricated role", () => {
    assert.equal(FICTIONAL_ACCESS_MATRIX.OWNER.includes("org.members.manage"), true);
    assert.equal(FICTIONAL_ACCESS_MATRIX.MEMBER.includes("org.members.manage"), false);
    assert.equal(fictionalActionPreview("OWNER", "org.members.manage", base), true);
    assert.equal(fictionalActionPreview("MEMBER", "org.members.manage", base), false);
    assert.equal(fictionalActionPreview("MEMBER", "crm.leads.read.own", base), true);
    assert.equal(fictionalActionPreview("MEMBER", "crm.leads.read.own",
      { ...base, ownsRecord: false }), false);
    assert.equal(fictionalActionPreview("OWNER", "crm.leads.read.all",
      { ...base, sameOrg: false }), false);
  });
  it("immediately denies revoked memberships in preview", () => {
    for (const permission of FICTIONAL_ACCESS_MATRIX.OWNER) {
      assert.equal(fictionalActionPreview("OWNER", permission,
        { ...base, memberActive: false }), false);
    }
    assert.deepEqual(visibleFictionalTeams("user_demo_bob", "MEMBER", false), []);
  });
  it("shows a manager only their own fictional team", () => {
    assert.deepEqual(visibleFictionalTeams("user_demo_bob", "MEMBER", true).map(x => x.id),
      ["team_demo_sales"]);
    assert.equal(visibleFictionalTeams("user_demo_alice", "OWNER", true).length, 2);
    assert.deepEqual(visibleFictionalTeams("user_demo_eve", "MEMBER", true), []);
  });
});
