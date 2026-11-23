/**
 * P4 Batch 15: synthetic-only audit keyset pagination.
 * RLS companion SQL AND restricted Prisma transaction require current owner
 * or reviewer role. Never use as a production HTTP export/read route.
 */
import type { PrismaClient } from "../generated/p4-r7-ci/client.js";
import { isCanonicalUuidV4 } from "./p4-approved-uuid.js";
import { getP4R7ApprovedMatrixRow } from "./p4-r7-authorizer.js";
import {
  inRestrictedTenant,P4R7CiReadDeniedError,type P4R7CiScope,
} from "./p4-r7-ci-prisma-reader.js";
export type P4R15AuditEvent=Readonly<{
 id:string;actorId:string;action:
  "role_grant.revoked"|"team_grant.revoked"|"invitation.created";
 occurredAt:string;
}>;
export type P4R15AuditPage=Readonly<{
 data:readonly P4R15AuditEvent[];nextCursor:string|null;
}>;
const ACTIONS:ReadonlySet<string>=new Set([
 "role_grant.revoked","team_grant.revoked","invitation.created",
]);
function checkLimit(value:unknown):number{
 if(typeof value!=="number"||!Number.isSafeInteger(value)||
    value<1||value>20)throw new P4R7CiReadDeniedError();
 return value;
}
function checkCursor(value:unknown):string|null{
 if(value===null||value===undefined)return null;
 if(!isCanonicalUuidV4(value))throw new P4R7CiReadDeniedError();
 return value;
}
function safeDate(value:unknown):string{
 if(!(value instanceof Date)||!Number.isFinite(value.valueOf()))
  throw new P4R7CiReadDeniedError();
 return value.toISOString();
}
/** Strict next-page cursor is derived ONLY from actual visible event IDs. */
export async function readP4R15CiAuditPage(
 prisma:PrismaClient,scope:P4R7CiScope,
 options:Readonly<{limit?:number;afterId?:string|null}>={},
 env:NodeJS.ProcessEnv=process.env,
):Promise<P4R15AuditPage>{
 const limit=checkLimit(options?.limit??20);
 const cursor=checkCursor(options?.afterId);
 return inRestrictedTenant(prisma,scope,env,async(tx,evidence)=>{
  if(!evidence.enabledApps.includes("platform")||
     !evidence.roleCodes.some(r=>(r==="ORG_OWNER"||r==="SECURITY_REVIEWER")&&
       getP4R7ApprovedMatrixRow(r,"audit_events")?.actions.some(a=>a==="R"))){
   throw new P4R7CiReadDeniedError();
  }
  const rows=await tx.$queryRawUnsafe<Array<{
   orgId:string;eventId:string;actorId:string;actionCode:string;occurredAt:Date;
  }>>('SELECT org_id AS "orgId",event_id AS "eventId",'+
    'actor_id AS "actorId",action_code AS "actionCode",'+
    'occurred_at AS "occurredAt" FROM p4_r15_ci.read_audit_page($1::uuid,$2::integer)',
    cursor,limit+1);
  if(rows.length>limit+1)throw new P4R7CiReadDeniedError();
  let last=cursor;
  const projected=rows.map(row=>{
   if(row.orgId!==evidence.organizationId||
      !isCanonicalUuidV4(row.eventId)||!isCanonicalUuidV4(row.actorId)||
      !ACTIONS.has(row.actionCode)||
      (last!==null&&row.eventId<=last)){
    throw new P4R7CiReadDeniedError();
   }
   last=row.eventId;
   return Object.freeze({
    id:row.eventId,actorId:row.actorId,
    action:row.actionCode as P4R15AuditEvent["action"],
    occurredAt:safeDate(row.occurredAt),
   });
  });
  const hasNext=projected.length>limit;
  const data=Object.freeze(projected.slice(0,limit));
  return Object.freeze({
   data,
   nextCursor:hasNext?data[data.length-1]?.id??null:null,
  });
 });
}
