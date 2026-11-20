/**
 * P4.12–P4.15 / ADR 0008: OWNER APPROVED D1/D2/D4/D5, INTERNAL CI ONLY.
 * - Exact business role grants from PostgreSQL, not JWT/user-controlled role.
 * - Each ORM read occurs in a restricted, transaction-local PG role/context.
 * - Membership, app grants and active team membership read inside same tx.
 * - RLS predicates AND P1.06 record checks must both authorize each row.
 * - Never mounted in production app.ts; no Neon, writes, exports or uploads.
 *
 * This role-switching proof uses a disposable CI bootstrap superuser.
 * Real staging/production MUST use separately approved least-privilege
 * database credentials and an independently reviewed migration.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../generated/p4-r7-ci/client.js";
import { assertP4V1CiPrismaEnvironment } from "./p4-v1-ci-prisma.js";
import { requireCanonicalUuidV4, type P4UuidV4 } from "./p4-approved-uuid.js";
import {
  P4_R7_P106_ROLES,
} from "./p4-r7-approved-policy-matrix.js";
import {
  authorizeP4R7Synthetic, projectP4R7SyntheticLead,
  type P4R7Evidence, type P4R7Record, type P4R7Role, type P4R7TeamGrant,
} from "./p4-r7-authorizer.js";

export class P4R7CiReadDeniedError extends Error {
  constructor() { super("P4_R7_CI_READ_DENIED"); }
}
type CiEnv = NodeJS.ProcessEnv;
const ROLE = "p4_v1_ci_runtime";
const DB = "zoho_clone_synthetic_ci";
const ALLOW_ROLES: ReadonlySet<string> = new Set(P4_R7_P106_ROLES);
export type P4R7CiScope = Readonly<{ organizationId: string; actorId: string }>;
export type P4R7CiLead = Readonly<{ id: string; displayName: string }>;
type Tx = Prisma.TransactionClient;

export function createP4R7CiPrismaClient(env: CiEnv = process.env): PrismaClient {
  assertP4V1CiPrismaEnvironment(env);
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: "postgresql://demo_ci:fake_ci_not_for_real_accounts@127.0.0.1:5432/" + DB,
      max: 1,
    }),
  });
}

/**
 * A caller supplies only UUIDs. The verified actor is resolved from the
 * synthetic token-to-subject bridge BEFORE entering this function.
 * Never infer a role or membership from browser props or JWT claims.
 */
async function inRestrictedTenant<T>(
  prisma: PrismaClient,
  scope: P4R7CiScope,
  env: CiEnv,
  callback: (tx: Tx, evidence: P4R7Evidence) => Promise<T>,
): Promise<T> {
  assertP4V1CiPrismaEnvironment(env);
  if (!prisma || typeof prisma.$transaction !== "function" || typeof callback !== "function")
    throw new P4R7CiReadDeniedError();
  let org: P4UuidV4, actor: P4UuidV4;
  try {
    org = requireCanonicalUuidV4(scope?.organizationId);
    actor = requireCanonicalUuidV4(scope?.actorId);
  } catch { throw new P4R7CiReadDeniedError(); }
  try {
    return await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE p4_v1_ci_runtime");
      await tx.$queryRawUnsafe(
        "SELECT set_config('app.tenant_id',$1,true),set_config('app.actor_id',$2,true)",org,actor,
      );
      const state = await tx.$queryRawUnsafe<Array<{
        role: string; privileged: boolean; isOwner: boolean;
        canReadLabel: boolean; canReadPrivate: boolean; canWrite: boolean;
      }>>(
        'SELECT current_user AS role,' +
        ' (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS privileged,' +
        ' (SELECT c.relowner = (SELECT oid FROM pg_roles WHERE rolname=current_user)' +
        " FROM pg_class c WHERE c.oid='p4_r7_ci.leads'::regclass) AS \"isOwner\"," +
        " has_column_privilege(current_user,'p4_r7_ci.leads','display_name','SELECT') AS \"canReadLabel\"," +
        " has_column_privilege(current_user,'p4_r7_ci.leads','confidential_note','SELECT') AS \"canReadPrivate\"," +
        " (has_table_privilege(current_user,'p4_r7_ci.leads','INSERT') OR" +
        " has_table_privilege(current_user,'p4_r7_ci.leads','UPDATE') OR" +
        " has_table_privilege(current_user,'p4_r7_ci.leads','DELETE')) AS \"canWrite\"",
      );
      if (state.length !== 1 || state[0]?.role !== ROLE ||
          state[0]?.privileged !== false || state[0]?.isOwner !== false ||
          state[0]?.canReadLabel !== true || state[0]?.canReadPrivate !== false ||
          state[0]?.canWrite !== false) throw new P4R7CiReadDeniedError();

      const membership = await tx.r7Membership.findUnique({
        where: { orgId_actorId: { orgId: org, actorId: actor } },
        select: { active: true },
      });
      if (!membership || membership.active !== true) throw new P4R7CiReadDeniedError();
      const roles = await tx.r7RoleGrant.findMany({
        where: { orgId: org, actorId: actor, active: true },
        select: { roleCode: true, active: true }, take: 20,
      });
      if (roles.length < 1 || roles.length > P4_R7_P106_ROLES.length ||
          roles.some(r => r.active !== true || !ALLOW_ROLES.has(r.roleCode)) ||
          new Set(roles.map(r => r.roleCode)).size !== roles.length)
        throw new P4R7CiReadDeniedError();

      const apps = await tx.r7AppGrant.findMany({
        where: { orgId: org, active: true },
        select: { appCode: true, active: true }, take: 10,
      });
      if (apps.length > 2 ||
          apps.some(a => a.active !== true || !["crm","platform"].includes(a.appCode)) ||
          new Set(apps.map(a => a.appCode)).size !== apps.length) {
        throw new P4R7CiReadDeniedError();
      }
      const teams = await tx.r7TeamGrant.findMany({
        where: { orgId: org, actorId: actor, active: true },
        select: { orgId: true, actorId: true, teamId: true, active: true, managed: true },
        take: 100,
      });
      if (teams.some(t => t.orgId !== org || t.actorId !== actor ||
            t.active !== true || typeof t.managed !== "boolean" ||
            !requireValidTeamId(t.teamId)) ||
          new Set(teams.map(t => t.teamId)).size !== teams.length) {
        throw new P4R7CiReadDeniedError();
      }
      const evidence: P4R7Evidence = Object.freeze({
        serverResolved: true, verifiedIdentity: true, activeMembership: true,
        organizationActive: true, organizationId: org, actorId: actor,
        roleCodes: Object.freeze(roles.map(r => r.roleCode as P4R7Role)),
        enabledApps: Object.freeze(apps.map(a => a.appCode)),
        activeTeamGrants: Object.freeze(teams.map((t): P4R7TeamGrant =>
          Object.freeze({ organizationId: org, userId: actor,
            teamId: t.teamId, active: true, managed: t.managed }))),
      });
      return callback(tx, evidence);
    }, { maxWait: 5_000, timeout: 10_000 });
  } catch {
    // No SQL error, private row existence or connection details in public errors.
    throw new P4R7CiReadDeniedError();
  }
}
function requireValidTeamId(value: unknown): boolean {
  try { requireCanonicalUuidV4(value); return true; } catch { return false; }
}
function approvedRecord(
  row: Readonly<{orgId:string;id:string;ownerUserId:string;teamId:string;
    assignedUserId:string|null;shareState:string}>,
): P4R7Record {
  if (row.shareState !== "private" && row.shareState !== "explicit_team") {
    throw new P4R7CiReadDeniedError();
  }
  return {
    organizationId: row.orgId, id: row.id, ownerUserId: row.ownerUserId,
    teamId: row.teamId, shareState: row.shareState,
    assignedUserIds: row.assignedUserId ? [row.assignedUserId] : [],
  };
}
const FIELDS = Object.freeze(["id", "displayName"] as const);
function checkRow(
  row: Readonly<{orgId:string;id:string;ownerUserId:string;teamId:string;
    assignedUserId:string|null;shareState:string;displayName:string}>,
  evidence: P4R7Evidence,
): P4R7CiLead {
  const policy = authorizeP4R7Synthetic(
    evidence, "leads", "R", approvedRecord(row), FIELDS,
  );
  if (!policy.allowed || row.orgId !== evidence.organizationId) {
    throw new P4R7CiReadDeniedError();
  }
  return projectP4R7SyntheticLead(policy, row);
}
/**
 * Return only rows permitted by BOTH SQL RLS and the approved P1.06 policy.
 * RLS filters BEFORE the ORM fetch so list size/search does not leak counts.
 */
export async function readP4R7CiLeads(
  prisma: PrismaClient, scope: P4R7CiScope, env: CiEnv = process.env,
): Promise<readonly P4R7CiLead[]> {
  return inRestrictedTenant(prisma,scope,env,async(tx,evidence) => {
    // Prevent even an empty result from being interpreted as CRM entitlement
    // for ORG_OWNER/ORG_ADMIN or a missing/disabled app.
    if (!evidence.enabledApps.includes("crm") ||
        !evidence.roleCodes.some(r => r === "SALES_REP" || r === "SALES_MANAGER")) {
      throw new P4R7CiReadDeniedError();
    }
    const rows = await tx.r7Lead.findMany({
      where: { orgId: evidence.organizationId },
      select: { orgId:true,id:true,ownerUserId:true,teamId:true,
        assignedUserId:true,shareState:true,displayName:true },
      orderBy: { id:"asc" }, take:20,
    });
    return Object.freeze(rows.map(row => checkRow(row,evidence)));
  });
}
/** Direct read does not reveal whether an absent/hidden row exists. */
export async function readP4R7CiLead(
  prisma: PrismaClient, scope: P4R7CiScope, recordId: unknown,
  env: CiEnv = process.env,
): Promise<P4R7CiLead> {
  let target: P4UuidV4;
  try { target = requireCanonicalUuidV4(recordId); }
  catch { throw new P4R7CiReadDeniedError(); }
  return inRestrictedTenant(prisma,scope,env,async(tx,evidence)=>{
    if (!evidence.enabledApps.includes("crm") ||
        !evidence.roleCodes.some(r => r === "SALES_REP" || r === "SALES_MANAGER")) {
      throw new P4R7CiReadDeniedError();
    }
    const row = await tx.r7Lead.findUnique({
      where: { orgId_id: { orgId: evidence.organizationId, id: target } },
      select: { orgId:true,id:true,ownerUserId:true,teamId:true,
        assignedUserId:true,shareState:true,displayName:true },
    });
    if (!row || row.id !== target) throw new P4R7CiReadDeniedError();
    return checkRow(row,evidence);
  });
}
