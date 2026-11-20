import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSyntheticTeam, listVisibleSyntheticTeams, P4TeamAccessDeniedError,
  type SyntheticTeamRepository, type SyntheticTeam,
} from "../src/platform/p4-teams.js";

const orchid = "10000000-0000-4000-8000-000000000001";
const cedar = "10000000-0000-4000-8000-000000000002";
const owner = { verified: true as const, orgId: orchid, orgSlug: "demo-orchid",
  userId: "user_demo_alice", role: "OWNER" as const };
const manager = { ...owner, userId: "user_demo_bob", role: "MEMBER" as const };
const otherManager = { ...owner, userId: "user_demo_carla", role: "MEMBER" as const };

function fixture() {
  const departments = [
    { id: "dept_demo_sales", orgId: orchid, name: "Demo Sales" },
    { id: "dept_demo_support", orgId: orchid, name: "Demo Support" },
    { id: "dept_demo_sales", orgId: cedar, name: "Demo Cedar Sales" },
  ];
  let teams: SyntheticTeam[] = [
    { id: "team_demo_sales", orgId: orchid, departmentId: "dept_demo_sales",
      name: "Demo Sales Team", managerUserId: manager.userId, active: true },
    { id: "team_demo_support", orgId: orchid, departmentId: "dept_demo_support",
      name: "Demo Support Team", managerUserId: otherManager.userId, active: true },
    { id: "team_demo_cedar", orgId: cedar, departmentId: "dept_demo_sales",
      name: "Demo Cedar Team", managerUserId: otherManager.userId, active: true },
  ];
  const members = [
    { orgId: orchid, teamId: "team_demo_sales", userId: manager.userId, active: true },
    { orgId: orchid, teamId: "team_demo_support", userId: otherManager.userId, active: true },
  ];
  const repo: SyntheticTeamRepository = {
    async departmentsForOrg(id) { return departments.filter(d => d.orgId === id); },
    async teamsForOrg(id) { return teams.filter(t => t.orgId === id); },
    async membershipsForUser(id, uid) { return members.filter(m => m.orgId === id && m.userId === uid); },
    async transaction(callback) {
      const shadow = [...teams];
      const answer = await callback({
        async activeOrgMember(id, uid) {
          return id === orchid && ["user_demo_alice", "user_demo_bob", "user_demo_carla"].includes(uid);
        },
        async createTeam(team) {
          if (shadow.some(t => t.id === team.id && t.orgId === team.orgId)) throw new Error("Duplicate team");
          shadow.push(team);
        },
      });
      teams = shadow;
      return answer;
    },
  };
  return { repo, teams: () => teams };
}
describe("P4.15 org-scoped teams and departments", () => {
  it("restricts a manager to their own assigned team and never returns another organization's teams", async () => {
    const f = fixture();
    assert.deepEqual((await listVisibleSyntheticTeams(manager, f.repo)).map(t => t.id), ["team_demo_sales"]);
    assert.deepEqual((await listVisibleSyntheticTeams(otherManager, f.repo)).map(t => t.id), ["team_demo_support"]);
    assert.deepEqual((await listVisibleSyntheticTeams(owner, f.repo)).map(t => t.id),
      ["team_demo_sales", "team_demo_support"]);
  });
  it("allows a synthetic OWNER to create a team with an active same-organization manager", async () => {
    const f = fixture();
    const t = await createSyntheticTeam(owner, {
      id: "team_demo_growth", departmentId: "dept_demo_sales",
      managerUserId: manager.userId, name: "Demo Growth Team",
    }, f.repo);
    assert.equal(t.orgId, orchid);
    assert.equal(t.active, true);
    assert.equal(f.teams().length, 4);
  });
  it("denies member-created team, forged organization/manager and unknown department", async () => {
    const f = fixture();
    const valid = { id: "team_demo_growth", departmentId: "dept_demo_sales",
      managerUserId: manager.userId, name: "Demo Growth Team" };
    await assert.rejects(createSyntheticTeam(manager, valid, f.repo), P4TeamAccessDeniedError);
    await assert.rejects(createSyntheticTeam(owner, { ...valid, orgId: cedar }, f.repo), P4TeamAccessDeniedError);
    await assert.rejects(createSyntheticTeam(owner, { ...valid, managerUserId: "user_demo_eve" }, f.repo),
      P4TeamAccessDeniedError);
    await assert.rejects(createSyntheticTeam(owner, { ...valid, departmentId: "dept_demo_unknown" }, f.repo),
      P4TeamAccessDeniedError);
    await assert.rejects(createSyntheticTeam({ ...owner, verified: false as never }, valid, f.repo),
      P4TeamAccessDeniedError);
    assert.equal(f.teams().length, 3);
  });
  it("fails closed if a repository returns cross-tenant rows", async () => {
    const f = fixture();
    const attack: SyntheticTeamRepository = {
      ...f.repo,
      async teamsForOrg() { return f.teams(); },
    };
    await assert.rejects(listVisibleSyntheticTeams(manager, attack), P4TeamAccessDeniedError);
  });
});
