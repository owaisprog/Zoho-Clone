/** R61 signed fictional CRM follow-up notes: immutable and tenant-scoped. */
import {randomUUID} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
export type P4R61LeadNote=Readonly<{
 noteId:string;leadId:string;noteText:string;actorUserId:string;createdAt:string;
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const TEXT=/^Demo [A-Za-z0-9 ,.!?-]{8,130}$/;
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
function project(row:Record<string,unknown>):P4R61LeadNote{
 if(Object.keys(row).sort().join(",")!==
  "actor_user_id,created_at,lead_id,note_id,note_text"||
  typeof row.note_id!=="string"||!UUID.test(row.note_id)||
  typeof row.lead_id!=="string"||!UUID.test(row.lead_id)||
  typeof row.actor_user_id!=="string"||!USER.test(row.actor_user_id)||
  typeof row.note_text!=="string"||!TEXT.test(row.note_text)||
  !(row.created_at instanceof Date)||!Number.isFinite(row.created_at.getTime()))
  return fail(503,"UNAVAILABLE");
 return Object.freeze({noteId:row.note_id,leadId:row.lead_id,
  noteText:row.note_text,actorUserId:row.actor_user_id,
  createdAt:row.created_at.toISOString()});
}
export class P4R61CiLeadNotes{
 constructor(private readonly pool:pg.Pool,
  private readonly env:NodeJS.ProcessEnv=process.env){}
 private async transaction<T>(actor:P4R28Actor|null,org:unknown,mode:
  "READ ONLY"|"READ WRITE",task:(c:pg.PoolClient,id:string)=>Promise<T>):Promise<T>{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return fail(503,"UNAVAILABLE");}
  if(!actor||actor.verified!==true||!USER.test(actor.userId))
   return fail(401,"IDENTITY_REQUIRED");
  if(typeof org!=="string"||!UUID.test(org))
   return fail(403,"ACCESS_DENIED");
  let c:pg.PoolClient;
  try{c=await this.pool.connect();}
  catch{return fail(503,"UNAVAILABLE");}
  let active=false,discard=false;
  try{
   await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ "+mode);active=true;
   await c.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await c.query("SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,org]);
   const role=await c.query("SELECT current_user AS name,"+
    "(SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user)"+
    " AS privileged");
   if(role.rows[0]?.name!=="p4_synthetic_ci_runtime"||
    role.rows[0]?.privileged!==false)return fail(403,"ACCESS_DENIED");
   const result=await task(c,org);
   await c.query("COMMIT");active=false;
   return result;
  }catch(e){
   if(active){try{await c.query("ROLLBACK");}catch{discard=true;}}
   if(e instanceof P4R28Denied)throw e;
   if(e&&typeof e==="object"&&"code" in e){
    if(e.code==="P4003")return fail(403,"ACCESS_DENIED");
    if(e.code==="P6100")return fail(400,"INVALID_INPUT");
    if(e.code==="P4009"||e.code==="23505")return fail(409,"CONFLICT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{c.release(discard);}
 }
 async add(actor:P4R28Actor|null,org:string,lead:unknown,body:unknown):
  Promise<P4R61LeadNote>{
  if(typeof lead!=="string"||!UUID.test(lead)||
   !body||typeof body!=="object"||Array.isArray(body)||
   Object.keys(body).join(",")!=="noteText"||
   typeof (body as {noteText?:unknown}).noteText!=="string"||
   !TEXT.test((body as {noteText:string}).noteText))
   return fail(400,"INVALID_INPUT");
  return this.transaction(actor,org,"READ WRITE",async(c,id)=>{
   const result=await c.query("SELECT note_id::text,lead_id::text,"+
    "note_text,actor_user_id,created_at FROM"+
    " p4_r61_ci.add_lead_note($1,$2,$3,$4,$5)",[
     id,lead,randomUUID(),randomUUID(),(body as {noteText:string}).noteText]);
   if(result.rows.length!==1)return fail(503,"UNAVAILABLE");
   const record=project(result.rows[0]);
   if(record.leadId!==lead)return fail(503,"UNAVAILABLE");
   return record;
  });
 }
 async list(actor:P4R28Actor|null,org:string,lead:unknown):
  Promise<readonly P4R61LeadNote[]>{
  if(typeof lead!=="string"||!UUID.test(lead))
   return fail(400,"INVALID_INPUT");
  return this.transaction(actor,org,"READ ONLY",async(c,id)=>{
   const rows=await c.query("SELECT note_id::text,lead_id::text,"+
    "note_text,actor_user_id,created_at FROM"+
    " p4_r61_ci.list_lead_notes($1,$2)",[id,lead]);
   if(rows.rows.length>20)return fail(503,"UNAVAILABLE");
   const notes=rows.rows.map(project);
   if(new Set(notes.map(x=>x.noteId)).size!==notes.length||
    notes.some((x,i)=>x.leadId!==lead||
     (i>0&&x.createdAt>notes[i-1]!.createdAt)))
    return fail(503,"UNAVAILABLE");
   return Object.freeze(notes);
  });
 }
}
