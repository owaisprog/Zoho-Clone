/**
 * P4 R43 owner-only atomic membership revoke in isolated disposable GitHub CI.
 * Trusts only the R33 signed JWT -> DB subject-mapped actor passed by router.
 * No customer data, Neon, staging or production route.
 */
import {randomUUID} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
export type P4R43Revoked=Readonly<{revoked:true}>;
export class P4R43CiMemberRevokeService{
 constructor(private readonly pool:pg.Pool,
  private readonly env:NodeJS.ProcessEnv=process.env){}
 async revoke(actor:P4R28Actor|null,organizationId:unknown,
  targetId:unknown):Promise<P4R43Revoked>{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return fail(503,"UNAVAILABLE");}
  if(!actor||actor.verified!==true||!USER.test(actor.userId))
   return fail(401,"IDENTITY_REQUIRED");
  if(typeof organizationId!=="string"||!UUID.test(organizationId)||
   typeof targetId!=="string"||!USER.test(targetId)||
   actor.userId===targetId)return fail(403,"ACCESS_DENIED");
  let client:pg.PoolClient;
  try{client=await this.pool.connect();}
  catch{return fail(503,"UNAVAILABLE");}
  let active=false,discard=false;
  try{
   await client.query("BEGIN");active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query("SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,organizationId]);
   const role=await client.query("SELECT current_user AS name,"+
    "(SELECT rolsuper OR rolbypassrls FROM pg_roles"+
    " WHERE rolname=current_user) AS privileged");
   if(role.rows.length!==1||
    role.rows[0]?.name!=="p4_synthetic_ci_runtime"||
    role.rows[0]?.privileged!==false)
    return fail(403,"ACCESS_DENIED");
   const rows=await client.query(
    "SELECT p4_r43_ci.revoke_member($1,$2,$3) AS revoked",
    [organizationId,targetId,randomUUID()]);
   if(rows.rows.length!==1||rows.rows[0]?.revoked!==true)
    return fail(503,"UNAVAILABLE");
   await client.query("COMMIT");active=false;
   return Object.freeze({revoked:true as const});
  }catch(error){
   if(active){try{await client.query("ROLLBACK");}catch{discard=true;}}
   if(error instanceof P4R28Denied)throw error;
   if(error&&typeof error==="object"&&"code" in error){
    if(error.code==="P4003")return fail(403,"ACCESS_DENIED");
    if(error.code==="P4009"||error.code==="23505")
     return fail(409,"CONFLICT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
}
