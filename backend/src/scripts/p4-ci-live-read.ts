/**
 * P4 EXIT CI ONLY. Real pg client with actual disposable PostgreSQL RLS.
 * Never pointed at Neon/staging/production. CI bootstraps the database with
 * temporary superuser but each workload connection SET ROLEs to a restricted
 * NOLOGIN role before any tenant data is queried.
 */
import assert from "node:assert/strict";
import pg from "pg";
import { readP4VerifiedWorkspaceSettings } from "../platform/p4-pg-workspace-reader.js";
import type { ScopedPgPool } from "../platform/p4-rls-transaction.js";
const REQUIRED_DB = "zoho_clone_synthetic_ci";
const ROLE = "p4_synthetic_ci_runtime";

async function main() {
  if (process.env.PGHOST !== "127.0.0.1" ||
      process.env.PGDATABASE !== REQUIRED_DB ||
      process.env.CI !== "true") {
    throw new Error("P4 live Postgres test requires disposable localhost CI database");
  }
  const pgPool = new pg.Pool({
    host: "127.0.0.1",
    port: Number(process.env.PGPORT || "5432"),
    database: REQUIRED_DB,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    max: 2,
  });
  try {
    const setup = await pgPool.query("SELECT current_database() AS name");
    assert.equal(setup.rows[0]?.name, REQUIRED_DB);
    const scoped: ScopedPgPool = {
      async connect() {
        const client = await pgPool.connect();
        try {
          await client.query("SET ROLE " + ROLE);
        } catch (error) {
          client.release(true);
          throw error;
        }
        return {
          async query(sql, values) { return client.query(sql, values ? [...values] : undefined); },
          release() { client.release(); },
        };
      },
    };
    const alice = { verified: true as const,
      userId: "user_demo_alice", role: "OWNER" as const };
    const org1 = { ...alice, orgId: "10000000-0000-4000-8000-000000000001",
      orgSlug: "demo-maple-payments" };
    const org2 = { ...alice, orgId: "10000000-0000-4000-8000-000000000002",
      orgSlug: "demo-cedar-payments" };
    const a = await readP4VerifiedWorkspaceSettings(scoped, org1, ROLE);
    const b = await readP4VerifiedWorkspaceSettings(scoped, org2, ROLE);
    assert.equal(a.name, "Demo Orchid Payments");
    assert.equal(b.name, "Demo Cedar Payments");
    assert.notEqual(a.orgId, b.orgId);
    const revoked = { ...org1, userId: "user_demo_bob", role: "MEMBER" as const };
    await assert.rejects(readP4VerifiedWorkspaceSettings(scoped, revoked, ROLE));
    const foreign = { ...org1, orgId: "10000000-0000-4000-8000-000000000003" };
    await assert.rejects(readP4VerifiedWorkspaceSettings(scoped, foreign, ROLE));
    process.stdout.write("P4 exit: two real disposable PostgreSQL tenant reads, revoked + foreign denied PASS\n");
  } finally {
    await pgPool.end();
  }
}
main().catch(() => {
  // Do not print DB credentials, connection strings or SQL error traces.
  process.stderr.write("P4 live disposable PostgreSQL RLS smoke failed\n");
  process.exitCode = 1;
});
