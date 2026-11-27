import pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
export type LeadSource="WEBSITE"|"REFERRAL"|"EVENT";
export type LeadStatus="NEW"|"CONTACTED"|"QUALIFIED"|"LOST"|"CONVERTED";
export type Lead={id:string;companyName:string;contactEmail:string;source:LeadSource;status:LeadStatus;revision:number};
export type CreateLead={id:string;requestId:string;companyName:string;contactEmail:string;source:LeadSource};
export type LeadFilter={search:string;source:LeadSource|null;status:LeadStatus|null};
export type ChangeLead={requestId:string;expectedRevision:number}&({operation:"edit";companyName:string;contactEmail:string;source:LeadSource}|{operation:"transition";nextStatus:Exclude<LeadStatus,"NEW"|"CONVERTED">});
export function parseLeadFilter(x:unknown):LeadFilter{
 if(!exact(x,"search,source,status")||typeof x.search!=="string"||!(/^[A-Za-z0-9 &.@_-]{0,50}$/).test(x.search)||(x.source!==null&&!source(x.source))||(x.status!==null&&!status(x.status)))return fail(400);
 return {search:x.search,source:x.source,status:x.status};
}
export function parseChangeLead(x:unknown):ChangeLead{
 if(!x||typeof x!=="object"||Array.isArray(x))return fail(400);
 const v=x as Record<string,unknown>;
 if(!isCanonicalUuidV4(v.requestId)||typeof v.expectedRevision!=="number"||!Number.isInteger(v.expectedRevision)||v.expectedRevision<0||v.expectedRevision>=1000000)return fail(400);
 const base={requestId:v.requestId,expectedRevision:v.expectedRevision};
 if(v.operation==="edit"&&exact(v,"companyName,contactEmail,expectedRevision,operation,requestId,source")&&company(v.companyName)&&email(v.contactEmail)&&source(v.source))return {...base,operation:"edit",companyName:v.companyName,contactEmail:v.contactEmail,source:v.source};
 if(v.operation==="transition"&&exact(v,"expectedRevision,nextStatus,operation,requestId")&&(v.nextStatus==="CONTACTED"||v.nextStatus==="QUALIFIED"||v.nextStatus==="LOST"))return {...base,operation:"transition",nextStatus:v.nextStatus};
 return fail(400);
}
export function parseHistory(value:unknown,after:number){
 if(!Array.isArray(value)||value.length>21)return fail(503);
 let prior=after;
 const rows=value.map((v:unknown)=>{
  if(!exact(v,"action,nextStatus,previousStatus,revision")||typeof v.revision!=="number"||!Number.isInteger(v.revision)||v.revision<=prior||v.revision>1000000)return fail(503);
  const valid=(v.action==="CREATED"&&v.revision===0&&v.previousStatus===null&&v.nextStatus===null)||
   ((v.action==="EDITED"||v.action==="ASSIGNED")&&v.revision>0&&v.previousStatus===null&&v.nextStatus===null)||
   (v.action==="STAGE_CHANGED"&&v.revision>0&&((v.previousStatus==="NEW"&&v.nextStatus==="CONTACTED")||(v.previousStatus==="CONTACTED"&&(v.nextStatus==="QUALIFIED"||v.nextStatus==="LOST"))));
  if(!valid&&!(v.action==="CONVERTED"&&v.revision>0&&v.previousStatus==="QUALIFIED"&&v.nextStatus==="CONVERTED"))return fail(503);
  prior=v.revision;return {action:v.action,revision:v.revision,previousStatus:v.previousStatus,nextStatus:v.nextStatus};
 });
 return {items:rows.slice(0,20),nextCursor:rows.length===21?rows[19]!.revision:null};
}
export function parseAssignment(x:unknown){
 if(!exact(x,"expectedRevision,ownerId,requestId")||!isCanonicalUuidV4(x.ownerId)||!isCanonicalUuidV4(x.requestId)||typeof x.expectedRevision!=="number"||!Number.isInteger(x.expectedRevision)||x.expectedRevision<0||x.expectedRevision>=1000000)return fail(400);
 return {ownerId:x.ownerId,requestId:x.requestId,expectedRevision:x.expectedRevision};
}
export function parseAssignmentOptions(x:unknown,after:string|null){
 if(!exact(x,"currentOwnerId,eligible,revision")||!isCanonicalUuidV4(x.currentOwnerId)||typeof x.revision!=="number"||!Number.isInteger(x.revision)||x.revision<0||x.revision>1000000||!Array.isArray(x.eligible)||x.eligible.length>21)return fail(503);
 let prior:string|null=after;
 const ids=x.eligible.map((v:unknown)=>{if(!isCanonicalUuidV4(v)||(prior!==null&&v<=prior))return fail(503);prior=v;return v;});
 return {currentOwnerId:x.currentOwnerId,revision:x.revision,items:ids.slice(0,20),nextCursor:ids.length===21?ids[19]!:null};
}
export class LeadError extends Error{constructor(readonly status:400|403|404|409|503){super("P5_LEAD_REQUEST_FAILED");}}
const fail=(status:400|403|404|409|503):never=>{throw new LeadError(status);};
const exact=(v:unknown,keys:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===keys;
const source=(v:unknown):v is LeadSource=>v==="WEBSITE"||v==="REFERRAL"||v==="EVENT";
const status=(v:unknown):v is LeadStatus=>v==="NEW"||v==="CONTACTED"||v==="QUALIFIED"||v==="LOST"||v==="CONVERTED";
const company=(v:unknown):v is string=>typeof v==="string"&&/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$/.test(v);
const email=(v:unknown):v is string=>typeof v==="string"&&/^[a-z][a-z0-9._-]{1,40}@example[.]com$/.test(v);
export function parseCreateLead(x:unknown):CreateLead{
 if(!exact(x,"companyName,contactEmail,id,requestId,source")||!isCanonicalUuidV4(x.id)||!isCanonicalUuidV4(x.requestId)||!company(x.companyName)||!email(x.contactEmail)||!source(x.source))return fail(400);
 return {id:x.id,requestId:x.requestId,companyName:x.companyName,contactEmail:x.contactEmail,source:x.source};
}
export function parseLead(x:unknown):Lead{
 if(!exact(x,"companyName,contactEmail,id,revision,source,status")||!isCanonicalUuidV4(x.id)||!company(x.companyName)||!email(x.contactEmail)||!source(x.source)||!status(x.status)||typeof x.revision!=="number"||!Number.isInteger(x.revision)||x.revision<0||x.revision>1000000)return fail(503);
 return {id:x.id,companyName:x.companyName,contactEmail:x.contactEmail,source:x.source,status:x.status,revision:x.revision};
}
export class CiP5Leads{
 private readonly pool:pg.Pool;
 constructor(private readonly env:NodeJS.ProcessEnv=process.env){
  this.guard();
  this.pool=new pg.Pool({host:"127.0.0.1",port:5432,database:"zoho_clone_synthetic_ci",user:"p5_ci_runtime",password:"fake_ci_not_for_real_accounts",max:2,connectionTimeoutMillis:2000,statement_timeout:5000});
 }
 private guard(){
  assertP4V1CiPrismaEnvironment(this.env);
  if(this.env.P5_LEADS_CI!=="true"||this.env.VERCEL!==undefined||this.env.VERCEL_ENV!==undefined)return fail(503);
 }
 protected scope(x:StageIdentity,org:string){
  if(!x||!/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.auth0\.com\/$/.test(x.issuer)||!/^auth0\|[A-Za-z0-9_-]{3,180}$/.test(x.subject)||!isCanonicalUuidV4(org))return fail(403);
  return [x.issuer,x.subject,org];
 }
 protected async transaction<T>(write:boolean,run:(c:pg.PoolClient)=>Promise<T>):Promise<T>{
  this.guard();const c=await this.pool.connect();let discard=false;
  try{
   await c.query(write?"BEGIN ISOLATION LEVEL SERIALIZABLE":"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
   const r=await c.query(`SELECT current_database()='zoho_clone_synthetic_ci' AND current_user='p5_ci_runtime' AND session_user=current_user
   AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT(rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication OR rolinherit))
   AND NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=current_user)
   AND NOT has_schema_privilege(current_user,'p5_ci','CREATE') AND NOT has_schema_privilege(current_user,'platform_stage','CREATE')
   AND (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='p5_ci' AND c.relkind='r' AND c.relname IN ('leads','lead_events','stage_edit_grants','accounts','account_events','contacts','contact_events','deals','conversions','deal_events','pipelines','pipeline_admin_grants','pipeline_events','activities','followups','forecast_inputs','email_templates','email_logs','customer_handoffs','saved_views','merge_audit','import_jobs','import_rows','webforms','capture_submissions','lead_source_history','scoring_rules','lead_assignment_rules','qualification_reasons','crm_settings','account_relationships','customization_grants','custom_field_definitions','custom_field_values')
    AND c.relrowsecurity AND c.relforcerowsecurity AND c.relowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
    AND NOT has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') AND NOT has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,TRIGGER'))=34
   AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='platform_stage' AND c.relkind='r'
    AND (has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') OR has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,TRIGGER'))) AS valid`);
   if(r.rows[0]?.valid!==true)return fail(503);
   const value=await run(c);await c.query("COMMIT");return value;
  }catch(e){try{await c.query("ROLLBACK");}catch{discard=true;}if(e instanceof LeadError)throw e;
   if(e&&typeof e==="object"&&"code" in e){if(e.code==="42501")return fail(403);if(e.code==="P5004")return fail(404);if(e.code==="22023")return fail(400);if(e.code==="23505"||e.code==="23503"||e.code==="40001")return fail(409);}
   return fail(503);
  }finally{c.release(discard);}
 }
 async list(x:StageIdentity,org:string,after:string|null=null,rawFilter:unknown={search:"",source:null,status:null}){
  const args=this.scope(x,org),filter=parseLeadFilter(rawFilter);if(after!==null&&!isCanonicalUuidV4(after))return fail(400);
  return this.transaction(false,async c=>{
   const r=await c.query("SELECT p5_ci.search_leads($1,$2,$3,$4,$5,$6,$7) AS data",[...args,after,filter.search,filter.source,filter.status]);const data=r.rows[0]?.data;
   if(!Array.isArray(data)||data.length>21)return fail(503);
   let previous:string|null=after;const items=data.map(x=>{const row=parseLead(x);if(previous!==null&&row.id<=previous)return fail(503);previous=row.id;return row;});
   return {items:items.slice(0,20),nextCursor:items.length===21?items[19]!.id:null};
  });
 }
 async detail(x:StageIdentity,org:string,id:string){
  const args=this.scope(x,org);if(!isCanonicalUuidV4(id))return fail(400);
  return this.transaction(false,async c=>{
   const r=await c.query("SELECT p5_ci.read_leads($1,$2,$3,NULL,$4) AS data",[...args,id]);
   if(r.rows[0]?.data===null)return fail(404);const lead=parseLead(r.rows[0]?.data);if(lead.id!==id)return fail(503);return lead;
  });
 }
 async create(x:StageIdentity,org:string,raw:unknown){
  const args=this.scope(x,org),cmd=parseCreateLead(raw);
  return this.transaction(true,async c=>{
   const r=await c.query("SELECT p5_ci.create_lead($1,$2,$3,$4,$5,$6,$7,$8) AS data",[...args,cmd.id,cmd.requestId,cmd.companyName,cmd.contactEmail,cmd.source]);
   const data:unknown=r.rows[0]?.data;
   if(!exact(data,"lead,outcome")||(data.outcome!=="created"&&data.outcome!=="replay"))return fail(503);
   const lead=parseLead(data.lead);if(lead.id!==cmd.id)return fail(503);
   return {outcome:data.outcome,lead};
  });
 }
 async change(x:StageIdentity,org:string,id:string,raw:unknown){
  const args=this.scope(x,org),cmd=parseChangeLead(raw);if(!isCanonicalUuidV4(id))return fail(400);
  return this.transaction(true,async c=>{
   const r=await c.query("SELECT p5_ci.change_lead($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) AS data",[...args,id,cmd.requestId,cmd.expectedRevision,cmd.operation,cmd.operation==="edit"?cmd.companyName:null,cmd.operation==="edit"?cmd.contactEmail:null,cmd.operation==="edit"?cmd.source:null,cmd.operation==="transition"?cmd.nextStatus:null]);
   const data:unknown=r.rows[0]?.data;
   if(!exact(data,"lead,outcome")||(data.outcome!=="applied"&&data.outcome!=="replay"))return fail(503);
   const lead=parseLead(data.lead);if(lead.id!==id)return fail(503);return {outcome:data.outcome,lead};
  });
 }
 async history(x:StageIdentity,org:string,id:string,after=-1){
  const args=this.scope(x,org);if(!isCanonicalUuidV4(id)||!Number.isInteger(after)||after< -1||after>1000000)return fail(400);
  return this.transaction(false,async c=>parseHistory((await c.query("SELECT p5_ci.lead_history($1,$2,$3,$4,$5) AS data",[...args,id,after])).rows[0]?.data,after));
 }
 async assignmentOptions(x:StageIdentity,org:string,id:string,after:string|null=null){
  const args=this.scope(x,org);if(!isCanonicalUuidV4(id)||(after!==null&&!isCanonicalUuidV4(after)))return fail(400);
  return this.transaction(false,async c=>parseAssignmentOptions((await c.query("SELECT p5_ci.assignment_options($1,$2,$3,$4,$5) AS data",[...args,id,after])).rows[0]?.data,after));
 }
 async assign(x:StageIdentity,org:string,id:string,raw:unknown){
  const args=this.scope(x,org),cmd=parseAssignment(raw);if(!isCanonicalUuidV4(id))return fail(400);
  return this.transaction(true,async c=>{
   const data:unknown=(await c.query("SELECT p5_ci.assign_lead($1,$2,$3,$4,$5,$6,$7) AS data",[...args,id,cmd.requestId,cmd.expectedRevision,cmd.ownerId])).rows[0]?.data;
   if(!exact(data,"lead,outcome")||(data.outcome!=="applied"&&data.outcome!=="replay"))return fail(503);
   const lead=parseLead(data.lead);if(lead.id!==id)return fail(503);return {outcome:data.outcome,lead};
  });
 }
 async duplicates(x:StageIdentity,org:string,raw:unknown){
  const args=this.scope(x,org);
  if(!exact(raw,"after,companyName,contactEmail")||!company(raw.companyName)||!email(raw.contactEmail)||(raw.after!==null&&!isCanonicalUuidV4(raw.after)))return fail(400);
  const after:string|null=raw.after;
  return this.transaction(false,async c=>{
   const rows:unknown=(await c.query("SELECT p5_ci.duplicate_candidates($1,$2,$3,$4,$5,$6) AS data",[...args,raw.companyName,raw.contactEmail,after])).rows[0]?.data;
   if(!Array.isArray(rows)||rows.length>21)return fail(503);
   let prior:string|null=after;
   const items=rows.map(x=>{const row=parseLead(x);if(prior!==null&&row.id<=prior)return fail(503);prior=row.id;return row;});
   return {items:items.slice(0,20),nextCursor:items.length===21?items[19]!.id:null};
  });
 }
 async close(){await this.pool.end();}
}
