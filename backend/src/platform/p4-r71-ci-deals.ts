/** R71 explicit sales rep own Deals; fixed synthetic pipeline and atomic stage history. */
import {randomUUID} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const NAME=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$/;
const STAGES=["OPEN","DISCOVERY","PROPOSAL","NEGOTIATION","WON","LOST"] as const;
type Stage=typeof STAGES[number];
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{throw new P4R28Denied(status,code);};
export type Deal=Readonly<{id:string;title:string;accountId:string;contactId:string;pipelineId:string;stageId:string;stage:Stage;revision:number;createdAt:string}>;
const id=(v:unknown):v is string=>typeof v==="string"&&UUID.test(v);
const stage=(v:unknown):v is Stage=>typeof v==="string"&&(STAGES as readonly string[]).includes(v);
function project(r:Record<string,unknown>):Deal{
 if(!id(r.id)||!id(r.account_id)||!id(r.contact_id)||!id(r.pipeline_id)||!id(r.stage_id)||
 typeof r.title!=="string"||!NAME.test(r.title)||!stage(r.stage)||
 typeof r.revision!=="number"||!Number.isSafeInteger(r.revision)||r.revision<0||r.revision>1000000||
 !(r.created_at instanceof Date)||!Number.isFinite(r.created_at.getTime()))return fail(503,"UNAVAILABLE");
 return Object.freeze({id:r.id,title:r.title,accountId:r.account_id,contactId:r.contact_id,pipelineId:r.pipeline_id,stageId:r.stage_id,stage:r.stage,revision:r.revision,createdAt:r.created_at.toISOString()});
}
const FIELDS="id::text,title,account_id::text,contact_id::text,pipeline_id::text,stage_id::text,stage,revision,created_at";
export class P4R71CiDeals{
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
    if(e.code==="P7100")return fail(400,"INVALID_INPUT");
    if(e.code==="P4009"||e.code==="23505"||e.code==="40001")return fail(409,"CONFLICT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
 async create(actor:P4R28Actor|null,org:string,body:unknown):Promise<Deal>{
  if(!body||typeof body!=="object"||Array.isArray(body))return fail(400,"INVALID_INPUT");
  const v=body as Record<string,unknown>;
  if(Object.keys(v).sort().join(",")!=="accountId,contactId,title"||
   typeof v.title!=="string"||!NAME.test(v.title)||!id(v.accountId)||!id(v.contactId))return fail(400,"INVALID_INPUT");
  return this.transact(actor,org,"READ WRITE",async(c,tenant)=>{
   const r=await c.query("SELECT "+FIELDS+" FROM p4_r71_ci.create_deal($1,$2,$3,$4,$5)",[tenant,randomUUID(),v.title,v.accountId,v.contactId]);
   if(r.rows.length!==1)return fail(503,"UNAVAILABLE");
   return project(r.rows[0]);
  });
 }
 async changeStage(actor:P4R28Actor|null,org:string,dealId:unknown,body:unknown):Promise<Deal>{
  if(!id(dealId)||!body||typeof body!=="object"||Array.isArray(body))return fail(400,"INVALID_INPUT");
  const v=body as Record<string,unknown>;
  if(Object.keys(v).sort().join(",")!=="expectedRevision,stage"||!stage(v.stage)||v.stage==="OPEN"||
   typeof v.expectedRevision!=="number"||!Number.isSafeInteger(v.expectedRevision)||v.expectedRevision<0||v.expectedRevision>=1000000)return fail(400,"INVALID_INPUT");
  return this.transact(actor,org,"READ WRITE",async(c,tenant)=>{
   const r=await c.query("SELECT "+FIELDS+" FROM p4_r71_ci.change_stage($1,$2,$3,$4)",[tenant,dealId,v.stage,v.expectedRevision]);
   if(r.rows.length!==1)return fail(503,"UNAVAILABLE");
   return project(r.rows[0]);
  });
 }
 async page(actor:P4R28Actor|null,org:string,after:unknown){
  if(after!==null&&!id(after))return fail(400,"INVALID_INPUT");
  return this.transact(actor,org,"READ ONLY",async(c,tenant)=>{
   const r=await c.query("SELECT "+FIELDS+" FROM p4_r71_ci.list_deals($1,$2)",[tenant,after]);
   if(r.rows.length>21)return fail(503,"UNAVAILABLE");
   const items=r.rows.slice(0,20).map(project);
   if(items.some((x,i)=>(i>0&&x.id<=items[i-1]!.id)||(typeof after==="string"&&x.id<=after)))return fail(503,"UNAVAILABLE");
   return {items,nextCursor:r.rows.length===21?items[19]!.id:null};
  });
 }
}
