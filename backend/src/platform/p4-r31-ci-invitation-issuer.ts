/**
 * P4 R31: CI-disposable, PostgreSQL-backed invitation issuance with an
 * in-memory fictional recipient mailbox. No SMTP, network delivery, real
 * Auth0, browser persistence, production router or shared database.
 *
 * Unlike R29 drafts, these fixture invitations retain a redeemable token
 * ONLY in the instance-scoped CI mailbox. PostgreSQL stores only SHA-256.
 * This is NOT a commercial invitation-delivery implementation.
 */
import {createHash,randomBytes,randomUUID} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R29CiInvitationService,type P4R29Invite}
 from "./p4-r29-ci-invitation-service.js";

const UUID4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL=/^[a-z0-9][a-z0-9._-]{0,60}@example\.com$/;
const OWNER_ACTORS=new Set(["user_demo_alice","user_demo_bob"]);
function denied(status:400|401|403|409|503,code:P4R28Denied["code"]):never{
 throw new P4R28Denied(status,code);
}
export class P4R31CiFixtureMailbox {
 private readonly pending=new Map<string,string>();
 constructor(private readonly capacity=10){
  if(!Number.isSafeInteger(capacity)||capacity<0||capacity>100)
   throw new Error("P4_R31_INVALID_FIXTURE_CAPACITY");
 }
 /** No external provider: synchronous memory-only delivery in CI. */
 deposit(email:string,token:string):void{
  if(!EMAIL.test(email)||!/^[0-9a-f]{64}$/.test(token)||
   this.pending.has(email)||this.pending.size>=this.capacity)
   throw new Error("P4_R31_SYNTHETIC_MAILBOX_REJECTED");
  this.pending.set(email,token);
 }
 /** Called only by GitHub CI fixtures, never registered on HTTP routes. */
 takeForFixtureTest(email:string):string|null{
  const token=this.pending.get(email)??null;
  this.pending.delete(email);
  return token;
 }
 pendingCount():number{return this.pending.size;}
}
export class P4R31CiInvitationIssuer {
 private readonly r29:P4R29CiInvitationService;
 constructor(
  private readonly pool:pg.Pool,
  private readonly mailbox:P4R31CiFixtureMailbox,
  private readonly env:NodeJS.ProcessEnv=process.env,
 ){
  this.r29=new P4R29CiInvitationService(pool,env);
 }
 async issue(actor:P4R28Actor|null,orgId:unknown,body:unknown):Promise<P4R29Invite>{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{return denied(503,"UNAVAILABLE");}
  if(!actor||actor.verified!==true||!OWNER_ACTORS.has(actor.userId))
   return denied(401,"IDENTITY_REQUIRED");
  if(typeof orgId!=="string"||!UUID4.test(orgId))
   return denied(403,"ACCESS_DENIED");
  if(!body||typeof body!=="object"||Array.isArray(body)||
   Object.keys(body).join(",")!=="recipientEmail")
   return denied(400,"INVALID_INPUT");
  const email=(body as Record<string,unknown>).recipientEmail;
  if(typeof email!=="string"||!EMAIL.test(email))
   return denied(400,"INVALID_INPUT");
  let client:pg.PoolClient;
  try{client=await this.pool.connect();}
  catch{return denied(503,"UNAVAILABLE");}
  let active=false,discard=false;
  let safe:P4R29Invite;
  let rawHex:string;
  try{
   await client.query("BEGIN");active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query(
    "SELECT set_config('app.actor_id',$1,true),"+
    "set_config('app.tenant_id',$2,true)",[actor.userId,orgId]);
   const role=await client.query(
    "SELECT current_user AS role,(SELECT rolsuper OR rolbypassrls"+
    " FROM pg_roles WHERE rolname=current_user) AS privileged");
   if(role.rows[0]?.role!=="p4_synthetic_ci_runtime"||
      role.rows[0]?.privileged!==false)
    return denied(403,"ACCESS_DENIED");
   const user=await client.query(
    "SELECT 1 FROM p4_synthetic.identity_subjects"+
    " WHERE user_id=$1 AND email_verified=true LIMIT 1",[actor.userId]);
   const member=await client.query(
    "SELECT 1 FROM p4_synthetic.memberships"+
    " WHERE org_id=$1 AND user_id=$2 AND role='OWNER'"+
    " AND active=true LIMIT 1",[orgId,actor.userId]);
   if(user.rowCount!==1||member.rowCount!==1)
    return denied(403,"ACCESS_DENIED");
   await client.query(
    "UPDATE p4_synthetic.invitations"+
    " SET status='expired',version=version+1"+
    " WHERE org_id=$1 AND recipient_email=$2"+
    " AND status='pending' AND expires_at<=now()",[orgId,email]);
   const id=randomUUID();
   const tokenBuffer=randomBytes(32);
   const hash=createHash("sha256").update(tokenBuffer).digest("hex");
   rawHex=tokenBuffer.toString("hex");
   tokenBuffer.fill(0);
   const inserted=await client.query(
    "INSERT INTO p4_synthetic.invitations"+
    " (id,org_id,invited_by,recipient_email,granted_role,token_hash,"+
    " issued_at,expires_at) VALUES"+
    " ($1,$2,$3,$4,'MEMBER',$5,now(),now()+interval '48 hours')"+
    " RETURNING id::text,org_id::text,recipient_email,granted_role,"+
    " status,issued_at,expires_at,version",
    [id,orgId,actor.userId,email,hash]);
   if(inserted.rowCount!==1)return denied(503,"UNAVAILABLE");
   const row=inserted.rows[0] as {
    id:string;org_id:string;recipient_email:string;granted_role:string;
    status:string;issued_at:Date;expires_at:Date;version:number;
   };
   if(row.granted_role!=="MEMBER"||row.status!=="pending"||
    !(row.issued_at instanceof Date)||!(row.expires_at instanceof Date)||
    row.version!==1)return denied(503,"UNAVAILABLE");
   safe=Object.freeze({
    id:row.id,organizationId:row.org_id,recipientEmail:row.recipient_email,
    role:"MEMBER" as const,status:"pending" as const,
    issuedAt:row.issued_at.toISOString(),
    expiresAt:row.expires_at.toISOString(),version:row.version,
   });
   await client.query("COMMIT");active=false;
  }catch(e){
   if(active){try{await client.query("ROLLBACK");}catch{discard=true;}}
   if(e instanceof P4R28Denied)throw e;
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")
    return denied(409,"CONFLICT");
   return denied(503,"UNAVAILABLE");
  }finally{client.release(discard);}
  // Delivery deliberately occurs only AFTER a committed DB row exists.
  // If the memory-only fixture cannot deliver, revoke immediately.
  try{
   this.mailbox.deposit(email,rawHex!);
  }catch{
   try{await this.r29.revoke(actor,orgId,safe!.id);}
   catch{/* deny outward regardless; never publish a raw token */}
   return denied(503,"UNAVAILABLE");
  }
  return safe!;
 }
}
