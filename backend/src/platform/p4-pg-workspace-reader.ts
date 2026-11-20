import type { VerifiedSyntheticTenant } from "./p4-membership.js";
import { withSyntheticRlsTransaction, type ScopedPgPool } from "./p4-rls-transaction.js";

/**
 * P4 exit CI proof path: a restricted PostgreSQL role, fresh membership
 * SELECT and RLS-protected settings read inside ONE transaction. This is
 * deliberately not a public API and makes no customer-facing writes.
 */
export class P4WorkspaceReadDeniedError extends Error {
  constructor() { super("P4_WORKSPACE_READ_DENIED"); }
}
function rows(response: unknown): Record<string, unknown>[] {
  if (!response || typeof response !== "object" || !("rows" in response) ||
      !Array.isArray(response.rows)) throw new P4WorkspaceReadDeniedError();
  return response.rows as Record<string, unknown>[];
}
export async function readP4VerifiedWorkspaceSettings(
  pool: ScopedPgPool, tenant: VerifiedSyntheticTenant,
  expectedRestrictedDbRole: string,
): Promise<Readonly<{ orgId: string; name: string; locale: string; currency: string; timeZone: string }>> {
  if (!/^p4_synthetic_ci_runtime$/.test(expectedRestrictedDbRole)) {
    // Explicit CI-only role. Revisit for approved production runtime role.
    throw new P4WorkspaceReadDeniedError();
  }
  try {
    return await withSyntheticRlsTransaction(pool, tenant, async client => {
      const role = rows(await client.query(
        "SELECT current_user AS \"dbRole\", (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS \"privileged\"",
      ));
      if (role.length !== 1 || role[0]?.dbRole !== expectedRestrictedDbRole ||
          role[0]?.privileged !== false) throw new P4WorkspaceReadDeniedError();

      const memberships = rows(await client.query(
        "SELECT role, active FROM p4_synthetic.memberships WHERE org_id=$1::uuid AND user_id=$2",
        [tenant.orgId, tenant.userId],
      ));
      if (memberships.length !== 1 || memberships[0]?.active !== true ||
          memberships[0]?.role !== tenant.role) throw new P4WorkspaceReadDeniedError();

      const entries = rows(await client.query(
        "SELECT org_id::text AS \"orgId\",display_name AS name,locale,display_currency AS currency,time_zone AS \"timeZone\" FROM p4_synthetic.organization_settings WHERE org_id=$1::uuid",
        [tenant.orgId],
      ));
      const result = entries[0];
      if (entries.length !== 1 || !result || result.orgId !== tenant.orgId ||
          typeof result.name !== "string" || !/^Demo /.test(result.name) ||
          typeof result.locale !== "string" || typeof result.currency !== "string" ||
          typeof result.timeZone !== "string") throw new P4WorkspaceReadDeniedError();
      return Object.freeze({
        orgId: tenant.orgId, name: result.name, locale: result.locale,
        currency: result.currency, timeZone: result.timeZone,
      });
    });
  } catch { throw new P4WorkspaceReadDeniedError(); }
}
