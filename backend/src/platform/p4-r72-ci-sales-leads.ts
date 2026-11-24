/** R72 sales-scoped lead and conversion API; no owner-only lead reuse. */
import {randomUUID} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const COMPANY=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,48}$/;
const CONTACT=/^Demo [A-Za-z][A-Za-z0-9 .-]{2,48}$/;
const EMAIL=/^[a-z][a-z0-9._-]{1,40}@example\.com$/;
const TITLE=/^Demo [A-Za-z][A-Za-z0-9 &.-]{2,148}$/;
const STATES=["NEW","CONTACTED","QUALIFIED","LOST","CONVERTED"] as const;
type Status=typeof STATES[number];
const id=(v:unknown):v is string=>typeof v==="string"&&UUID.test(v);
const valid=(v:unknown,re:RegExp):v is string=>typeof v==="string"&&re.test(v);
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{throw new P4R28Denied(status,code);};
const fields="id::text,company_name,contact_name,email,status,revision,account_id::text,contact_id::text,deal_id::text,created_at";
export type SalesLead=Readonly<{id:string;companyName:string;contactName:string;email:string;status:Status;revision:number;accountId:string|null;contactId:string|null;dealId:string|null;createdAt:string}>;
function project(r:Record<string,unknown>):SalesLead{
 if(!id(r.id)||!valid(r.company_name,COMPANY)||!valid(r.contact_name,CONTACT)||!valid(r.email,EMAIL)||
 typeof r.status!=="string"||!(STATES as readonly string[]).includes(r.status)||
 typeof r.revision!=="number"||!Number.isSafeInteger(r.revision)||r.revision<0||r.revision>1000000||
 !(r.created_at instanceof Date)||!Number.isFinite(r.created_at.getTime())||
 ![r.account_id,r.contact_id,r.deal_id].every(v=>r.status==="CONVERTED"?id(v):v===null))
 return fail(503,"UNAVAILABLE");
 return Object.freeze({id:r.id,companyName:r.company_name,contactName:r.contact_name,email:r.email,status:r.status as Status,
 revision:r.revision,accountId:r.account_id as string|null,contactId:r.contact_id as string|null,dealId:r.deal_id as string|null,createdAt:r.created_at.toISOString()});
}
const body=(v:unknown,keys:string):Record<string,unknown>=>{
 if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).sort().join(",")!==keys)return fail(400,"INVALID_INPUT");
 return v as Record<string,unknown>;
};
const version=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<1000000;
export class P4R72CiSalesLeads{
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
    if(e.code==="P7200")return fail(400,"INVALID_INPUT");
    if(e.code==="P4009"||e.code==="23505"||e.code==="40001")return fail(409,"CONFLICT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
 async create(actor:P4R28Actor|null,org:string,input:unknown){
  const v=body(input,"companyName,contactName,email");
  if(!valid(v.companyName,COMPANY)||!valid(v.contactName,CONTACT)||!valid(v.email,EMAIL))return fail(400,"INVALID_INPUT");
  return this.transact(actor,org,"READ WRITE",async(c,t)=>{
   const r=await c.query("SELECT "+fields+" FROM p4_r72_ci.create_lead($1,$2,$3,$4,$5)",[t,randomUUID(),v.companyName,v.contactName,v.email]);
   if(r.rows.length!==1)return fail(503,"UNAVAILABLE");return project(r.rows[0]);
  });
 }
 async page(actor:P4R28Actor|null,org:string,after:unknown){
  if(after!==null&&!id(after))return fail(400,"INVALID_INPUT");
  return this.transact(actor,org,"READ ONLY",async(c,t)=>{
   const r=await c.query("SELECT "+fields+" FROM p4_r72_ci.list_leads($1,$2)",[t,after]);
   if(r.rows.length>21)return fail(503,"UNAVAILABLE");const items=r.rows.slice(0,20).map(project);
   if(items.some((x,i)=>(i>0&&x.id<=items[i-1]!.id)||(typeof after==="string"&&x.id<=after)))return fail(503,"UNAVAILABLE");
   return {items,nextCursor:r.rows.length===21?items[19]!.id:null};
  });
 }
 async changeStage(actor:P4R28Actor|null,org:string,lead:unknown,input:unknown){
  const v=body(input,"expectedRevision,status");
  if(!id(lead)||!version(v.expectedRevision)||!["CONTACTED","QUALIFIED","LOST"].includes(v.status as string))return fail(400,"INVALID_INPUT");
  return this.transact(actor,org,"READ WRITE",async(c,t)=>{
   const r=await c.query("SELECT "+fields+" FROM p4_r72_ci.change_stage($1,$2,$3,$4)",[t,lead,v.status,v.expectedRevision]);
   if(r.rows.length!==1)return fail(503,"UNAVAILABLE");return project(r.rows[0]);
  });
 }
 async convert(actor:P4R28Actor|null,org:string,lead:unknown,input:unknown){
  const v=body(input,"expectedRevision,title");
  if(!id(lead)||!version(v.expectedRevision)||!valid(v.title,TITLE))return fail(400,"INVALID_INPUT");
  return this.transact(actor,org,"READ WRITE",async(c,t)=>{
   const r=await c.query("SELECT "+fields+" FROM p4_r72_ci.convert_lead($1,$2,$3,$4,$5,$6,$7)",[t,lead,v.expectedRevision,randomUUID(),randomUUID(),randomUUID(),v.title]);
   if(r.rows.length!==1)return fail(503,"UNAVAILABLE");return project(r.rows[0]);
  });
 }
}
