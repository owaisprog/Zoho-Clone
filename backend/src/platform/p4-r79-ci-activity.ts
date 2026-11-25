import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
export type HistoryKind="LEAD"|"ACCOUNT"|"CONTACT"|"DEAL"|"TASK";
export type HistoryEvent=Readonly<{revision:number;actor:string;action:string;occurredAt:string;beforeValue:string|null;afterValue:string|null}>;
export type HistoryPage=Readonly<{items:readonly HistoryEvent[];nextCursor:number|null}>;
export type WorkloadRow=Readonly<{owner:string;overdue:number;dueToday:number;upcoming:number;completed:number}>;
export type Workload=Readonly<{rows:readonly WorkloadRow[];total:number}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const TEAM=/^team_demo_[a-z]{2,24}$/;
const valid=(v:unknown,re:RegExp):v is string=>typeof v==="string"&&re.test(v);
const id=(v:unknown):v is string=>valid(v,UUID);
const date=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v>="2020-01-01"&&v<="2100-12-31";
const count=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0;
const kind=(v:unknown):v is HistoryKind=>typeof v==="string"&&["LEAD","ACCOUNT","CONTACT","DEAL","TASK"].includes(v);
const object=(v:unknown,keys:string):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===keys;
const status=["NEW","CONTACTED","QUALIFIED","LOST","CONVERTED","OPEN","DISCOVERY","PROPOSAL","NEGOTIATION","WON"];
const value=(v:unknown)=>v===null||date(v)||(typeof v==="string"&&status.includes(v));
function parseHistory(v:unknown,before:number|null):HistoryPage{
 if(!object(v,"items,nextCursor")||!Array.isArray(v.items)||v.items.length>20)return invalid();
 const items=v.items.map(x=>{if(!object(x,"action,actor,afterValue,beforeValue,occurredAt,revision")||!count(x.revision)||x.revision>1000000||!valid(x.actor,USER)||typeof x.action!=="string"||!["CREATED","UPDATED","STAGE_CHANGED","RESCHEDULED","COMPLETED","REASSIGNED"].includes(x.action)||typeof x.occurredAt!=="string"||!Number.isFinite(Date.parse(x.occurredAt))||new Date(x.occurredAt).toISOString()!==x.occurredAt||!value(x.beforeValue)||!value(x.afterValue))return invalid();return x as HistoryEvent;});
 if(items.some((x,i)=>(i>0&&x.revision>=items[i-1]!.revision)||(before!==null&&x.revision>=before))||(v.nextCursor!==null&&(items.length!==20||v.nextCursor!==items[19]!.revision)))return invalid();
 return {items,nextCursor:v.nextCursor as number|null};
}
function parseWorkload(v:unknown):Workload{
 if(!object(v,"rows,total")||!Array.isArray(v.rows)||v.rows.length>100||!count(v.total))return invalid();
 const rows=v.rows.map(x=>{if(!object(x,"completed,dueToday,overdue,owner,upcoming")||!valid(x.owner,USER)||![x.overdue,x.dueToday,x.upcoming,x.completed].every(count))return invalid();return x as WorkloadRow;});
 const total=rows.reduce((n,r)=>n+r.overdue+r.dueToday+r.upcoming+r.completed,0);
 if(total!==v.total||!Number.isSafeInteger(total)||rows.some((x,i)=>i>0&&x.owner<=rows[i-1]!.owner))return invalid();return {rows,total};
}
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{throw new P4R28Denied(status,code);};
const invalid=():never=>fail(503,"UNAVAILABLE");
export class P4R79CiActivity{
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
    if(e.code==="P7900")return fail(400,"INVALID_INPUT");
    if(e.code==="P4009"||e.code==="23505"||e.code==="40001")return fail(409,"CONFLICT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
 async history(actor:P4R28Actor|null,org:string,q:unknown){
 if(!object(q,"before,kind,record,team")||!(q.team===""||valid(q.team,TEAM))||!kind(q.kind)||!id(q.record)||typeof q.before!=="string"||!(q.before===""||/^(0|[1-9][0-9]{0,6})$/.test(q.before))||Number(q.before)>1000001)return fail(400,"INVALID_INPUT");
 const before=q.before===""?null:Number(q.before);
 return this.transact(actor,org,"READ ONLY",async(c,t)=>{const r=await c.query('SELECT revision,actor,action,occurred_at AS "occurredAt",before_value AS "beforeValue",after_value AS "afterValue" FROM p4_r79_ci.timeline($1,$2,$3,$4,$5)',[t,q.team||null,q.kind,q.record,before]);if(r.rows.length>21)return invalid();const items=r.rows.slice(0,20).map(x=>({...x,occurredAt:x.occurredAt instanceof Date?x.occurredAt.toISOString():null}));return parseHistory({items,nextCursor:r.rows.length===21?r.rows[19].revision:null},before);});
 }
 async workload(actor:P4R28Actor|null,org:string,q:unknown){
 if(!object(q,"asOf,owner,team")||!valid(q.team,TEAM)||!date(q.asOf)||!(q.owner===""||valid(q.owner,USER)))return fail(400,"INVALID_INPUT");
 return this.transact(actor,org,"READ ONLY",async(c,t)=>{const r=await c.query('SELECT owner,overdue,due_today AS "dueToday",upcoming,completed FROM p4_r79_ci.workload($1,$2,$3,$4)',[t,q.team,q.asOf,q.owner||null]);if(r.rows.length>100)return invalid();return parseWorkload({rows:r.rows,total:r.rows.reduce((n,x)=>n+x.overdue+x.dueToday+x.upcoming+x.completed,0)});});
 }
}
