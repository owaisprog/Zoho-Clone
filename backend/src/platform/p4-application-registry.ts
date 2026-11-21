import { SYNTHETIC_ORG_ID, type VerifiedSyntheticTenant } from "./p4-membership.js";
import { P4_PERMISSION_CODES, type P4PermissionCode } from "./p4-roles-catalog.js";

/**
 * P4.17: entitlement != authorization. Synthetic registry only; never
 * mount as real app routes until P6 billing/entitlements and verified
 * membership+permission checks are connected.
 */
export type P4AppCode = "crm" | "teams" | "finance" | "files";
export interface P4AppDefinition {
  code: P4AppCode;
  name: string;
  href: string;
  permissionRequired: P4PermissionCode | null;
}
export const P4_APP_DEFINITIONS: readonly P4AppDefinition[] = Object.freeze([
  Object.freeze({ code: "crm", name: "Sales CRM", href: "/app/sales/leads", permissionRequired: "crm.leads.read.own" }),
  Object.freeze({ code: "teams", name: "Teams", href: "/app/organization/access", permissionRequired: "teams.read.assigned" }),
  Object.freeze({ code: "finance", name: "Finance", href: "/app/finance", permissionRequired: null }),
  Object.freeze({ code: "files", name: "Files", href: "/app/files", permissionRequired: null }),
]);
export interface P4ApplicationGrant {
  orgId: string;
  appCode: P4AppCode;
  active: boolean;
}
export interface P4AppAccessEvidence {
  tenant: VerifiedSyntheticTenant;
  serverResolved: true;
  grants: readonly P4ApplicationGrant[];
  permissions: readonly P4PermissionCode[];
}
export interface P4AppAccessView extends P4AppDefinition {
  status: "available" | "locked";
}
export class P4ApplicationDeniedError extends Error {
  constructor() { super("P4_APPLICATION_ACCESS_DENIED"); }
}
function validateEvidence(e: P4AppAccessEvidence): boolean {
  if (!e || e.serverResolved !== true || !e.tenant ||
      e.tenant.verified !== true || !SYNTHETIC_ORG_ID.test(e.tenant.orgId) ||
      !/^user_demo_[a-z]{2,16}$/.test(e.tenant.userId) ||
      (e.tenant.role !== "OWNER" && e.tenant.role !== "MEMBER") ||
      !Array.isArray(e.grants) || e.grants.length > 32 ||
      !Array.isArray(e.permissions) || e.permissions.length > P4_PERMISSION_CODES.length)
    return false;
  const allowed = new Set<string>(P4_PERMISSION_CODES);
  if (e.permissions.some(p => !allowed.has(p))) return false;
  if (e.grants.some(g => g.orgId !== e.tenant.orgId ||
        !P4_APP_DEFINITIONS.some(a => a.code === g.appCode) ||
        typeof g.active !== "boolean")) return false;
  const unique = new Set(e.grants.map(g => g.appCode));
  return unique.size === e.grants.length;
}
export function p4ApplicationManifest(evidence: P4AppAccessEvidence): readonly P4AppAccessView[] {
  if (!validateEvidence(evidence)) throw new P4ApplicationDeniedError();
  return Object.freeze(P4_APP_DEFINITIONS.map(app => {
    const enabled = evidence.grants.some(g => g.appCode === app.code && g.active === true);
    const authorized = app.permissionRequired !== null &&
      evidence.permissions.includes(app.permissionRequired);
    // A locked app stays locked even with RBAC permissions if not entitled.
    return Object.freeze({ ...app, status: enabled && authorized ? "available" as const : "locked" as const });
  }));
}
export function requireP4ApplicationAccess(evidence: P4AppAccessEvidence, code: P4AppCode): void {
  const manifest = p4ApplicationManifest(evidence);
  if (manifest.find(app => app.code === code)?.status !== "available")
    throw new P4ApplicationDeniedError();
}
/** Only intended for a separate synthetic test application, not app.ts. */
export function p4AppCodeForPath(path: string): P4AppCode | null {
  const app = P4_APP_DEFINITIONS.find(a => a.href === path);
  return app?.code ?? null;
}
