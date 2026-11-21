/**
 * P4 Batch 13: CI-only restricted team summaries and invite lifecycle reads.
 * Not imported by public app.ts. No writes, exports or invitation actions.
 */
import type { PrismaClient } from "../generated/p4-r7-ci/client.js";
import { isCanonicalUuidV4 } from "./p4-approved-uuid.js";
import { getP4R7ApprovedMatrixRow } from "./p4-r7-authorizer.js";
import {
  inRestrictedTenant,P4R7CiReadDeniedError,type P4R7CiScope,
} from "./p4-r7-ci-prisma-reader.js";
import { readP4R11CiInvitationStatus } from "./p4-r11-ci-iam-reader.js";

export type P4R13SafeTeam=Readonly<{
  id:string;name:string;memberCount:number;isManager:boolean;
}>;
export type P4R13SafeInvite=Readonly<{
  id:string;roleCode:"SALES_REP";
  status:"pending"|"accepted"|"revoked"|"expired";
  expiresAt:string;
}>;
function limitInput(value:unknown):number {
  if(typeof value!=="number"||!Number.isSafeInteger(value)||value<1||value>20)
    throw new P4R7CiReadDeniedError();
  return value;
}
function canonicalTime(value:unknown):number {
  if(typeof value!=="string"||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new P4R7CiReadDeniedError();
  }
  const result=Date.parse(value);
  if(!Number.isFinite(result)||new Date(result).toISOString()!==value)
    throw new P4R7CiReadDeniedError();
  return result;
}
/** RLS + explicit P1.06 role evidence from current restricted transaction. */
export async function readP4R13CiTeams(
  prisma:PrismaClient,scope:P4R7CiScope,limit=20,
  env:NodeJS.ProcessEnv=process.env,
):Promise<readonly P4R13SafeTeam[]> {
  const max=limitInput(limit);
  return inRestrictedTenant(prisma,scope,env,async(tx,evidence)=>{
    if(!evidence.enabledApps.includes("platform")||
       !evidence.roleCodes.some(r=>(r==="ORG_OWNER"||r==="ORG_ADMIN")&&
          getP4R7ApprovedMatrixRow(r,"memberships")?.actions.some(a=>a==="R"))) {
      throw new P4R7CiReadDeniedError();
    }
    const rows=await tx.$queryRawUnsafe<Array<{
      orgId:string;teamId:string;teamName:string;memberCount:bigint;isManager:boolean;
    }>>('SELECT org_id AS "orgId",team_id AS "teamId",'+
      'team_name AS "teamName",member_count AS "memberCount",'+
      'is_manager AS "isManager" FROM p4_r13_ci.read_team_summaries() LIMIT 21');
    if(rows.length>max)throw new P4R7CiReadDeniedError();
    const privileged=evidence.roleCodes.some(r=>
      ["ORG_OWNER","ORG_ADMIN","SECURITY_REVIEWER"].includes(r));
    return Object.freeze(rows.map(row=>{
      if(row.orgId!==evidence.organizationId||!isCanonicalUuidV4(row.teamId)||
        typeof row.teamName!=="string"||!row.teamName.startsWith("Demo ")||
        row.teamName.length>80||typeof row.isManager!=="boolean"||
        typeof row.memberCount!=="bigint"||row.memberCount<0n||
        row.memberCount>1000n||(!privileged&&!row.isManager)||
        (row.isManager&&!evidence.activeTeamGrants.some(t=>
          t.teamId===row.teamId&&t.managed&&t.active))) {
        throw new P4R7CiReadDeniedError();
      }
      return Object.freeze({
        id:row.teamId,name:row.teamName,
        memberCount:Number(row.memberCount),isManager:row.isManager,
      });
    }));
  });
}
/** R11 SQL grants stay authoritative. Only derives effective expiry at a supplied instant. */
export async function readP4R13CiInviteLifecycle(
  prisma:PrismaClient,scope:P4R7CiScope,asOf:string,limit=20,
  env:NodeJS.ProcessEnv=process.env,
):Promise<readonly P4R13SafeInvite[]> {
  const when=canonicalTime(asOf);
  const max=limitInput(limit);
  const rows=await readP4R11CiInvitationStatus(prisma,scope,max,env);
  return Object.freeze(rows.map(row=>{
    const expiry=canonicalTime(row.expiresAt);
    return Object.freeze({id:row.id,roleCode:row.roleCode,
      status:row.status==="pending"&&expiry<=when?"expired" as const:row.status,
      expiresAt:row.expiresAt});
  }));
}
