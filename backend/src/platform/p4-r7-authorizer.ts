/**
 * P4 Batch 07 — executable subset of the OWNER-APPROVED P1.06 matrix.
 *
 * This is a pure, READ-ONLY, synthetic decision helper, not the source
 * of current membership/role grants. Inputs MUST originate from fresh,
 * verified server DB evidence; callers cannot rely on JWT claims or UI.
 * The original 286-row matrix is authoritative for design; no policy
 * outside the implemented resource/field allowlists is enabled here.
 *
 * In particular ORG_OWNER/ORG_ADMIN are NOT implicit CRM data readers.
 */
import {
  P4_R7_P106_POLICY_ROWS, P4_R7_P106_ROLES,
  P4_R7_P106_RESOURCES,
} from "./p4-r7-approved-policy-matrix.js";
import { isCanonicalUuidV4 } from "./p4-approved-uuid.js";

export type P4R7Role = (typeof P4_R7_P106_ROLES)[number];
export type P4R7Resource = (typeof P4_R7_P106_RESOURCES)[number];
export type P4R7Action = "C" | "R" | "U" | "E" | "M";
export type P4R7Decision = Readonly<{
  allowed: boolean;
  reason: "allowed" | "denied";
  fields: readonly string[];
}>;
export type P4R7TeamGrant = Readonly<{
  organizationId: string;
  teamId: string;
  userId: string;
  active: true;
  managed: boolean;
}>;
export type P4R7Evidence = Readonly<{
  serverResolved: true;
  verifiedIdentity: true;
  activeMembership: true;
  organizationActive: true;
  organizationId: string;
  actorId: string;
  roleCodes: readonly P4R7Role[];
  enabledApps: readonly string[];
  activeTeamGrants: readonly P4R7TeamGrant[];
}>;
export type P4R7Record = Readonly<{
  organizationId: string;
  id: string;
  ownerUserId: string;
  teamId: string;
  /** "private" is the P1.06 default. The team link alone is not enough. */
  shareState: "private" | "explicit_team";
  /** Server-resolved direct grants, not an input from a browser. */
  assignedUserIds: readonly string[];
}>;
const DENIED: P4R7Decision = Object.freeze({
  allowed: false, reason: "denied", fields: Object.freeze([]),
});
const LEAD_FIELDS = Object.freeze(["id", "displayName"] as const);
const ORG_FIELDS = Object.freeze(["id", "displayName"] as const);
const AUDIT_FIELDS = Object.freeze(["id", "action", "occurredAt"] as const);
const KNOWN_ROLES: ReadonlySet<string> = new Set(P4_R7_P106_ROLES);
const KNOWN_RESOURCES: ReadonlySet<string> = new Set(P4_R7_P106_RESOURCES);
const ACTS: ReadonlySet<string> = new Set(["C","R","U","E","M"]);

export function getP4R7ApprovedMatrixRow(role: unknown, resource: unknown) {
  if (typeof role !== "string" || !KNOWN_ROLES.has(role) ||
      typeof resource !== "string" || !KNOWN_RESOURCES.has(resource)) return null;
  return P4_R7_P106_POLICY_ROWS.find(row =>
    row.role === role && row.resource === resource) ?? null;
}
function verifiedEvidence(input: P4R7Evidence | null): input is P4R7Evidence {
  if (!input || input.serverResolved !== true ||
      input.verifiedIdentity !== true ||
      input.activeMembership !== true ||
      input.organizationActive !== true ||
      !isCanonicalUuidV4(input.actorId) ||
      !isCanonicalUuidV4(input.organizationId) ||
      !Array.isArray(input.roleCodes) || input.roleCodes.length < 1 ||
      input.roleCodes.length > P4_R7_P106_ROLES.length ||
      new Set(input.roleCodes).size !== input.roleCodes.length ||
      input.roleCodes.some(r => !KNOWN_ROLES.has(r)) ||
      !Array.isArray(input.enabledApps) ||
      !Array.isArray(input.activeTeamGrants) ||
      input.activeTeamGrants.length > 100 ||
      input.activeTeamGrants.some(t => t.active !== true ||
        t.organizationId !== input.organizationId ||
        t.userId !== input.actorId || !isCanonicalUuidV4(t.teamId) ||
        typeof t.managed !== "boolean") ||
      new Set(input.activeTeamGrants.map(t => t.teamId)).size !== input.activeTeamGrants.length
  ) return false;
  return true;
}
function validRecord(input: P4R7Record | undefined, evidence: P4R7Evidence): input is P4R7Record {
  if (!input || input.organizationId !== evidence.organizationId ||
      !isCanonicalUuidV4(input.id) || !isCanonicalUuidV4(input.ownerUserId) ||
      !isCanonicalUuidV4(input.teamId) ||
      (input.shareState !== "private" && input.shareState !== "explicit_team") ||
      !Array.isArray(input.assignedUserIds) ||
      input.assignedUserIds.length > 100 ||
      new Set(input.assignedUserIds).size !== input.assignedUserIds.length ||
      input.assignedUserIds.some(x => !isCanonicalUuidV4(x))) return false;
  return true;
}
function checkLeadScope(
  rowScope: string, input: P4R7Evidence, rec: P4R7Record,
): boolean {
  const owns = rec.ownerUserId === input.actorId;
  const assignedDirectly = rec.assignedUserIds.includes(input.actorId);
  const currentTeam = input.activeTeamGrants.find(t => t.teamId === rec.teamId);
  const explicitlySharedTeam = rec.shareState === "explicit_team" && !!currentTeam;
  switch (rowScope) {
    case "TEAM_RECORDS":
      // Management permission comes from current approved team manager grant;
      // a displayed "manager" title or owner membership is insufficient.
      return !!currentTeam?.managed && rec.shareState === "explicit_team";
    case "OWN_OR_ASSIGNED_TEAM_RECORDS":
      return owns || assignedDirectly || explicitlySharedTeam;
    default:
      return false;
  }
}
/**
 * Enforce the P1.06 matrix intersected with active tenant, app,
 * record/team/assignment scope and strict field allowlist.
 * Non-read or unimplemented domains stay denied until their dedicated
 * domain + DB policy and owner acceptance are implemented.
 */
export function authorizeP4R7Synthetic(
  input: P4R7Evidence | null, resource: unknown, action: unknown,
  rec?: P4R7Record,
  requestedFields: readonly string[] = [],
): P4R7Decision {
  if (!verifiedEvidence(input) || typeof resource !== "string" ||
      !KNOWN_RESOURCES.has(resource) ||
      typeof action !== "string" || !ACTS.has(action) ||
      action !== "R" || !Array.isArray(requestedFields) ||
      requestedFields.length === 0 || requestedFields.length > 12 ||
      requestedFields.some(f => typeof f !== "string") ||
      new Set(requestedFields).size !== requestedFields.length) return DENIED;

  let safeFields: readonly string[];
  let app: string;
  if (resource === "leads") { safeFields = LEAD_FIELDS; app = "crm"; }
  else if (resource === "organization") { safeFields = ORG_FIELDS; app = "platform"; }
  else if (resource === "audit_events") { safeFields = AUDIT_FIELDS; app = "platform"; }
  else return DENIED;
  if (!input.enabledApps.includes(app) ||
      requestedFields.some(f => !safeFields.includes(f))) return DENIED;

  if (resource === "leads" && !validRecord(rec,input)) return DENIED;
  if (resource !== "leads" && rec !== undefined) return DENIED;

  for (const role of input.roleCodes) {
    const matrix = getP4R7ApprovedMatrixRow(role,resource);
    if (!matrix || !matrix.actions.some(a => a === action)) continue;
    if (resource === "leads") {
      if (!rec || !checkLeadScope(matrix.rowScope,input,rec)) continue;
    } else if (matrix.rowScope !== "OWN_ORG") continue;
    return Object.freeze({
      allowed: true, reason: "allowed",
      fields: Object.freeze(requestedFields.slice()),
    });
  }
  return DENIED;
}
export class P4R7PolicyDeniedError extends Error {
  constructor() { super("P4_R7_POLICY_DENIED"); }
}
/** The only safe response projection in Batch 07. Never spread a DB record. */
export function projectP4R7SyntheticLead(
  decision: P4R7Decision,
  record: Readonly<{ id: string; displayName: string; [key: string]: unknown }>,
): Readonly<{ id: string; displayName: string }> {
  if (decision?.allowed !== true ||
      decision.fields.length !== 2 ||
      !decision.fields.includes("id") ||
      !decision.fields.includes("displayName") ||
      !record || !isCanonicalUuidV4(record.id) ||
      typeof record.displayName !== "string" ||
      !/^Demo [A-Za-z0-9 ]{3,70}$/.test(record.displayName)) {
    throw new P4R7PolicyDeniedError();
  }
  return Object.freeze({ id: record.id, displayName: record.displayName });
}
