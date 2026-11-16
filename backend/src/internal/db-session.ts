import { InternalApiError } from "./contracts.js";
import type { PreviewAuthorization } from "./policy.js";

export interface PgResult {
  rows: Record<string, unknown>[];
  rowCount?: number | null;
}
export interface PgConnection {
  query(sql: string, params?: readonly unknown[]): Promise<PgResult>;
  release(): void;
}
export interface PgPoolLike {
  connect(): Promise<PgConnection>;
}

/**
 * P3.20: transaction-scoped RLS contexts. A verified membership/role decision
 * MUST be made before this function; this is NOT an identity verifier.
 *
 * Uses PostgreSQL set_config(..., true) instead of session-level SET so
 * a pooled connection cannot retain a previous tenant context after COMMIT.
 */
export async function withPreviewDbTransaction<T>(
  pool: PgPoolLike,
  context: PreviewAuthorization,
  operation: (conn: PgConnection) => Promise<T>,
): Promise<T> {
  if (context.actor.verified !== true ||
      context.actor.userId !== context.membership.userId ||
      context.orgId !== context.membership.orgId ||
      !context.membership.active ||
      !/^org_demo_[a-z]{2,16}$/.test(context.orgId) ||
      !/^user_demo_[a-z]{2,16}$/.test(context.actor.userId)) {
    throw new InternalApiError(403, "FORBIDDEN");
  }
  const conn = await pool.connect();
  let began = false;
  try {
    await conn.query("BEGIN");
    began = true;
    await conn.query(
      "SELECT set_config('app.tenant_id', $1, true), set_config('app.actor_id', $2, true)",
      [context.orgId, context.actor.userId],
    );
    const result = await operation(conn);
    await conn.query("COMMIT");
    return result;
  } catch (error) {
    if (began) {
      // Never replace original exception with unrelated rollback error.
      try { await conn.query("ROLLBACK"); } catch { /* preserve original error */ }
    }
    throw error;
  } finally {
    conn.release();
  }
}
