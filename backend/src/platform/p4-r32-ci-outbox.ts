/**
 * P4 R32: disposable CI-only encrypted, PostgreSQL-backed outbox.
 * The same transaction inserts a pending invitation AND an encrypted
 * delivery job. The issuer never exposes raw tokens over HTTP.
 * The test-worker is a CI bootstrap role, NOT a production permission design.
 */
import {createHash,randomBytes,randomUUID,createCipheriv,createDecipheriv}
 from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import type {P4R29Invite} from "./p4-r29-ci-invitation-service.js";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL=/^[a-z0-9][a-z0-9._-]{0,60}@example\.com$/;
const OWNERS=new Set(["user_demo_alice","user_demo_bob"]);
const err=(status:400|401|403|409|503,code:P4R28Denied["code"]):never=>{
 throw new P4R28Denied(status,code);
};
function envGuard(env:NodeJS.ProcessEnv){
 try{assertP4V1CiPrismaEnvironment(env);}
 catch{err(503,"UNAVAILABLE");}
}
function keyGuard(key:Buffer){
 if(!Buffer.isBuffer(key)||key.length!==32)err(503,"UNAVAILABLE");
}
export class P4R32CiOutboxIssuer{
 constructor(private readonly pool:pg.Pool,private readonly key:Buffer,
  private readonly env:NodeJS.ProcessEnv=process.env){}
 async issue(actor:P4R28Actor|null,orgId:unknown,body:unknown):
  Promise<P4R29Invite>{
  envGuard(this.env);keyGuard(this.key);
  if(!actor||actor.verified!==true||!OWNERS.has(actor.userId))
   return err(401,"IDENTITY_REQUIRED");
  if(typeof orgId!=="string"||!UUID.test(orgId))
   return err(403,"ACCESS_DENIED");
  if(!body||typeof body!=="object"||Array.isArray(body)||
    Object.keys(body).join(",")!=="recipientEmail"||
    typeof (body as {recipientEmail?:unknown}).recipientEmail!=="string")
   return err(400,"INVALID_INPUT");
  const email=(body as {recipientEmail:string}).recipientEmail;
  if(!EMAIL.test(email))return err(400,"INVALID_INPUT");
  let client:pg.PoolClient;
  try{client=await this.pool.connect();}
  catch{return err(503,"UNAVAILABLE");}
  let active=false,discard=false;
  try{
   await client.query("BEGIN");active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query(
    "SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,orgId]);
   const validation=await client.query(
    "SELECT current_user AS role,(SELECT rolsuper OR rolbypassrls"+
    " FROM pg_roles WHERE rolname=current_user) AS privileged");
   if(validation.rows[0]?.role!=="p4_synthetic_ci_runtime"||
    validation.rows[0]?.privileged!==false)return err(403,"ACCESS_DENIED");
   const owner=await client.query(
    "SELECT 1 FROM p4_synthetic.memberships m"+
    " JOIN p4_synthetic.identity_subjects s ON s.user_id=m.user_id"+
    " AND s.email_verified=true"+
    " WHERE m.org_id=$1 AND m.user_id=$2 AND m.role='OWNER'"+
    " AND m.active=true LIMIT 1",[orgId,actor.userId]);
   if(owner.rowCount!==1)return err(403,"ACCESS_DENIED");
   await client.query(
    "UPDATE p4_synthetic.invitations SET status='expired',version=version+1"+
    " WHERE org_id=$1 AND recipient_email=$2 AND status='pending'"+
    " AND expires_at<=now()",[orgId,email]);
   const id=randomUUID(),job=randomUUID(),token=randomBytes(32).toString("hex");
   const hash=createHash("sha256").update(token,"utf8").digest("hex");
   const nonce=randomBytes(12),cipher=createCipheriv("aes-256-gcm",this.key,nonce);
   // Fixed-size encrypted token, never retained in a plaintext DB field.
   const encrypted=Buffer.concat([cipher.update(token,"utf8"),cipher.final()]);
   const tag=cipher.getAuthTag();
   const invite=await client.query(
    "INSERT INTO p4_synthetic.invitations"+
    " (id,org_id,invited_by,recipient_email,granted_role,token_hash,"+
    " issued_at,expires_at) VALUES"+
    " ($1,$2,$3,$4,'MEMBER',$5,now(),now()+interval '48 hours')"+
    " RETURNING id::text,org_id::text,recipient_email,granted_role,"+
    " status,issued_at,expires_at,version",
    [id,orgId,actor.userId,email,hash]);
   if(invite.rowCount!==1)return err(503,"UNAVAILABLE");
   await client.query(
    "INSERT INTO p4_r32_ci.delivery_outbox"+
    " (id,invitation_id,org_id,recipient_email,encrypted_token,nonce,auth_tag)"+
    " VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [job,id,orgId,email,encrypted.toString("hex"),nonce.toString("hex"),
     tag.toString("hex")]);
   await client.query("COMMIT");active=false;
   const row=invite.rows[0];
   return Object.freeze({id:row.id,organizationId:row.org_id,
    recipientEmail:row.recipient_email,role:"MEMBER" as const,
    status:"pending" as const,issuedAt:row.issued_at.toISOString(),
    expiresAt:row.expires_at.toISOString(),version:row.version});
  }catch(e){
   if(active){try{await client.query("ROLLBACK");}
    catch{discard=true;}}
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
    return err(409,"CONFLICT");
   if(e instanceof P4R28Denied)throw e;
   return err(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
}
/** In-process fictional delivery; deduplicated by job, not a live mailer. */
export class P4R32CiRecipientMailbox{
 private readonly delivered=new Map<string,{email:string;token:string}>();
 constructor(private readonly fail=false){}
 deliver(jobId:string,email:string,token:string){
  if(this.fail)throw Error("FIXTURE_MAILBOX_DOWN");
  if(!this.delivered.has(jobId))this.delivered.set(jobId,{email,token});
 }
 take(email:string):string|null{
  for(const [id,item] of this.delivered){
   if(item.email===email){this.delivered.delete(id);return item.token;}
  }
  return null;
 }
 count(){return this.delivered.size;}
}
export class P4R32CiOutboxWorker{
 constructor(private readonly pool:pg.Pool,private readonly key:Buffer,
  private readonly env:NodeJS.ProcessEnv=process.env){}
 /** One CI-bootstrap transaction; row lock gives exclusive claim. */
 async deliverOne(recipient:P4R32CiRecipientMailbox):Promise<"delivered"|"retry"|"dead"|"empty">{
  envGuard(this.env);keyGuard(this.key);
  let client:pg.PoolClient;
  try{client=await this.pool.connect();}
  catch{return err(503,"UNAVAILABLE");}
  let active=false,discard=false;
  try{
   await client.query("BEGIN");active=true;
   const role=await client.query("SELECT current_user AS role");
   if(role.rows[0]?.role!=="demo_ci")return err(503,"UNAVAILABLE");
   const claim=await client.query(
    "SELECT q.id::text,q.recipient_email,q.encrypted_token,q.nonce,q.auth_tag,"+
    " q.attempts,i.status AS invitation_status,i.expires_at"+
    " FROM p4_r32_ci.delivery_outbox q"+
    " JOIN p4_synthetic.invitations i ON i.id=q.invitation_id"+
    " WHERE q.status='queued' AND q.next_attempt_at<=now()"+
    " ORDER BY q.created_at,q.id LIMIT 1 FOR UPDATE OF q SKIP LOCKED");
   if(claim.rowCount!==1){await client.query("COMMIT");active=false;return "empty";}
   const row=claim.rows[0] as {
    id:string;recipient_email:string;encrypted_token:string;nonce:string;
    auth_tag:string;attempts:number;invitation_status:string;expires_at:Date;
   };
   if(row.invitation_status!=="pending"||
    row.expires_at.getTime()<=Date.now()){
    await client.query("UPDATE p4_r32_ci.delivery_outbox"+
      " SET status='dead' WHERE id=$1",[row.id]);
    await client.query("COMMIT");active=false;return "dead";
   }
   try{
    const decrypt=createDecipheriv("aes-256-gcm",this.key,
     Buffer.from(row.nonce,"hex"));
    decrypt.setAuthTag(Buffer.from(row.auth_tag,"hex"));
    const token=Buffer.concat([decrypt.update(
     Buffer.from(row.encrypted_token,"hex")),decrypt.final()]).toString("utf8");
    if(!/^[0-9a-f]{64}$/.test(token))throw Error("INVALID_CIPHERTEXT");
    recipient.deliver(row.id,row.recipient_email,token);
    await client.query("UPDATE p4_r32_ci.delivery_outbox"+
     " SET status='delivered',delivered_at=now(),attempts=attempts+1"+
     " WHERE id=$1",[row.id]);
    await client.query("COMMIT");active=false;
    return "delivered";
   }catch{
    await client.query("UPDATE p4_r32_ci.delivery_outbox"+
     " SET attempts=attempts+1,"+
     " status=CASE WHEN attempts+1>=3 THEN 'dead' ELSE 'queued' END,"+
     " next_attempt_at=now()+interval '1 second'"+
     " WHERE id=$1",[row.id]);
    await client.query("COMMIT");active=false;
    return row.attempts+1>=3?"dead":"retry";
   }
  }catch{
   if(active){try{await client.query("ROLLBACK");}
    catch{discard=true;}}
   return err(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
}
