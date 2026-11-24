/** P4 R50: readonly owner operational aggregate, disposable CI PostgreSQL. */
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
export type P4R50OwnerSummary=Readonly<{
 activeMembers:number;revokedMembers:number;salesManagers:number;
 pendingInvites:number;acceptedInvites:number;revokedInvites:number;
 expiredInvites:number;roleChanges:number;membershipEvents:number;
 renewals:number;cancellations:number;
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const FIELDS=[
 ["active_members","activeMembers"],["revoked_members","revokedMembers"],
 ["sales_managers","salesManagers"],["pending_invites","pendingInvites"],
 ["accepted_invites","acceptedInvites"],["revoked_invites","revokedInvites"],
 ["expired_invites","expiredInvites"],["role_changes","roleChanges"],
 ["membership_events","membershipEvents"],["renewals","renewals"],
 ["cancellations","cancellations"],
] as const;
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
function safe(row:unknown):P4R50OwnerSummary{
 if(!row||typeof row!=="object"||Array.isArray(row))
  return fail(503,"UNAVAILABLE");
 const input=row as Record<string,unknown>,result:Record<string,number>={};
 if(Object.keys(input).sort().join(",")!==
  FIELDS.map(x=>x[0]).sort().join(","))
  return fail(503,"UNAVAILABLE");
 for(const [sql,display] of FIELDS){
  const value=input[sql];
  if(!Number.isSafeInteger(value)||(value as number)<0||
   (value as number)>1000000)return fail(503,"UNAVAILABLE");
  result[display]=value as number;
 }
 if(result.salesManagers!>result.activeMembers!)
  return fail(503,"UNAVAILABLE");
 return Object.freeze(result) as P4R50OwnerSummary;
}
export class P4R50CiOwnerOperations{
 constructor(private readonly pool:pg.Pool,
  private readonly env:NodeJS.ProcessEnv=process.env){}
 async summary(actor:P4R28Actor|null,org:unknown):
  Promise<P4R50OwnerSummary>{
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
   await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
   active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query("SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,org]);
   const role=await client.query("SELECT current_user AS role,"+
    "(SELECT rolsuper OR rolbypassrls FROM pg_roles"+
    " WHERE rolname=current_user) AS privileged");
   if(role.rows[0]?.role!=="p4_synthetic_ci_runtime"||
    role.rows[0]?.privileged!==false)
    return fail(403,"ACCESS_DENIED");
   const data=await client.query(
    "SELECT * FROM p4_r50_ci.owner_operations_summary($1)",[org]);
   if(data.rows.length!==1)return fail(503,"UNAVAILABLE");
   const result=safe(data.rows[0]);
   await client.query("COMMIT");active=false;
   return result;
  }catch(error){
   if(active){try{await client.query("ROLLBACK");}catch{discard=true;}}
   if(error instanceof P4R28Denied)throw error;
   if(error&&typeof error==="object"&&"code" in error&&
    error.code==="P4003")return fail(403,"ACCESS_DENIED");
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
}
