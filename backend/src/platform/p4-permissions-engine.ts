import { SYNTHETIC_ORG_ID, type VerifiedSyntheticTenant } from "./p4-membership.js";
import {
  P4_PERMISSION_CODES, type P4PermissionCode, type P4RoleDefinition,
  reservedRole,
} from "./p4-roles-catalog.js";

/**
 * P4.13: deny-by-default RBAC + row ownership/ABAC.
 * This is NOT an Express route. Evidence must be resolved from the server's
 * verified identity, fresh active membership, role/permission DB tables and
 * record owner/department under an RLS-scoped SQL transaction.
 */
export type P4AccessDecision =
  Readonly<{ allowed: boolean; reason: "allowed" | "denied" }>;
export interface P4SyntheticPolicySnapshot {
  tenant: VerifiedSyntheticTenant;
  /** Must come from trusted DB membership/assignments and not JWT or browser. */
  serverResolved: true;
  roleDefinition: P4RoleDefinition;
}
export interface P4SyntheticRecord {
  orgId: string;
  recordId: string;
  ownerUserId: string;
  teamId?: string;
}
export interface P4SyntheticTeamAssignment {
  orgId: string;
  teamId: string;
  userId: string;
  active: true;
  teamManager: boolean;
}

const permissionSet = new Set<string>(P4_PERMISSION_CODES);
const DENIED: P4AccessDecision = Object.freeze({ allowed: false, reason: "denied" });
const ALLOWED: P4AccessDecision = Object.freeze({ allowed: true, reason: "allowed" });

export function authorizeSyntheticAction(
  snapshot: P4SyntheticPolicySnapshot | null,
  permission: unknown,
  record?: P4SyntheticRecord,
  teamAssignments: readonly P4SyntheticTeamAssignment[] = [],
): P4AccessDecision {
  if (!snapshot || snapshot.serverResolved !== true || snapshot.tenant.verified !== true ||
      !SYNTHETIC_ORG_ID.test(snapshot.tenant.orgId) ||
      !/^user_demo_[a-z]{2,16}$/.test(snapshot.tenant.userId) ||
      typeof permission !== "string" || !permissionSet.has(permission)) return DENIED;

  const role = snapshot.roleDefinition;
  if (!role || !Array.isArray(role.permissions) || role.permissions.some(p => !permissionSet.has(p))) {
    return DENIED;
  }
  // A reserved code may never bring in a modified client-provided template.
  if (role.reserved) {
    const builtIn = reservedRole(role.code);
    if (!builtIn || builtIn.permissions.length !== role.permissions.length ||
        builtIn.permissions.some(p => !role.permissions.includes(p))) return DENIED;
  } else if (!/^demo_[a-z][a-z0-9_]{2,30}$/.test(role.code)) return DENIED;

  // The MVP synthetic membership model only has OWNER/MEMBER; a custom role
  // must be evaluated from DB-assigned grants after P4.12 approval.
  if (role.reserved && role.code !== snapshot.tenant.role) return DENIED;
  if (!role.permissions.includes(permission as P4PermissionCode)) return DENIED;

  if (permission === "org.members.manage" && snapshot.tenant.role !== "OWNER") return DENIED;

  if (permission.startsWith("crm.leads.")) {
    if (!record || record.orgId !== snapshot.tenant.orgId ||
        !/^user_demo_[a-z]{2,16}$/.test(record.ownerUserId) ||
        !/^LEAD-DEMO-[0-9]{2,6}$/.test(record.recordId)) return DENIED;
    if ((permission === "crm.leads.read.own" || permission === "crm.leads.edit.own") &&
        record.ownerUserId !== snapshot.tenant.userId) return DENIED;
  }

  if (permission.startsWith("teams.")) {
    if (!record || record.orgId !== snapshot.tenant.orgId ||
        !record.teamId || !/^team_demo_[a-z]{2,24}$/.test(record.teamId)) return DENIED;
    const assignment = teamAssignments.find(m =>
      m.orgId === snapshot.tenant.orgId &&
      m.teamId === record.teamId &&
      m.userId === snapshot.tenant.userId &&
      m.active === true);
    if (!assignment || (permission === "teams.manage.assigned" && assignment.teamManager !== true)) {
      return DENIED;
    }
  }
  return ALLOWED;
}
