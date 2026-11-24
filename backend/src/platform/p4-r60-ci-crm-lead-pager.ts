/** R60 HMAC-bound owner CRM lead keyset pagination; disposable CI only. */
import {createHmac,timingSafeEqual} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {parseP4R57CiLeadRow,type P4R57Lead,type P4R57LeadStatus}
 from "./p4-r57-ci-crm-leads.js";
type Filter="all"|P4R57LeadStatus;
type Cursor=Readonly<{org:string;filter:Filter;search:string;
 time:string;id:string;exp:number}>;
export type P4R60Page=Readonly<{items:readonly P4R57Lead[];
 nextCursor:string|null}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const TIME=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/;
const FILTERS=new Set(["all","NEW","CONTACTED","QUALIFIED","LOST"]);
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
export class P4R60CiCrmLeadPager{
 constructor(private readonly pool:pg.Pool,private readonly key:Buffer,
  private readonly env:NodeJS.ProcessEnv=process.env,
  private readonly now:()=>number=Date.now){}
 private guard():void{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return fail(503,"UNAVAILABLE");}
  if(!Buffer.isBuffer(this.key)||this.key.length!==32||
   !Number.isSafeInteger(this.now())||this.now()<0)
   fail(503,"UNAVAILABLE");
 }
 private sign(value:string):string{
  return createHmac("sha256",this.key).update(value,"utf8").digest("base64url");
 }
 private read(token:string|null,org:string,filter:Filter,search:string):
  Cursor|null{
  if(token===null)return null;
  if(token.length>1024||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token))
   return fail(400,"INVALID_INPUT");
  const [payload,signature]=token.split(".");
  if(!payload||!signature)return fail(400,"INVALID_INPUT");
  const actual=Buffer.from(signature,"base64url");
  const expected=Buffer.from(this.sign(payload),"base64url");
  if(actual.toString("base64url")!==signature||
   actual.length!==expected.length||!timingSafeEqual(actual,expected))
   return fail(400,"INVALID_INPUT");
  let raw:unknown;
  try{
   const bytes=Buffer.from(payload,"base64url");
   if(bytes.toString("base64url")!==payload)return fail(400,"INVALID_INPUT");
   raw=JSON.parse(bytes.toString("utf8"));
  }catch{return fail(400,"INVALID_INPUT");}
  if(!raw||typeof raw!=="object"||Array.isArray(raw))
   return fail(400,"INVALID_INPUT");
  const v=raw as Record<string,unknown>;
  if(Object.keys(v).sort().join(",")!=="exp,filter,id,org,search,time"||
   v.org!==org||v.filter!==filter||v.search!==search||
   typeof v.id!=="string"||!UUID.test(v.id)||
   typeof v.time!=="string"||!TIME.test(v.time)||
   !Number.isSafeInteger(v.exp)||(v.exp as number)<=this.now()||
   (v.exp as number)>this.now()+10*60*1000)
   return fail(400,"INVALID_INPUT");
  return v as Cursor;
 }
 async page(actor:P4R28Actor|null,org:unknown,status:unknown,
  query:unknown,token:unknown):Promise<P4R60Page>{
  this.guard();
  if(!actor||actor.verified!==true||!USER.test(actor.userId))
   return fail(401,"IDENTITY_REQUIRED");
  if(typeof org!=="string"||!UUID.test(org))
   return fail(403,"ACCESS_DENIED");
  if(typeof status!=="string"||!FILTERS.has(status)||
   typeof query!=="string"||query.length>40||
   !/^[a-zA-Z0-9._@ -]*$/.test(query)||
   (token!==null&&typeof token!=="string"))
   return fail(400,"INVALID_INPUT");
  const filter=status as Filter,search=query.toLowerCase();
  const cursor=this.read(token as string|null,org,filter,search);
  let client:pg.PoolClient;
  try{client=await this.pool.connect();}
  catch{return fail(503,"UNAVAILABLE");}
  let active=false,discard=false;
  try{
   await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query("SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,org]);
   const role=await client.query("SELECT current_user AS name,"+
    "(SELECT rolsuper OR rolbypassrls FROM pg_roles"+
    " WHERE rolname=current_user) AS privileged");
   if(role.rows[0]?.name!=="p4_synthetic_ci_runtime"||
    role.rows[0]?.privileged!==false)return fail(403,"ACCESS_DENIED");
   const rows=await client.query("SELECT lead_id::text,company_name,contact_email,"+
    "source,status,revision,created_at,key_time"+
    " FROM p4_r60_ci.owner_crm_lead_page($1,$2,$3,$4,$5)",[
    org,filter,search,cursor?.time??null,cursor?.id??null]);
   if(rows.rows.length>21)return fail(503,"UNAVAILABLE");
   const sourceRows=rows.rows.slice(0,20) as Record<string,unknown>[];
   const items=sourceRows.map(row=>{
    const {key_time,...fields}=row;
    if(typeof key_time!=="string"||!TIME.test(key_time))
     return fail(503,"UNAVAILABLE");
    return parseP4R57CiLeadRow(fields);
   });
   if(new Set(items.map(x=>x.leadId)).size!==items.length||
    new Set(items.map(x=>x.contactEmail)).size!==items.length||
    items.some((x,i)=>i>0&&x.createdAt>items[i-1]!.createdAt)||
    items.some(x=>(filter!=="all"&&x.status!==filter)||
     (search!==""&&!x.companyName.toLowerCase().includes(search)&&
      !x.contactEmail.includes(search))))
    return fail(503,"UNAVAILABLE");
   let nextCursor:string|null=null;
   if(rows.rows.length===21){
    const last=sourceRows.at(-1)!;
    if(typeof last.key_time!=="string"||!TIME.test(last.key_time)||
     typeof last.lead_id!=="string"||!UUID.test(last.lead_id))
     return fail(503,"UNAVAILABLE");
    const data:Cursor={org,filter,search,time:last.key_time,
     id:last.lead_id,exp:this.now()+10*60*1000};
    const payload=Buffer.from(JSON.stringify(data),"utf8").toString("base64url");
    nextCursor=payload+"."+this.sign(payload);
    if(nextCursor.length>1024)return fail(503,"UNAVAILABLE");
   }
   await client.query("COMMIT");active=false;
   return Object.freeze({items:Object.freeze(items),nextCursor});
  }catch(error){
   if(active){try{await client.query("ROLLBACK");}catch{discard=true;}}
   if(error instanceof P4R28Denied)throw error;
   if(error&&typeof error==="object"&&"code" in error){
    if(error.code==="P4003")return fail(403,"ACCESS_DENIED");
    if(error.code==="P6000")return fail(400,"INVALID_INPUT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
}
