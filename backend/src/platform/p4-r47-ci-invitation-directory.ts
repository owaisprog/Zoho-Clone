/**
 * R47: read-only owner's fictional invitation directory in disposable CI.
 * Uses signed R33 DB-mapped actor and a narrowly granted SQL projection.
 */
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import type {P4R29Invite} from "./p4-r29-ci-invitation-service.js";
export type P4R47CiInvitationFilter=
 "all"|"pending"|"accepted"|"revoked"|"expired";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const EMAIL=/^[a-z0-9][a-z0-9._-]{0,60}@example[.]com$/;
const STATES=new Set(["pending","accepted","revoked","expired"]);
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
function safe(row:Record<string,unknown>):P4R29Invite{
 if(typeof row.id!=="string"||!UUID.test(row.id)||
  typeof row.org_id!=="string"||!UUID.test(row.org_id)||
  typeof row.recipient_email!=="string"||!EMAIL.test(row.recipient_email)||
  row.granted_role!=="MEMBER"||!STATES.has(String(row.status))||
  !(row.issued_at instanceof Date)||!(row.expires_at instanceof Date)||
  !Number.isFinite(row.issued_at.getTime())||
  !Number.isFinite(row.expires_at.getTime())||
  row.expires_at.getTime()<=row.issued_at.getTime()||
  !Number.isSafeInteger(row.version)||row.version<1)
  return fail(503,"UNAVAILABLE");
 return Object.freeze({id:row.id,organizationId:row.org_id,
  recipientEmail:row.recipient_email,role:"MEMBER",
  status:row.status as P4R29Invite["status"],
  issuedAt:row.issued_at.toISOString(),expiresAt:row.expires_at.toISOString(),
  version:row.version});
}
export class P4R47CiInvitationDirectory{
 constructor(private readonly pool:pg.Pool,
  private readonly env:NodeJS.ProcessEnv=process.env){}
 async list(actor:P4R28Actor|null,orgId:unknown,
  status:unknown,search:unknown):Promise<readonly P4R29Invite[]>{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return fail(503,"UNAVAILABLE");}
  if(!actor||actor.verified!==true||!USER.test(actor.userId))
   return fail(401,"IDENTITY_REQUIRED");
  if(typeof orgId!=="string"||!UUID.test(orgId))
   return fail(403,"ACCESS_DENIED");
  if(typeof status!=="string"||
   !["all","pending","accepted","revoked","expired"].includes(status)||
   typeof search!=="string"||search.length>40||
   !/^[a-zA-Z0-9._@-]*$/.test(search))
   return fail(400,"INVALID_INPUT");
  let client:pg.PoolClient;
  try{client=await this.pool.connect();}
  catch{return fail(503,"UNAVAILABLE");}
  let active=false,discard=false;
  try{
   await client.query("BEGIN");active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query(
    "SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,orgId]);
   const role=await client.query(
    "SELECT current_user AS name,"+
    "(SELECT rolsuper OR rolbypassrls FROM pg_roles"+
    " WHERE rolname=current_user) AS privileged");
   if(role.rows[0]?.name!=="p4_synthetic_ci_runtime"||
    role.rows[0]?.privileged!==false)
    return fail(403,"ACCESS_DENIED");
   const result=await client.query(
    "SELECT id::text,org_id::text,recipient_email,granted_role,"+
    "status,issued_at,expires_at,version"+
    " FROM p4_r47_ci.owner_invitations($1,$2,$3)",
    [orgId,status,search.toLowerCase()]);
   if(result.rows.length>20)return fail(503,"UNAVAILABLE");
   const rows=result.rows.map(safe);
   if(new Set(rows.map(x=>x.id)).size!==rows.length||
    rows.some(x=>x.organizationId!==orgId)||
    (status!=="all"&&rows.some(x=>x.status!==status)))
    return fail(503,"UNAVAILABLE");
   await client.query("COMMIT");active=false;
   return Object.freeze(rows);
  }catch(error){
   if(active){try{await client.query("ROLLBACK");}catch{discard=true;}}
   if(error instanceof P4R28Denied)throw error;
   if(error&&typeof error==="object"&&"code" in error){
    if(error.code==="P4003")return fail(403,"ACCESS_DENIED");
    if(error.code==="P4700")return fail(400,"INVALID_INPUT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
}
