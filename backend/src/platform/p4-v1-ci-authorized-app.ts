/**
 * P4.13 / P4.17: CI-only tenant app entitlement AND role authorization.
 * Only a fresh, restricted Prisma transaction can resolve these decisions.
 * This code is not imported by the production Express application.
 */
import type { PrismaClient, Prisma } from "../generated/p4-v1-ci/client.js";
import {
  withP4V1CiPrismaTenant,
  type P4V1CiTenantScope,
} from "./p4-v1-ci-prisma.js";
import { requireCanonicalUuidV4 } from "./p4-approved-uuid.js";

export class P4V1CiAppDeniedError extends Error {
  constructor() { super("P4_V1_CI_APP_DENIED"); }
}
export type P4V1CiAppCode = "crm" | "teams";
export type P4V1CiAppCard = Readonly<{
  code: P4V1CiAppCode;
  status: "available" | "locked";
  href: "/app/sales/leads" | "/app/organization/access";
}>;
const APPS = Object.freeze([
  Object.freeze({
    code: "crm" as const,
    requiredPermission: "crm.leads.read",
    href: "/app/sales/leads" as const,
  }),
  Object.freeze({
    code: "teams" as const,
    requiredPermission: "teams.read",
    href: "/app/organization/access" as const,
  }),
]);

async function manifestInsideTransaction(
  tx: Prisma.TransactionClient,
  orgId: string, role: "OWNER" | "MEMBER",
): Promise<readonly P4V1CiAppCard[]> {
  const grants = await tx.v1AppGrant.findMany({
    where: { orgId },
    select: { appCode: true, active: true }, take: 10,
  });
  const roles = await tx.v1RolePermission.findMany({
    where: { orgId, roleCode: role },
    select: { permissionCode: true }, take: 10,
  });
  if (grants.length > APPS.length || roles.length > APPS.length ||
      new Set(grants.map(g => g.appCode)).size !== grants.length ||
      new Set(roles.map(p => p.permissionCode)).size !== roles.length ||
      grants.some(g => !APPS.some(a => a.code === g.appCode) ||
        typeof g.active !== "boolean") ||
      roles.some(p => !APPS.some(a => a.requiredPermission === p.permissionCode))) {
    throw new P4V1CiAppDeniedError();
  }
  return Object.freeze(APPS.map(app => Object.freeze({
    code: app.code,
    href: app.href,
    status: grants.some(g => g.appCode === app.code && g.active) &&
      roles.some(p => p.permissionCode === app.requiredPermission)
      ? "available" as const : "locked" as const,
  })));
}
export async function readP4V1CiAppManifest(
  prisma: PrismaClient, scope: P4V1CiTenantScope,
  env: NodeJS.ProcessEnv = process.env,
): Promise<readonly P4V1CiAppCard[]> {
  try {
    requireCanonicalUuidV4(scope?.actorId);
    requireCanonicalUuidV4(scope?.organizationId);
    return await withP4V1CiPrismaTenant(
      prisma, scope, async (tx, current) =>
        manifestInsideTransaction(tx, current.organizationId, current.role),
      env,
    );
  } catch { throw new P4V1CiAppDeniedError(); }
}
/** Route-level gate: direct API access cannot rely on hidden navigation. */
export async function readP4V1CiAuthorizedApp(
  prisma: PrismaClient,
  scope: P4V1CiTenantScope,
  requestedApp: unknown,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Readonly<{
  organizationId: string;
  appCode: "crm";
  leads: readonly Readonly<{ id: string; label: string }>[];
}>> {
  if (requestedApp !== "crm") throw new P4V1CiAppDeniedError();
  try {
    return await withP4V1CiPrismaTenant(prisma, scope, async (tx, current) => {
      const apps = await manifestInsideTransaction(
        tx, current.organizationId, current.role,
      );
      if (apps.find(a => a.code === requestedApp)?.status !== "available") {
        throw new P4V1CiAppDeniedError();
      }
      const records = await tx.v1Lead.findMany({
        where: { orgId: current.organizationId },
        select: { id: true, displayName: true },
        orderBy: { id: "asc" }, take: 20,
      });
      if (records.some(r => !/^Demo [A-Za-z0-9 ]{3,70}$/.test(r.displayName))) {
        throw new P4V1CiAppDeniedError();
      }
      return Object.freeze({
        organizationId: current.organizationId,
        appCode: "crm" as const,
        leads: Object.freeze(records.map(r => Object.freeze({
          id: r.id, label: r.displayName,
        }))),
      });
    }, env);
  } catch { throw new P4V1CiAppDeniedError(); }
}
