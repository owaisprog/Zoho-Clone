/**
 * ADR 0007 / P4.11: actual PostgreSQL pooled connection probe for the new
 * UUIDv4 relational candidate. DISPOSABLE GITHUB CI ONLY.
 *
 * The session begins as disposable bootstrap user (demo_ci), then each
 * transaction sets a LOCAL, restricted application role. No role, actor or
 * tenant context may survive COMMIT, ROLLBACK or pool-client reuse.
 *
 * NEVER configure against Neon or a customer/staging/production DB.
 */
import assert from "node:assert/strict";
import pg from "pg";
import { requireCanonicalUuidV4 } from "../platform/p4-approved-uuid.js";

const CI_DB = "zoho_clone_synthetic_ci";
const RUNTIME_ROLE = "p4_v1_ci_runtime";
const ALICE = "10000000-0000-4000-8000-0000000000a1";
const BOB = "10000000-0000-4000-8000-0000000000b1";
const ORCHID = "20000000-0000-4000-8000-000000000001";
const CEDAR = "20000000-0000-4000-8000-000000000002";
type ScopedRead = Readonly<{
  organizationId: string;
  ownedRole: string;
  leads: number;
  files: number;
  audits: number;
}>;
function guard(): void {
  if (process.env.CI !== "true" ||
      process.env.PGHOST !== "127.0.0.1" ||
      process.env.PGDATABASE !== CI_DB ||
      process.env.PGUSER !== "demo_ci" ||
      process.env.NODE_ENV === "production") {
    throw new Error("P4 V1 CI ONLY: rejected non-disposable database connection");
  }
}
function countRows(rows: readonly { n?: unknown }[]): number {
  if (!Array.isArray(rows) || rows.length !== 1 ||
      typeof rows[0]?.n !== "string" || !/^[0-9]{1,3}$/.test(rows[0].n)) {
    throw new Error("P4 V1 CI ONLY: malformed count response");
  }
  return Number(rows[0].n);
}
/**
 * Runtime read shape, NOT a public route. Missing current active membership
 * denies the request even when caller supplies an otherwise valid org UUID.
 */
async function readSummary(pool: pg.Pool, actorId: string, organizationId: string): Promise<ScopedRead> {
  const actor = requireCanonicalUuidV4(actorId);
  const org = requireCanonicalUuidV4(organizationId);
  const client = await pool.connect();
  let began = false;
  try {
    await client.query("BEGIN");
    began = true;
    await client.query("SET LOCAL ROLE p4_v1_ci_runtime");
    await client.query("SELECT set_config('app.actor_id', $1, true)", [actor]);
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [org]);
    const role = await client.query(
      'SELECT current_user AS "name",(SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS "privileged"',
    );
    assert.equal(role.rows.length, 1);
    assert.equal(role.rows[0].name, RUNTIME_ROLE);
    assert.equal(role.rows[0].privileged, false);
    const m = await client.query(
      "SELECT role FROM p4_v1_ci.memberships WHERE organization_id=$1 AND user_id=$2 AND active=true",
      [org, actor],
    );
    if (m.rows.length !== 1 || !["OWNER","MEMBER"].includes(m.rows[0]?.role)) {
      throw new Error("P4 V1 CI ONLY: current membership denied");
    }
    const leads = countRows((await client.query(
      "SELECT count(*) AS n FROM p4_v1_ci.crm_leads WHERE organization_id=$1", [org],
    )).rows);
    const files = countRows((await client.query(
      "SELECT count(*) AS n FROM p4_v1_ci.file_metadata WHERE organization_id=$1", [org],
    )).rows);
    const audits = countRows((await client.query(
      "SELECT count(*) AS n FROM p4_v1_ci.audit_logs WHERE organization_id=$1", [org],
    )).rows);
    await client.query("COMMIT");
    began = false;
    return Object.freeze({ organizationId: org, ownedRole: m.rows[0].role, leads, files, audits });
  } catch {
    if (began) {
      try { await client.query("ROLLBACK"); } catch { /* no SQL error details */ }
    }
    throw new Error("P4_V1_CI_READ_DENIED");
  } finally {
    // SET LOCAL ROLE and transaction-local GUCs are cleared on COMMIT or ROLLBACK.
    // The client must never leave an unclosed transaction in the pool.
    client.release();
  }
}
async function checkPoolReset(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    const role = await client.query('SELECT current_user AS "role"');
    assert.equal(role.rows[0]?.role, "demo_ci");
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE p4_v1_ci_runtime");
    const scoped = await client.query(
      "SELECT count(*) AS n FROM p4_v1_ci.crm_leads",
    );
    assert.equal(countRows(scoped.rows), 0);
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
}
async function main() {
  guard();
  const pool = new pg.Pool({
    host: "127.0.0.1",
    port: Number(process.env.PGPORT || "5432"),
    database: CI_DB,
    user: "demo_ci",
    password: process.env.PGPASSWORD,
    max: 1, // force reuse of the same pooled session to detect leaks
  });
  try {
    const db = await pool.query("SELECT current_database() AS name");
    assert.equal(db.rows[0]?.name, CI_DB);
    await checkPoolReset(pool);
    const orchid = await readSummary(pool, ALICE, ORCHID);
    assert.deepEqual(orchid, {
      organizationId: ORCHID, ownedRole: "OWNER", leads: 2, files: 1, audits: 1,
    });
    await checkPoolReset(pool);
    const cedar = await readSummary(pool, ALICE, CEDAR);
    assert.deepEqual(cedar, {
      organizationId: CEDAR, ownedRole: "OWNER", leads: 1, files: 1, audits: 0,
    });
    assert.notDeepEqual(orchid, cedar);
    await checkPoolReset(pool);
    // The SQL isolation tests have already revoked Bob in Orchid, and Bob was
    // never a Cedar member. Both accesses must now fail.
    await assert.rejects(readSummary(pool, BOB, ORCHID), /P4_V1_CI_READ_DENIED/);
    await checkPoolReset(pool);
    await assert.rejects(readSummary(pool, BOB, CEDAR), /P4_V1_CI_READ_DENIED/);
    await checkPoolReset(pool);
    process.stdout.write(
      "P4 architecture v1: actual pooled PostgreSQL UUIDv4 RLS, two tenants, revocation and role cleanup PASS\n",
    );
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  process.stderr.write("P4 architecture v1: disposable PostgreSQL smoke FAILED\n");
  process.exitCode = 1;
});
