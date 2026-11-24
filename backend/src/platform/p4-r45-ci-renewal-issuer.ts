/**
 * R45: real atomic expired/revoked invitation renewal in disposable CI only.
 * Current signed fictional owner is verified through R33 JWT + DB subject
 * mapper. No live email provider, owner Neon migration, or production API.
 */
import {createHash,createCipheriv,randomBytes,randomUUID} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import type {P4R29Invite} from "./p4-r29-ci-invitation-service.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const USER=/^user_demo_[a-z]{2,16}$/;
const EMAIL=/^[a-z0-9][a-z0-9._-]{0,60}@example[.]com$/;
const fail=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
export class P4R45CiRenewalIssuer{
 constructor(private readonly pool:pg.Pool,private readonly encryptionKey:Buffer,
  private readonly env:NodeJS.ProcessEnv=process.env){}
 async renew(actor:P4R28Actor|null,orgId:unknown,input:unknown):
  Promise<P4R29Invite>{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return fail(503,"UNAVAILABLE");}
  if(!Buffer.isBuffer(this.encryptionKey)||this.encryptionKey.length!==32)
   return fail(503,"UNAVAILABLE");
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
   await client.query(
    "SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,orgId]);
   const role=await client.query(
    "SELECT current_user AS name,(SELECT rolsuper OR rolbypassrls"+
    " FROM pg_roles WHERE rolname=current_user) AS privileged");
   if(role.rows.length!==1||role.rows[0]?.name!=="p4_synthetic_ci_runtime"||
    role.rows[0]?.privileged!==false)
    return fail(403,"ACCESS_DENIED");
   await client.query("SELECT p4_r40_ci.require_current_owner($1)",[orgId]);
   const prior=await client.query(
    "SELECT id,recipient_email,status,expires_at,resend_count,version"+
    " FROM p4_synthetic.invitations WHERE org_id=$1 AND id=$2 FOR UPDATE",
    [orgId,data.invitationId]);
   if(prior.rows.length!==1)return fail(403,"ACCESS_DENIED");
   const old=prior.rows[0];
   if(typeof old.recipient_email!=="string"||!EMAIL.test(old.recipient_email)||
    !Number.isSafeInteger(old.resend_count)||old.resend_count<0||
    old.resend_count>=3||!Number.isSafeInteger(old.version)||
    old.version!==data.expectedVersion||!(old.expires_at instanceof Date))
    return fail(409,"CONFLICT");
   if(old.status==="pending"&&old.expires_at.getTime()<=Date.now()){
    const expired=await client.query(
     "UPDATE p4_synthetic.invitations SET status='expired',version=version+1"+
     " WHERE id=$1 AND org_id=$2 AND status='pending'"+
     " AND expires_at<=clock_timestamp()",[old.id,orgId]);
    if(expired.rowCount!==1)return fail(409,"CONFLICT");
   }else if(old.status!=="expired"&&old.status!=="revoked")
    return fail(409,"CONFLICT");
   const activeMember=await client.query(
    "SELECT 1 FROM p4_synthetic.memberships m"+
    " JOIN p4_synthetic.identity_subjects s ON s.user_id=m.user_id"+
    " AND s.email_verified=true"+
    " WHERE m.org_id=$1 AND m.active=true AND s.canonical_email=$2 LIMIT 1",
    [orgId,old.recipient_email]);
   if(activeMember.rowCount!==0)return fail(409,"CONFLICT");
   const id=randomUUID(),job=randomUUID(),event=randomUUID();
   const token=randomBytes(32).toString("hex");
   const tokenHash=createHash("sha256").update(token,"utf8").digest("hex");
   const nonce=randomBytes(12),cipher=createCipheriv(
    "aes-256-gcm",this.encryptionKey,nonce);
   const encrypted=Buffer.concat([cipher.update(token,"utf8"),cipher.final()]);
   const tag=cipher.getAuthTag();
   await client.query(
    "SELECT p4_r45_ci.invalidate_queued_delivery($1,$2)",
    [orgId,old.id]);
   const rows=await client.query(
    "INSERT INTO p4_synthetic.invitations"+
    " (id,org_id,invited_by,recipient_email,granted_role,token_hash,"+
    " issued_at,expires_at,resend_count) VALUES"+
    " ($1,$2,$3,$4,'MEMBER',$5,now(),now()+interval '48 hours',$6)"+
    " RETURNING id::text,org_id::text,recipient_email,granted_role,"+
    " status,issued_at,expires_at,version",
    [id,orgId,actor.userId,old.recipient_email,tokenHash,
     old.resend_count+1]);
   if(rows.rowCount!==1)return fail(503,"UNAVAILABLE");
   await client.query(
    "INSERT INTO p4_r32_ci.delivery_outbox"+
    " (id,invitation_id,org_id,recipient_email,encrypted_token,nonce,auth_tag)"+
    " VALUES($1,$2,$3,$4,$5,$6,$7)",
    [job,id,orgId,old.recipient_email,encrypted.toString("hex"),
     nonce.toString("hex"),tag.toString("hex")]);
   await client.query(
    "INSERT INTO p4_r45_ci.renewal_events"+
    " (id,org_id,prior_invitation_id,renewed_invitation_id,actor_user_id)"+
    " VALUES($1,$2,$3,$4,$5)",
    [event,orgId,old.id,id,actor.userId]);
   await client.query("COMMIT");active=false;
   const row=rows.rows[0];
   return Object.freeze({id:row.id,organizationId:row.org_id,
    recipientEmail:row.recipient_email,role:"MEMBER",
    status:"pending",issuedAt:row.issued_at.toISOString(),
    expiresAt:row.expires_at.toISOString(),version:row.version});
  }catch(e){
   if(active){try{await client.query("ROLLBACK");}
    catch{discard=true;}}
   if(e instanceof P4R28Denied)throw e;
   if(e&&typeof e==="object"&&"code" in e){
    if(e.code==="P4003")return fail(403,"ACCESS_DENIED");
    if(e.code==="P4009"||e.code==="23505")return fail(409,"CONFLICT");
   }
   return fail(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
}
