import {randomUUID} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
export type Task=Readonly<{id:string;parentKind:"LEAD"|"ACCOUNT"|"DEAL";parentId:string;title:string;dueDate:string;status:"OPEN"|"COMPLETED";revision:number;assignee:string}>;
export type TaskInput=Readonly<{parentKind:Task["parentKind"];parentId:string;title:string;dueDate:string;assignee:string}>;
export type TaskChange=Readonly<{action:"RESCHEDULED"|"COMPLETED";dueDate:string|null;expectedRevision:number}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const TITLE=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$/;
const valid=(v:unknown,re:RegExp):v is string=>typeof v==="string"&&re.test(v);
const id=(v:unknown):v is string=>valid(v,UUID);
const date=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v>="2020-01-01"&&v<="2100-12-31";
const version=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<1000000;
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{throw new P4R28Denied(status,code);};
const invalid=():never=>fail(503,"UNAVAILABLE");
function parseTask(raw:unknown):Task{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return invalid();
 const v=raw as Record<string,unknown>;
 if(Object.keys(v).sort().join(",")!=="assignee,dueDate,id,parentId,parentKind,revision,status,title"||
 !id(v.id)||!id(v.parentId)||!["LEAD","ACCOUNT","DEAL"].includes(v.parentKind as string)||
 !valid(v.title,TITLE)||!date(v.dueDate)||!["OPEN","COMPLETED"].includes(v.status as string)||
 typeof v.revision!=="number"||!Number.isSafeInteger(v.revision)||v.revision<0||v.revision>1000000||!valid(v.assignee,USER))return invalid();
 return Object.freeze(v as Task);
}
const fields='id::text,CASE WHEN lead_id IS NOT NULL THEN \'LEAD\' WHEN account_id IS NOT NULL THEN \'ACCOUNT\' ELSE \'DEAL\' END AS "parentKind",coalesce(lead_id,account_id,deal_id)::text AS "parentId",title,due_date::text AS "dueDate",status,revision,owner_user_id AS assignee';
const body=(v:unknown,keys:string):Record<string,unknown>=>{if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).sort().join(",")!==keys)return fail(400,"INVALID_INPUT");return v as Record<string,unknown>;};
export class P4R75CiSalesTasks{
 constructor(private readonly pool:pg.Pool,private readonly env:NodeJS.ProcessEnv=process.env){}
 private async transact<T>(actor:P4R28Actor|null,org:unknown,
  mode:"READ ONLY"|"READ WRITE",
  callback:(client:pg.PoolClient,id:string)=>Promise<T>):Promise<T>{
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
   await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ "+mode);active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query("SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,org]);
   const roles=await client.query("SELECT current_user AS role,"+
    "(SELECT rolsuper OR rolbypassrls FROM pg_roles"+
    " WHERE rolname=current_user) AS privileged");
   if(roles.rows[0]?.role!=="p4_synthetic_ci_runtime"||
    roles.rows[0]?.privileged!==false)return fail(403,"ACCESS_DENIED");
   const result=await callback(client,org);
   await client.query("COMMIT");active=false;
   return result;
  }catch(e){
   if(active){try{await client.query("ROLLBACK");}catch{discard=true;}}
   if(e instanceof P4R28Denied)throw e;
   if(e&&typeof e==="object"&&"code" in e){
    if(e.code==="P4003")return fail(403,"ACCESS_DENIED");
    if(e.code==="P7500")return fail(400,"INVALID_INPUT");
    if(e.code==="P4009"||e.code==="23505"||e.code==="40001")return fail(409,"CONFLICT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
 async create(actor:P4R28Actor|null,org:string,input:unknown){
 const v=body(input,"assignee,dueDate,parentId,parentKind,title");
 if(!id(v.parentId)||!["LEAD","ACCOUNT","DEAL"].includes(v.parentKind as string)||!valid(v.title,TITLE)||!date(v.dueDate)||!valid(v.assignee,USER))return fail(400,"INVALID_INPUT");
 return this.transact(actor,org,"READ WRITE",async(c,t)=>{const r=await c.query("SELECT "+fields+" FROM p4_r75_ci.create_task($1,$2,$3,$4,$5,$6,$7)",[t,randomUUID(),v.parentKind,v.parentId,v.title,v.dueDate,v.assignee]);if(r.rows.length!==1)return invalid();return parseTask(r.rows[0]);});
 }
 async page(actor:P4R28Actor|null,org:string,after:unknown){
 if(after!==null&&!id(after))return fail(400,"INVALID_INPUT");
 return this.transact(actor,org,"READ ONLY",async(c,t)=>{const r=await c.query("SELECT "+fields+" FROM p4_r75_ci.list_tasks($1,$2)",[t,after]);if(r.rows.length>21)return invalid();const items=r.rows.slice(0,20).map(parseTask);if(items.some((x,i)=>(i>0&&x.id<=items[i-1]!.id)||(typeof after==="string"&&x.id<=after)))return invalid();return {items,nextCursor:r.rows.length===21?items[19]!.id:null};});
 }
 async change(actor:P4R28Actor|null,org:string,task:unknown,input:unknown){
 const v=body(input,"action,dueDate,expectedRevision");
 if(!id(task)||!version(v.expectedRevision)||!((v.action==="RESCHEDULED"&&date(v.dueDate))||(v.action==="COMPLETED"&&v.dueDate===null)))return fail(400,"INVALID_INPUT");
 return this.transact(actor,org,"READ WRITE",async(c,t)=>{const r=await c.query("SELECT "+fields+" FROM p4_r75_ci.change_task($1,$2,$3,$4,$5)",[t,task,v.expectedRevision,v.action,v.dueDate]);if(r.rows.length!==1)return invalid();return parseTask(r.rows[0]);});
 }
}
