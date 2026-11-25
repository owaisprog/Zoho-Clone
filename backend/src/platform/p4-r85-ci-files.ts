import {createHash,randomBytes,randomUUID} from "node:crypto";
import {Router,type Request,type Response} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {type P4R33CiJwk} from "./p4-r33-ci-jwt-verifier.js";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import {P4R84CiRuntime,P4R84Denied,invalid} from "./p4-r84-ci-runtime.js";
import {ciIdentity,safeError,isObject} from "./p4-r84-ci-platform.js";
const fixture=/^Demo (blocked )?attachment [A-Za-z0-9 .-]{1,120}$/;
const tokenPattern=/^[a-f0-9]{64}$/;
const hash=(v:string)=>createHash("sha256").update(v,"ascii").digest("hex");
const exact=(v:unknown,k:string):v is Record<string,unknown>=>isObject(v)&&Object.keys(v).sort().join(",")===k;
const metadata=(v:unknown)=>exact(v,"id,revision,state")&&isCanonicalUuidV4(v.id)&&Number.isSafeInteger(v.revision)&&["quarantined","scan_clean","rejected","soft_deleted"].includes(v.state as string);
const malformed=()=>{throw new P4R84Denied(503,"UNAVAILABLE");};
export function createP4R85CiFilesRouter(db:P4R84CiRuntime,keys:readonly P4R33CiJwk[],env=process.env){
 assertP4V1CiPrismaEnvironment(env);const router=Router();
 router.use((_q,r,next)=>{r.setHeader("Cache-Control","no-store, private");r.setHeader("X-Content-Type-Options","nosniff");next();});
 const cmd=async(q:Request,op:string,id:string|null,parent:string|null,content:string|null,digest:string|null,revision:number|null)=>{
  const identity=ciIdentity(q,keys,env),org=q.params.orgId;
  if(!isCanonicalUuidV4(org)||(id!==null&&!isCanonicalUuidV4(id))||(parent!==null&&!isCanonicalUuidV4(parent)))return invalid();
  return db.run(op==="list"?"READ ONLY":"READ WRITE",async c=>{
   const r=await c.query("SELECT p4_r85_ci.command($1,$2,$3,$4,$5,$6,$7,$8,$9) AS data",[identity.issuer,identity.subject,org,op,id,parent,content,digest,revision]);if(r.rowCount!==1)return malformed();return r.rows[0].data as unknown;
  });
 };
 const send=(r:Response,data:unknown)=>r.json({scope:"disposable-ci-only",data});
 router.get("/:orgId/parents/:parentId/files",async(q,r)=>{try{
  const after=q.query.after??null;if(Object.keys(q.query).some(x=>x!=="after")||(after!==null&&!isCanonicalUuidV4(after)))return invalid();
  const v=await cmd(q,"list",after as string|null,q.params.parentId??null,null,null,null);
  if(!Array.isArray(v)||v.length>21||v.some(x=>!metadata(x)))return malformed();send(r,{items:v.slice(0,20),nextCursor:v.length===21?v[19].id:null});
 }catch(e){safeError(r,e);}});
 router.post("/:orgId/parents/:parentId/files",async(q,r)=>{try{
  if(Object.keys(q.query).length||!exact(q.body,"content")||typeof q.body.content!=="string"||!fixture.test(q.body.content))return invalid();
  const v=await cmd(q,"create",randomUUID(),q.params.parentId??null,q.body.content,null,null);if(!metadata(v))return malformed();send(r,v);
 }catch(e){safeError(r,e);}});
 router.post("/:orgId/files/:id/grant",async(q,r)=>{try{
  if(Object.keys(q.query).length||!exact(q.body,""))return invalid();
  const token=randomBytes(32).toString("hex"),v=await cmd(q,"grant",q.params.id??null,null,null,hash(token),null);
  if(!exact(v,"expiresAt")||typeof v.expiresAt!=="string"||!Number.isFinite(Date.parse(v.expiresAt)))return malformed();send(r,{token,expiresAt:v.expiresAt});
 }catch(e){safeError(r,e);}});
 router.post("/:orgId/files/:id/redeem",async(q,r)=>{try{
  if(Object.keys(q.query).length||!exact(q.body,"token")||typeof q.body.token!=="string"||!tokenPattern.test(q.body.token))return invalid();
  const v=await cmd(q,"redeem",q.params.id??null,null,null,hash(q.body.token),null);
  if(!exact(v,"content")||typeof v.content!=="string"||!/^Demo attachment [A-Za-z0-9 .-]{1,120}$/.test(v.content))return malformed();
  r.setHeader("Content-Disposition",'attachment; filename="demo-attachment.txt"');r.type("text/plain").send(v.content);
 }catch(e){safeError(r,e);}});
 router.delete("/:orgId/files/:id",async(q,r)=>{try{
  if(Object.keys(q.query).length||!exact(q.body,"expectedRevision")||typeof q.body.expectedRevision!=="number"||!Number.isSafeInteger(q.body.expectedRevision)||q.body.expectedRevision<0)return invalid();
  const v=await cmd(q,"delete",q.params.id??null,null,null,null,q.body.expectedRevision);if(!metadata(v))return malformed();send(r,v);
 }catch(e){safeError(r,e);}});
 return router;
}
