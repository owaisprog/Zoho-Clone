/** Disposable restricted SQL writer. No live configuration or provider calls. */
import pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
export type SalesRole="SALES_REP"|"SALES_MANAGER";
export type GrantRow={role:SalesRole;active:boolean;revision:number};
export type RoleCommand={role:SalesRole;expectedActive:boolean;nextActive:boolean;expectedRevision:number;requestId:string};
export type GrantOutcome="applied"|"replay"|"conflict"|"denied"|"unavailable";
const deny=()=>{throw Error("P4_STAGE_GRANT_DENIED");};
const validRole=(x:unknown):x is SalesRole=>x==="SALES_REP"||x==="SALES_MANAGER";
export function parseRoleCommand(raw:unknown):RoleCommand{
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).sort().join(",")!=="expectedActive,expectedRevision,nextActive,requestId,role")return deny();
 const x=raw as Record<string,unknown>;
 if(!validRole(x.role)||typeof x.expectedActive!=="boolean"||typeof x.nextActive!=="boolean"||x.expectedActive===x.nextActive||
    typeof x.expectedRevision!=="number"||!Number.isSafeInteger(x.expectedRevision)||x.expectedRevision<0||x.expectedRevision>=1000000000||!isCanonicalUuidV4(x.requestId))return deny();
 return {role:x.role,expectedActive:x.expectedActive,nextActive:x.nextActive,expectedRevision:x.expectedRevision,requestId:x.requestId};
}
export class CiStageRoleGrants{
 private readonly pool:pg.Pool;
 constructor(private readonly env:NodeJS.ProcessEnv=process.env){
  this.guard();
  this.pool=new pg.Pool({host:"127.0.0.1",port:5432,database:"zoho_clone_synthetic_ci",user:"p4_stage_grant_writer",password:"fake_ci_not_for_real_accounts",max:2,connectionTimeoutMillis:2000,statement_timeout:3000});
 }
 private guard(){
  assertP4V1CiPrismaEnvironment(this.env);
  if(this.env.P4_STAGE_GRANTS_CI!=="true"||this.env.VERCEL!==undefined||this.env.VERCEL_ENV!==undefined||this.env.NODE_ENV==="production")return deny();
 }
 private args(identity:StageIdentity,org:string,target:string){
  if(!identity||!/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.auth0\.com\/$/.test(identity.issuer)||!/^auth0\|[A-Za-z0-9_-]{3,180}$/.test(identity.subject)||!isCanonicalUuidV4(org)||!isCanonicalUuidV4(target))return deny();
  return [identity.issuer,identity.subject,org,target];
 }
 private async transaction<T>(run:(client:pg.PoolClient)=>Promise<T>):Promise<T>{
  this.guard();const c=await this.pool.connect();let discard=false;
  try{
   await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
   const scope=await c.query(`SELECT current_database()='zoho_clone_synthetic_ci' AND current_user='p4_stage_grant_writer'
   AND session_user=current_user AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT(rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication OR rolinherit))
   AND NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=current_user)
   AND NOT has_schema_privilege(current_user,'platform_stage','CREATE')
   AND (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='platform_stage'
    AND c.relname IN ('users','identity_subjects','organizations','memberships','sales_grants','grant_audit')
    AND c.relrowsecurity AND c.relforcerowsecurity
    AND c.relowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
    AND NOT has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
    AND NOT has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,TRIGGER'))=6 AS valid`);
   if(scope.rows[0]?.valid!==true)return deny();
   const value=await run(c);await c.query("COMMIT");return value;
  }catch(e){try{await c.query("ROLLBACK");}catch{discard=true;}throw e;}finally{c.release(discard);}
 }
 async list(identity:StageIdentity,org:string,target:string):Promise<GrantRow[]>{
  const args=this.args(identity,org,target);
  return this.transaction(async c=>{
   const r=await c.query('SELECT role_code AS role,active,revision FROM platform_stage.list_sales_grants($1,$2,$3,$4)',args);
   if(r.rows.length>2)return deny();
   return r.rows.map(row=>{
    if(!validRole(row.role)||typeof row.active!=="boolean"||!Number.isInteger(row.revision)||row.revision<0||row.revision>1000000000)return deny();
    return {role:row.role,active:row.active,revision:row.revision};
   });
  });
 }
 async toggle(identity:StageIdentity,org:string,target:string,raw:unknown):Promise<GrantOutcome>{
  const args=this.args(identity,org,target),cmd=parseRoleCommand(raw);
  try{return await this.transaction(async c=>{
   const r=await c.query("SELECT platform_stage.toggle_sales_grant($1,$2,$3,$4,$5,$6,$7,$8,$9) AS result",[...args,cmd.role,cmd.expectedActive,cmd.nextActive,cmd.expectedRevision,cmd.requestId]);
   const outcome=r.rows[0]?.result;
   if(!["applied","replay","conflict","denied"].includes(outcome)||r.rowCount!==1)return deny();
   return outcome as GrantOutcome;
  });}catch(e){return typeof e==="object"&&e!==null&&"code" in e&&(e.code==="40001"||e.code==="23505")?"conflict":"unavailable";}
 }
 async close(){await this.pool.end();}
}
