import type { ScopedPgClient, ScopedPgPool } from "./p4-rls-transaction.js";
import { isCanonicalUuidV4 } from "./p4-approved-uuid.js";
import { withSyntheticRlsTransaction } from "./p4-rls-transaction.js";
import type { VerifiedSyntheticTenant } from "./p4-membership.js";
import {
  p4ApplicationManifest, requireP4ApplicationAccess,
  type P4AppAccessView, type P4AppCode, type P4ApplicationGrant,
} from "./p4-application-registry.js";
import {
  reservedRole, P4_PERMISSION_CODES, type P4PermissionCode,
} from "./p4-roles-catalog.js";

/**
 * P4 exit integration 02: read-only tenant data, using real RLS within one
 * transaction. CI role & schema are disposable-only, NOT production policy.
 * The tenant must be obtained from verified Auth0 identity and fresh membership.
 */
export class P4ReadModelDeniedError extends Error {
  constructor() { super("P4_READ_MODEL_DENIED"); }
}
const CI_ROLE = "p4_synthetic_ci_runtime" as const;
const CODES = new Set<string>(P4_PERMISSION_CODES);

function resultRows(value: unknown, max: number): Record<string, unknown>[] {
  if (!value || typeof value !== "object" || !("rows" in value) ||
      !Array.isArray(value.rows) || value.rows.length > max ||
      value.rows.some(row => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new P4ReadModelDeniedError();
  }
  return value.rows as Record<string, unknown>[];
}
async function verifiedRuntime(client: ScopedPgClient, tenant: VerifiedSyntheticTenant): Promise<void> {
  const role = resultRows(await client.query(
    'SELECT current_user AS "name", (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS "privileged"',
  ), 1);
  if (role.length !== 1 || role[0]?.name !== CI_ROLE || role[0]?.privileged !== false)
    throw new P4ReadModelDeniedError();
  const memberships = resultRows(await client.query(
    "SELECT role,active FROM p4_synthetic.memberships WHERE org_id=$1::uuid AND user_id=$2",
    [tenant.orgId, tenant.userId],
  ), 2);
  if (memberships.length !== 1 || memberships[0]?.role !== tenant.role ||
      memberships[0]?.active !== true) throw new P4ReadModelDeniedError();
}

export interface P4ReadOnlyNotification {
  id: string;
  category: "membership" | "task" | "system";
  href: string;
  read: boolean;
}
export interface P4ReadOnlyAttachment {
  id: string;
  label: string;
  mediaType: string;
  sizeBytes: number;
  lifecycle: "quarantined" | "scan_clean" | "rejected";
  downloadEnabled: false;
}
export interface P4ReadOnlyShell {
  orgId: string;
  apps: readonly P4AppAccessView[];
  navigation: readonly Readonly<{ code: P4AppCode; label: string; href: string }>[];
  notifications: readonly P4ReadOnlyNotification[];
  files: readonly P4ReadOnlyAttachment[];
}
function fail(): never { throw new P4ReadModelDeniedError(); }
function mapNotification(row: Record<string, unknown>): P4ReadOnlyNotification {
  if (typeof row.id !== "string" || !isCanonicalUuidV4(row.id) ||
      typeof row.category !== "string" || typeof row.read !== "boolean" ||
      typeof row.linkCode !== "string") return fail();
  const links = {
    membership: { code: "memberships", href: "/app/organization/memberships" },
    task: { code: "tasks", href: "/app/tasks" },
    system: { code: "settings", href: "/app/settings" },
  } as const;
  const category = row.category;
  if (!(category in links)) return fail();
  const link = links[category as keyof typeof links];
  if (row.linkCode !== link.code) return fail();
  return Object.freeze({
    id: row.id, category: category as P4ReadOnlyNotification["category"],
    href: link.href, read: row.read,
  });
}
function mapFile(row: Record<string, unknown>): P4ReadOnlyAttachment {
  if (typeof row.id !== "string" || !isCanonicalUuidV4(row.id) ||
      typeof row.label !== "string" || !/^Demo [A-Za-z0-9 .'-]{1,100}$/.test(row.label) ||
      typeof row.mediaType !== "string" ||
      !["application/pdf","image/jpeg","image/png","text/plain"].includes(row.mediaType) ||
      typeof row.sizeBytes !== "number" || !Number.isSafeInteger(row.sizeBytes) ||
      row.sizeBytes < 1 || row.sizeBytes > 10_485_760 ||
      (row.lifecycle !== "quarantined" && row.lifecycle !== "scan_clean" &&
       row.lifecycle !== "rejected")) return fail();
  return Object.freeze({
    id: row.id, label: row.label, mediaType: row.mediaType,
    sizeBytes: row.sizeBytes, lifecycle: row.lifecycle,
    downloadEnabled: false as const,
  });
}

export async function readP4SyntheticPlatformShell(
  pool: ScopedPgPool, tenant: VerifiedSyntheticTenant,
): Promise<Readonly<P4ReadOnlyShell>> {
  try {
    return await withSyntheticRlsTransaction(pool, tenant, async client => {
      await verifiedRuntime(client, tenant);
      const assigned = resultRows(await client.query(
        "SELECT ra.role_code AS code FROM p4_synthetic.role_assignments ra WHERE ra.org_id=$1::uuid AND ra.user_id=$2 AND ra.active",
        [tenant.orgId, tenant.userId],
      ), 4);
      if (assigned.length !== 1 || assigned[0]?.code !== tenant.role) return fail();
      const permissionsRows = resultRows(await client.query(
        'SELECT rp.permission_code AS code FROM p4_synthetic.role_permissions rp WHERE rp.org_id=$1::uuid AND rp.role_code=$2 ORDER BY rp.permission_code',
        [tenant.orgId, tenant.role],
      ), P4_PERMISSION_CODES.length + 1);
      const permissions: P4PermissionCode[] = [];
      for (const row of permissionsRows) {
        if (typeof row.code !== "string" || !CODES.has(row.code) ||
            permissions.includes(row.code as P4PermissionCode)) return fail();
        permissions.push(row.code as P4PermissionCode);
      }
      // Provisional reserved-role policy: no silently added/removed DB grants.
      const template = reservedRole(tenant.role);
      if (!template || permissions.length !== template.permissions.length ||
          template.permissions.some(code => !permissions.includes(code))) return fail();
      const grants = resultRows(await client.query(
        'SELECT app_code AS "appCode",active FROM p4_synthetic.app_grants WHERE org_id=$1::uuid ORDER BY app_code',
        [tenant.orgId],
      ), 32).map(row => {
        if (typeof row.appCode !== "string" || !["crm","teams","finance","files"].includes(row.appCode) ||
            typeof row.active !== "boolean") return fail();
        return { orgId: tenant.orgId, appCode: row.appCode as P4AppCode, active: row.active } satisfies P4ApplicationGrant;
      });
      const apps = p4ApplicationManifest({ serverResolved: true, tenant, grants, permissions });
      const navigation = Object.freeze(apps.filter(app => app.status === "available")
        .map(app => Object.freeze({ code: app.code, label: app.name, href: app.href })));
      const notices = Object.freeze(resultRows(await client.query(
        'SELECT id::text AS id,kind AS category,link_code AS "linkCode",(read_at IS NOT NULL) AS read FROM p4_synthetic.notifications WHERE org_id=$1::uuid AND recipient_user_id=$2 ORDER BY id LIMIT 30',
        [tenant.orgId, tenant.userId],
      ), 30).map(mapNotification));
      const files = Object.freeze(resultRows(await client.query(
        'SELECT id::text AS id,display_name AS label,mime AS "mediaType",size_bytes AS "sizeBytes",lifecycle FROM p4_synthetic.files WHERE org_id=$1::uuid AND owner_user_id=$2 ORDER BY id LIMIT 30',
        [tenant.orgId, tenant.userId],
      ), 30).map(mapFile));
      return Object.freeze({ orgId: tenant.orgId, apps, navigation, notifications: notices, files });
    });
  } catch { throw new P4ReadModelDeniedError(); }
}
/** Deny direct API route if no entitlement OR no role permission. */
export function authorizeP4DirectAppRoute(shell: P4ReadOnlyShell, code: unknown): void {
  if (!shell || !isCanonicalUuidV4(shell.orgId) || typeof code !== "string" ||
      !["crm","teams","finance","files"].includes(code)) return fail();
  // Re-check from the server-computed manifest, never a browser nav item.
  const matched = shell.apps.find(item => item.code === code);
  if (!matched || matched.status !== "available") return fail();
}
/** Owner-only redacted audit read. No raw before/after/identity payload. */
export async function readP4SyntheticOwnerAudit(
  pool: ScopedPgPool, tenant: VerifiedSyntheticTenant,
): Promise<readonly Readonly<{ id: string; action: string; objectType: string; before: "[REDACTED]"; after: "[REDACTED]" }>[]> {
  if (tenant?.role !== "OWNER") throw new P4ReadModelDeniedError();
  try {
    return await withSyntheticRlsTransaction(pool, tenant, async client => {
      await verifiedRuntime(client, tenant);
      const events = resultRows(await client.query(
        'SELECT event_id::text AS id,action,object_type AS "objectType",before_redacted AS before,after_redacted AS after FROM p4_synthetic.audit_logs WHERE org_id=$1::uuid ORDER BY created_at DESC LIMIT 50',
        [tenant.orgId],
      ), 50);
      const allowedActions = ["membership.revoked","org.preferences.changed","app.grant.changed","team.created","file.upload.requested"];
      return Object.freeze(events.map(row => {
        if (typeof row.id !== "string" || !isCanonicalUuidV4(row.id) ||
            typeof row.action !== "string" || !allowedActions.includes(row.action) ||
            typeof row.objectType !== "string" ||
            !["membership","organization","application","team","file"].includes(row.objectType) ||
            row.before !== "[REDACTED]" || row.after !== "[REDACTED]") return fail();
        return Object.freeze({
          id: row.id, action: row.action, objectType: row.objectType,
          before: "[REDACTED]" as const, after: "[REDACTED]" as const,
        });
      }));
    });
  } catch { throw new P4ReadModelDeniedError(); }
}
