/** R69 own-record, explicit sales rep and CRM entitlement only. */
import {randomUUID} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const NAME=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$/;
const WEB=/^https:\/\/[a-z0-9-]{1,63}\.example\.com$/;
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{throw new P4R28Denied(status,code);};
export type Account=Readonly<{id:string;name:string;websiteLabel:string|null;revision:number;createdAt:string}>;
function project(r:Record<string,unknown>):Account{
 if(typeof r.id!=="string"||!UUID.test(r.id)||typeof r.name!=="string"||!NAME.test(r.name)||
 (r.website_label!==null&&(typeof r.website_label!=="string"||!WEB.test(r.website_label)))||
 typeof r.revision!=="number"||!Number.isSafeInteger(r.revision)||r.revision<0||r.revision>1000000||
 !(r.created_at instanceof Date)||!Number.isFinite(r.created_at.getTime()))return fail(503,"UNAVAILABLE");
 return Object.freeze({id:r.id,name:r.name,websiteLabel:r.website_label,revision:r.revision,createdAt:r.created_at.toISOString()});
}
export class P4R69CiAccounts{
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
    if(e.code==="P6900")return fail(400,"INVALID_INPUT");
    if(e.code==="P4009"||e.code==="23505"||e.code==="40001")return fail(409,"CONFLICT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
 async save(actor:P4R28Actor|null,org:string,id:unknown,body:unknown):Promise<Account>{
  if(!body||typeof body!=="object"||Array.isArray(body))return fail(400,"INVALID_INPUT");
  const v=body as Record<string,unknown>,create=id===null;
  if(Object.keys(v).sort().join(",")!==(create?"name,websiteLabel":"expectedRevision,name,websiteLabel")||
   typeof v.name!=="string"||!NAME.test(v.name)||
   (v.websiteLabel!==null&&(typeof v.websiteLabel!=="string"||!WEB.test(v.websiteLabel)))||
   (!create&&(typeof id!=="string"||!UUID.test(id)||typeof v.expectedRevision!=="number"||
   !Number.isSafeInteger(v.expectedRevision)||v.expectedRevision<0||v.expectedRevision>=1000000)))
    return fail(400,"INVALID_INPUT");
  const key=create?randomUUID():id as string;
  return this.transact(actor,org,"READ WRITE",async(c,tenant)=>{
   const r=await c.query("SELECT id::text,name,website_label,revision,created_at FROM p4_r69_ci.save_account($1,$2,$3,$4,$5)",
    [tenant,key,v.name,v.websiteLabel,create?null:v.expectedRevision]);
   if(r.rows.length!==1)return fail(503,"UNAVAILABLE");
   return project(r.rows[0]);
  });
 }
 async page(actor:P4R28Actor|null,org:string,after:unknown){
  if(after!==null&&(typeof after!=="string"||!UUID.test(after)))return fail(400,"INVALID_INPUT");
  return this.transact(actor,org,"READ ONLY",async(c,tenant)=>{
   const r=await c.query("SELECT id::text,name,website_label,revision,created_at FROM p4_r69_ci.list_accounts($1,$2)",[tenant,after]);
   if(r.rows.length>21)return fail(503,"UNAVAILABLE");
   const items=r.rows.slice(0,20).map(project);
   if(items.some((x,i)=>(i>0&&x.id<=items[i-1]!.id)||(typeof after==="string"&&x.id<=after)))return fail(503,"UNAVAILABLE");
   return {items,nextCursor:r.rows.length===21?items[19]!.id:null};
  });
 }
}
