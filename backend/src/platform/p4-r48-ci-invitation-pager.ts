/** R48: signed cursor keyset invitation paging, CI-only PostgreSQL. */
import {createHmac,randomUUID,timingSafeEqual} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import type {P4R29Invite} from "./p4-r29-ci-invitation-service.js";
type Filter="all"|"pending"|"accepted"|"revoked"|"expired";
export type P4R48Page=Readonly<{
 items:readonly P4R29Invite[];
 nextCursor:string|null;
}>;
type Cursor=Readonly<{org:string;filter:Filter;search:string;
 time:string;id:string;exp:number}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIME=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/;
const EMAIL=/^[a-z0-9][a-z0-9._-]{0,60}@example[.]com$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const ALLOWED=new Set(["all","pending","accepted","revoked","expired"]);
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
function project(raw:Record<string,unknown>):P4R29Invite{
 if(typeof raw.id!=="string"||!UUID.test(raw.id)||
  typeof raw.org_id!=="string"||!UUID.test(raw.org_id)||
  typeof raw.recipient_email!=="string"||!EMAIL.test(raw.recipient_email)||
  raw.granted_role!=="MEMBER"||
  !["pending","accepted","revoked","expired"].includes(String(raw.status))||
  !(raw.issued_at instanceof Date)||!(raw.expires_at instanceof Date)||
  !Number.isFinite(raw.issued_at.getTime())||
  !Number.isFinite(raw.expires_at.getTime())||
  raw.expires_at.getTime()<=raw.issued_at.getTime()||
  !Number.isSafeInteger(raw.version)||(raw.version as number)<1||
  typeof raw.key_time!=="string"||!TIME.test(raw.key_time))
  return fail(503,"UNAVAILABLE");
 return Object.freeze({
  id:raw.id,organizationId:raw.org_id,recipientEmail:raw.recipient_email,
  role:"MEMBER",status:raw.status as P4R29Invite["status"],
  issuedAt:raw.issued_at.toISOString(),expiresAt:raw.expires_at.toISOString(),
  version:raw.version as number,
 });
}
export class P4R48CiInvitationPager{
 constructor(private readonly pool:pg.Pool,private readonly secret:Buffer,
  private readonly env:NodeJS.ProcessEnv=process.env,
  private readonly now:()=>number=Date.now){}
 private guard(){
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return fail(503,"UNAVAILABLE");}
  if(!Buffer.isBuffer(this.secret)||this.secret.length!==32||
   !Number.isSafeInteger(this.now())||this.now()<0)
   return fail(503,"UNAVAILABLE");
 }
 private sign(value:string):string{
  return createHmac("sha256",this.secret).update(value,"utf8").digest("base64url");
 }
 private read(raw:string|null,org:string,filter:Filter,search:string):
  Cursor|null{
  if(raw===null)return null;
  if(raw.length>1024||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(raw))
   return fail(400,"INVALID_INPUT");
  const [payload,signature]=raw.split(".");
  if(!payload||!signature)return fail(400,"INVALID_INPUT");
  const received=Buffer.from(signature,"base64url");
  const expected=Buffer.from(this.sign(payload),"base64url");
  if(received.toString("base64url")!==signature||
   received.length!==expected.length||
   !timingSafeEqual(received,expected))return fail(400,"INVALID_INPUT");
  let row:unknown;
  try{row=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));}
  catch{return fail(400,"INVALID_INPUT");}
  if(!row||typeof row!=="object"||Array.isArray(row))
   return fail(400,"INVALID_INPUT");
  const x=row as Record<string,unknown>;
  if(Object.keys(x).sort().join(",")!=="exp,filter,id,org,search,time"||
   x.org!==org||x.filter!==filter||x.search!==search||
   typeof x.id!=="string"||!UUID.test(x.id)||
   typeof x.time!=="string"||!TIME.test(x.time)||
   !Number.isSafeInteger(x.exp)||(x.exp as number)<=this.now()||
   (x.exp as number)>this.now()+10*60*1000)
   return fail(400,"INVALID_INPUT");
  return x as Cursor;
 }
 async page(actor:P4R28Actor|null,org:unknown,status:unknown,
  query:unknown,token:unknown):Promise<P4R48Page>{
  this.guard();
  if(!actor||actor.verified!==true||!USER.test(actor.userId))
   return fail(401,"IDENTITY_REQUIRED");
  if(typeof org!=="string"||!UUID.test(org))
   return fail(403,"ACCESS_DENIED");
  if(typeof status!=="string"||!ALLOWED.has(status)||
   typeof query!=="string"||query.length>40||
   !/^[a-zA-Z0-9._@-]*$/.test(query)||
   (token!==null&&typeof token!=="string"))
   return fail(400,"INVALID_INPUT");
  const filter=status as Filter,search=query.toLowerCase();
  const cursor=this.read(token as string|null,org,filter,search);
  let client:pg.PoolClient;
  try{client=await this.pool.connect();}
  catch{return fail(503,"UNAVAILABLE");}
  let active=false,discard=false;
  try{
   await client.query("BEGIN");active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query(
    "SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,org]);
   const role=await client.query("SELECT current_user AS name,"+
    "(SELECT rolsuper OR rolbypassrls FROM pg_roles"+
    " WHERE rolname=current_user) AS privileged");
   if(role.rows[0]?.name!=="p4_synthetic_ci_runtime"||
    role.rows[0]?.privileged!==false)return fail(403,"ACCESS_DENIED");
   const records=await client.query(
    "SELECT id::text,org_id::text,recipient_email,granted_role,"+
    " status,issued_at,expires_at,version,key_time"+
    " FROM p4_r48_ci.owner_invitation_page($1,$2,$3,$4,$5)",
    [org,filter,search,cursor?.time??null,cursor?.id??null]);
   if(records.rows.length>21)return fail(503,"UNAVAILABLE");
   const rawRows=records.rows.slice(0,20) as Record<string,unknown>[];
   const items=rawRows.map(project);
   if(new Set(items.map(i=>i.id)).size!==items.length||
    items.some(i=>i.organizationId!==org||
     (filter!=="all"&&i.status!==filter)||
     (search!==""&&!i.recipientEmail.includes(search))))
    return fail(503,"UNAVAILABLE");
   let nextCursor:string|null=null;
   if(records.rows.length===21){
    const last=rawRows.at(-1);
    if(!last||typeof last.key_time!=="string"||
     !TIME.test(last.key_time)||typeof last.id!=="string"||
     !UUID.test(last.id))return fail(503,"UNAVAILABLE");
    const value:Cursor={org,filter,search,time:last.key_time,id:last.id,
     exp:this.now()+10*60*1000};
    const payload=Buffer.from(JSON.stringify(value),"utf8").toString("base64url");
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
    if(error.code==="P4700")return fail(400,"INVALID_INPUT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
}
