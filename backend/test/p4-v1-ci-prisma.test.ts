import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertP4V1CiPrismaEnvironment,
  createP4V1CiPrismaClient,
  readP4V1CiPrismaOverview,
  withP4V1CiPrismaTenant,
  P4V1CiPrismaDeniedError,
} from "../src/platform/p4-v1-ci-prisma.js";
import type { PrismaClient } from "../src/generated/p4-v1-ci/client.js";

const CI = Object.freeze({
  CI: "true",
  GITHUB_ACTIONS: "true",
  PGHOST: "127.0.0.1",
  PGPORT: "5432",
  PGDATABASE: "zoho_clone_synthetic_ci",
  PGUSER: "demo_ci",
  PGPASSWORD: "fake_ci_not_for_real_accounts",
});
const ORCHID = "20000000-0000-4000-8000-000000000001";
const ACTOR = "10000000-0000-4000-8000-0000000000a1";

type FakeDbOptions = {
  member?: "OWNER" | "MEMBER" | "REVOKED" | "MISSING";
  role?: string;
  privileged?: boolean;
  canWrite?: boolean;
  ownTable?: boolean;
  throwSql?: boolean;
  injectSensitive?: boolean;
};
function mockedPrisma(options: FakeDbOptions = {}) {
  const statements: string[] = [];
  const fakeTx = {
    async $executeRawUnsafe(sql: string) {
      statements.push(sql);
      return 0;
    },
    async $queryRawUnsafe(sql: string) {
      statements.push(sql);
      if (options.throwSql) throw new Error("password=THIS_MUST_NOT_LEAK");
      if (sql.includes("set_config(")) return [{}];
      return [{
        role: options.role ?? "p4_v1_ci_runtime",
        privileged: options.privileged ?? false,
        isOwner: options.ownTable ?? false,
        canRead: true,
        canReadLabel: true, canReadPrivateNote: false, canReadPrivateFile: false,
        canWrite: options.canWrite ?? false,
      }];
    },
    v1Membership: {
      async findUnique() {
        if (options.member === "MISSING") return null;
        return {
          active: options.member !== "REVOKED",
          role: options.member === "MEMBER" ? "MEMBER" : "OWNER",
        };
      },
    },
    v1Organization: {
      async findUnique() { return { id: ORCHID, displayName: "Demo Orchid" }; },
    },
    v1Lead: {
      async findMany() {
        return [{
          id: "40000000-0000-4000-8000-000000000001",
          displayName: "Demo Orchid Lead",
          ...(options.injectSensitive ? { contact: "PRIVATE EMAIL" } : {}),
        }];
      },
    },
    v1FileMetadata: {
      async findMany() {
        return [{
          id: "50000000-0000-4000-8000-000000000001",
          scanState: "quarantined",
          ...(options.injectSensitive ? { objectKey: "private/raw-key" } : {}),
        }];
      },
    },
    v1AuditLog: {
      async findMany() {
        return [{
          id: "70000000-0000-4000-8000-000000000001",
          eventName: "file.scan.requested",
          redacted: true,
          ...(options.injectSensitive ? { actorUserId: ACTOR } : {}),
        }];
      },
    },
  };
  const prisma = {
    async $transaction(callback: (tx: typeof fakeTx) => Promise<unknown>) {
      return callback(fakeTx);
    },
  } as unknown as PrismaClient;
  return { prisma, statements };
}
describe("P4 Architecture v1 Prisma CI-only environmental containment", () => {
  it("accepts only exact ephemeral localhost CI configuration", () => {
    assert.doesNotThrow(() => assertP4V1CiPrismaEnvironment(CI));
  });
  it("denies Neon, nonlocal host, shared database, wrong role, missing CI and production", () => {
    for (const fake of [
      { ...CI, PGHOST: "my-db.neon.tech" },
      { ...CI, PGDATABASE: "zoho_clone_synthetic" },
      { ...CI, PGUSER: "neondb_owner" },
      { ...CI, PGPORT: "5433" },
      { ...CI, CI: "false" },
      { ...CI, GITHUB_ACTIONS: "false" },
      { ...CI, NODE_ENV: "production" },
      { ...CI, PGPASSWORD: "wrong" },
      {},
    ]) assert.throws(
      () => assertP4V1CiPrismaEnvironment(fake),
      P4V1CiPrismaDeniedError,
    );
  });
  it("refuses instantiation for Neon, no matter what credentials are provided", () => {
    assert.throws(() => createP4V1CiPrismaClient({
      ...CI, PGHOST: "other-host.neon.tech",
    }), P4V1CiPrismaDeniedError);
  });
});
describe("P4 Architecture v1 Prisma transaction negative authorization", () => {
  it("does not even start a transaction for invalid IDs", async () => {
    const f = mockedPrisma();
    for (const scope of [
      { organizationId: "demo-org", actorId: ACTOR },
      { organizationId: ORCHID, actorId: "auth0|demo-alice" },
      { organizationId: "20000000-0000-1000-8000-000000000001", actorId: ACTOR },
    ]) {
      await assert.rejects(withP4V1CiPrismaTenant(f.prisma, scope,
        async () => "should never run", CI), P4V1CiPrismaDeniedError);
    }
    assert.deepEqual(f.statements, []);
  });
  it("selects restricted role and transaction-local parameterized tenant GUCs first", async () => {
    const f = mockedPrisma();
    const v = await withP4V1CiPrismaTenant(f.prisma,
      { organizationId: ORCHID, actorId: ACTOR },
      async (_, identity) => identity.role,
      CI);
    assert.equal(v, "OWNER");
    assert.equal(f.statements[0], "SET LOCAL ROLE p4_v1_ci_runtime");
    assert.ok(f.statements[1]?.includes("set_config('app.tenant_id', $1, true)"));
    assert.ok(f.statements[1]?.includes("set_config('app.actor_id', $2, true)"));
  });
  it("denies role bypass, privileged connection, table-owner and DML grants", async () => {
    for (const policy of [
      { role: "demo_ci" }, { privileged: true },
      { canWrite: true }, { ownTable: true },
    ]) {
      const f = mockedPrisma(policy);
      await assert.rejects(withP4V1CiPrismaTenant(f.prisma,
        { organizationId: ORCHID, actorId: ACTOR },
        async () => true, CI), P4V1CiPrismaDeniedError);
    }
  });
  it("denies revoked or missing membership before executing a data callback", async () => {
    for (const policy of [{ member: "REVOKED" as const }, { member: "MISSING" as const }]) {
      const f = mockedPrisma(policy);
      let executed = false;
      await assert.rejects(withP4V1CiPrismaTenant(f.prisma,
        { organizationId: ORCHID, actorId: ACTOR },
        async () => { executed = true; return true; }, CI),
      P4V1CiPrismaDeniedError);
      assert.equal(executed, false);
    }
  });
  it("never exposes underlying SQL errors, credentials, or payloads", async () => {
    const f = mockedPrisma({ throwSql: true });
    await assert.rejects(withP4V1CiPrismaTenant(f.prisma,
      { organizationId: ORCHID, actorId: ACTOR },
      async () => true, CI), (error: unknown) => {
      assert.ok(error instanceof P4V1CiPrismaDeniedError);
      assert.ok(!String(error).includes("THIS_MUST_NOT_LEAK"));
      assert.ok(!String(error).includes("password"));
      return true;
    });
  });
  it("serializes only allowlisted fields and never a file URL, private key or email", async () => {
    const f = mockedPrisma({ injectSensitive: true });
    const overview = await readP4V1CiPrismaOverview(f.prisma,
      { organizationId: ORCHID, actorId: ACTOR }, CI);
    const serialized = JSON.stringify(overview);
    assert.equal(overview.leads.length, 1);
    assert.equal(overview.files[0]?.downloadEnabled, false);
    for (const forbidden of ["PRIVATE EMAIL","private/raw-key","objectKey","actorUserId","ownerUserId","downloadUrl"]) {
      assert.ok(!serialized.includes(forbidden));
    }
  });
  it("fails closed on member audit returned by a compromised policy adapter", async () => {
    const f = mockedPrisma({ member: "MEMBER" });
    await assert.rejects(readP4V1CiPrismaOverview(f.prisma,
      { organizationId: ORCHID, actorId: ACTOR }, CI), P4V1CiPrismaDeniedError);
  });
});
