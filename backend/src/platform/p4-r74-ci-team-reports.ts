/** R74 team-scoped read-only manager reports. */
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const TEAM=/^team_demo_[a-z]{2,24}$/;
const NAME=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,80}$/;
const STAGES=["OPEN","DISCOVERY","PROPOSAL","NEGOTIATION","WON","LOST"] as const;
type Stage=typeof STAGES[number];
const valid=(v:unknown,re:RegExp):v is string=>typeof v==="string"&&re.test(v);
const date=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{throw new P4R28Denied(status,code);};
export type Team=Readonly<{id:string;name:string}>;
export type ReportRow=Readonly<{owner:string;stage:Stage;total:number}>;
export class P4R74CiTeamReports{
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
    if(e.code==="P7400")return fail(400,"INVALID_INPUT");
    if(e.code==="P4009"||e.code==="23505"||e.code==="40001")return fail(409,"CONFLICT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
 async teams(actor:P4R28Actor|null,org:string):Promise<readonly Team[]>{
  return this.transact(actor,org,"READ ONLY",async(c,t)=>{
   const r=await c.query("SELECT id,name FROM p4_r74_ci.teams($1)",[t]);
   if(r.rows.length>100)return fail(503,"UNAVAILABLE");
   const items=r.rows.map((v:Record<string,unknown>)=>{
    if(!valid(v.id,TEAM)||!valid(v.name,NAME))return fail(503,"UNAVAILABLE");
    return Object.freeze({id:v.id,name:v.name});
   });
   if(items.some((v,i)=>i>0&&v.id<=items[i-1]!.id))return fail(503,"UNAVAILABLE");return items;
  });
 }
 async report(actor:P4R28Actor|null,org:string,query:unknown){
  if(!query||typeof query!=="object"||Array.isArray(query)||Object.keys(query).sort().join(",")!=="from,owner,stage,team,to")return fail(400,"INVALID_INPUT");
  const v=query as Record<string,unknown>;
  if(!valid(v.team,TEAM)||!(v.owner===""||valid(v.owner,USER))||
   !(v.stage===""||(typeof v.stage==="string"&&(STAGES as readonly string[]).includes(v.stage)))||
   !date(v.from)||!date(v.to)||Date.parse(v.to)<=Date.parse(v.from)||Date.parse(v.to)-Date.parse(v.from)>366*86400000)
   return fail(400,"INVALID_INPUT");
  return this.transact(actor,org,"READ ONLY",async(c,t)=>{
   const r=await c.query("SELECT owner_user_id,stage,total FROM p4_r74_ci.deal_report($1,$2,$3,$4,$5,$6)",[t,v.team,v.owner||null,v.stage||null,v.from,v.to]);
   if(r.rows.length>600)return fail(503,"UNAVAILABLE");
   const rows:ReportRow[]=r.rows.map((x:Record<string,unknown>)=>{
    if(!valid(x.owner_user_id,USER)||typeof x.stage!=="string"||!(STAGES as readonly string[]).includes(x.stage)||
     typeof x.total!=="number"||!Number.isSafeInteger(x.total)||x.total<1||
     (v.owner!==""&&x.owner_user_id!==v.owner)||(v.stage!==""&&x.stage!==v.stage))return fail(503,"UNAVAILABLE");
    return Object.freeze({owner:x.owner_user_id,stage:x.stage as Stage,total:x.total});
   });
   const total=rows.reduce((n,x)=>n+x.total,0);
   if(!Number.isSafeInteger(total)||new Set(rows.map(x=>x.owner+":"+x.stage)).size!==rows.length)return fail(503,"UNAVAILABLE");
   return Object.freeze({rows,total});
  });
 }
}
