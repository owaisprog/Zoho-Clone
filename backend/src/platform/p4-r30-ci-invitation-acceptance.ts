/**
 * P4 R30 fictional single-use invite acceptance. A recipient is resolved
 * exclusively from trusted synthetic CI SDK evidence + the DB's verified
 * email mapping. No email, org, or role comes from the request body.
 * This does NOT redeem R29 drafts (their raw token was destroyed).
 * Unmounted in normal app, and disallowed outside disposable GitHub CI.
 */
import {createHash} from "node:crypto";
import type pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";

const ACTORS=new Set(["user_demo_alice","user_demo_bob","user_demo_carla"]);
const TOKEN=/^[0-9a-f]{64}$/;
export type P4R30Acceptance=Readonly<{accepted:true;membershipActivated:true}>;
export class P4R30CiAcceptanceService {
 constructor(private readonly pool:pg.Pool,
  private readonly env:NodeJS.ProcessEnv=process.env){}
 async accept(actor:P4R28Actor|null,body:unknown):Promise<P4R30Acceptance>{
  try{assertP4V1CiPrismaEnvironment(this.env);}
  catch{throw new P4R28Denied(503,"UNAVAILABLE");}
  if(!actor||actor.verified!==true||!ACTORS.has(actor.userId))
   throw new P4R28Denied(401,"IDENTITY_REQUIRED");
  if(!body||typeof body!=="object"||Array.isArray(body)||
   Object.keys(body).join(",")!=="token"||
   typeof (body as Record<string,unknown>).token!=="string"||
   !TOKEN.test((body as {token:string}).token))
   throw new P4R28Denied(400,"INVALID_INPUT");
  const supplied=(body as {token:string}).token;
  const hash=createHash("sha256").update(supplied,"utf8").digest("hex");
  let client:pg.PoolClient;
  try{client=await this.pool.connect();}
  catch{throw new P4R28Denied(503,"UNAVAILABLE");}
  let active=false,discard=false;
  try{
   await client.query("BEGIN");active=true;
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   await client.query(
    "SELECT set_config('app.actor_id',$1,true)",[actor.userId]);
   const guard=await client.query(
    "SELECT current_user AS role,(SELECT rolsuper OR rolbypassrls"+
    " FROM pg_roles WHERE rolname=current_user) AS privileged");
   if(guard.rows.length!==1||
    guard.rows[0]?.role!=="p4_synthetic_ci_runtime"||
    guard.rows[0]?.privileged!==false)
    throw new P4R28Denied(403,"ACCESS_DENIED");
   const rows=await client.query(
    'SELECT p4_r30_ci.redeem_fictional_invitation($1) AS accepted',
    [hash]);
   if(rows.rowCount!==1||rows.rows[0]?.accepted!==true)
    throw new P4R28Denied(403,"ACCESS_DENIED");
   await client.query("COMMIT");active=false;
   return Object.freeze({accepted:true,membershipActivated:true});
  }catch(e){
   if(active){try{await client.query("ROLLBACK");}
    catch{discard=true;}}
   if(e instanceof P4R28Denied)throw e;
   // Unique-constraint conflict or SQL internal error never reflects
   // DB schema, user IDs, raw token, hash or recipient email.
   throw new P4R28Denied(503,"UNAVAILABLE");
  }finally{client.release(discard);}
 }
}
