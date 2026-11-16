import { InternalApiError, type LeadDetail } from "./contracts.js";
import type { PreviewAuthorization } from "./policy.js";
import { withPreviewDbTransaction, type PgPoolLike, type PgResult } from "./db-session.js";

function validateProjectedRows(result: PgResult, canReadContact: boolean): LeadDetail[] {
  if (result.rows.length > 100) throw new InternalApiError(503, "FORBIDDEN");
  return result.rows.map(row => {
    if (typeof row.id !== "string" || !/^LEAD-DEMO-\d{3}$/.test(row.id) ||
        typeof row.organization !== "string" || !row.organization.includes("Demo") ||
        (row.stage !== "new" && row.stage !== "contacted" && row.stage !== "qualified") ||
        typeof row.version !== "number" || !Number.isSafeInteger(row.version) || row.version < 1) {
      throw new InternalApiError(503, "FORBIDDEN");
    }
    const projected: LeadDetail = {
      id: row.id, organization: row.organization,
      stage: row.stage, version: row.version,
    };
    if (canReadContact) {
      if (typeof row.contact !== "string" || !row.contact.startsWith("Example ") ||
          typeof row.email !== "string" || !row.email.endsWith("@example.com")) {
        throw new InternalApiError(503, "FORBIDDEN");
      }
      projected.contact = row.contact;
      projected.email = row.email;
    }
    return projected;
  });
}

/**
 * P3.20: parameterized PostgreSQL read query adapter, deliberately not
 * instantiated by the default API. Future approved pool may be injected.
 * RLS adds tenant protection, SQL adds tenant/owner predicates,
 * and projections select only permitted contact fields.
 */
export class ScopedSqlLeadReader {
  constructor(private readonly pool: PgPoolLike) {}

  async list(ctx: PreviewAuthorization): Promise<{ data: LeadDetail[]; count: number }> {
    return withPreviewDbTransaction(this.pool, ctx, async connection => {
      const contactCols = ctx.canReadContact ? ", contact, email" : "";
      const sql = "SELECT id, organization, stage, version" + contactCols +
        " FROM synthetic.leads WHERE org_id = $1 AND (owner_id = $2 OR $3::boolean)" +
        " ORDER BY id LIMIT 100";
      const result = await connection.query(sql, [
        ctx.orgId, ctx.actor.userId, ctx.membership.scope === "all",
      ]);
      const data = validateProjectedRows(result, ctx.canReadContact);
      return { data, count: data.length };
    });
  }

  async read(ctx: PreviewAuthorization, leadId: string): Promise<LeadDetail> {
    if (!/^LEAD-DEMO-\d{3}$/.test(leadId)) throw new InternalApiError(404,"NOT_FOUND");
    return withPreviewDbTransaction(this.pool, ctx, async connection => {
      const contactCols = ctx.canReadContact ? ", contact, email" : "";
      const result = await connection.query(
        "SELECT id, organization, stage, version" + contactCols +
        " FROM synthetic.leads WHERE org_id = $1 AND id = $2" +
        " AND (owner_id = $3 OR $4::boolean) LIMIT 1",
        [ctx.orgId, leadId, ctx.actor.userId, ctx.membership.scope === "all"],
      );
      const data = validateProjectedRows(result, ctx.canReadContact);
      if (data.length !== 1) throw new InternalApiError(404,"NOT_FOUND");
      const item = data[0];
      if (!item) throw new InternalApiError(404,"NOT_FOUND");
      return item;
    });
  }
}
