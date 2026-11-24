/**
 * R46: atomic pending invitation cancellation, with audit and outbox dead-letter.
 * Only disposable CI PostgreSQL; no production API, real Auth0 or SMTP.
 */
import {randomUUID} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import type {P4R29Invite} from "./p4-r29-ci-invitation-service.js";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
export class P4R46CiInvitationCanceler{
 constructor(private readonly pool:pg.Pool,
  private readonly env:NodeJS.ProcessEnv=process.env){}
 async cancel(actor:P4R28Actor|null,orgId:unknown,input:unknown):
 Promise<P4R29Invite>{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return fail(503,"UNAVAILABLE");}
  if(!actor||actor.verified!==true||!USER.test(actor.userId))
   return fail(401,"IDENTITY_REQUIRED");
  if(typeof orgId!=="string"||!UUID.test(orgId))
   return fail(403,"ACCESS_DENIED");
  if(!input||typeof input!=="object"||Array.isArray(input)||
   Object.keys(input).sort().join(",")!=="expectedVersion,invitationId")
   return fail(400,"INVALID_INPUT");
  const data=input as Record<string,unknown>;
  if(typeof data.invitationId!=="string"||!UUID.test(data.invitationId)||
   !Number.isSafeInteger(data.expectedVersion)||
   (data.expectedVersion as number)<1||
   (data.expectedVersion as number)>10000000)
   return fail(400,"INVALID_INPUT");
  let client:pg.PoolClient;
  try{client=await this.pool.connect();}
  catch{return fail(503,"UNAVAILABLE");}
  let active=false,discard=false;
  try{
   await client.query("BEGIN");active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query("SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,orgId]);
   const role=await client.query("SELECT current_user AS name,"+
    "(SELECT rolsuper OR rolbypassrls FROM pg_roles"+
    " WHERE rolname=current_user) AS privileged");
   if(role.rows[0]?.name!=="p4_synthetic_ci_runtime"||
    role.rows[0]?.privileged!==false)return fail(403,"ACCESS_DENIED");
   const owner=await client.query(
    "SELECT 1 FROM p4_synthetic.memberships m"+
    " JOIN p4_synthetic.identity_subjects s ON s.user_id=m.user_id"+
    " AND s.email_verified=true"+
    " WHERE m.org_id=$1 AND m.user_id=$2"+
    " AND m.role='OWNER' AND m.active=true LIMIT 1",
    [orgId,actor.userId]);
   if(owner.rowCount!==1)return fail(403,"ACCESS_DENIED");
   const result=await client.query(
    "UPDATE p4_synthetic.invitations"+
    " SET status='revoked',version=version+1"+
    " WHERE org_id=$1 AND id=$2 AND status='pending'"+
    " AND version=$3 AND expires_at>clock_timestamp()"+
    " RETURNING id::text,org_id::text,recipient_email,granted_role,"+
    " status,issued_at,expires_at,version",
    [orgId,data.invitationId,data.expectedVersion]);
   if(result.rowCount!==1)return fail(409,"CONFLICT");
   const row=result.rows[0];
   if(row.granted_role!=="MEMBER"||row.status!=="revoked"||
    !Number.isSafeInteger(row.version)||
    !(row.issued_at instanceof Date)||!(row.expires_at instanceof Date))
    return fail(503,"UNAVAILABLE");
   await client.query(
    "SELECT p4_r45_ci.invalidate_queued_delivery($1,$2)",
    [orgId,data.invitationId]);
   await client.query(
    "INSERT INTO p4_r46_ci.cancellation_events"+
    " (id,org_id,invitation_id,actor_user_id,canceled_version)"+
    " VALUES($1,$2,$3,$4,$5)",
    [randomUUID(),orgId,data.invitationId,actor.userId,row.version]);
   await client.query("COMMIT");active=false;
   return Object.freeze({id:row.id,organizationId:row.org_id,
    recipientEmail:row.recipient_email,role:"MEMBER",
    status:"revoked",issuedAt:row.issued_at.toISOString(),
    expiresAt:row.expires_at.toISOString(),version:row.version});
  }catch(error){
   if(active){try{await client.query("ROLLBACK");}catch{discard=true;}}
   if(error instanceof P4R28Denied)throw error;
   if(error&&typeof error==="object"&&"code" in error){
    if(error.code==="P4003")return fail(403,"ACCESS_DENIED");
    if(error.code==="P4009"||error.code==="23505")
     return fail(409,"CONFLICT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
}
