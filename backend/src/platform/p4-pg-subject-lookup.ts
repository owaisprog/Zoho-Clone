import type { ScopedPgPool } from "./p4-rls-transaction.js";
import {
  P4IdentityBridgeDeniedError, type P4SubjectMappingLookup,
} from "./p4-auth0-subject-bridge.js";

/** A separate low-privilege database pool can ONLY execute the narrow
 * SECURITY DEFINER mapping function after provider token verification.
 * No tenant/owner role, contact email lookup, or implicit user creation.
 * Candidate DB function is CI-only until production security review.
 */
export function createP4PgSubjectMappingLookup(pool: ScopedPgPool): P4SubjectMappingLookup {
  return {
    async findByIssuerAndSubject(issuer, subject) {
      let client;
      try {
        client = await pool.connect();
        const response: unknown = await client.query(
          "SELECT user_id AS \"userId\", email_verified AS \"emailVerified\" FROM p4_synthetic.lookup_verified_subject($1, $2)",
          [issuer, subject],
        );
        if (!response || typeof response !== "object" || !("rows" in response) ||
            !Array.isArray(response.rows) || response.rows.length > 1) {
          throw new P4IdentityBridgeDeniedError();
        }
        const row: unknown = response.rows[0];
        if (row === undefined) return null;
        if (!row || typeof row !== "object" || !("userId" in row) || !("emailVerified" in row) ||
            typeof row.userId !== "string" || typeof row.emailVerified !== "boolean") {
          throw new P4IdentityBridgeDeniedError();
        }
        return { userId: row.userId, emailVerified: row.emailVerified };
      } catch {
        throw new P4IdentityBridgeDeniedError();
      } finally {
        try { client?.release(); } catch { /* never expose connection details */ }
      }
    },
  };
}
