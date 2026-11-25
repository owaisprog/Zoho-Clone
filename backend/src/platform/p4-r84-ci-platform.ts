import {Router,type Request,type Response} from "express";
import {verifyP4R33CiToken,type P4R33CiJwk} from "./p4-r33-ci-jwt-verifier.js";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import {P4R84CiRuntime,P4R84Denied,invalid} from "./p4-r84-ci-runtime.js";
export const resources=["navigation","organization","members","entitlements","audit"] as const;
type Resource=typeof resources[number];
export const isObject=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const exact=(v:unknown,keys:string):v is Record<string,unknown>=>isObject(v)&&Object.keys(v).sort().join(",")===keys;
const role=(v:unknown)=>v==="OWNER"||v==="MEMBER";
const actions=["membership.changed","file.created","file.scanned","file.downloaded","file.deleted","notice.read"];
const malformed=()=>{throw new P4R84Denied(503,"UNAVAILABLE");};
export function parsePlatform(v:unknown,r:Resource,org:string,after:string|null):unknown{
 if(r==="navigation"){if(!exact(v,"crmAvailable,membershipRole,organizationId")||v.organizationId!==org||!role(v.membershipRole)||typeof v.crmAvailable!=="boolean"||(v.membershipRole==="OWNER"&&v.crmAvailable))return malformed();return v;}
 if(r==="organization"){if(!exact(v,"displayName,id")||v.id!==org||typeof v.displayName!=="string"||v.displayName.length<2||v.displayName.length>160)return malformed();return v;}
 if(!Array.isArray(v)||v.length>(r==="entitlements"?2:21))return malformed();
 if(r==="entitlements"){if(v.some(x=>!exact(x,"active,app")||!["platform","crm"].includes(x.app as string)||typeof x.active!=="boolean")||new Set(v.map(x=>x.app)).size!==v.length)return malformed();return v;}
 let prior=after??"";
 for(const x of v){
  if(!exact(x,r==="members"?"id,role":"action,id,occurredAt")||!isCanonicalUuidV4(x.id)||x.id<=prior)return malformed();
  if(r==="members"?!role(x.role):typeof x.action!=="string"||!actions.includes(x.action)||typeof x.occurredAt!=="string"||!Number.isFinite(Date.parse(x.occurredAt))||new Date(x.occurredAt).toISOString()!==x.occurredAt)return malformed();
  prior=x.id;
 }
 return {items:v.slice(0,20),nextCursor:v.length===21?v[19].id:null};
}
export function ciIdentity(req:Request,keys:readonly P4R33CiJwk[],env:NodeJS.ProcessEnv){
 const h=req.get("authorization")??"";
 if(!h.startsWith("Bearer "))throw new P4R84Denied(401,"IDENTITY_REQUIRED");
 try{return verifyP4R33CiToken(h.slice(7),keys,Math.floor(Date.now()/1000),env);}catch{throw new P4R84Denied(401,"IDENTITY_REQUIRED");}
}
export function safeError(res:Response,e:unknown){const x=e instanceof P4R84Denied?e:new P4R84Denied(503,"UNAVAILABLE");res.status(x.status).json({error:{code:x.code}});}
export function createP4R84CiPlatformRouter(db:P4R84CiRuntime,keys:readonly P4R33CiJwk[],env=process.env){
 assertP4V1CiPrismaEnvironment(env);const router=Router();
 router.use((_q,r,next)=>{r.setHeader("Cache-Control","no-store, private");r.setHeader("X-Content-Type-Options","nosniff");next();});
 router.get("/:orgId/:resource",async(q,r)=>{try{
  const actor=ciIdentity(q,keys,env),org=q.params.orgId,resource=q.params.resource;
  if(!isCanonicalUuidV4(org)||!(resources as readonly string[]).includes(resource))return invalid();
  const kind=resource as Resource,after=q.query.after??null;
  if(Object.keys(q.query).some(x=>x!=="after")||(after!==null&&(!["members","audit"].includes(kind)||!isCanonicalUuidV4(after))))return invalid();
  const data=await db.run("READ ONLY",async c=>{
   const result=await c.query("SELECT p4_r84_ci.platform_read($1,$2,$3,$4,$5) AS data",[actor.issuer,actor.subject,org,kind,after]);
   if(result.rowCount!==1)return malformed();return parsePlatform(result.rows[0].data,kind,org,after as string|null);
  });r.json({scope:"disposable-ci-only",data});
 }catch(e){safeError(r,e);}});
 return router;
}
