/** R54 CI-only sales organization discovery and own-record dashboard. */
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
export type P4R73SalesOrganization=Readonly<{id:string;name:string;
 slug:string;salesRole:"SALES_REP"}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const NAME=/^Demo [A-Za-z][A-Za-z0-9 &'-]{2,48}$/;
const SLUG=/^demo-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
export class P4R73CiSalesWorkspace{
 constructor(private readonly pool:pg.Pool,
  private readonly env:NodeJS.ProcessEnv=process.env){}
 async list(actor:P4R28Actor|null):Promise<readonly P4R73SalesOrganization[]>{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return fail(503,"UNAVAILABLE");}
  if(!actor||actor.verified!==true||!USER.test(actor.userId))
   return fail(401,"IDENTITY_REQUIRED");
  let client:pg.PoolClient;
  try{client=await this.pool.connect();}
  catch{return fail(503,"UNAVAILABLE");}
  let active=false,discard=false;
  try{
   await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query("SELECT set_config('app.actor_id',$1,true)",[actor.userId]);
   const check=await client.query("SELECT current_user AS name,"+
    "(SELECT rolsuper OR rolbypassrls FROM pg_roles"+
    " WHERE rolname=current_user) AS privileged,"+
    "nullif(current_setting('app.tenant_id',true),'') AS tenant");
   if(check.rows[0]?.name!=="p4_synthetic_ci_runtime"||
    check.rows[0]?.privileged!==false||check.rows[0]?.tenant!==null)
    return fail(403,"ACCESS_DENIED");
   const response=await client.query("SELECT id::text,name,slug,sales_role"+
    " FROM (SELECT id,display_name AS name,slug,sales_role"+
    " FROM p4_r73_ci.organizations()) AS owned");
   if(response.rows.length>200)return fail(503,"UNAVAILABLE");
   const records: P4R73SalesOrganization[]=[];
   for(const row of response.rows as Record<string,unknown>[]){
    if(typeof row.id!=="string"||!UUID.test(row.id)||
     typeof row.name!=="string"||!NAME.test(row.name)||
     typeof row.slug!=="string"||!SLUG.test(row.slug)||
     row.slug.length>48||row.sales_role!=="SALES_REP")
     return fail(503,"UNAVAILABLE");
    records.push(Object.freeze({id:row.id,name:row.name,slug:row.slug,
     salesRole:"SALES_REP"}));
   }
   if(new Set(records.map(x=>x.id)).size!==records.length||
    records.some((r,i)=>i>0&&(records[i-1]!.id>=r.id)))
    return fail(503,"UNAVAILABLE");
   await client.query("COMMIT");active=false;
   return Object.freeze(records);
  }catch(error){
   if(active){try{await client.query("ROLLBACK");}catch{discard=true;}}
   if(error instanceof P4R28Denied)throw error;
   if(error&&typeof error==="object"&&"code" in error&&
    error.code==="P4003")return fail(403,"ACCESS_DENIED");
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
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
 async overview(actor:P4R28Actor|null,org:string){
  return this.transact(actor,org,"READ ONLY",async(c,t)=>{
   const r=await c.query("SELECT * FROM p4_r73_ci.overview($1)",[t]);
   const v=r.rows[0] as Record<string,unknown>|undefined;
   if(r.rows.length!==1||!v)return fail(503,"UNAVAILABLE");
   const count=(k:string):number=>{const n=v[k];if(typeof n!=="number"||!Number.isSafeInteger(n)||n<0)return fail(503,"UNAVAILABLE");return n;};
   const data={leads:count("leads"),qualified:count("qualified"),converted:count("converted"),accounts:count("accounts"),
    contacts:count("contacts"),deals:count("deals"),openDeals:count("open_deals"),wonDeals:count("won_deals"),lostDeals:count("lost_deals")};
   if(data.qualified+data.converted>data.leads||data.openDeals+data.wonDeals+data.lostDeals!==data.deals)return fail(503,"UNAVAILABLE");
   return Object.freeze(data);
  });
 }
}
