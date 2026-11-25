/** R82 isolated implementation of R81 reader. Separate real restricted login;
 * no SET ROLE from a bootstrap superuser; no live environment support.
 */
import pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {checkP4R81Membership,type ProviderTenantReader,type MembershipProjection} from "./p4-r81-provider-tenant.js";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
export class P4R82CiTenantReader implements ProviderTenantReader{
 private readonly pool:pg.Pool;
 constructor(private readonly env:NodeJS.ProcessEnv=process.env){
  assertP4V1CiPrismaEnvironment(env);
  this.pool=new pg.Pool({host:"127.0.0.1",port:5432,database:"zoho_clone_synthetic_ci",user:"p4_r82_ci_runtime",password:"fake_ci_not_for_real_accounts",max:2,connectionTimeoutMillis:2000,statement_timeout:2000});
 }
 async close(){await this.pool.end();}
 async read(input:Parameters<ProviderTenantReader["read"]>[0]):Promise<MembershipProjection|null>{
  assertP4V1CiPrismaEnvironment(this.env);
  if(!isCanonicalUuidV4(input?.organizationId)||!/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.auth0\.com\/$/.test(input.identity?.issuer??"")||!/^auth0\|[A-Za-z0-9_-]{3,180}$/.test(input.identity?.subject??""))return null;
  let c:pg.PoolClient|undefined,active=false,discard=false;
  try{
   c=await this.pool.connect();await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");active=true;
   const r=await c.query("SELECT current_user AS role,session_user AS login,current_database() AS db, (SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication OR rolinherit FROM pg_roles WHERE rolname=current_user) AS privileged, (SELECT count(*)::int FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=current_user) AS grants");
   const v=r.rows[0];if(r.rows.length!==1||v?.role!=="p4_r82_ci_runtime"||v.login!==v.role||v.db!=="zoho_clone_synthetic_ci"||v.privileged!==false||v.grants!==0)throw Error("ROLE_DENIED");
   const out=await c.query('SELECT actor_id::text AS "actorId",organization_id::text AS "organizationId",membership_role AS role FROM p4_r82_ci.membership_check($1,$2,$3)',[input.identity.issuer,input.identity.subject,input.organizationId]);
   if(out.rows.length>1)throw Error("INVALID_PROJECTION");
   const row=out.rows.length?checkP4R81Membership(out.rows[0],input.organizationId):null;
   if(out.rows.length&&!row)throw Error("INVALID_PROJECTION");
   await c.query("COMMIT");active=false;return row;
  }catch{
   if(c&&active)try{await c.query("ROLLBACK");}catch{discard=true;}
   throw Error("P4_R82_TENANT_READER_UNAVAILABLE");
  }finally{c?.release(discard);}
 }
}
