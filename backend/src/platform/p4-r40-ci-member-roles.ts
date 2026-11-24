/**
 * P4 R40: real transactional owner-scoped sales-role writes in DISPOSABLE CI.
 * No production or Neon integration. Verified actor MUST originate from R33's
 * RSA JWT verification and DB subject mapping, never HTTP actor/role headers.
 */
import {randomUUID} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
type Role="SALES_REP"|"SALES_MANAGER";
type RecordRow=Readonly<{userId:string;role:Role;revision:number}>;
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
function safe(row:Record<string,unknown>):RecordRow{
 if(!USER.test(String(row.user_id??""))||
  (row.role_code!=="SALES_REP"&&row.role_code!=="SALES_MANAGER")||
  !Number.isSafeInteger(row.revision)||
  (row.revision as number)<0||(row.revision as number)>10000000)
  return fail(503,"UNAVAILABLE");
 return Object.freeze({userId:row.user_id as string,
  role:row.role_code as Role,revision:row.revision as number});
}
export class P4R40CiMemberRoles {
 constructor(private readonly pool:pg.Pool,
  private readonly env:NodeJS.ProcessEnv=process.env){}
 private async inside<T>(
  actor:P4R28Actor|null,orgId:unknown,
  action:(client:pg.PoolClient,org:string)=>Promise<T>,
 ):Promise<T>{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return fail(503,"UNAVAILABLE");}
  if(!actor||actor.verified!==true||!USER.test(actor.userId))
   return fail(401,"IDENTITY_REQUIRED");
  if(typeof orgId!=="string"||!UUID.test(orgId))
   return fail(403,"ACCESS_DENIED");
  let client:pg.PoolClient;
  try{client=await this.pool.connect();}
  catch{return fail(503,"UNAVAILABLE");}
  let active=false,discard=false;
  try{
   await client.query("BEGIN");active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query(
    "SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,orgId]);
   const role=await client.query(
    "SELECT current_user AS name,(SELECT rolsuper OR rolbypassrls"+
    " FROM pg_roles WHERE rolname=current_user) AS privileged");
   if(role.rows.length!==1||
    role.rows[0]?.name!=="p4_synthetic_ci_runtime"||
    role.rows[0]?.privileged!==false)
    return fail(403,"ACCESS_DENIED");
   const result=await action(client,orgId);
   await client.query("COMMIT");active=false;
   return result;
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
 async list(actor:P4R28Actor|null,orgId:unknown):Promise<readonly RecordRow[]>{
  return this.inside(actor,orgId,async(client,org)=>{
   const rows=await client.query(
    "SELECT user_id,role_code,revision FROM p4_r40_ci.list_member_sales_roles($1)",
    [org]);
   if(rows.rows.length>20)return fail(503,"UNAVAILABLE");
   const entries=rows.rows.map(safe);
   if(new Set(entries.map(x=>x.userId)).size!==entries.length)
    return fail(503,"UNAVAILABLE");
   return Object.freeze(entries);
  });
 }
 async change(actor:P4R28Actor|null,orgId:unknown,targetId:unknown,body:unknown)
 :Promise<RecordRow>{
  if(typeof targetId!=="string"||!USER.test(targetId))
   return fail(403,"ACCESS_DENIED");
  if(!body||typeof body!=="object"||Array.isArray(body)||
   Object.keys(body).sort().join(",")!=="expectedRevision,role")
   return fail(400,"INVALID_INPUT");
  const value=body as Record<string,unknown>;
  if((value.role!=="SALES_REP"&&value.role!=="SALES_MANAGER")||
   !Number.isSafeInteger(value.expectedRevision)||
   (value.expectedRevision as number)<0||
   (value.expectedRevision as number)>=10000000)
   return fail(400,"INVALID_INPUT");
  return this.inside(actor,orgId,async(client,org)=>{
   const result=await client.query(
    "SELECT role_code,revision FROM p4_r40_ci.change_member_sales_role($1,$2,$3,$4,$5)",
    [org,targetId,value.role,value.expectedRevision,randomUUID()]);
   if(result.rows.length!==1)return fail(503,"UNAVAILABLE");
   return safe({...result.rows[0],user_id:targetId});
  });
 }
}
