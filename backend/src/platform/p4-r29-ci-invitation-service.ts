/**
 * P4 R29: persisted fictional invitation lifecycle using the existing
 * disposable CI-only RLS schema. No delivery or token redemption.
 * NEVER imported by src/app.ts, src/server.ts, production or owner Neon.
 */
import {createHash,randomBytes,randomUUID} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";

const UUID4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL=/^[a-z0-9][a-z0-9._-]{0,60}@example\.com$/;
const KNOWN=new Set(["user_demo_alice","user_demo_bob"]);
const EXPIRY_MS=48*60*60*1000;
export type P4R29Invite=Readonly<{
 id:string;organizationId:string;recipientEmail:string;role:"MEMBER";
 status:"pending"|"expired"|"revoked"|"accepted";issuedAt:string;
 expiresAt:string;version:number;
}>;
function fail(status:400|401|403|409|503,code:P4R28Denied["code"]):never{
 throw new P4R28Denied(status,code);
}
function parsedActor(actor:P4R28Actor|null):string{
 if(!actor||actor.verified!==true||!KNOWN.has(actor.userId))
  return fail(401,"IDENTITY_REQUIRED");
 return actor.userId;
}
function parsedOrg(id:unknown):string{
 if(typeof id!=="string"||!UUID4.test(id))return fail(403,"ACCESS_DENIED");
 return id;
}
function parsedEmail(body:unknown):string{
 if(!body||typeof body!=="object"||Array.isArray(body)||
  Object.keys(body).join(",")!=="recipientEmail")
  return fail(400,"INVALID_INPUT");
 const email=(body as Record<string,unknown>).recipientEmail;
 if(typeof email!=="string"||!EMAIL.test(email))
  return fail(400,"INVALID_INPUT");
 return email;
}
function safe(row:Record<string,unknown>):P4R29Invite{
 const status=row.status;
 if(typeof row.id!=="string"||typeof row.org_id!=="string"||
  typeof row.recipient_email!=="string"||typeof row.granted_role!=="string"||
  row.granted_role!=="MEMBER"||
  !["pending","expired","revoked","accepted"].includes(String(status))||
  !(row.issued_at instanceof Date)||!(row.expires_at instanceof Date)||
  !Number.isSafeInteger(row.version))return fail(503,"UNAVAILABLE");
 return Object.freeze({id:row.id,organizationId:row.org_id,
  recipientEmail:row.recipient_email,role:"MEMBER",
  status:status as P4R29Invite["status"],
  issuedAt:row.issued_at.toISOString(),expiresAt:row.expires_at.toISOString(),
  version:row.version as number});
}
export class P4R29CiInvitationService{
 constructor(private readonly pool:pg.Pool,private readonly env:NodeJS.ProcessEnv=process.env){}
 private async scoped<T>(
  actor:P4R28Actor|null,orgId:unknown,
  operation:(client:pg.PoolClient,owner:string,org:string)=>Promise<T>,
 ):Promise<T>{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return fail(503,"UNAVAILABLE");}
  const owner=parsedActor(actor),org=parsedOrg(orgId);
  let client:pg.PoolClient;
  try{client=await this.pool.connect();}
  catch{return fail(503,"UNAVAILABLE");}
  let active=false,discard=false;
  try{
   await client.query("BEGIN");active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query(
    "SELECT set_config('app.actor_id',$1,true),set_config('app.tenant_id',$2,true)",
    [owner,org]);
   const privilege=await client.query(
    "SELECT current_user AS role, (SELECT rolsuper OR rolbypassrls"+
    " FROM pg_roles WHERE rolname=current_user) AS privileged");
   if(privilege.rows[0]?.role!=="p4_synthetic_ci_runtime"||
      privilege.rows[0]?.privileged!==false)return fail(403,"ACCESS_DENIED");
   const verified=await client.query(
    "SELECT 1 FROM p4_synthetic.identity_subjects"+
    " WHERE user_id=$1 AND email_verified=true LIMIT 1",[owner]);
   const owned=await client.query(
    "SELECT 1 FROM p4_synthetic.memberships"+
    " WHERE org_id=$1 AND user_id=$2 AND role='OWNER' AND active=true LIMIT 1",
    [org,owner]);
   if(verified.rowCount!==1||owned.rowCount!==1)
    return fail(403,"ACCESS_DENIED");
   const result=await operation(client,owner,org);
   await client.query("COMMIT");active=false;
   return result;
  }catch(e){
   if(active){try{await client.query("ROLLBACK");}catch{discard=true;}}
   if(e instanceof P4R28Denied)throw e;
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
    return fail(409,"CONFLICT");
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
 async create(actor:P4R28Actor|null,orgId:unknown,body:unknown):Promise<P4R29Invite>{
  const email=parsedEmail(body);
  return this.scoped(actor,orgId,async(client,owner,org)=>{
   // Expire old pending entries before replacing; the unique partial index
   // must remain the final concurrency authority.
   await client.query(
    "UPDATE p4_synthetic.invitations SET status='expired',version=version+1"+
    " WHERE org_id=$1 AND recipient_email=$2 AND status='pending'"+
    " AND expires_at<=now()",[org,email]);
   const id=randomUUID();
   const token=randomBytes(32);
   const hash=createHash("sha256").update(token).digest("hex");
   token.fill(0);
   // No bearer token is ever returned or sent. This is an undelivered
   // draft lifecycle, NOT an invitation a recipient can redeem.
   const rows=await client.query(
    "INSERT INTO p4_synthetic.invitations"+
    " (id,org_id,invited_by,recipient_email,granted_role,token_hash,"+
    " issued_at,expires_at) VALUES ($1,$2,$3,$4,'MEMBER',$5,now(),"+
    " now()+interval '48 hours')"+
    " RETURNING id::text,org_id::text,recipient_email,granted_role,"+
    " status,issued_at,expires_at,version",
    [id,org,owner,email,hash]);
   if(rows.rowCount!==1)return fail(503,"UNAVAILABLE");
   return safe(rows.rows[0]);
  });
 }
 async list(actor:P4R28Actor|null,orgId:unknown):Promise<readonly P4R29Invite[]>{
  return this.scoped(actor,orgId,async(client,_owner,org)=>{
   const rows=await client.query(
    "SELECT id::text,org_id::text,recipient_email,granted_role,status,"+
    " issued_at,expires_at,version FROM p4_synthetic.invitations"+
    " WHERE org_id=$1 ORDER BY issued_at DESC,id DESC LIMIT 21",[org]);
   if(rows.rows.length>20)return fail(503,"UNAVAILABLE");
   return Object.freeze(rows.rows.map(safe));
  });
 }
 async revoke(actor:P4R28Actor|null,orgId:unknown,id:unknown):
  Promise<P4R29Invite>{
  if(typeof id!=="string"||!UUID4.test(id))return fail(403,"ACCESS_DENIED");
  return this.scoped(actor,orgId,async(client,_owner,org)=>{
   // CAS + SQL RLS avoids reviving accepted, expired or already-revoked rows.
   const rows=await client.query(
    "UPDATE p4_synthetic.invitations"+
    " SET status='revoked',version=version+1"+
    " WHERE org_id=$1 AND id=$2 AND status='pending'"+
    " RETURNING id::text,org_id::text,recipient_email,granted_role,"+
    " status,issued_at,expires_at,version",[org,id]);
   if(rows.rowCount!==1)return fail(409,"CONFLICT");
   return safe(rows.rows[0]);
  });
 }
}
