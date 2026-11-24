/** R66 owner-checked signed HMAC cursor for persisted CRM task pages. */
import {createHmac,timingSafeEqual} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {project,type P4R64Task} from "./p4-r64-ci-lead-tasks.js";
export type P4R66TaskPage=Readonly<{items:readonly P4R64Task[];
 nextCursor:string|null}>;
type Cursor=Readonly<{org:string;lead:string;time:string;id:string;exp:number}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIME=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
export class P4R66CiTaskPager{
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
 private sign(payload:string):string{
  return createHmac("sha256",this.secret).update(payload,"utf8").digest("base64url");
 }
 private parse(raw:unknown,org:string,lead:string):Cursor|null{
  if(raw===null)return null;
  if(typeof raw!=="string"||raw.length>1024||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(raw))
   return fail(400,"INVALID_INPUT");
  const [payload,signature]=raw.split(".");
  if(!payload||!signature)return fail(400,"INVALID_INPUT");
  const expected=Buffer.from(this.sign(payload),"base64url");
  const received=Buffer.from(signature,"base64url");
  if(received.length!==expected.length||
   received.toString("base64url")!==signature||
   !timingSafeEqual(expected,received))
   return fail(400,"INVALID_INPUT");
  let decoded:unknown;
  try{
   const b=Buffer.from(payload,"base64url");
   if(b.toString("base64url")!==payload)return fail(400,"INVALID_INPUT");
   decoded=JSON.parse(b.toString("utf8"));
  }catch{return fail(400,"INVALID_INPUT");}
  if(!decoded||typeof decoded!=="object"||Array.isArray(decoded))
   return fail(400,"INVALID_INPUT");
  const v=decoded as Record<string,unknown>;
  if(Object.keys(v).sort().join(",")!=="exp,id,lead,org,time"||
   v.org!==org||v.lead!==lead||typeof v.id!=="string"||
   !UUID.test(v.id)||typeof v.time!=="string"||!TIME.test(v.time)||
   !Number.isSafeInteger(v.exp)||(v.exp as number)<=this.now()||
   (v.exp as number)>this.now()+10*60*1000)
   return fail(400,"INVALID_INPUT");
  return v as Cursor;
 }
 async page(actor:P4R28Actor|null,org:unknown,lead:unknown,token:unknown):
  Promise<P4R66TaskPage>{
  this.guard();
  if(!actor||actor.verified!==true||!USER.test(actor.userId))
   return fail(401,"IDENTITY_REQUIRED");
  if(typeof org!=="string"||!UUID.test(org))
   return fail(403,"ACCESS_DENIED");
  if(typeof lead!=="string"||!UUID.test(lead))
   return fail(400,"INVALID_INPUT");
  const cursor=this.parse(token,org,lead);
  let c:pg.PoolClient;
  try{c=await this.pool.connect();}
  catch{return fail(503,"UNAVAILABLE");}
  let tx=false,discard=false;
  try{
   await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");tx=true;
   await c.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await c.query("SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,org]);
   const role=await c.query("SELECT current_user AS name,"+
    "(SELECT rolsuper OR rolbypassrls FROM pg_roles"+
    " WHERE rolname=current_user) AS privileged");
   if(role.rows[0]?.name!=="p4_synthetic_ci_runtime"||
    role.rows[0]?.privileged!==false)return fail(403,"ACCESS_DENIED");
   const rs=await c.query("SELECT task_id::text,lead_id::text,title,"+
    "due_date,status,revision,created_by,updated_by,created_at,"+
    "completed_at,key_time FROM"+
    " p4_r66_ci.owner_task_page($1,$2,$3,$4)",
    [org,lead,cursor?.time??null,cursor?.id??null]);
   if(rs.rows.length>21)return fail(503,"UNAVAILABLE");
   const raw=rs.rows.slice(0,20) as Record<string,unknown>[];
   const items=raw.map(x=>{
    const {key_time,...row}=x;
    if(typeof key_time!=="string"||!TIME.test(key_time))
     return fail(503,"UNAVAILABLE");
    return project(row);
   });
   if(items.some(x=>x.leadId!==lead||
    items.filter(y=>y.taskId===x.taskId).length!==1)||
    items.some((x,i)=>i>0&&x.createdAt>items[i-1]!.createdAt))
    return fail(503,"UNAVAILABLE");
   let nextCursor:string|null=null;
   if(rs.rows.length===21){
    const last=raw.at(-1);
    if(!last||typeof last.key_time!=="string"||
     !TIME.test(last.key_time)||typeof last.task_id!=="string"||
     !UUID.test(last.task_id))return fail(503,"UNAVAILABLE");
    const data:Cursor={org,lead,time:last.key_time,id:last.task_id,
     exp:this.now()+10*60*1000};
    const payload=Buffer.from(JSON.stringify(data),"utf8").toString("base64url");
    nextCursor=payload+"."+this.sign(payload);
    if(nextCursor.length>1024)return fail(503,"UNAVAILABLE");
   }
   await c.query("COMMIT");tx=false;
   return Object.freeze({items:Object.freeze(items),nextCursor});
  }catch(e){
   if(tx){try{await c.query("ROLLBACK");}catch{discard=true;}}
   if(e instanceof P4R28Denied)throw e;
   if(e&&typeof e==="object"&&"code" in e){
    if(e.code==="P4003")return fail(403,"ACCESS_DENIED");
    if(e.code==="P6600")return fail(400,"INVALID_INPUT");
    if(e.code==="P4009")return fail(409,"CONFLICT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{c.release(discard);}
 }
}
