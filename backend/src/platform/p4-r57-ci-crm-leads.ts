/** R57 persisted fictional CRM leads, owner-only signed CI PostgreSQL. */
import {randomUUID} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
export type P4R57LeadStatus="NEW"|"CONTACTED"|"QUALIFIED"|"LOST";
export type P4R57LeadSource="WEBSITE"|"REFERRAL"|"EVENT";
export type P4R57Lead=Readonly<{leadId:string;companyName:string;
 contactEmail:string;source:P4R57LeadSource;status:P4R57LeadStatus;
 revision:number;createdAt:string}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const NAME=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$/;
const EMAIL=/^[a-z][a-z0-9._-]{1,40}@example\.com$/;
const SOURCES=new Set<P4R57LeadSource>(["WEBSITE","REFERRAL","EVENT"]);
const STATUSES=new Set<P4R57LeadStatus>(["NEW","CONTACTED","QUALIFIED","LOST"]);
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
export function parseP4R57CiLeadRow(row:Record<string,unknown>):P4R57Lead{
 if(Object.keys(row).sort().join(",")!==
  "company_name,contact_email,created_at,lead_id,revision,source,status"||
  typeof row.lead_id!=="string"||!UUID.test(row.lead_id)||
  typeof row.company_name!=="string"||!NAME.test(row.company_name)||
  typeof row.contact_email!=="string"||!EMAIL.test(row.contact_email)||
  typeof row.source!=="string"||!SOURCES.has(row.source as P4R57LeadSource)||
  typeof row.status!=="string"||!STATUSES.has(row.status as P4R57LeadStatus)||
  !Number.isSafeInteger(row.revision)||(row.revision as number)<0||
  (row.revision as number)>1000000||!(row.created_at instanceof Date)||
  !Number.isFinite(row.created_at.getTime()))return fail(503,"UNAVAILABLE");
 return Object.freeze({
  leadId:row.lead_id,companyName:row.company_name,
  contactEmail:row.contact_email,source:row.source as P4R57LeadSource,
  status:row.status as P4R57LeadStatus,revision:row.revision as number,
  createdAt:row.created_at.toISOString(),
 });
}
export class P4R57CiCrmLeads{
 constructor(private readonly pool:pg.Pool,
  private readonly env:NodeJS.ProcessEnv=process.env){}
 private async transact<T>(actor:P4R28Actor|null,org:unknown,
  mode:"READ ONLY"|"READ WRITE",
  callback:(client:pg.PoolClient,id:string)=>Promise<T>):Promise<T>{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return fail(503,"UNAVAILABLE");}
  if(!actor||actor.verified!==true||!USER.test(actor.userId))
   return fail(401,"IDENTITY_REQUIRED");
  if(typeof org!=="string"||!UUID.test(org))
   return fail(403,"ACCESS_DENIED");
  let client:pg.PoolClient;
  try{client=await this.pool.connect();}
  catch{return fail(503,"UNAVAILABLE");}
  let active=false,discard=false;
  try{
   await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ "+mode);active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query("SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,org]);
   const roles=await client.query("SELECT current_user AS role,"+
    "(SELECT rolsuper OR rolbypassrls FROM pg_roles"+
    " WHERE rolname=current_user) AS privileged");
   if(roles.rows[0]?.role!=="p4_synthetic_ci_runtime"||
    roles.rows[0]?.privileged!==false)return fail(403,"ACCESS_DENIED");
   const result=await callback(client,org);
   await client.query("COMMIT");active=false;
   return result;
  }catch(e){
   if(active){try{await client.query("ROLLBACK");}catch{discard=true;}}
   if(e instanceof P4R28Denied)throw e;
   if(e&&typeof e==="object"&&"code" in e){
    if(e.code==="P4003")return fail(403,"ACCESS_DENIED");
    if(e.code==="P5700")return fail(400,"INVALID_INPUT");
    if(e.code==="P4009"||e.code==="23505")return fail(409,"CONFLICT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
 async create(actor:P4R28Actor|null,org:string,body:unknown):Promise<P4R57Lead>{
  if(!body||typeof body!=="object"||Array.isArray(body)||
   Object.keys(body).sort().join(",")!=="companyName,contactEmail,source")
   return fail(400,"INVALID_INPUT");
  const v=body as Record<string,unknown>;
  if(typeof v.companyName!=="string"||!NAME.test(v.companyName)||
   typeof v.contactEmail!=="string"||!EMAIL.test(v.contactEmail)||
   !SOURCES.has(v.source as P4R57LeadSource))
   return fail(400,"INVALID_INPUT");
  return this.transact(actor,org,"READ WRITE",async(client,id)=>{
   const rows=await client.query("SELECT lead_id::text,company_name,"+
    "contact_email,source,status,revision,created_at FROM"+
    " p4_r57_ci.create_lead($1,$2,$3,$4,$5,$6)",
    [id,randomUUID(),randomUUID(),v.companyName,v.contactEmail,v.source]);
   if(rows.rows.length!==1)return fail(503,"UNAVAILABLE");
   return parseP4R57CiLeadRow(rows.rows[0]);
  });
 }
 async list(actor:P4R28Actor|null,org:string):Promise<readonly P4R57Lead[]>{
  return this.transact(actor,org,"READ ONLY",async(client,id)=>{
   const rows=await client.query("SELECT lead_id::text,company_name,"+
    "contact_email,source,status,revision,created_at FROM"+
    " p4_r57_ci.list_leads($1)",[id]);
   if(rows.rows.length>20)return fail(503,"UNAVAILABLE");
   const output=rows.rows.map(parseP4R57CiLeadRow);
   if(new Set(output.map(x=>x.leadId)).size!==output.length||
    new Set(output.map(x=>x.contactEmail)).size!==output.length||
    output.some((x,i)=>i>0&&x.createdAt>output[i-1]!.createdAt))
    return fail(503,"UNAVAILABLE");
   return Object.freeze(output);
  });
 }
}
