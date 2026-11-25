import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
export const SEARCH_KINDS=["LEAD","ACCOUNT","CONTACT","DEAL","TASK"] as const;
export type SearchKind=typeof SEARCH_KINDS[number];
export const SEARCH_STATUSES:Readonly<Record<SearchKind,readonly string[]>>={LEAD:["NEW","CONTACTED","QUALIFIED","LOST","CONVERTED"],ACCOUNT:[],CONTACT:[],DEAL:["OPEN","DISCOVERY","PROPOSAL","NEGOTIATION","WON","LOST"],TASK:["OPEN","COMPLETED"]};
export type SearchQuery=Readonly<{kind:SearchKind;q:string;status:string;after:string|null}>;
export type SearchRecord=Readonly<{id:string;label:string;status:string|null}>;
export type SearchPage=Readonly<{actorId:string;items:readonly SearchRecord[];nextCursor:string|null}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const LABEL=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$/;
const Q=/^[A-Za-z0-9 .&-]{0,64}$/;
const valid=(v:unknown,re:RegExp):v is string=>typeof v==="string"&&re.test(v);
const id=(v:unknown):v is string=>valid(v,UUID);
const kind=(v:unknown):v is SearchKind=>typeof v==="string"&&(SEARCH_KINDS as readonly string[]).includes(v);
function parseRow(raw:unknown,k:SearchKind,q:string,s:string):SearchRecord{
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).sort().join(",")!=="id,label,status")return invalid();
 const v=raw as Record<string,unknown>;
 if(!id(v.id)||!valid(v.label,LABEL)||!v.label.toLowerCase().includes(q.toLowerCase())||
 (SEARCH_STATUSES[k].length===0?v.status!==null:typeof v.status!=="string"||!SEARCH_STATUSES[k].includes(v.status))||
 (s!==""&&v.status!==s))return invalid();
 return {id:v.id,label:v.label,status:v.status as string|null};
}
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{throw new P4R28Denied(status,code);};
const invalid=():never=>fail(503,"UNAVAILABLE");
export class P4R77CiSearch{
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
    if(e.code==="P7700")return fail(400,"INVALID_INPUT");
    if(e.code==="P4009"||e.code==="23505"||e.code==="40001")return fail(409,"CONFLICT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
 async search(actor:P4R28Actor|null,org:string,input:unknown):Promise<SearchPage>{
 if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).sort().join(",")!=="after,kind,q,status")return fail(400,"INVALID_INPUT");
 const v=input as Record<string,unknown>;
 if(!kind(v.kind)||!valid(v.q,Q)||typeof v.status!=="string"||(v.status!==""&&!SEARCH_STATUSES[v.kind].includes(v.status))||!(v.after===""||id(v.after)))return fail(400,"INVALID_INPUT");
 const k=v.kind,q=v.q,s=v.status,after=v.after;
 return this.transact(actor,org,"READ ONLY",async(c,t)=>{
 const r=await c.query("SELECT id::text,label,status FROM p4_r77_ci.search_records($1,$2,$3,$4,$5)",[t,k,q,s||null,after||null]);
 if(r.rows.length>21)return invalid();const items=r.rows.slice(0,20).map(x=>parseRow(x,k,q,s));
 if(items.some((x,i)=>(i>0&&x.id<=items[i-1]!.id)||(typeof after==="string"&&x.id<=after)))return invalid();
 return {actorId:actor!.userId,items,nextCursor:r.rows.length===21?items[19]!.id:null};
 });
 }
}
