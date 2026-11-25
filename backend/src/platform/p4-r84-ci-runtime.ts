/** Dedicated restricted CI connection, never reachable from normal app. */
import pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
export class P4R84Denied extends Error{
 constructor(public readonly status:400|401|403|409|503,public readonly code:string){super(code);}
}
export const invalid=()=>{throw new P4R84Denied(400,"INVALID_INPUT");};
export class P4R84CiRuntime{
 private pool:pg.Pool;
 constructor(private readonly env:NodeJS.ProcessEnv=process.env){
  assertP4V1CiPrismaEnvironment(env);
  this.pool=new pg.Pool({host:"127.0.0.1",port:5432,database:"zoho_clone_synthetic_ci",user:"p4_r82_ci_runtime",password:"fake_ci_not_for_real_accounts",max:3,connectionTimeoutMillis:2000,statement_timeout:3000});
 }
 async close(){await this.pool.end();}
 async run<T>(mode:"READ ONLY"|"READ WRITE",work:(c:pg.PoolClient)=>Promise<T>):Promise<T>{
  assertP4V1CiPrismaEnvironment(this.env);
  let c:pg.PoolClient|undefined,active=false,discard=false;
  try{
   c=await this.pool.connect();await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ "+mode);active=true;
   const check=await c.query("SELECT current_user AS role,session_user AS login,current_database() AS db,(SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication OR rolinherit FROM pg_roles WHERE rolname=current_user) AS privileged,(SELECT count(*)::int FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=current_user) AS grants");
   const r=check.rows[0];if(check.rowCount!==1||r?.role!=="p4_r82_ci_runtime"||r.login!==r.role||r.db!=="zoho_clone_synthetic_ci"||r.privileged!==false||r.grants!==0)throw new P4R84Denied(503,"UNAVAILABLE");
   const result=await work(c);await c.query("COMMIT");active=false;return result;
  }catch(e){
   if(c&&active)try{await c.query("ROLLBACK");}catch{discard=true;}
   if(e instanceof P4R84Denied)throw e;
   const code=e&&typeof e==="object"&&"code" in e?e.code:null;
   if(code==="P4003")throw new P4R84Denied(403,"ACCESS_DENIED");
   if(code==="P8400"||code==="P8500"||code==="P8600")throw new P4R84Denied(400,"INVALID_INPUT");
   if(code==="P4009"||code==="40001"||code==="23505")throw new P4R84Denied(409,"CONFLICT");
   throw new P4R84Denied(503,"UNAVAILABLE");
  }finally{c?.release(discard);}
 }
}
