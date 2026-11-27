import pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
export type LeadSource="WEBSITE"|"REFERRAL"|"EVENT";
export type LeadStatus="NEW"|"CONTACTED"|"QUALIFIED"|"LOST";
export type Lead={id:string;companyName:string;contactEmail:string;source:LeadSource;status:LeadStatus;revision:number};
export type CreateLead={id:string;requestId:string;companyName:string;contactEmail:string;source:LeadSource};
export class LeadError extends Error{constructor(readonly status:400|403|404|409|503){super("P5_LEAD_REQUEST_FAILED");}}
const fail=(status:400|403|404|409|503):never=>{throw new LeadError(status);};
const exact=(v:unknown,keys:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===keys;
const source=(v:unknown):v is LeadSource=>v==="WEBSITE"||v==="REFERRAL"||v==="EVENT";
const status=(v:unknown):v is LeadStatus=>v==="NEW"||v==="CONTACTED"||v==="QUALIFIED"||v==="LOST";
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
 private scope(x:StageIdentity,org:string){
  if(!x||!/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.auth0\.com\/$/.test(x.issuer)||!/^auth0\|[A-Za-z0-9_-]{3,180}$/.test(x.subject)||!isCanonicalUuidV4(org))return fail(403);
  return [x.issuer,x.subject,org];
 }
 private async transaction<T>(write:boolean,run:(c:pg.PoolClient)=>Promise<T>):Promise<T>{
  this.guard();const c=await this.pool.connect();let discard=false;
  try{
   await c.query(write?"BEGIN ISOLATION LEVEL SERIALIZABLE":"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
   const r=await c.query(`SELECT current_database()='zoho_clone_synthetic_ci' AND current_user='p5_ci_runtime' AND session_user=current_user
   AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT(rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication OR rolinherit))
   AND NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=current_user)
   AND NOT has_schema_privilege(current_user,'p5_ci','CREATE') AND NOT has_schema_privilege(current_user,'platform_stage','CREATE')
   AND (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='p5_ci' AND c.relkind='r' AND c.relname IN ('leads','lead_events')
    AND c.relrowsecurity AND c.relforcerowsecurity AND c.relowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
    AND NOT has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') AND NOT has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,TRIGGER'))=2
   AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='platform_stage' AND c.relkind='r'
    AND (has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') OR has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,TRIGGER'))) AS valid`);
   if(r.rows[0]?.valid!==true)return fail(503);
   const value=await run(c);await c.query("COMMIT");return value;
  }catch(e){try{await c.query("ROLLBACK");}catch{discard=true;}if(e instanceof LeadError)throw e;
   if(e&&typeof e==="object"&&"code" in e){if(e.code==="42501")return fail(403);if(e.code==="22023")return fail(400);if(e.code==="23505"||e.code==="40001")return fail(409);}
   return fail(503);
  }finally{c.release(discard);}
 }
 async list(x:StageIdentity,org:string,after:string|null=null){
  const args=this.scope(x,org);if(after!==null&&!isCanonicalUuidV4(after))return fail(400);
  return this.transaction(false,async c=>{
   const r=await c.query("SELECT p5_ci.read_leads($1,$2,$3,$4,NULL) AS data",[...args,after]);const data=r.rows[0]?.data;
   if(!Array.isArray(data)||data.length>21)return fail(503);
   let previous=after;const items=data.map(x=>{const row=parseLead(x);if(previous!==null&&row.id<=previous)return fail(503);previous=row.id;return row;});
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
 async close(){await this.pool.end();}
}
