/**
 * ADR 0007 provider/tenant seam for an eventual approved staging service.
 * Unmounted, no provider provisioning, no customer routes or automatic enrollment.
 * Only the SDK verification pipeline may invoke the request handler.
 */
import {Router,type Request,type RequestHandler} from "express";
import {auth0IdentityCheckMiddleware} from "../auth/auth0-api.js";
import {readAuth0ApiConfiguration} from "../auth/auth0-config.js";
import {isCanonicalUuidV4,type P4UuidV4} from "./p4-approved-uuid.js";
export type ProviderPolicy=Readonly<{issuer:string;audience:string;clientId:string}>;
export type VerifiedSubject=Readonly<{issuer:string;subject:string}>;
export type MembershipProjection=Readonly<{actorId:P4UuidV4;organizationId:P4UuidV4;role:"OWNER"|"MEMBER"}>;
/** Implementation must resolve exact issuer+subject and current verified active membership in one DB snapshot. */
export interface ProviderTenantReader{
 read(input:Readonly<{identity:VerifiedSubject;organizationId:P4UuidV4}>):Promise<MembershipProjection|null>;
}
const SUBJECT=/^auth0\|[A-Za-z0-9_-]{3,180}$/;
const CLIENT=/^[A-Za-z0-9_-]{16,128}$/;
const SCOPE=/^[A-Za-z0-9:_-]+(?: [A-Za-z0-9:_-]+)*$/;
export function readP4R81Policy(env:NodeJS.ProcessEnv):ProviderPolicy|null{
 const auth=readAuth0ApiConfiguration(env);
 const clientId=env.P4_AUTH0_WEB_CLIENT_ID??"";
 if(!auth||!CLIENT.test(clientId))return null;
 return Object.freeze({issuer:auth.issuerBaseURL,audience:auth.audience,clientId});
}
/** Shape and purpose checks only; this function does NOT verify a JWT signature. */
export function checkP4R81SdkPayload(raw:unknown,p:ProviderPolicy,now:number):VerifiedSubject|null{
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||!Number.isSafeInteger(now))return null;
 const c=raw as Record<string,unknown>;
 if(c.iss!==p.issuer||typeof c.sub!=="string"||!SUBJECT.test(c.sub)||
 c.azp!==p.clientId||c.gty==="client-credentials"||
 !(c.aud===p.audience||(Array.isArray(c.aud)&&c.aud.length<=8&&c.aud.every(v=>typeof v==="string")&&c.aud.includes(p.audience)))||
 typeof c.iat!=="number"||!Number.isSafeInteger(c.iat)||c.iat>now+30||
 typeof c.exp!=="number"||!Number.isSafeInteger(c.exp)||c.exp<=now||c.exp<=c.iat||c.exp-c.iat>86400||
 (c.nbf!==undefined&&(typeof c.nbf!=="number"||!Number.isSafeInteger(c.nbf)||c.nbf>now))||
 typeof c.scope!=="string"||c.scope.length>512||!SCOPE.test(c.scope)||!c.scope.split(" ").includes("read:identity"))return null;
 return Object.freeze({issuer:p.issuer,subject:c.sub});
}
export function checkP4R81Membership(value:unknown,org:P4UuidV4):MembershipProjection|null{
 if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).sort().join(",")!=="actorId,organizationId,role")return null;
 const row=value as Record<string,unknown>;
 if(!isCanonicalUuidV4(row.actorId)||row.organizationId!==org||(row.role!=="OWNER"&&row.role!=="MEMBER"))return null;
 return Object.freeze({actorId:row.actorId,organizationId:org,role:row.role});
}
export function createP4R81ProviderTenantRouter(reader:ProviderTenantReader,env:NodeJS.ProcessEnv=process.env):Router{
 // Explicit preparation only. This is NOT a staging or production entrypoint.
 if(process.env.NODE_ENV==="production"||env.NODE_ENV==="production"||!["local","ci"].includes(env.P3_APP_ENV??"local")||env.P4_PROVIDER_PREPARATION!=="true")
 throw Error("P4_R81_PREPARATION_DISABLED");
 const router=Router(),policy=readP4R81Policy(env);
 router.use((_q,r,next)=>{r.setHeader("Cache-Control","no-store, private");r.setHeader("X-Content-Type-Options","nosniff");next();});
 const reject=(res:import("express").Response,status:number,code:string)=>res.status(status).json({error:{code}});
 if(!policy){router.use((_q,r)=>{reject(r,503,"AUTH_NOT_CONFIGURED");});return router;}
 // SDK verifies signature, issuer, audience, expiry. Do not inject a replacement verifier.
 const verify=auth0IdentityCheckMiddleware(env);
 const handler:RequestHandler=async(req,res)=>{
  if(Object.keys(req.query).length||!isCanonicalUuidV4(req.params.orgId)){reject(res,403,"ACCESS_DENIED");return;}
  const payload=(req as Request&{auth?:{payload?:unknown}}).auth?.payload;
  const identity=checkP4R81SdkPayload(payload,policy,Math.floor(Date.now()/1000));
  if(!identity){reject(res,401,"IDENTITY_REQUIRED");return;}
  try{
   const membership=checkP4R81Membership(await reader.read({identity,organizationId:req.params.orgId}),req.params.orgId);
   if(!membership){reject(res,403,"ACCESS_DENIED");return;}
   // Do not disclose provider subject, token, or internal actor ID. Membership is not CRM authorization.
   res.json({scope:"provider-preparation-only",organizationId:membership.organizationId,membershipRole:membership.role,applicationAccess:false});
  }catch{reject(res,503,"UNAVAILABLE");}
 };
 router.get("/:orgId/membership-check",verify,handler);
 router.use((_q,r)=>{reject(r,404,"NOT_FOUND");});
 const error:import("express").ErrorRequestHandler=(e,_q,r,_next)=>{
  reject(r,e&&typeof e==="object"&&"status" in e&&e.status===401?401:503,e&&typeof e==="object"&&"status" in e&&e.status===401?"IDENTITY_REQUIRED":"UNAVAILABLE");
 };
 router.use(error);
 return router;
}
