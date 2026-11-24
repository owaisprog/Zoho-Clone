/** R58 signed disposable PostgreSQL CRM stage changes with CAS + immutable history. */
import {randomUUID} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {parseP4R57CiLeadRow,type P4R57Lead}
 from "./p4-r57-ci-crm-leads.js";
export type P4R58LeadHistory=Readonly<{
 eventId:string;eventKind:"CREATED"|"STATUS_CHANGED";
 beforeStatus:"NEW"|"CONTACTED"|null;
 afterStatus:"NEW"|"CONTACTED"|"QUALIFIED"|"LOST";
 revision:number;actorUserId:string;occurredAt:string;
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const ERROR=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
function safe(row:Record<string,unknown>):P4R58LeadHistory{
 if(Object.keys(row).sort().join(",")!==
  "actor_user_id,after_status,before_status,event_id,event_kind,occurred_at,revision"||
  typeof row.event_id!=="string"||!UUID.test(row.event_id)||
  typeof row.actor_user_id!=="string"||!USER.test(row.actor_user_id)||
  (row.event_kind!=="CREATED"&&row.event_kind!=="STATUS_CHANGED")||
  !["NEW","CONTACTED","QUALIFIED","LOST"].includes(String(row.after_status))||
  !Number.isSafeInteger(row.revision)||(row.revision as number)<0||
  (row.revision as number)>1000000||
  (row.event_kind==="CREATED"&&
   (row.revision!==0||row.before_status!==null||row.after_status!=="NEW"))||
  (row.event_kind==="STATUS_CHANGED"&&
   (row.revision===0||row.before_status===null||
    row.before_status===row.after_status||
    !["NEW","CONTACTED"].includes(String(row.before_status))))||
  !(row.occurred_at instanceof Date)||
  !Number.isFinite(row.occurred_at.getTime()))
  return ERROR(503,"UNAVAILABLE");
 return Object.freeze({eventId:row.event_id,
  eventKind:row.event_kind as P4R58LeadHistory["eventKind"],
  beforeStatus:row.before_status as P4R58LeadHistory["beforeStatus"],
  afterStatus:row.after_status as P4R58LeadHistory["afterStatus"],
  revision:row.revision as number,actorUserId:row.actor_user_id,
  occurredAt:row.occurred_at.toISOString()});
}
export class P4R58CiCrmLeadStages{
 constructor(private readonly pool:pg.Pool,
  private readonly env:NodeJS.ProcessEnv=process.env){}
 private async txn<T>(actor:P4R28Actor|null,org:unknown,
  mode:"READ ONLY"|"READ WRITE",callback:(c:pg.PoolClient,org:string)=>Promise<T>):Promise<T>{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return ERROR(503,"UNAVAILABLE");}
  if(!actor||actor.verified!==true||!USER.test(actor.userId))
   return ERROR(401,"IDENTITY_REQUIRED");
  if(typeof org!=="string"||!UUID.test(org))
   return ERROR(403,"ACCESS_DENIED");
  let client:pg.PoolClient;
  try{client=await this.pool.connect();}
  catch{return ERROR(503,"UNAVAILABLE");}
  let active=false,discard=false;
  try{
   await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ "+mode);active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query("SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,org]);
   const role=await client.query("SELECT current_user AS name,"+
    "(SELECT rolsuper OR rolbypassrls FROM pg_roles"+
    " WHERE rolname=current_user) AS privileged");
   if(role.rows[0]?.name!=="p4_synthetic_ci_runtime"||
    role.rows[0]?.privileged!==false)return ERROR(403,"ACCESS_DENIED");
   const result=await callback(client,org);
   await client.query("COMMIT");active=false;
   return result;
  }catch(e){
   if(active){try{await client.query("ROLLBACK");}catch{discard=true;}}
   if(e instanceof P4R28Denied)throw e;
   if(e&&typeof e==="object"&&"code" in e){
    if(e.code==="P4003")return ERROR(403,"ACCESS_DENIED");
    if(e.code==="P5800")return ERROR(400,"INVALID_INPUT");
    if(e.code==="P4009"||e.code==="23505")return ERROR(409,"CONFLICT");
   }
   return ERROR(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
 async change(actor:P4R28Actor|null,org:string,leadId:unknown,input:unknown):
  Promise<P4R57Lead>{
  if(typeof leadId!=="string"||!UUID.test(leadId)||
   !input||typeof input!=="object"||Array.isArray(input)||
   Object.keys(input).sort().join(",")!=="expectedRevision,status")
   return ERROR(400,"INVALID_INPUT");
  const value=input as Record<string,unknown>;
  if((value.status!=="CONTACTED"&&value.status!=="QUALIFIED"&&
   value.status!=="LOST")||!Number.isSafeInteger(value.expectedRevision)||
   (value.expectedRevision as number)<0||
   (value.expectedRevision as number)>=1000000)
   return ERROR(400,"INVALID_INPUT");
  return this.txn(actor,org,"READ WRITE",async(c,id)=>{
   const result=await c.query("SELECT lead_id::text,company_name,contact_email,"+
    "source,status,revision,created_at FROM"+
    " p4_r58_ci.change_lead_status($1,$2,$3,$4,$5)",[
     id,leadId,value.status,value.expectedRevision,randomUUID()]);
   if(result.rows.length!==1)return ERROR(503,"UNAVAILABLE");
   const lead=parseP4R57CiLeadRow(result.rows[0]);
   if(lead.leadId!==leadId||lead.status!==value.status||
    lead.revision!==(value.expectedRevision as number)+1)
    return ERROR(503,"UNAVAILABLE");
   return lead;
  });
 }
 async history(actor:P4R28Actor|null,org:string,leadId:unknown):
  Promise<readonly P4R58LeadHistory[]>{
  if(typeof leadId!=="string"||!UUID.test(leadId))
   return ERROR(400,"INVALID_INPUT");
  return this.txn(actor,org,"READ ONLY",async(c,id)=>{
   const rows=await c.query("SELECT event_id::text,event_kind,before_status,"+
    "after_status,revision,actor_user_id,occurred_at"+
    " FROM p4_r58_ci.list_lead_history($1,$2)",[id,leadId]);
   if(rows.rows.length>20)return ERROR(503,"UNAVAILABLE");
   const events=rows.rows.map(safe);
   if(new Set(events.map(x=>x.eventId)).size!==events.length||
    events.some((x,i)=>x.revision!==i||
     (i>0&&x.eventKind!=="STATUS_CHANGED")))
    return ERROR(503,"UNAVAILABLE");
   return Object.freeze(events);
  });
 }
}
