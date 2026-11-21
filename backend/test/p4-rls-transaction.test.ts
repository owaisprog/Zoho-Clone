import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  withSyntheticRlsTransaction, P4DatabaseScopeDeniedError,
  type ScopedPgClient, type ScopedPgPool,
} from "../src/platform/p4-rls-transaction.js";

const context = {
  verified: true as const,
  orgId: "10000000-0000-4000-8000-000000000001",
  orgSlug: "demo-orchid",
  userId: "user_demo_alice",
  role: "OWNER" as const,
};
function fakePool(failOn?: string) {
  const queries: { sql: string; values?: readonly string[] }[] = [];
  let releases = 0;
  const client: ScopedPgClient = {
    async query(sql, values) {
      queries.push({ sql, ...(values ? { values } : {}) });
      if (sql === failOn) throw new Error("Private simulated DB credentials must not leak");
      return { rows: [{ test: true }] };
    },
    release() { releases += 1; },
  };
  const pool: ScopedPgPool = { async connect() { return client; } };
  return { pool, queries, releases: () => releases };
}

describe("P4.11 transaction-local PostgreSQL context helper", () => {
  it("uses parameterized, transaction-local actor and tenant without leaking after commit", async () => {
    const db = fakePool();
    const result = await withSyntheticRlsTransaction(db.pool, context, async c => {
      await c.query("SELECT 1");
      return "fictional-ok";
    });
    assert.equal(result, "fictional-ok");
    assert.deepEqual(db.queries, [
      { sql: "BEGIN" },
      { sql: "SELECT set_config('app.actor_id', $1, true)", values: [context.userId] },
      { sql: "SELECT set_config('app.tenant_id', $1, true)", values: [context.orgId] },
      { sql: "SELECT 1" }, { sql: "COMMIT" },
    ]);
    assert.equal(db.releases(), 1);
  });
  it("rejects unverified forged or malformed context before acquiring connection", async () => {
    for (const bad of [
      { ...context, verified: false as never },
      { ...context, orgId: "demo-org" },
      { ...context, orgId: "anything'); DROP TABLE org; --" },
      { ...context, userId: "auth0|unverified" },
      { ...context, role: "SUPER_ADMIN" as never },
      { ...context, orgSlug: "other-company" },
    ]) {
      const db = fakePool();
      await assert.rejects(withSyntheticRlsTransaction(db.pool, bad, async () => "unreachable"),
        P4DatabaseScopeDeniedError);
      assert.equal(db.queries.length, 0);
      assert.equal(db.releases(), 0);
    }
  });
  it("rolls back on an operation failure and never leaks driver errors", async () => {
    const db = fakePool("SELECT throws");
    await assert.rejects(
      withSyntheticRlsTransaction(db.pool, context, async c => c.query("SELECT throws")),
      error => error instanceof P4DatabaseScopeDeniedError &&
        error.message === "P4_DATABASE_SCOPE_DENIED",
    );
    assert.deepEqual(db.queries.at(-1), { sql: "ROLLBACK" });
    assert.equal(db.releases(), 1);
  });
  it("rolls back and releases if setting actor context fails", async () => {
    const db = fakePool("SELECT set_config('app.actor_id', $1, true)");
    await assert.rejects(withSyntheticRlsTransaction(db.pool, context, async () => "not-called"),
      P4DatabaseScopeDeniedError);
    assert.deepEqual(db.queries.at(-1), { sql: "ROLLBACK" });
    assert.equal(db.releases(), 1);
  });
});
