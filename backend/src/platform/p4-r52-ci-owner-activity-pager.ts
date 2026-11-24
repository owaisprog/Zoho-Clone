/** R52 scoped HMAC keyset over owner immutable activity, disposable CI only. */
import {createHmac,timingSafeEqual} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import type {P4R51Activity,P4R51ActivityFilter,P4R51ActivityKind}
 from "./p4-r51-ci-owner-activity.js";
export type P4R52ActivityPage=Readonly<{
 items:readonly P4R51Activity[];nextCursor:string|null;
}>;
type Cursor={org:string;kind:P4R51ActivityFilter;
 time:string;id:string;exp:number};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const TIME=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/;
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
  (row.kind.startsWith("member.")||row.kind==="role.changed"?
   !USER.test(row.subject_id):!UUID.test(row.subject_id))||
  (row.actor_user_id!==null&&
   (typeof row.actor_user_id!=="string"||!USER.test(row.actor_user_id)))||
  (row.kind==="member.reactivated"&&row.actor_user_id!==null)||
  (row.kind!=="member.reactivated"&&row.actor_user_id===null)||
  !(row.occurred_at instanceof Date)||
  !Number.isFinite(row.occurred_at.getTime())||
  typeof row.key_time!=="string"||!TIME.test(row.key_time))
  return fail(503,"UNAVAILABLE");
 return Object.freeze({eventId:row.event_id,
  kind:row.kind as P4R51ActivityKind,subjectId:row.subject_id,
  actorUserId:row.actor_user_id as string|null,
  occurredAt:row.occurred_at.toISOString()});
}
export class P4R52CiOwnerActivityPager{
 constructor(private readonly pool:pg.Pool,private readonly key:Buffer,
  private readonly env:NodeJS.ProcessEnv=process.env,
  private readonly now:()=>number=Date.now){}
 private guard():void{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return fail(503,"UNAVAILABLE");}
  if(!Buffer.isBuffer(this.key)||this.key.length!==32||
   !Number.isSafeInteger(this.now())||this.now()<0)
   return fail(503,"UNAVAILABLE");
 }
 private sign(payload:string):string{
  return createHmac("sha256",this.key).update(payload).digest("base64url");
 }
 private cursor(raw:string|null,org:string,kind:P4R51ActivityFilter):
  Cursor|null{
  if(raw===null)return null;
  if(raw.length>1024||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(raw))
   return fail(400,"INVALID_INPUT");
  const [payload,signature]=raw.split(".");
  if(!payload||!signature)return fail(400,"INVALID_INPUT");
  const received=Buffer.from(signature,"base64url");
  const expected=Buffer.from(this.sign(payload),"base64url");
  if(received.toString("base64url")!==signature||
   Buffer.from(payload,"base64url").toString("base64url")!==payload||
   received.length!==expected.length||
   !timingSafeEqual(received,expected))
   return fail(400,"INVALID_INPUT");
  let decoded:unknown;
  try{decoded=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));}
  catch{return fail(400,"INVALID_INPUT");}
  if(!decoded||typeof decoded!=="object"||Array.isArray(decoded))
   return fail(400,"INVALID_INPUT");
  const value=decoded as Record<string,unknown>;
  if(Object.keys(value).sort().join(",")!=="exp,id,kind,org,time"||
   value.org!==org||value.kind!==kind||
   typeof value.id!=="string"||!UUID.test(value.id)||
   typeof value.time!=="string"||!TIME.test(value.time)||
   !Number.isSafeInteger(value.exp)||(value.exp as number)<=this.now()||
   (value.exp as number)>this.now()+10*60*1000)
   return fail(400,"INVALID_INPUT");
  return value as Cursor;
 }
 async page(actor:P4R28Actor|null,org:unknown,filter:unknown,token:unknown):
  Promise<P4R52ActivityPage>{
  this.guard();
  if(!actor||actor.verified!==true||!USER.test(actor.userId))
   return fail(401,"IDENTITY_REQUIRED");
  if(typeof org!=="string"||!UUID.test(org))
   return fail(403,"ACCESS_DENIED");
  if(typeof filter!=="string"||!KIND.has(filter as P4R51ActivityFilter)||
   (token!==null&&typeof token!=="string"))
   return fail(400,"INVALID_INPUT");
  const kind=filter as P4R51ActivityFilter;
  const cursor=this.cursor(token as string|null,org,kind);
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
   const records=await client.query(
    "SELECT event_id::text,kind,subject_id,actor_user_id,"+
    "occurred_at,key_time"+
    " FROM p4_r52_ci.owner_activity_page($1,$2,$3,$4)",
    [org,kind,cursor?.time??null,cursor?.id??null]);
   if(records.rows.length>21)return fail(503,"UNAVAILABLE");
   const raw=records.rows.slice(0,20) as Record<string,unknown>[];
   const items=raw.map(safe);
   if(new Set(items.map(x=>x.eventId)).size!==items.length||
    items.some(x=>kind!=="all"&&x.kind!==kind)||
    items.some((x,i)=>i>0&&x.occurredAt>items[i-1]!.occurredAt))
    return fail(503,"UNAVAILABLE");
   let nextCursor:string|null=null;
   if(records.rows.length===21){
    const last=raw.at(-1);
    if(!last||typeof last.key_time!=="string"||
     !TIME.test(last.key_time)||typeof last.event_id!=="string"||
     !UUID.test(last.event_id))
     return fail(503,"UNAVAILABLE");
    const data:Cursor={org,kind,time:last.key_time,id:last.event_id,
     exp:this.now()+10*60*1000};
    const payload=Buffer.from(JSON.stringify(data)).toString("base64url");
    nextCursor=payload+"."+this.sign(payload);
    if(nextCursor.length>1024)return fail(503,"UNAVAILABLE");
   }
   await client.query("COMMIT");active=false;
   return Object.freeze({items:Object.freeze(items),nextCursor});
  }catch(error){
   if(active){try{await client.query("ROLLBACK");}catch{discard=true;}}
   if(error instanceof P4R28Denied)throw error;
   if(error&&typeof error==="object"&&"code" in error){
    if(error.code==="P4003")return fail(403,"ACCESS_DENIED");
    if(error.code==="P5200")return fail(400,"INVALID_INPUT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
}
