/**
 * P3.05/06 synthetic-only CLI acceptance check. Never connected to the
 * default Express server; never maps Auth0 identities or accepts HTTP input.
 * Requires disposable local Docker Compose PostgreSQL on 127.0.0.1:5433.
 */
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { requireLocalSyntheticDatabaseUrl } from "../internal/local-synthetic-db-url.js";

type DemoContext = {
  tenant: "org_demo_orchid" | "org_demo_cedar";
  actor: "user_demo_alice" | "user_demo_bob" | "user_demo_carla" | "user_demo_eve";
  scope: "owned" | "all";
};

const cases: Record<"alice" | "bob" | "carla" | "eve" | "wrongOrg", DemoContext> = {
  alice: { tenant: "org_demo_orchid", actor: "user_demo_alice", scope: "owned" },
  bob: { tenant: "org_demo_orchid", actor: "user_demo_bob", scope: "all" },
  carla: { tenant: "org_demo_cedar", actor: "user_demo_carla", scope: "all" },
  eve: { tenant: "org_demo_orchid", actor: "user_demo_eve", scope: "all" },
  wrongOrg: { tenant: "org_demo_cedar", actor: "user_demo_alice", scope: "all" },
};

export async function verifySyntheticPrismaReadOnly(
  connectionString: string,
  expectedRole: "p3_preview_runtime" | "p3_neon_reader",
): Promise<void> {
  const adapter = new PrismaPg({ connectionString, max: 2 });
  const prisma = new PrismaClient({ adapter });
  try {
    const role = await prisma.$queryRaw<Array<{ role: string; superuser: boolean; bypassrls: boolean }>>`
      SELECT current_user AS role, rolsuper AS superuser, rolbypassrls AS bypassrls
      FROM pg_roles WHERE rolname = current_user
    `;
    assert.equal(role.length, 1);
    assert.equal(role[0]?.role, expectedRole);
    assert.equal(role[0]?.superuser, false);
    assert.equal(role[0]?.bypassrls, false);
    // A connected role must not be a database object owner or able to write
    // even if RLS is accidentally changed. Reject roles with inherited DML.
    const grants = await prisma.$queryRaw<Array<{
      canSelect: boolean;
      canInsert: boolean;
      canUpdate: boolean;
      canDelete: boolean;
    }>>`
      SELECT
        has_table_privilege(current_user, 'synthetic.leads', 'SELECT') AS "canSelect",
        has_table_privilege(current_user, 'synthetic.leads', 'INSERT') AS "canInsert",
        has_table_privilege(current_user, 'synthetic.leads', 'UPDATE') AS "canUpdate",
        has_table_privilege(current_user, 'synthetic.leads', 'DELETE') AS "canDelete"
    `;
    assert.deepEqual(grants, [{
      canSelect: true,
      canInsert: false,
      canUpdate: false,
      canDelete: false,
    }]);


    // Default deny on a fresh connection with no tenant/actor context.
    assert.equal(await prisma.lead.count(), 0);

    async function countWithContext(ctx: DemoContext): Promise<number> {
      return prisma.$transaction(async tx => {
        // RLS GUCs are local to this transaction, NOT a pooled session SET.
        // Contexts above are hardcoded synthetic fixtures; not user inputs.
        await tx.$queryRaw`
          SELECT set_config('app.tenant_id', ${ctx.tenant}, true),
                 set_config('app.actor_id', ${ctx.actor}, true)
        `;
        const records = await tx.lead.findMany({
          where: {
            orgId: ctx.tenant,
            ...(ctx.scope === "owned" ? { ownerId: ctx.actor } : {}),
          },
          select: {
            id: true,
            organization: true,
            stage: true,
            version: true,
          },
          take: 100,
          orderBy: { id: "asc" },
        });
        for (const record of records) {
          assert.match(record.id, /^LEAD-DEMO-\d{3}$/);
          assert.match(record.organization, /Demo/);
          assert.ok(record.version > 0);
          // This query projects only allowed non-contact fields.
          assert.equal("email" in record, false);
          assert.equal("contact" in record, false);
        }
        return records.length;
      });
    }

    assert.equal(await countWithContext(cases.alice), 1);
    assert.equal(await countWithContext(cases.bob), 2);
    assert.equal(await countWithContext(cases.carla), 1);
    assert.equal(await countWithContext(cases.eve), 0);
    assert.equal(await countWithContext(cases.wrongOrg), 0);
    // Every transaction must clear its GUCs before connection reuse.
    assert.equal(await prisma.lead.count(), 0);
  } finally {
    await prisma.$disconnect();
  }
}

export async function verifyLocalSyntheticPrisma(urlInput: string | undefined): Promise<void> {
  const connectionString = requireLocalSyntheticDatabaseUrl(urlInput);
  return verifySyntheticPrismaReadOnly(connectionString, "p3_preview_runtime");
}

if (process.argv[1]?.endsWith("/p3-prisma-local-smoke.js")) {
  verifyLocalSyntheticPrisma(process.env.DATABASE_URL)
    .then(() => console.info("P3.05/06 local synthetic Prisma read-only RLS smoke: PASS"))
    .catch(() => {
      console.error("P3.05/06 local synthetic Prisma smoke: FAIL (no details logged)");
      process.exitCode = 1;
    });
}
