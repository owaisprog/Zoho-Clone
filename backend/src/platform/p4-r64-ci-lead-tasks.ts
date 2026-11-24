/** R64 signed owner-only fictional CRM follow-up tasks, real CI PostgreSQL. */
import {randomUUID} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
export type P4R64Task=Readonly<{
 taskId:string;leadId:string;title:string;dueDate:string;
 status:"OPEN"|"DONE";revision:number;createdBy:string;updatedBy:string|null;
 createdAt:string;completedAt:string|null;
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const TITLE=/^Demo [A-Za-z0-9 ,.!?-]{8,70}$/;
const DATE=/^\d{4}-\d\d-\d\d$/;
const validDate=(v:unknown):v is string=>typeof v==="string"&&
 DATE.test(v)&&v>="2026-01-01"&&v<="2032-12-31"&&
 Number.isFinite(Date.parse(v+"T00:00:00.000Z"))&&
 new Date(v+"T00:00:00.000Z").toISOString().slice(0,10)===v;
const deny=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
function project(r:Record<string,unknown>):P4R64Task{
 const done=r.status==="DONE";
 if(Object.keys(r).sort().join(",")!==
  "completed_at,created_at,created_by,due_date,lead_id,revision,status,task_id,title,updated_by"||
  typeof r.task_id!=="string"||!UUID.test(r.task_id)||
  typeof r.lead_id!=="string"||!UUID.test(r.lead_id)||
  typeof r.title!=="string"||!TITLE.test(r.title)||
  !validDate(r.due_date)||
  (r.status!=="OPEN"&&r.status!=="DONE")||
  r.revision!==(done?1:0)||
  typeof r.created_by!=="string"||!USER.test(r.created_by)||
  (done?(typeof r.updated_by!=="string"||!USER.test(r.updated_by)):
   r.updated_by!==null)||
  !(r.created_at instanceof Date)||
  !Number.isFinite(r.created_at.getTime())||
  (done?(!(r.completed_at instanceof Date)||
   !Number.isFinite(r.completed_at.getTime())||
   r.completed_at.getTime()<r.created_at.getTime()):
   r.completed_at!==null))
  return deny(503,"UNAVAILABLE");
 return Object.freeze({taskId:r.task_id,leadId:r.lead_id,title:r.title,
  dueDate:r.due_date,status:r.status as P4R64Task["status"],
  revision:r.revision as number,createdBy:r.created_by,
  updatedBy:r.updated_by as string|null,
  createdAt:r.created_at.toISOString(),
  completedAt:r.completed_at instanceof Date?r.completed_at.toISOString():null});
}
export class P4R64CiLeadTasks{
 constructor(private readonly pool:pg.Pool,
  private readonly env:NodeJS.ProcessEnv=process.env){}
 private async txn<T>(actor:P4R28Actor|null,org:unknown,
  mode:"READ ONLY"|"READ WRITE",
  task:(c:pg.PoolClient,id:string)=>Promise<T>):Promise<T>{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return deny(503,"UNAVAILABLE");}
  if(!actor||actor.verified!==true||!USER.test(actor.userId))
   return deny(401,"IDENTITY_REQUIRED");
  if(typeof org!=="string"||!UUID.test(org))return deny(403,"ACCESS_DENIED");
  let client:pg.PoolClient;
  try{client=await this.pool.connect();}
  catch{return deny(503,"UNAVAILABLE");}
  let active=false,discard=false;
  try{
   await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ "+mode);
   active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query("SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,org]);
   const rights=await client.query("SELECT current_user AS name,"+
    "(SELECT rolsuper OR rolbypassrls FROM pg_roles"+
    " WHERE rolname=current_user) AS privileged");
   if(rights.rows[0]?.name!=="p4_synthetic_ci_runtime"||
    rights.rows[0]?.privileged!==false)return deny(403,"ACCESS_DENIED");
   const output=await task(client,org);
   await client.query("COMMIT");active=false;
   return output;
  }catch(e){
   if(active){try{await client.query("ROLLBACK");}catch{discard=true;}}
   if(e instanceof P4R28Denied)throw e;
   if(e&&typeof e==="object"&&"code" in e){
    if(e.code==="P4003")return deny(403,"ACCESS_DENIED");
    if(e.code==="P6400")return deny(400,"INVALID_INPUT");
    if(e.code==="P4009"||e.code==="23505")return deny(409,"CONFLICT");
   }
   return deny(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
 async create(actor:P4R28Actor|null,org:string,lead:unknown,
  input:unknown):Promise<P4R64Task>{
  if(typeof lead!=="string"||!UUID.test(lead)||
   !input||typeof input!=="object"||Array.isArray(input)||
   Object.keys(input).sort().join(",")!=="dueDate,title")
   return deny(400,"INVALID_INPUT");
  const v=input as Record<string,unknown>;
  if(typeof v.title!=="string"||!TITLE.test(v.title)||
   !validDate(v.dueDate))return deny(400,"INVALID_INPUT");
  return this.txn(actor,org,"READ WRITE",async(c,id)=>{
   const rows=await c.query("SELECT task_id::text,lead_id::text,title,"+
    "due_date::text,status,revision,created_by,updated_by,"+
    "created_at,completed_at FROM"+
    " p4_r64_ci.create_task($1,$2,$3,$4,$5,$6::date)",[
     id,lead,randomUUID(),randomUUID(),v.title,v.dueDate]);
   if(rows.rows.length!==1)return deny(503,"UNAVAILABLE");
   const result=project(rows.rows[0]);
   if(result.leadId!==lead||result.status!=="OPEN"||result.revision!==0||
    result.title!==v.title||result.dueDate!==v.dueDate)
    return deny(503,"UNAVAILABLE");
   return result;
  });
 }
 async list(actor:P4R28Actor|null,org:string,lead:unknown):
  Promise<readonly P4R64Task[]>{
  if(typeof lead!=="string"||!UUID.test(lead))
   return deny(400,"INVALID_INPUT");
  return this.txn(actor,org,"READ ONLY",async(c,id)=>{
   const rows=await c.query("SELECT task_id::text,lead_id::text,title,"+
    "due_date::text,status,revision,created_by,updated_by,"+
    "created_at,completed_at FROM p4_r64_ci.list_tasks($1,$2)",[id,lead]);
   if(rows.rows.length>20)return deny(503,"UNAVAILABLE");
   const tasks=rows.rows.map(project);
   if(new Set(tasks.map(x=>x.taskId)).size!==tasks.length||
    tasks.some((x,i)=>x.leadId!==lead||
     (i>0&&x.createdAt>tasks[i-1]!.createdAt)))
    return deny(503,"UNAVAILABLE");
   return Object.freeze(tasks);
  });
 }
 async complete(actor:P4R28Actor|null,org:string,lead:unknown,
  task:unknown,input:unknown):Promise<P4R64Task>{
  if(typeof lead!=="string"||!UUID.test(lead)||
   typeof task!=="string"||!UUID.test(task)||
   !input||typeof input!=="object"||Array.isArray(input)||
   Object.keys(input).join(",")!=="expectedRevision"||
   (input as {expectedRevision?:unknown}).expectedRevision!==0)
   return deny(400,"INVALID_INPUT");
  return this.txn(actor,org,"READ WRITE",async(c,id)=>{
   const rows=await c.query("SELECT task_id::text,lead_id::text,title,"+
    "due_date::text,status,revision,created_by,updated_by,"+
    "created_at,completed_at FROM"+
    " p4_r64_ci.complete_task($1,$2,$3,$4,$5)",[
     id,lead,task,0,randomUUID()]);
   if(rows.rows.length!==1)return deny(503,"UNAVAILABLE");
   const result=project(rows.rows[0]);
   if(result.taskId!==task||result.leadId!==lead||
    result.status!=="DONE"||result.revision!==1)
    return deny(503,"UNAVAILABLE");
   return result;
  });
 }
}
