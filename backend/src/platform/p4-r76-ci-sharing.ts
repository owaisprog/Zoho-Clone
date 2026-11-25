import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
export type Kind="LEAD"|"ACCOUNT"|"CONTACT"|"DEAL";
export type Team=Readonly<{id:string;name:string}>;
export type Assignment=Readonly<{teamId:string;active:boolean;revision:number}>;
export type AssignmentInput=Readonly<{teamId:string;active:boolean;expectedRevision:number|null}>;
export type SharedRecord=Readonly<{id:string;label:string;status:string|null;owner:string}>;
export type SharedPage=Readonly<{items:readonly SharedRecord[];nextCursor:string|null}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const TEAM=/^team_demo_[a-z]{2,24}$/;
const NAME=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$/;
const valid=(v:unknown,re:RegExp):v is string=>typeof v==="string"&&re.test(v);
const id=(v:unknown):v is string=>valid(v,UUID);
const kind=(v:unknown):v is Kind=>typeof v==="string"&&["LEAD","ACCOUNT","CONTACT","DEAL"].includes(v);
const version=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<1000000;
const record=(v:unknown,keys:string):Record<string,unknown>=>{if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).sort().join(",")!==keys)return invalid();return v as Record<string,unknown>;};
function parseAssignment(v:unknown):Assignment{const x=record(v,"active,revision,teamId");if(!valid(x.teamId,TEAM)||typeof x.active!=="boolean"||typeof x.revision!=="number"||!Number.isSafeInteger(x.revision)||x.revision<0||x.revision>1000000)return invalid();return {teamId:x.teamId,active:x.active,revision:x.revision};}
function parseTeams(v:unknown):readonly Team[]{if(!Array.isArray(v)||v.length>100)return invalid();const a=v.map(x=>{const r=record(x,"id,name");if(!valid(r.id,TEAM)||!valid(r.name,NAME))return invalid();return {id:r.id,name:r.name};});if(a.some((x,i)=>i>0&&x.id<=a[i-1]!.id))return invalid();return a;}
function parseShared(v:unknown):SharedRecord{const x=record(v,"id,label,owner,status");if(!id(x.id)||!valid(x.label,NAME)||!valid(x.owner,USER)||(x.status!==null&&(typeof x.status!=="string"||!["NEW","CONTACTED","QUALIFIED","LOST","CONVERTED","OPEN","DISCOVERY","PROPOSAL","NEGOTIATION","WON"].includes(x.status))))return invalid();return {id:x.id,label:x.label,owner:x.owner,status:x.status as string|null};}
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{throw new P4R28Denied(status,code);};
const invalid=():never=>fail(503,"UNAVAILABLE");
export class P4R76CiSharing{
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
    if(e.code==="P7600")return fail(400,"INVALID_INPUT");
    if(e.code==="P4009"||e.code==="23505"||e.code==="40001")return fail(409,"CONFLICT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
 async teams(actor:P4R28Actor|null,org:string){return this.transact(actor,org,"READ ONLY",async(c,t)=>parseTeams((await c.query("SELECT * FROM p4_r76_ci.teams($1)",[t])).rows));}
 async get(actor:P4R28Actor|null,org:string,k:unknown,r:unknown){
 if(!kind(k)||!id(r))return fail(400,"INVALID_INPUT");
 return this.transact(actor,org,"READ ONLY",async(c,t)=>{const rows=(await c.query('SELECT team_id AS "teamId",active,revision FROM p4_r76_ci.get_assignment($1,$2,$3)',[t,k,r])).rows;if(rows.length>1)return invalid();return rows.length?parseAssignment(rows[0]):null;});
 }
 async set(actor:P4R28Actor|null,org:string,k:unknown,r:unknown,input:unknown){
 if(!kind(k)||!id(r)||!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).sort().join(",")!=="active,expectedRevision,teamId")return fail(400,"INVALID_INPUT");
 const v=input as Record<string,unknown>;if(!valid(v.teamId,TEAM)||typeof v.active!=="boolean"||!(v.expectedRevision===null||version(v.expectedRevision)))return fail(400,"INVALID_INPUT");
 return this.transact(actor,org,"READ WRITE",async(c,t)=>{const rows=(await c.query('SELECT team_id AS "teamId",active,revision FROM p4_r76_ci.set_assignment($1,$2,$3,$4,$5,$6)',[t,k,r,v.teamId,v.active,v.expectedRevision])).rows;if(rows.length!==1)return invalid();return parseAssignment(rows[0]);});
 }
 async shared(actor:P4R28Actor|null,org:string,query:unknown){
 if(!query||typeof query!=="object"||Array.isArray(query)||Object.keys(query).sort().join(",")!=="after,kind,team")return fail(400,"INVALID_INPUT");
 const q=query as Record<string,unknown>;if(!kind(q.kind)||!valid(q.team,TEAM)||!(q.after===""||id(q.after)))return fail(400,"INVALID_INPUT");
 return this.transact(actor,org,"READ ONLY",async(c,t)=>{const rows=(await c.query('SELECT id::text,label,status,owner_user_id AS owner FROM p4_r76_ci.shared_records($1,$2,$3,$4)',[t,q.team,q.kind,q.after||null])).rows;if(rows.length>21)return invalid();const items=rows.slice(0,20).map(parseShared);if(items.some((x,i)=>(i>0&&x.id<=items[i-1]!.id)||(typeof q.after==="string"&&x.id<=q.after)))return invalid();return {items,nextCursor:rows.length===21?items[19]!.id:null};});
 }
}
