/**
 * P4/ADR 0007 — REAL Prisma 7 driver acceptance on disposable GitHub CI only.
 * Isolated p4_v1_ci SQL candidate; 2 fictional organizations; no Neon or API.
 */
import assert from "node:assert/strict";
import {
  assertP4V1CiPrismaEnvironment,
  createP4V1CiPrismaClient,
  readP4V1CiPrismaOverview,
  withP4V1CiPrismaTenant,
  P4V1CiPrismaDeniedError,
} from "../platform/p4-v1-ci-prisma.js";

const ALICE = "10000000-0000-4000-8000-0000000000a1";
const BOB = "10000000-0000-4000-8000-0000000000b1";
const ORCHID = "20000000-0000-4000-8000-000000000001";
const CEDAR = "20000000-0000-4000-8000-000000000002";

async function main() {
  assertP4V1CiPrismaEnvironment(process.env);
  const prisma = createP4V1CiPrismaClient(process.env);
  try {
    // Probe connection metadata only. The bootstrap role must NEVER be
    // used to query tenant business data through Prisma.
    const server = await prisma.$queryRawUnsafe<Array<{ name: string; role: string }>>(
      'SELECT current_database() AS name,current_user AS role',
    );
    assert.deepEqual(server, [{
      name: "zoho_clone_synthetic_ci", role: "demo_ci",
    }]);
    const orchid = await readP4V1CiPrismaOverview(prisma, {
      actorId: ALICE, organizationId: ORCHID,
    });
    assert.equal(orchid.organizationName, "Demo Orchid");
    assert.equal(orchid.role, "OWNER");
    assert.equal(orchid.leads.length, 2);
    assert.equal(orchid.files.length, 1);
    assert.equal(orchid.audit.length, 1);
    assert.equal(orchid.files[0]?.downloadEnabled, false);
    assert.equal("ownerUserId" in orchid.leads[0]!, false);
    assert.equal("actorUserId" in orchid.audit[0]!, false);
    assert.equal("url" in orchid.files[0]!, false);

    // Same global user, other tenant; never carry A's records to B.
    const cedar = await readP4V1CiPrismaOverview(prisma, {
      actorId: ALICE, organizationId: CEDAR,
    });
    assert.equal(cedar.organizationName, "Demo Cedar");
    assert.equal(cedar.role, "OWNER");
    assert.equal(cedar.leads.length, 1);
    assert.equal(cedar.files.length, 1);
    assert.equal(cedar.audit.length, 0);
    assert.ok(orchid.leads.every(l => !cedar.leads.some(other => other.id === l.id)));

    // Even if someone directly supplies a foreign tenant query to a tx,
    // PostgreSQL RLS must prevent any rows from crossing organization scope.
    await withP4V1CiPrismaTenant(prisma, {
      actorId: ALICE, organizationId: ORCHID,
    }, async tx => {
      assert.equal(await tx.v1Lead.count({ where: { orgId: CEDAR } }), 0);
      assert.equal(await tx.v1FileMetadata.count({ where: { orgId: CEDAR } }), 0);
      return true;
    });

    // Bob's original Orchid membership was revoked in CI SQL tests 010;
    // Bob has never held Cedar membership.
    for (const organizationId of [ORCHID, CEDAR]) {
      await assert.rejects(readP4V1CiPrismaOverview(prisma, {
        actorId: BOB, organizationId,
      }), P4V1CiPrismaDeniedError);
    }
    await assert.rejects(readP4V1CiPrismaOverview(prisma, {
      actorId: "user_demo_alice", organizationId: ORCHID,
    }), P4V1CiPrismaDeniedError);
    await assert.rejects(readP4V1CiPrismaOverview(prisma, {
      actorId: ALICE, organizationId: "10000000-0000-1000-8000-000000000001",
    }), P4V1CiPrismaDeniedError);

    // Explicitly attempt a write; restricted DB role must reject it.
    await assert.rejects(withP4V1CiPrismaTenant(prisma, {
      actorId: ALICE, organizationId: ORCHID,
    }, async tx => {
      await tx.v1Lead.update({
        where: { orgId_id: {
          orgId: ORCHID, id: "40000000-0000-4000-8000-000000000001",
        } },
        data: { version: { increment: 1 } },
      });
      return true;
    }), P4V1CiPrismaDeniedError);
    // Rejection/Rollback has not poisoned the pooled connection or retained
    // tenant/role context. Repeat a legal read on the same 1-connection pool.
    const after = await readP4V1CiPrismaOverview(prisma, {
      actorId: ALICE, organizationId: CEDAR,
    });
    assert.equal(after.leads.length, 1);
    const ended = await prisma.$queryRawUnsafe<Array<{
      role: string; tenant: string | null; actor: string | null;
    }>>(
      "SELECT current_user AS role," +
      " nullif(current_setting('app.tenant_id',true),'') AS tenant," +
      " nullif(current_setting('app.actor_id',true),'') AS actor",
    );
    assert.deepEqual(ended, [{ role: "demo_ci", tenant: null, actor: null }]);

    process.stdout.write(
      "P4.11 Prisma 7 UUIDv4 tenant transactions: two-org ORM reads, cross-tenant denial," +
      " revoked-user denial, write denial and role/GUC pool cleanup PASS\n",
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  // No raw exception, SQL, database URL, user ID or credentials in CI logs.
  process.stderr.write("P4.11 disposable CI Prisma tenant smoke FAIL\n");
  process.exitCode = 1;
});
