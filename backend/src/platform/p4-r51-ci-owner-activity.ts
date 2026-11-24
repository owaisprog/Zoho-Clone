/** P4 R51: readonly owner audit history over real CI PostgreSQL. */
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
export type P4R51ActivityKind="role.changed"|"member.revoked"|
 "member.reactivated"|"invitation.renewed"|"invitation.canceled";
export type P4R51ActivityFilter="all"|P4R51ActivityKind;
export type P4R51Activity=Readonly<{
 eventId:string;kind:P4R51ActivityKind;subjectId:string;
 actorUserId:string|null;occurredAt:string;
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const KIND=new Set<P4R51ActivityFilter>(["all","role.changed",
 "member.revoked","member.reactivated","invitation.renewed",
 "invitation.canceled"]);
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
function safe(row:Record<string,unknown>):P4R51Activity{
 if(typeof row.event_id!=="string"||!UUID.test(row.event_id)||
  typeof row.kind!=="string"||row.kind==="all"||
  !KIND.has(row.kind as P4R51ActivityFilter)||
  typeof row.subject_id!=="string"||
  !(USER.test(row.subject_id)||UUID.test(row.subject_id))||
  (row.actor_user_id!==null&&
   (typeof row.actor_user_id!=="string"||!USER.test(row.actor_user_id)))||
  !(row.occurred_at instanceof Date)||
  !Number.isFinite(row.occurred_at.getTime()))
  return fail(503,"UNAVAILABLE");
 if(row.kind.startsWith("member.")||row.kind==="role.changed"){
  if(!USER.test(row.subject_id))return fail(503,"UNAVAILABLE");
 }else if(!UUID.test(row.subject_id))return fail(503,"UNAVAILABLE");
 return Object.freeze({eventId:row.event_id,kind:row.kind as P4R51ActivityKind,
  subjectId:row.subject_id,actorUserId:row.actor_user_id as string|null,
  occurredAt:row.occurred_at.toISOString()});
}
export class P4R51CiOwnerActivityService{
 constructor(private readonly pool:pg.Pool,
  private readonly env:NodeJS.ProcessEnv=process.env){}
 async list(actor:P4R28Actor|null,org:unknown,filter:unknown):
  Promise<readonly P4R51Activity[]>{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return fail(503,"UNAVAILABLE");}
  if(!actor||actor.verified!==true||!USER.test(actor.userId))
   return fail(401,"IDENTITY_REQUIRED");
  if(typeof org!=="string"||!UUID.test(org))
   return fail(403,"ACCESS_DENIED");
  if(typeof filter!=="string"||!KIND.has(filter as P4R51ActivityFilter))
   return fail(400,"INVALID_INPUT");
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
   const role=await client.query("SELECT current_user AS name,"+
    "(SELECT rolsuper OR rolbypassrls FROM pg_roles"+
    " WHERE rolname=current_user) AS privileged");
   if(role.rows[0]?.name!=="p4_synthetic_ci_runtime"||
    role.rows[0]?.privileged!==false)return fail(403,"ACCESS_DENIED");
   const data=await client.query(
    "SELECT event_id::text,kind,subject_id,actor_user_id,occurred_at"+
    " FROM p4_r51_ci.owner_activity($1,$2)",[org,filter]);
   if(data.rows.length>20)return fail(503,"UNAVAILABLE");
   const rows=(data.rows as Record<string,unknown>[]).map(safe);
   if(new Set(rows.map(x=>x.eventId)).size!==rows.length||
    rows.some(x=>filter!=="all"&&x.kind!==filter)||
    rows.some((x,i)=>i>0&&
     (x.occurredAt>rows[i-1]!.occurredAt)))
    return fail(503,"UNAVAILABLE");
   await client.query("COMMIT");active=false;
   return Object.freeze(rows);
  }catch(e){
   if(active){try{await client.query("ROLLBACK");}catch{discard=true;}}
   if(e instanceof P4R28Denied)throw e;
   if(e&&typeof e==="object"&&"code" in e){
    if(e.code==="P4003")return fail(403,"ACCESS_DENIED");
    if(e.code==="P5100")return fail(400,"INVALID_INPUT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
}
