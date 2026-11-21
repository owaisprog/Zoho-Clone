/**
 * ADR 0008 / P4 Batch 09: synthetic CRM search and RLS-bounded reporting.
 *
 * Pure read-only queries with strict input limits, current DB membership,
 * CRM role and entitlement, server-enforced FORCE RLS, and a second P1.06
 * record-level check on every returned row. Never imported in app.ts.
 * NO export/CSV/worker/production endpoints or real customer data.
 */
import type { PrismaClient } from "../generated/p4-r7-ci/client.js";
import { requireCanonicalUuidV4 } from "./p4-approved-uuid.js";
import {
  inRestrictedTenant,
  P4R7CiReadDeniedError,
  type P4R7CiLead, type P4R7CiScope,
} from "./p4-r7-ci-prisma-reader.js";
import {
  authorizeP4R7Synthetic, projectP4R7SyntheticLead,
  type P4R7Evidence, type P4R7Record,
} from "./p4-r7-authorizer.js";

const FIELDS = Object.freeze(["id","displayName"] as const);
const SELECT = Object.freeze({
  orgId:true,id:true,ownerUserId:true,teamId:true,assignedUserId:true,
  shareState:true,displayName:true,
});
type SelectedLead = Readonly<{
  orgId:string;id:string;ownerUserId:string;teamId:string;
  assignedUserId:string|null;shareState:string;displayName:string;
}>;
const ALLOWED_SEARCH=/^[A-Za-z0-9 ]{1,40}$/;
function scopeAllowsCrm(e: P4R7Evidence): void {
  if (!e.enabledApps.includes("crm") ||
      !e.roleCodes.some(r=>r==="SALES_REP"||r==="SALES_MANAGER")) {
    throw new P4R7CiReadDeniedError();
  }
}
function safeLead(row: SelectedLead, evidence:P4R7Evidence):P4R7CiLead {
  if (row.orgId!==evidence.organizationId ||
      (row.shareState!=="private"&&row.shareState!=="explicit_team")) {
    throw new P4R7CiReadDeniedError();
  }
  const rec: P4R7Record={
    organizationId:row.orgId,id:row.id,
    ownerUserId:row.ownerUserId,teamId:row.teamId,
    shareState:row.shareState,
    assignedUserIds:row.assignedUserId?[row.assignedUserId]:[],
  };
  const d=authorizeP4R7Synthetic(evidence,"leads","R",rec,FIELDS);
  if(!d.allowed)throw new P4R7CiReadDeniedError();
  return projectP4R7SyntheticLead(d,row);
}
export type P4R9SearchInput=Readonly<{
  text: string;
  limit?: number;
  afterId?: string;
}>;
export type P4R9SearchResult=Readonly<{
  records: readonly P4R7CiLead[];
  nextCursor: string | null;
}>;
/**
 * Keyset cursor compares UUID in SQL and does not query cursor ownership
 * or expose its existence. Never page unauthorized rows in app memory.
 * A single extra RLS-filtered row is fetched only to detect a next page.
 */
export async function searchP4R9CiLeads(
  prisma:PrismaClient,scope:P4R7CiScope,search:P4R9SearchInput,
  env:NodeJS.ProcessEnv=process.env,
):Promise<P4R9SearchResult> {
  if(!search||typeof search.text!=="string"||!ALLOWED_SEARCH.test(search.text)||
     search.text.trim().length===0||
     (search.limit!==undefined&&(!Number.isSafeInteger(search.limit)||
       search.limit<1||search.limit>20)))throw new P4R7CiReadDeniedError();
  const term=search.text.trim();
  let after:string|undefined;
  if(search.afterId!==undefined){
    try{after=requireCanonicalUuidV4(search.afterId);}
    catch{throw new P4R7CiReadDeniedError();}
  }
  const limit=search.limit??10;
  return inRestrictedTenant(prisma,scope,env,async(tx,evidence)=>{
    scopeAllowsCrm(evidence);
    const rows=await tx.r7Lead.findMany({
      where:{orgId:evidence.organizationId,
        displayName:{contains:term,mode:"insensitive"},
        ...(after?{id:{gt:after}}:{})},
      select:SELECT,
      orderBy:{id:"asc"},
      take:limit+1,
    });
    if(rows.length>limit+1)throw new P4R7CiReadDeniedError();
    // Do not send any data if policy state and SQL RLS ever disagree.
    const projected=rows.map(row=>safeLead(row,evidence));
    const visible=projected.slice(0,limit);
    return Object.freeze({
      records:Object.freeze(visible),
      nextCursor:projected.length>limit?
        (visible.at(-1)?.id??null):null,
    });
  });
}
export type P4R9Report=Readonly<{
  metric:"visible_crm_leads";
  totalVisible: number;
  privateVisible: number;
  explicitlyTeamSharedVisible: number;
}>;
/**
 * CI-only bounded summary. The 100-row limit is deliberately small: if
 * larger, DENY instead of displaying an incorrect count or exporting data.
 * RLS filters before fetching; check all returned rows against P1.06 ABAC.
 * Do not promote this bounded demonstration into a production analytics API.
 */
export async function readP4R9CiVisibleReport(
  prisma:PrismaClient,scope:P4R7CiScope,
  env:NodeJS.ProcessEnv=process.env,
):Promise<P4R9Report> {
  return inRestrictedTenant(prisma,scope,env,async(tx,evidence)=>{
    scopeAllowsCrm(evidence);
    const total=await tx.r7Lead.count({where:{orgId:evidence.organizationId}});
    if(!Number.isSafeInteger(total)||total<0||total>100){
      throw new P4R7CiReadDeniedError();
    }
    const rows=await tx.r7Lead.findMany({
      where:{orgId:evidence.organizationId},select:SELECT,
      orderBy:{id:"asc"},take:101,
    });
    if(rows.length!==total)throw new P4R7CiReadDeniedError();
    rows.forEach(row=>safeLead(row,evidence));
    return Object.freeze({
      metric:"visible_crm_leads" as const,totalVisible:total,
      privateVisible:rows.filter(r=>r.shareState==="private").length,
      explicitlyTeamSharedVisible:
        rows.filter(r=>r.shareState==="explicit_team").length,
    });
  });
}
