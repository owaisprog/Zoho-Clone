import {
  SYNTHETIC_ORG_ID, type VerifiedSyntheticTenant,
} from "./p4-membership.js";

/**
 * P4.15 synthetic department/team service contracts.
 * No public /teams or /departments endpoints until P4.11-P4.14 roles,
 * actor mapping and read/write RLS have passed owner review.
 */
export interface SyntheticDepartment {
  id: string;
  orgId: string;
  name: string;
}
export interface SyntheticTeam {
  id: string;
  orgId: string;
  departmentId: string;
  name: string;
  managerUserId: string;
  active: boolean;
}
export interface SyntheticTeamMembership {
  orgId: string;
  teamId: string;
  userId: string;
  active: boolean;
}
export interface SyntheticTeamRepository {
  departmentsForOrg(orgId: string): Promise<readonly SyntheticDepartment[]>;
  teamsForOrg(orgId: string): Promise<readonly SyntheticTeam[]>;
  membershipsForUser(orgId: string, userId: string): Promise<readonly SyntheticTeamMembership[]>;
  /** Transaction must validate new manager is actively in *this* tenant. */
  transaction<T>(callback: (tx: {
    activeOrgMember(orgId: string, userId: string): Promise<boolean>;
    createTeam(team: SyntheticTeam): Promise<void>;
  }) => Promise<T>): Promise<T>;
}
export class P4TeamAccessDeniedError extends Error {
  constructor() { super("P4_TEAM_ACCESS_DENIED"); }
}

function verifyTenant(tenant: VerifiedSyntheticTenant): void {
  if (!tenant || tenant.verified !== true || !SYNTHETIC_ORG_ID.test(tenant.orgId) ||
      !/^user_demo_[a-z]{2,16}$/.test(tenant.userId) ||
      (tenant.role !== "OWNER" && tenant.role !== "MEMBER")) {
    throw new P4TeamAccessDeniedError();
  }
}
export async function listVisibleSyntheticTeams(
  tenant: VerifiedSyntheticTenant,
  repo: SyntheticTeamRepository,
): Promise<readonly SyntheticTeam[]> {
  verifyTenant(tenant);
  try {
    const [departments, teams, assignments] = await Promise.all([
      repo.departmentsForOrg(tenant.orgId),
      repo.teamsForOrg(tenant.orgId),
      repo.membershipsForUser(tenant.orgId, tenant.userId),
    ]);
    if (!Array.isArray(departments) || !Array.isArray(teams) ||
        !Array.isArray(assignments) || teams.length > 100) throw new P4TeamAccessDeniedError();
    const departmentIds = new Set(departments.filter(d => d.orgId === tenant.orgId).map(d => d.id));
    if (departments.some(d => d.orgId !== tenant.orgId) ||
        teams.some(t => t.orgId !== tenant.orgId) ||
        assignments.some(a => a.orgId !== tenant.orgId || a.userId !== tenant.userId)) {
      throw new P4TeamAccessDeniedError();
    }
    const assigned = new Set(assignments.filter(a => a.active === true).map(a => a.teamId));
    return Object.freeze(teams.filter(t =>
      t.active === true && departmentIds.has(t.departmentId) &&
      (tenant.role === "OWNER" || t.managerUserId === tenant.userId || assigned.has(t.id)))
      .map(t => Object.freeze({ ...t })));
  } catch {
    throw new P4TeamAccessDeniedError();
  }
}

export async function createSyntheticTeam(
  actor: VerifiedSyntheticTenant,
  input: unknown,
  repo: SyntheticTeamRepository,
): Promise<SyntheticTeam> {
  verifyTenant(actor);
  if (actor.role !== "OWNER" || !input || typeof input !== "object" || Array.isArray(input)) {
    throw new P4TeamAccessDeniedError();
  }
  const raw = input as Record<string, unknown>;
  if (Object.keys(raw).sort().join(",") !== "departmentId,id,managerUserId,name" ||
      typeof raw.id !== "string" || !/^team_demo_[a-z]{2,24}$/.test(raw.id) ||
      typeof raw.departmentId !== "string" || !/^dept_demo_[a-z]{2,24}$/.test(raw.departmentId) ||
      typeof raw.managerUserId !== "string" ||
      !/^user_demo_[a-z]{2,16}$/.test(raw.managerUserId) ||
      typeof raw.name !== "string" || !/^Demo [A-Za-z][A-Za-z0-9 &' -]{2,47}$/.test(raw.name)) {
    throw new P4TeamAccessDeniedError();
  }
  const team: SyntheticTeam = Object.freeze({
    id: raw.id, orgId: actor.orgId, departmentId: raw.departmentId,
    managerUserId: raw.managerUserId, name: raw.name, active: true,
  });
  try {
    const departments = await repo.departmentsForOrg(actor.orgId);
    if (departments.some(d => d.orgId !== actor.orgId) ||
        !departments.some(d => d.id === team.departmentId)) throw new P4TeamAccessDeniedError();
    return await repo.transaction(async tx => {
      if (!await tx.activeOrgMember(actor.orgId, team.managerUserId)) throw new P4TeamAccessDeniedError();
      await tx.createTeam(team);
      return team;
    });
  } catch {
    throw new P4TeamAccessDeniedError();
  }
}
