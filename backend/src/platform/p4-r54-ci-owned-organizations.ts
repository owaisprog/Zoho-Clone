/** R54 CI-only owned organization chooser; no arbitrary org-wide metadata. */
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
export type P4R54OwnedOrganization=Readonly<{id:string;name:string;
 slug:string;ownerRole:"OWNER"}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const NAME=/^Demo [A-Za-z][A-Za-z0-9 &'-]{2,48}$/;
const SLUG=/^demo-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
export class P4R54CiOwnedOrganizations{
 constructor(private readonly pool:pg.Pool,
  private readonly env:NodeJS.ProcessEnv=process.env){}
 async list(actor:P4R28Actor|null):Promise<readonly P4R54OwnedOrganization[]>{
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
   const response=await client.query("SELECT id::text,name,slug,owner_role"+
    " FROM (SELECT id,display_name AS name,slug,owner_role"+
    " FROM p4_r54_ci.list_owned_organizations()) AS owned");
   if(response.rows.length>200)return fail(503,"UNAVAILABLE");
   const records: P4R54OwnedOrganization[]=[];
   for(const row of response.rows as Record<string,unknown>[]){
    if(typeof row.id!=="string"||!UUID.test(row.id)||
     typeof row.name!=="string"||!NAME.test(row.name)||
     typeof row.slug!=="string"||!SLUG.test(row.slug)||
     row.slug.length>48||row.owner_role!=="OWNER")
     return fail(503,"UNAVAILABLE");
    records.push(Object.freeze({id:row.id,name:row.name,slug:row.slug,
     ownerRole:"OWNER"}));
   }
   if(new Set(records.map(x=>x.id)).size!==records.length||
    records.some((r,i)=>i>0&&(records[i-1]!.name>r.name||
     (records[i-1]!.name===r.name&&records[i-1]!.id>=r.id))))
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
}
