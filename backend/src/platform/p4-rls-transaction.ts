/**
 * P4.11: a restricted-role PostgreSQL transaction boundary. This is a
 * provider-neutral implementation seam, NOT connected to the public API.
 * Only a server-verified identity + freshly resolved active org membership
 * may call it. PostgreSQL must enforce FORCE RLS and the role must never
 * own tenant tables, be superuser, or have BYPASSRLS.
 */
import {
  SYNTHETIC_ORG_ID, type VerifiedSyntheticTenant,
} from "./p4-membership.js";

export interface ScopedPgClient {
  query(sql: string, values?: readonly string[]): Promise<unknown>;
  release(): void;
}
export interface ScopedPgPool {
  connect(): Promise<ScopedPgClient>;
}
export class P4DatabaseScopeDeniedError extends Error {
  constructor() { super("P4_DATABASE_SCOPE_DENIED"); }
}

export async function withSyntheticRlsTransaction<T>(
  pool: ScopedPgPool,
  context: VerifiedSyntheticTenant,
  operation: (client: ScopedPgClient) => Promise<T>,
): Promise<T> {
  if (!context || context.verified !== true ||
      !SYNTHETIC_ORG_ID.test(context.orgId) ||
      !/^user_demo_[a-z]{2,16}$/.test(context.userId) ||
      !/^demo-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(context.orgSlug) ||
      (context.role !== "OWNER" && context.role !== "MEMBER")) {
    throw new P4DatabaseScopeDeniedError();
  }
  let client: ScopedPgClient;
  try {
    client = await pool.connect();
  } catch {
    throw new P4DatabaseScopeDeniedError();
  }
  let began = false;
  try {
    await client.query("BEGIN");
    began = true;
    // set_config(..., true) is transaction-local, not session-global.
    // Explicit parameter binding prevents tenant or actor SQL injection.
    await client.query("SELECT set_config('app.actor_id', $1, true)", [context.userId]);
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [context.orgId]);
    const value = await operation(client);
    await client.query("COMMIT");
    return value;
  } catch {
    if (began) {
      try { await client.query("ROLLBACK"); }
      catch { /* never replace the safe constant error with DB details */ }
    }
    throw new P4DatabaseScopeDeniedError();
  } finally {
    client.release();
  }
}
