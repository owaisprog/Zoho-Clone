/**
 * Phase 4 Batch 11: synthetic-only P1.06 R0 IAM metadata readers.
 * Read-only. Fresh membership/role/app verification and scoped SQL RLS
 * happen in the same restricted tenant transaction on disposable CI only.
 * Never mounted on a live application or connected to owner Neon.
 */
import type { PrismaClient } from "../generated/p4-r7-ci/client.js";
import { isCanonicalUuidV4 } from "./p4-approved-uuid.js";
import { getP4R7ApprovedMatrixRow, type P4R7Evidence } from "./p4-r7-authorizer.js";
import {
  inRestrictedTenant,P4R7CiReadDeniedError,type P4R7CiScope,
} from "./p4-r7-ci-prisma-reader.js";

type Resource = "memberships"|"invitations"|"audit_events";
const ALLOWED_ROLES:ReadonlySet<string>=new Set([
  "ORG_OWNER","ORG_ADMIN","SALES_MANAGER","SALES_REP",
  "ONBOARDING_MANAGER","ONBOARDING_COORDINATOR","AGENT_MANAGER",
  "BILLING_ADMIN","SECURITY_REVIEWER","PLATFORM_SUPPORT",
  "EXTERNAL_AGENT","EXTERNAL_MERCHANT","SYSTEM_WORKER",
]);
function allow(e:P4R7Evidence,resource:Resource):void {
  if(!e.enabledApps.includes("platform") ||
    !e.roleCodes.some(r=>getP4R7ApprovedMatrixRow(r,resource)?.actions.some(a=>a==="R"))) {
    throw new P4R7CiReadDeniedError();
  }
  // Owner-approved design permits reviewer invite audit metadata, but the
  // exact field contract is still open. More restrictive CI-only denial.
  if(resource==="invitations" &&
      !e.roleCodes.some(r=>r==="ORG_OWNER"||r==="ORG_ADMIN")) {
    throw new P4R7CiReadDeniedError();
  }
}
function limitInput(limit:unknown):number {
  if(typeof limit!=="number"||!Number.isSafeInteger(limit) ||
      limit<1||limit>20)throw new P4R7CiReadDeniedError();
  return limit;
}
function safeTimestamp(value:unknown):string {
  if(!(value instanceof Date)||!Number.isFinite(value.valueOf())) {
    throw new P4R7CiReadDeniedError();
  }
  return value.toISOString();
}
export type P4R11SafeMember=Readonly<{userId:string;roleCode:string;active:boolean}>;
export type P4R11SafeInvite=Readonly<{
  id:string;status:"pending"|"accepted"|"revoked"|"expired";
  roleCode:"SALES_REP";expiresAt:string;
}>;
export type P4R11SafeAudit=Readonly<{
  id:string;actorId:string;action:string;occurredAt:string;
}>;
export async function readP4R11CiMembershipStatus(
  prisma:PrismaClient,scope:P4R7CiScope,limit=20,
  env:NodeJS.ProcessEnv=process.env,
):Promise<readonly P4R11SafeMember[]> {
  const max=limitInput(limit);
  return inRestrictedTenant(prisma,scope,env,async(tx,evidence)=>{
    allow(evidence,"memberships");
    const rows=await tx.$queryRawUnsafe<Array<{
      actorId:string;roleCode:string;active:boolean;
    }>>('SELECT actor_id AS "actorId",role_code AS "roleCode",active '+
      'FROM p4_r11_ci.read_member_roles() LIMIT 21');
    if(rows.length>max)throw new P4R7CiReadDeniedError();
    return Object.freeze(rows.map(row=>{
      if(!isCanonicalUuidV4(row.actorId) ||
          typeof row.roleCode!=="string" ||
          !ALLOWED_ROLES.has(row.roleCode) ||
          typeof row.active!=="boolean" ||
          (evidence.roleCodes.includes("ORG_ADMIN") &&
            ["ORG_OWNER","ORG_ADMIN","SECURITY_REVIEWER","PLATFORM_SUPPORT"].includes(row.roleCode) &&
            !evidence.roleCodes.includes("ORG_OWNER"))) {
        throw new P4R7CiReadDeniedError();
      }
      return Object.freeze({
        userId:row.actorId,roleCode:row.roleCode,active:row.active,
      });
    }));
  });
}
export async function readP4R11CiInvitationStatus(
  prisma:PrismaClient,scope:P4R7CiScope,limit=20,
  env:NodeJS.ProcessEnv=process.env,
):Promise<readonly P4R11SafeInvite[]> {
  const max=limitInput(limit);
  return inRestrictedTenant(prisma,scope,env,async(tx,evidence)=>{
    allow(evidence,"invitations");
    const rows=await tx.$queryRawUnsafe<Array<{
      orgId:string;id:string;roleCode:string;status:string;expiresAt:Date;
    }>>('SELECT organization_id AS "orgId",id,'+
      ' role_code AS "roleCode",status,expires_at AS "expiresAt"'+
      " FROM p4_r11_ci.invitation_status"+
      " WHERE organization_id::text=current_setting('app.tenant_id',true)"+
      " ORDER BY id LIMIT 21");
    if(rows.length>max)throw new P4R7CiReadDeniedError();
    return Object.freeze(rows.map(row=>{
      if(row.orgId!==evidence.organizationId ||
         !isCanonicalUuidV4(row.id) ||
         row.roleCode!=="SALES_REP" ||
         !["pending","accepted","revoked","expired"].includes(row.status)) {
        throw new P4R7CiReadDeniedError();
      }
      return Object.freeze({
        id:row.id,status:row.status as P4R11SafeInvite["status"],
        roleCode:"SALES_REP" as const,expiresAt:safeTimestamp(row.expiresAt),
      });
    }));
  });
}
export async function readP4R11CiAuditMetadata(
  prisma:PrismaClient,scope:P4R7CiScope,limit=20,
  env:NodeJS.ProcessEnv=process.env,
):Promise<readonly P4R11SafeAudit[]> {
  const max=limitInput(limit);
  return inRestrictedTenant(prisma,scope,env,async(tx,evidence)=>{
    allow(evidence,"audit_events");
    const rows=await tx.$queryRawUnsafe<Array<{
      orgId:string;id:string;actorId:string;action:string;occurredAt:Date;
    }>>('SELECT organization_id AS "orgId",id,'+
      ' actor_user_id AS "actorId",action,occurred_at AS "occurredAt"'+
      " FROM p4_r11_ci.audit_status"+
      " WHERE organization_id::text=current_setting('app.tenant_id',true)"+
      " ORDER BY id LIMIT 21");
    if(rows.length>max)throw new P4R7CiReadDeniedError();
    return Object.freeze(rows.map(row=>{
      if(row.orgId!==evidence.organizationId ||
        !isCanonicalUuidV4(row.id)||!isCanonicalUuidV4(row.actorId) ||
        !["role_grant.revoked","team_grant.revoked","invitation.created"].includes(row.action)){
        throw new P4R7CiReadDeniedError();
      }
      return Object.freeze({
        id:row.id,actorId:row.actorId,action:row.action,
        occurredAt:safeTimestamp(row.occurredAt),
      });
    }));
  });
}
