/**
 * P4 Batch 14: only allowlisted organization/role metadata from disposable CI.
 * Inaccessible from app.ts. Caller actor is server-mapped Auth0 subject, never
 * browser-controlled role. SQL and Prisma both enforce fresh grants.
 */
import type { PrismaClient } from "../generated/p4-r7-ci/client.js";
import { isCanonicalUuidV4 } from "./p4-approved-uuid.js";
import { getP4R7ApprovedMatrixRow } from "./p4-r7-authorizer.js";
import { P4_R7_P106_ROLES } from "./p4-r7-approved-policy-matrix.js";
import {
  inRestrictedTenant,P4R7CiReadDeniedError,type P4R7CiScope,
} from "./p4-r7-ci-prisma-reader.js";

const ALL_ROLES:ReadonlySet<string>=new Set(P4_R7_P106_ROLES);
type SafeOrg=Readonly<{id:string;displayName?:string}>;
type SafeRole=Readonly<{roleCode:string;activeCount?:number}>;
function allowed(roles:readonly string[],resource:"organization"|"role_grants"){
 return roles.some(r=>getP4R7ApprovedMatrixRow(r,resource)?.actions.some(a=>a==="R"));
}
function hasFullOrg(roles:readonly string[]):boolean{
 return roles.includes("ORG_OWNER")||roles.includes("ORG_ADMIN");
}
function hasRoleCounts(roles:readonly string[]):boolean{
 return hasFullOrg(roles);
}
function checkCount(limit:number):number{
 if(!Number.isSafeInteger(limit)||limit<1||limit>20)throw new P4R7CiReadDeniedError();
 return limit;
}
/** No slug, creator, billing details, API tokens or identity subjects. */
export async function readP4R14CiOrganization(
 prisma:PrismaClient,scope:P4R7CiScope,env:NodeJS.ProcessEnv=process.env,
):Promise<SafeOrg>{
 return inRestrictedTenant(prisma,scope,env,async(tx,e)=>{
  if(!e.enabledApps.includes("platform")||!allowed(e.roleCodes,"organization"))
   throw new P4R7CiReadDeniedError();
  const rows=await tx.$queryRawUnsafe<Array<{orgId:string;displayName:string|null}>>(
   'SELECT org_id AS "orgId",display_name AS "displayName" FROM p4_r14_ci.read_organization()');
  if(rows.length!==1||rows[0]?.orgId!==e.organizationId)
   throw new P4R7CiReadDeniedError();
  const label=rows[0].displayName;
  if(hasFullOrg(e.roleCodes)){
   if(typeof label!=="string"||!/^Demo [A-Za-z0-9 ]{2,72}$/.test(label))
    throw new P4R7CiReadDeniedError();
   return Object.freeze({id:e.organizationId,displayName:label});
  }
  if(label!==null)throw new P4R7CiReadDeniedError();
  return Object.freeze({id:e.organizationId});
 });
}
/** Role codes and bounded counts, never actor/member identifiers. */
export async function readP4R14CiRoleSummaries(
 prisma:PrismaClient,scope:P4R7CiScope,limit=20,env:NodeJS.ProcessEnv=process.env,
):Promise<readonly SafeRole[]>{
 const max=checkCount(limit);
 return inRestrictedTenant(prisma,scope,env,async(tx,e)=>{
  if(!e.enabledApps.includes("platform")||!allowed(e.roleCodes,"role_grants"))
    throw new P4R7CiReadDeniedError();
  const rows=await tx.$queryRawUnsafe<Array<{
   orgId:string;roleCode:string;activeCount:bigint|null;
  }>>('SELECT org_id AS "orgId",role_code AS "roleCode",'+
    'active_count AS "activeCount" FROM p4_r14_ci.read_role_summaries() LIMIT 21');
  if(rows.length>max)throw new P4R7CiReadDeniedError();
  const seen=new Set<string>();
  const full=hasRoleCounts(e.roleCodes);
  return Object.freeze(rows.map(row=>{
   if(row.orgId!==e.organizationId||!ALL_ROLES.has(row.roleCode)||
      seen.has(row.roleCode)||
      (e.roleCodes.includes("ORG_ADMIN")&&!e.roleCodes.includes("ORG_OWNER")&&
       ["ORG_OWNER","ORG_ADMIN","SECURITY_REVIEWER","PLATFORM_SUPPORT"].includes(row.roleCode)))
    throw new P4R7CiReadDeniedError();
   seen.add(row.roleCode);
   if(full){
    if(typeof row.activeCount!=="bigint"||row.activeCount<1n||
       row.activeCount>1000n)throw new P4R7CiReadDeniedError();
    return Object.freeze({roleCode:row.roleCode,activeCount:Number(row.activeCount)});
   }
   if(row.activeCount!==null)throw new P4R7CiReadDeniedError();
   return Object.freeze({roleCode:row.roleCode});
  }));
 });
}
