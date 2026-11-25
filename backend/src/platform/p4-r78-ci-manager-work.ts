import {randomUUID} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
export type WorkKind="DEAL"|"TASK";
export type WorkRow=Readonly<{id:string;label:string;status:string;owner:string;revision:number;parentId:string|null;dueDate:string|null}>;
export type WorkPage=Readonly<{items:readonly WorkRow[];nextCursor:string|null}>;
export type TaskCreate=Readonly<{team:string;dealId:string;title:string;dueDate:string;assignee:string}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const TEAM=/^team_demo_[a-z]{2,24}$/;
const LABEL=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$/;
const NEXT=["DISCOVERY","PROPOSAL","NEGOTIATION","WON","LOST"];
const valid=(v:unknown,re:RegExp):v is string=>typeof v==="string"&&re.test(v);
const id=(v:unknown):v is string=>valid(v,UUID);
const date=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v>="2020-01-01"&&v<="2100-12-31";
const version=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<1000000;
const object=(v:unknown,keys:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===keys;
function parseRow(v:unknown,k:WorkKind):WorkRow{
 if(!object(v,"dueDate,id,label,owner,parentId,revision,status")||!id(v.id)||!valid(v.label,LABEL)||!valid(v.owner,USER)||typeof v.revision!=="number"||!Number.isSafeInteger(v.revision)||v.revision<0||v.revision>1000000||
 (k==="DEAL"?v.parentId!==null||v.dueDate!==null||!["OPEN",...NEXT].includes(v.status as string):!id(v.parentId)||!date(v.dueDate)||!["OPEN","COMPLETED"].includes(v.status as string)))return invalid();
 return v as WorkRow;
}
function parseMembers(v:unknown):readonly string[]{if(!Array.isArray(v)||v.length>100||!v.every(x=>valid(x,USER))||v.some((x,i)=>i>0&&x<=v[i-1]!))return invalid();return v;}
function parsePage(v:unknown,k:WorkKind,after:string|null):WorkPage{
 if(!object(v,"items,nextCursor")||!Array.isArray(v.items)||v.items.length>20)return invalid();
 const items=v.items.map(x=>parseRow(x,k));if(items.some((x,i)=>(i>0&&x.id<=items[i-1]!.id)||(after!==null&&x.id<=after))||(v.nextCursor!==null&&(items.length!==20||v.nextCursor!==items[19]!.id)))return invalid();return {items,nextCursor:v.nextCursor as string|null};
}
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{throw new P4R28Denied(status,code);};
const invalid=():never=>fail(503,"UNAVAILABLE");
const taskFields='id::text,title AS label,status,owner_user_id AS owner,revision,deal_id::text AS "parentId",due_date::text AS "dueDate"';
export class P4R78CiManagerWork{
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
    if(e.code==="P7800")return fail(400,"INVALID_INPUT");
    if(e.code==="P4009"||e.code==="23505"||e.code==="40001")return fail(409,"CONFLICT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
 async members(actor:P4R28Actor|null,org:string,q:unknown){if(!object(q,"team")||!valid(q.team,TEAM))return fail(400,"INVALID_INPUT");
 return this.transact(actor,org,"READ ONLY",async(c,t)=>parseMembers((await c.query("SELECT user_id FROM p4_r78_ci.members($1,$2)",[t,q.team])).rows.map(x=>x.user_id)));}
 async work(actor:P4R28Actor|null,org:string,q:unknown){
 if(!object(q,"after,kind,team")||!valid(q.team,TEAM)||(q.kind!=="DEAL"&&q.kind!=="TASK")||!(q.after===""||id(q.after)))return fail(400,"INVALID_INPUT");
 const k=q.kind,after=q.after||null;
 return this.transact(actor,org,"READ ONLY",async(c,t)=>{const rows=(await c.query('SELECT id::text,label,status,owner_user_id AS owner,revision,parent_id::text AS "parentId",due_date::text AS "dueDate" FROM p4_r78_ci.work($1,$2,$3,$4)',[t,q.team,k,after])).rows;
 if(rows.length>21)return invalid();return parsePage({items:rows.slice(0,20),nextCursor:rows.length===21?rows[19].id:null},k,after as string|null);});}
 async create(actor:P4R28Actor|null,org:string,q:unknown){
 if(!object(q,"assignee,dealId,dueDate,team,title")||!valid(q.team,TEAM)||!id(q.dealId)||!valid(q.title,LABEL)||!date(q.dueDate)||!valid(q.assignee,USER))return fail(400,"INVALID_INPUT");
 return this.transact(actor,org,"READ WRITE",async(c,t)=>{const r=await c.query("SELECT "+taskFields+" FROM p4_r78_ci.create_task($1,$2,$3,$4,$5,$6,$7)",[t,q.team,randomUUID(),q.dealId,q.title,q.dueDate,q.assignee]);if(r.rows.length!==1)return invalid();return parseRow(r.rows[0],"TASK");});}
 async reassign(actor:P4R28Actor|null,org:string,task:unknown,q:unknown){
 if(!id(task)||!object(q,"assignee,expectedRevision,team")||!valid(q.team,TEAM)||!valid(q.assignee,USER)||!version(q.expectedRevision))return fail(400,"INVALID_INPUT");
 return this.transact(actor,org,"READ WRITE",async(c,t)=>{const r=await c.query("SELECT "+taskFields+" FROM p4_r78_ci.reassign($1,$2,$3,$4,$5)",[t,q.team,task,q.assignee,q.expectedRevision]);if(r.rows.length!==1)return invalid();return parseRow(r.rows[0],"TASK");});}
 async stage(actor:P4R28Actor|null,org:string,deal:unknown,q:unknown){
 if(!id(deal)||!object(q,"expectedRevision,stage,team")||!valid(q.team,TEAM)||!version(q.expectedRevision)||!NEXT.includes(q.stage as string))return fail(400,"INVALID_INPUT");
 return this.transact(actor,org,"READ WRITE",async(c,t)=>{const r=await c.query("SELECT id::text,stage,revision FROM p4_r78_ci.change_stage($1,$2,$3,$4,$5)",[t,q.team,deal,q.stage,q.expectedRevision]);
 if(r.rows.length!==1||r.rows[0].id!==deal||r.rows[0].stage!==q.stage||r.rows[0].revision!==(q.expectedRevision as number)+1)return invalid();return {id:r.rows[0].id as string,stage:r.rows[0].stage as string,revision:r.rows[0].revision as number};});}
}
