/**
 * P4.11 / ADR 0007: Prisma 7 read-only, UUIDv4 tenant transaction proof.
 *
 * INTERNAL DISPOSABLE GITHUB CI ONLY. Never call from Express app.ts,
 * background workers, Neon scripts, staging or production.
 *
 * The service boots using the disposable CI database setup principal only
 * to SET LOCAL ROLE inside each transaction. No business read executes before
 * the role becomes p4_v1_ci_runtime (non-owner / NOBYPASSRLS / SELECT-only).
 * Production needs its own approved role design, signed Auth0 identity mapping,
 * entitlement checks and record/field policies.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type Prisma,
} from "../generated/p4-v1-ci/client.js";
import {
  requireCanonicalUuidV4,
  type P4UuidV4,
} from "./p4-approved-uuid.js";

const CI_ROLE = "p4_v1_ci_runtime";
const CI_DATABASE = "zoho_clone_synthetic_ci";
const CI_PASSWORD = "fake_ci_not_for_real_accounts";

export class P4V1CiPrismaDeniedError extends Error {
  constructor() { super("P4_V1_CI_PRISMA_DENIED"); }
}
type CIEnvironment = Readonly<{
  CI?: string;
  GITHUB_ACTIONS?: string;
  NODE_ENV?: string;
  PGHOST?: string;
  PGPORT?: string;
  PGDATABASE?: string;
  PGUSER?: string;
  PGPASSWORD?: string;
}>;
/** Fixed guard: a Neon or shared DB URL cannot be used even by mistake. */
export function assertP4V1CiPrismaEnvironment(env: CIEnvironment): void {
  if (!env || env.CI !== "true" || env.GITHUB_ACTIONS !== "true" ||
      env.NODE_ENV === "production" ||
      env.PGHOST !== "127.0.0.1" || env.PGPORT !== "5432" ||
      env.PGDATABASE !== CI_DATABASE || env.PGUSER !== "demo_ci" ||
      env.PGPASSWORD !== CI_PASSWORD) {
    throw new P4V1CiPrismaDeniedError();
  }
}
/** Not exported to application routers. No external data access. */
export function createP4V1CiPrismaClient(env: CIEnvironment): PrismaClient {
  assertP4V1CiPrismaEnvironment(env);
  const adapter = new PrismaPg({
    connectionString:
      "postgresql://demo_ci:" + CI_PASSWORD +
      "@127.0.0.1:5432/" + CI_DATABASE,
    max: 1,
  });
  return new PrismaClient({ adapter });
}
export type P4V1CiTenantScope = Readonly<{
  organizationId: string;
  actorId: string;
}>;
export type P4V1CiTenantIdentity = Readonly<{
  organizationId: P4UuidV4;
  actorId: P4UuidV4;
  role: "OWNER" | "MEMBER";
}>;
export type P4V1CiTransaction = Prisma.TransactionClient;

/**
 * Never trust a caller-provided role; verify active membership with RLS
 * INSIDE the same Prisma transaction that performs allowed reads.
 * No global Prisma client may be used inside the callback.
 * Not an Auth0 verifier; inputs are fixed fictional CI fixtures only.
 */
export async function withP4V1CiPrismaTenant<T>(
  prisma: PrismaClient,
  scope: P4V1CiTenantScope,
  callback: (tx: P4V1CiTransaction, verified: P4V1CiTenantIdentity) => Promise<T>,
  env: CIEnvironment = process.env,
): Promise<T> {
  assertP4V1CiPrismaEnvironment(env);
  if (!prisma || typeof prisma.$transaction !== "function" ||
      typeof callback !== "function") throw new P4V1CiPrismaDeniedError();
  let organizationId: P4UuidV4, actorId: P4UuidV4;
  try {
    organizationId = requireCanonicalUuidV4(scope?.organizationId);
    actorId = requireCanonicalUuidV4(scope?.actorId);
  } catch {
    throw new P4V1CiPrismaDeniedError();
  }
  try {
    return await prisma.$transaction(async tx => {
      // Static SQL statement, no caller-controlled interpolation.
      await tx.$executeRawUnsafe("SET LOCAL ROLE p4_v1_ci_runtime");
      // Transaction-local GUCs from CI synthetic fixture IDs. Parameters
      // are bound, never constructed into SQL expressions.
      await tx.$queryRawUnsafe(
        "SELECT set_config('app.tenant_id', $1, true), set_config('app.actor_id', $2, true)",
        organizationId, actorId,
      );
      const checked = await tx.$queryRawUnsafe<Array<{
        role: string;
        privileged: boolean;
        isOwner: boolean;
        canRead: boolean;
        canWrite: boolean;
      }>>(
        "SELECT current_user AS role," +
        " (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS privileged," +
        " (SELECT c.relowner = (SELECT oid FROM pg_roles WHERE rolname=current_user)" +
        " FROM pg_class c WHERE c.oid='p4_v1_ci.crm_leads'::regclass) AS \"isOwner\"," +
        " has_table_privilege(current_user,'p4_v1_ci.crm_leads','SELECT') AS \"canRead\"," +
        " (has_table_privilege(current_user,'p4_v1_ci.crm_leads','INSERT') OR" +
        " has_table_privilege(current_user,'p4_v1_ci.crm_leads','UPDATE') OR" +
        " has_table_privilege(current_user,'p4_v1_ci.crm_leads','DELETE')) AS \"canWrite\"",
      );
      if (checked.length !== 1 ||
          checked[0]?.role !== CI_ROLE || checked[0]?.privileged !== false ||
          checked[0]?.isOwner !== false || checked[0]?.canRead !== true ||
          checked[0]?.canWrite !== false) {
        throw new P4V1CiPrismaDeniedError();
      }
      const membership = await tx.v1Membership.findUnique({
        where: { orgId_userId: { orgId: organizationId, userId: actorId } },
        select: { role: true, active: true },
      });
      if (!membership || membership.active !== true ||
          (membership.role !== "OWNER" && membership.role !== "MEMBER")) {
        throw new P4V1CiPrismaDeniedError();
      }
      return callback(tx, Object.freeze({
        organizationId, actorId,
        role: membership.role as "OWNER" | "MEMBER",
      }));
    }, { maxWait: 5_000, timeout: 10_000 });
  } catch {
    // Suppress SQL driver details, credentials, tenant IDs and query payloads.
    throw new P4V1CiPrismaDeniedError();
  }
}

export type P4V1CiReadProjection = Readonly<{
  organizationId: string;
  organizationName: string;
  role: "OWNER" | "MEMBER";
  leads: readonly Readonly<{ id: string; label: string }>[];
  files: readonly Readonly<{ id: string; scanState: string; downloadEnabled: false }>[];
  audit: readonly Readonly<{ id: string; action: string }>[];
}>;
/** Explicit allowlisted SELECT projections. NO customer-data API. */
export async function readP4V1CiPrismaOverview(
  prisma: PrismaClient,
  scope: P4V1CiTenantScope,
  env: CIEnvironment = process.env,
): Promise<P4V1CiReadProjection> {
  return withP4V1CiPrismaTenant(prisma, scope, async (tx, current) => {
    const org = await tx.v1Organization.findUnique({
      where: { id: current.organizationId },
      select: { id: true, displayName: true },
    });
    if (!org || org.id !== current.organizationId ||
        !/^Demo [A-Za-z0-9 ]{3,70}$/.test(org.displayName)) {
      throw new P4V1CiPrismaDeniedError();
    }
    const leads = await tx.v1Lead.findMany({
      where: { orgId: current.organizationId },
      select: { id: true, displayName: true },
      orderBy: { id: "asc" }, take: 20,
    });
    const files = await tx.v1FileMetadata.findMany({
      where: { orgId: current.organizationId },
      select: { id: true, scanState: true },
      orderBy: { id: "asc" }, take: 20,
    });
    const audit = await tx.v1AuditLog.findMany({
      where: { orgId: current.organizationId },
      select: { id: true, eventName: true, redacted: true },
      orderBy: { id: "asc" }, take: 20,
    });
    if (leads.some(l => !/^Demo /.test(l.displayName)) ||
        files.some(f => !["quarantined","scan_clean","rejected","soft_deleted"].includes(f.scanState)) ||
        audit.some(a => a.redacted !== true) ||
        (current.role !== "OWNER" && audit.length !== 0)) {
      throw new P4V1CiPrismaDeniedError();
    }
    return Object.freeze({
      organizationId: current.organizationId,
      organizationName: org.displayName,
      role: current.role,
      leads: Object.freeze(leads.map(l => Object.freeze({ id: l.id, label: l.displayName }))),
      files: Object.freeze(files.map(f => Object.freeze({
        id: f.id, scanState: f.scanState, downloadEnabled: false as const,
      }))),
      audit: Object.freeze(audit.map(a => Object.freeze({ id: a.id, action: a.eventName }))),
    });
  }, env);
}
