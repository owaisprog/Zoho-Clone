/**
 * P4 R28: actual transactionally persisted org + owner membership,
 * DISPOSABLE CI POSTGRES ONLY. No live Auth0, owner Neon, or public route.
 */
import {randomUUID} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";

export class P4R28Denied extends Error {
 constructor(public readonly status:400|401|403|409|503,public readonly code:
  "INVALID_INPUT"|"IDENTITY_REQUIRED"|"ACCESS_DENIED"|"CONFLICT"|"UNAVAILABLE"){
  super(code);
 }
}
const demoName=/^Demo [A-Za-z][A-Za-z0-9 &'-]{2,48}$/;
const demoSlug=/^demo-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const knownActors=new Set(["user_demo_alice","user_demo_bob"]);
function validateBody(body:unknown):{name:string;slug:string}{
 if(!body||typeof body!=="object"||Array.isArray(body)||
  Object.keys(body).sort().join(",")!=="name,slug")
  throw new P4R28Denied(400,"INVALID_INPUT");
 const value=body as Record<string,unknown>;
 if(typeof value.name!=="string"||typeof value.slug!=="string"||
   !demoName.test(value.name)||!demoSlug.test(value.slug)||
   value.slug.length>48||
   ["demo-admin","demo-support","demo-system"].includes(value.slug))
  throw new P4R28Denied(400,"INVALID_INPUT");
 return {name:value.name,slug:value.slug};
}
export type P4R28Actor=Readonly<{userId:string;verified:true}>;
export type P4R28Organization=Readonly<{id:string;name:string;slug:string;ownerRole:"OWNER"}>;
/**
 * Caller-supplied actor is NEVER read from headers. Caller must provide
 * trusted CI-only injected identity resolver, not a raw JWT or userId param.
 */
export class P4R28CiOrganizationService {
 constructor(private readonly pool:pg.Pool,private readonly env:NodeJS.ProcessEnv=process.env){}
 private actor(value:P4R28Actor|null):string{
  if(!value||value.verified!==true||!knownActors.has(value.userId))
   throw new P4R28Denied(401,"IDENTITY_REQUIRED");
  return value.userId;
 }
 async create(actorValue:P4R28Actor|null,body:unknown,options?:{failAfterOrg?:boolean})
  :Promise<P4R28Organization>{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{throw new P4R28Denied(503,"UNAVAILABLE");}
  const actor=this.actor(actorValue),input=validateBody(body),id=randomUUID();
  const client=await this.pool.connect();
  let active=false;let discard=false;
  try{
   await client.query("BEGIN");active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query(
    "SELECT set_config('app.actor_id',$1,true),set_config('app.tenant_id',$2,true)",
    [actor,id]);
   const checks=await client.query(
    "SELECT current_user AS role,(SELECT rolsuper OR rolbypassrls"+
    " FROM pg_roles WHERE rolname=current_user) AS privileged");
   if(checks.rows.length!==1||checks.rows[0]?.role!=="p4_synthetic_ci_runtime"||
    checks.rows[0]?.privileged!==false)
    throw new P4R28Denied(403,"ACCESS_DENIED");
   const subject=await client.query(
    "SELECT 1 FROM p4_synthetic.identity_subjects"+
    " WHERE user_id=$1 AND email_verified=true LIMIT 1",[actor]);
   if(subject.rowCount!==1)throw new P4R28Denied(403,"ACCESS_DENIED");
   await client.query(
    "INSERT INTO p4_synthetic.organizations(id,slug,display_name,created_by)"+
    " VALUES ($1,$2,$3,$4)",[id,input.slug,input.name,actor]);
   if(options?.failAfterOrg)throw new Error("SYNTHETIC_TEST_TRANSACTION_ROLLBACK");
   await client.query(
    "INSERT INTO p4_synthetic.memberships(org_id,user_id,role,active)"+
    " VALUES ($1,$2,'OWNER',true)",[id,actor]);
   await client.query("COMMIT");active=false;
   return Object.freeze({id,name:input.name,slug:input.slug,ownerRole:"OWNER"});
  }catch(error){
   if(active){try{await client.query("ROLLBACK");}catch{discard=true;}}
   if(error instanceof P4R28Denied)throw error;
   if(error&&typeof error==="object"&&"code" in error&&error.code==="23505")
    throw new P4R28Denied(409,"CONFLICT");
   throw new P4R28Denied(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
 async read(actorValue:P4R28Actor|null,id:unknown):Promise<P4R28Organization>{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{throw new P4R28Denied(503,"UNAVAILABLE");}
  const actor=this.actor(actorValue);
  if(typeof id!=="string"||
   !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))
   throw new P4R28Denied(403,"ACCESS_DENIED");
  const client=await this.pool.connect();let active=false,discard=false;
  try{
   await client.query("BEGIN");active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query(
    "SELECT set_config('app.actor_id',$1,true),set_config('app.tenant_id',$2,true)",
    [actor,id]);
   const rows=await client.query(
    "SELECT o.id::text AS id,o.display_name AS name,o.slug"+
    " FROM p4_synthetic.organizations o JOIN p4_synthetic.memberships m"+
    " ON m.org_id=o.id AND m.user_id=$2 AND m.active=true AND m.role='OWNER'"+
    " WHERE o.id=$1 LIMIT 1",[id,actor]);
   await client.query("COMMIT");active=false;
   if(rows.rowCount!==1)throw new P4R28Denied(403,"ACCESS_DENIED");
   const row=rows.rows[0];
   return Object.freeze({id:row.id,name:row.name,slug:row.slug,ownerRole:"OWNER"});
  }catch(error){
   if(active){try{await client.query("ROLLBACK");}catch{discard=true;}}
   if(error instanceof P4R28Denied)throw error;
   throw new P4R28Denied(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
}
