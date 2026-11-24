/** R68 signed owner-only cross-lead due follow-up queue (disposable PostgreSQL). */
import {createHmac,timingSafeEqual} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {project,type P4R64Task} from "./p4-r64-ci-lead-tasks.js";
export type P4R68DueItem=Readonly<{task:P4R64Task;companyName:string}>;
export type P4R68DuePage=Readonly<{items:readonly P4R68DueItem[];
 nextCursor:string|null}>;
type Cursor=Readonly<{org:string;through:string;due:string;id:string;exp:number}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const COMPANY=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$/;
const validDate=(v:unknown):v is string=>typeof v==="string"&&
 /^\d{4}-\d\d-\d\d$/.test(v)&&v>="2026-01-01"&&v<="2032-12-31"&&
 Number.isFinite(Date.parse(v+"T00:00:00.000Z"))&&
 new Date(v+"T00:00:00.000Z").toISOString().slice(0,10)===v;
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
export class P4R68CiDueQueue{
 constructor(private readonly pool:pg.Pool,private readonly key:Buffer,
  private readonly env:NodeJS.ProcessEnv=process.env,
  private readonly now:()=>number=Date.now){}
 private guard():void{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return fail(503,"UNAVAILABLE");}
  if(!Buffer.isBuffer(this.key)||this.key.length!==32||
   !Number.isSafeInteger(this.now())||this.now()<0)return fail(503,"UNAVAILABLE");
 }
 private sign(payload:string):string{
  return createHmac("sha256",this.key).update(payload).digest("base64url");
 }
 private cursor(raw:unknown,org:string,through:string):Cursor|null{
  if(raw===null)return null;
  if(typeof raw!=="string"||raw.length>1024||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(raw))
   return fail(400,"INVALID_INPUT");
  const [payload,sig]=raw.split(".");
  if(!payload||!sig)return fail(400,"INVALID_INPUT");
  const actual=Buffer.from(sig,"base64url");
  const expected=Buffer.from(this.sign(payload),"base64url");
  if(actual.length!==expected.length||actual.toString("base64url")!==sig||
   !timingSafeEqual(actual,expected))return fail(400,"INVALID_INPUT");
  let parsed:unknown;
  try{
   const bytes=Buffer.from(payload,"base64url");
   if(bytes.toString("base64url")!==payload)return fail(400,"INVALID_INPUT");
   parsed=JSON.parse(bytes.toString("utf8"));
  }catch{return fail(400,"INVALID_INPUT");}
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))
   return fail(400,"INVALID_INPUT");
  const v=parsed as Record<string,unknown>;
  if(Object.keys(v).sort().join(",")!=="due,exp,id,org,through"||
   v.org!==org||v.through!==through||!validDate(v.due)||
   typeof v.id!=="string"||!UUID.test(v.id)||
   !Number.isSafeInteger(v.exp)||(v.exp as number)<=this.now()||
   (v.exp as number)>this.now()+10*60*1000)
   return fail(400,"INVALID_INPUT");
  return v as Cursor;
 }
 async page(actor:P4R28Actor|null,org:unknown,through:unknown,token:unknown):
  Promise<P4R68DuePage>{
  this.guard();
  if(!actor||actor.verified!==true||!USER.test(actor.userId))
   return fail(401,"IDENTITY_REQUIRED");
  if(typeof org!=="string"||!UUID.test(org))return fail(403,"ACCESS_DENIED");
  if(!validDate(through))return fail(400,"INVALID_INPUT");
  const cursor=this.cursor(token,org,through);
  let c:pg.PoolClient;
  try{c=await this.pool.connect();}catch{return fail(503,"UNAVAILABLE");}
  let active=false,discard=false;
  try{
   await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
   active=true;
   await c.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await c.query("SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,org]);
   const role=await c.query("SELECT current_user AS name,"+
    "(SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user)"+
    " AS privileged");
   if(role.rows[0]?.name!=="p4_synthetic_ci_runtime"||
    role.rows[0]?.privileged!==false)return fail(403,"ACCESS_DENIED");
   const rs=await c.query("SELECT task_id::text,lead_id::text,title,"+
    "due_date,status,revision,created_by,updated_by,created_at,"+
    "completed_at,company_name,key_date FROM"+
    " p4_r68_ci.owner_due_queue($1,$2::date,$3::date,$4::uuid)",
    [org,through,cursor?.due??null,cursor?.id??null]);
   if(rs.rows.length>21)return fail(503,"UNAVAILABLE");
   const raw=rs.rows.slice(0,20) as Record<string,unknown>[];
   const items:P4R68DueItem[]=raw.map(row=>{
    const {company_name,key_date,...rest}=row;
    if(typeof company_name!=="string"||!COMPANY.test(company_name)||
     !validDate(key_date))return fail(503,"UNAVAILABLE");
    const task=project(rest);
    if(task.status!=="OPEN"||task.dueDate!==key_date||
     task.dueDate>through)return fail(503,"UNAVAILABLE");
    return Object.freeze({task,companyName:company_name});
   });
   if(new Set(items.map(x=>x.task.taskId)).size!==items.length||
    items.some((x,i)=>i>0&&(
     x.task.dueDate<items[i-1]!.task.dueDate||
     (x.task.dueDate===items[i-1]!.task.dueDate&&
      x.task.taskId<=items[i-1]!.task.taskId))))
    return fail(503,"UNAVAILABLE");
   let nextCursor:string|null=null;
   if(rs.rows.length===21){
    const last=raw.at(-1);
    if(!last||!validDate(last.key_date)||
     typeof last.task_id!=="string"||!UUID.test(last.task_id))
     return fail(503,"UNAVAILABLE");
    const next:Cursor={org,through,due:last.key_date,id:last.task_id,
     exp:this.now()+10*60*1000};
    const payload=Buffer.from(JSON.stringify(next)).toString("base64url");
    nextCursor=payload+"."+this.sign(payload);
    if(nextCursor.length>1024)return fail(503,"UNAVAILABLE");
   }
   await c.query("COMMIT");active=false;
   return Object.freeze({items:Object.freeze(items),nextCursor});
  }catch(e){
   if(active){try{await c.query("ROLLBACK");}catch{discard=true;}}
   if(e instanceof P4R28Denied)throw e;
   if(e&&typeof e==="object"&&"code" in e){
    if(e.code==="P4003")return fail(403,"ACCESS_DENIED");
    if(e.code==="P6800")return fail(400,"INVALID_INPUT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{c.release(discard);}
 }
}
