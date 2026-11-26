import pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
export type Resource="navigation"|"leads"|"lead";
export class AppAccessDenied extends Error{constructor(readonly status:403|404|503){super("P4_APP_ACCESS_DENIED");}}
const bad=()=>{throw new AppAccessDenied(503);};
export function parseAppProjection(value:unknown,resource:Resource,org:string,after:string|null,id:string|null){
 const exact=(x:unknown,keys:string):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).sort().join(",")===keys;
 if(resource==="navigation"){
  if(!exact(value,"crmAvailable,membershipRole,organizationId")||value.organizationId!==org||
   (value.membershipRole!=="OWNER"&&value.membershipRole!=="MEMBER")||typeof value.crmAvailable!=="boolean")return bad();
  return value;
 }
 const lead=(x:unknown)=>{
  if(!exact(x,"id,label")||!isCanonicalUuidV4(x.id)||typeof x.label!=="string"||!/^Demo [A-Za-z0-9 ]{1,75}$/.test(x.label))return bad();
  return {id:x.id,label:x.label};
 };
 if(resource==="lead"){
  if(value===null)throw new AppAccessDenied(404);
  const row=lead(value);if(row.id!==id)return bad();return row;
 }
 if(!Array.isArray(value)||value.length>21)return bad();
 let previous=after;const rows=value.map(x=>{const row=lead(x);if(previous!==null&&row.id<=previous)return bad();previous=row.id;return row;});
 return {items:rows.slice(0,20),nextCursor:rows.length===21?rows[19]!.id:null};
}
export class CiStageAppAccess{
 private readonly pool:pg.Pool;
 constructor(private readonly env:NodeJS.ProcessEnv=process.env){
  this.guard();
  this.pool=new pg.Pool({host:"127.0.0.1",port:5432,database:"zoho_clone_synthetic_ci",user:"p4_stage_runtime",password:"fake_ci_not_for_real_accounts",max:2,connectionTimeoutMillis:2000,statement_timeout:3000});
 }
 private guard(){
  assertP4V1CiPrismaEnvironment(this.env);
  if(this.env.P4_STAGE_APP_ACCESS_CI!=="true"||this.env.VERCEL!==undefined||this.env.VERCEL_ENV!==undefined||this.env.NODE_ENV==="production")return bad();
 }
 async read(identity:StageIdentity,org:string,resource:Resource,after:string|null=null,id:string|null=null){
  this.guard();
  if(!identity||!/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.auth0\.com\/$/.test(identity.issuer)||!/^auth0\|[A-Za-z0-9_-]{3,180}$/.test(identity.subject)||
   !isCanonicalUuidV4(org)||!["navigation","leads","lead"].includes(resource)||(after!==null&&!isCanonicalUuidV4(after))||(id!==null&&!isCanonicalUuidV4(id))||
   (resource==="navigation"&&(after!==null||id!==null))||(resource==="leads"&&id!==null)||(resource==="lead"&&(id===null||after!==null)))throw new AppAccessDenied(403);
  const c=await this.pool.connect();let discard=false;
  try{
   await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
   const scope=await c.query(`SELECT current_database()='zoho_clone_synthetic_ci' AND current_user='p4_stage_runtime'
   AND session_user=current_user AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT(rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication OR rolinherit))
   AND NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=current_user)
   AND NOT has_schema_privilege(current_user,'platform_stage','CREATE')
   AND (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='platform_stage' AND c.relkind='r'
    AND c.relname IN ('users','identity_subjects','organizations','memberships','sales_grants','grant_audit','teams','team_grants','app_entitlements','lead_read_fixtures')
    AND c.relrowsecurity AND c.relforcerowsecurity AND c.relowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
    AND NOT has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
    AND NOT has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,TRIGGER'))=10 AS valid`);
   if(scope.rows[0]?.valid!==true)return bad();
   const r=await c.query("SELECT platform_stage.app_read($1,$2,$3,$4,$5,$6) AS data",[identity.issuer,identity.subject,org,resource,after,id]);
   if(r.rowCount!==1)return bad();
   const result=parseAppProjection(r.rows[0].data,resource,org,after,id);
   await c.query("COMMIT");return result;
  }catch(e){
   try{await c.query("ROLLBACK");}catch{discard=true;}
   if(e instanceof AppAccessDenied)throw e;
   if(typeof e==="object"&&e!==null&&"code" in e&&e.code==="42501")throw new AppAccessDenied(403);
   return bad();
  }finally{c.release(discard);}
 }
 async close(){await this.pool.end();}
}
