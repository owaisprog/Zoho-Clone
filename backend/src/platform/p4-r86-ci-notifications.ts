import pg from "pg";
import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {type P4R33CiJwk} from "./p4-r33-ci-jwt-verifier.js";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import {P4R84CiRuntime,P4R84Denied,invalid} from "./p4-r84-ci-runtime.js";
import {ciIdentity,safeError,isObject} from "./p4-r84-ci-platform.js";
export type Delivery="empty"|"delivered"|"cancelled"|"retry"|"dead";
export class P4R86CiNotificationWorker{
 private pool:pg.Pool;
 constructor(private readonly env:NodeJS.ProcessEnv=process.env){
  assertP4V1CiPrismaEnvironment(env);
  this.pool=new pg.Pool({host:"127.0.0.1",port:5432,database:"zoho_clone_synthetic_ci",user:"p4_r86_ci_worker",password:"fake_ci_not_for_real_accounts",max:2,statement_timeout:3000,connectionTimeoutMillis:2000});
 }
 async close(){await this.pool.end();}
 async deliverOne():Promise<Delivery>{
  assertP4V1CiPrismaEnvironment(this.env);
  let c:pg.PoolClient|undefined,active=false,discard=false;
  try{
   c=await this.pool.connect();await c.query("BEGIN");active=true;
   const check=await c.query("SELECT current_user AS role,session_user AS login,current_database() AS db,(SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication OR rolinherit FROM pg_roles WHERE rolname=current_user) AS privileged,(SELECT count(*)::int FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=current_user) AS grants");
   const r=check.rows[0];if(check.rowCount!==1||r?.role!=="p4_r86_ci_worker"||r.login!==r.role||r.db!=="zoho_clone_synthetic_ci"||r.privileged!==false||r.grants!==0)throw Error("ROLE_DENIED");
   const out=await c.query("SELECT p4_r86_ci.deliver_one() AS result");
   const value=out.rows[0]?.result;if(out.rowCount!==1||!["empty","delivered","cancelled","retry","dead"].includes(value))throw Error("INVALID_PROJECTION");
   await c.query("COMMIT");active=false;return value as Delivery;
  }catch{
   if(c&&active)try{await c.query("ROLLBACK");}catch{discard=true;}
   throw Error("P4_R86_WORKER_UNAVAILABLE");
  }finally{c?.release(discard);}
 }
}
const exact=(v:unknown,k:string):v is Record<string,unknown>=>isObject(v)&&Object.keys(v).sort().join(",")===k;
const malformed=()=>{throw new P4R84Denied(503,"UNAVAILABLE");};
export function createP4R86CiInboxRouter(db:P4R84CiRuntime,keys:readonly P4R33CiJwk[],env=process.env){
 assertP4V1CiPrismaEnvironment(env);const router=Router();
 router.use((_q,r,next)=>{r.setHeader("Cache-Control","no-store, private");r.setHeader("X-Content-Type-Options","nosniff");next();});
 const query=async(q:Request,op:string,id:string|null)=>{
  const actor=ciIdentity(q,keys,env),org=q.params.orgId;if(!isCanonicalUuidV4(org)||(id!==null&&!isCanonicalUuidV4(id)))return invalid();
  return db.run(op==="list"?"READ ONLY":"READ WRITE",async c=>{const r=await c.query("SELECT p4_r86_ci.inbox($1,$2,$3,$4,$5) AS data",[actor.issuer,actor.subject,org,op,id]);if(r.rowCount!==1)return malformed();return r.rows[0].data as unknown;});
 };
 router.get("/:orgId/notices",async(q,r)=>{try{
  const after=q.query.after??null;if(Object.keys(q.query).some(x=>x!=="after")||(after!==null&&!isCanonicalUuidV4(after)))return invalid();
  const v=await query(q,"list",after as string|null);
  if(!Array.isArray(v)||v.length>21||v.some(x=>!exact(x,"fileId,id,kind,read")||!isCanonicalUuidV4(x.id)||!isCanonicalUuidV4(x.fileId)||!["FILE_SCAN_CLEAN","FILE_SCAN_REJECTED"].includes(x.kind as string)||typeof x.read!=="boolean"))return malformed();
  r.json({scope:"disposable-ci-only",data:{items:v.slice(0,20),nextCursor:v.length===21?v[19].id:null}});
 }catch(e){safeError(r,e);}});
 router.post("/:orgId/notices/:id/read",async(q,r)=>{try{
  if(Object.keys(q.query).length||!exact(q.body,"")||!isCanonicalUuidV4(q.params.id))return invalid();
  const v=await query(q,"read",q.params.id);if(!exact(v,"id,read")||v.id!==q.params.id||v.read!==true)return malformed();
  r.json({scope:"disposable-ci-only",data:v});
 }catch(e){safeError(r,e);}});
 return router;
}
