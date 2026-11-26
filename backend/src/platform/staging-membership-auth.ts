import { Router, type Request, type ErrorRequestHandler } from "express";
import { auth } from "express-oauth2-jwt-bearer";
import { isCanonicalUuidV4 } from "./p4-approved-uuid.js";
import type { StageIdentity, StageMembershipReader } from "./staging-membership-db.js";
export type StageIdentityPolicy=Readonly<{issuer:string;audience:string;clientId:string}>;
export function readStageIdentityPolicy(env:Readonly<Record<string,string|undefined>>):StageIdentityPolicy|null {
  if(env.VERCEL!=="1"||env.VERCEL_ENV!=="preview"||env.P4_VERCEL_SYNTHETIC_PREVIEW!=="true"||
    env.P4_STAGE_MEMBERSHIP_ENABLED!=="true")return null;
  const domain=env.P4_STAGE_AUTH0_DOMAIN??"",audience=env.P4_STAGE_AUTH0_AUDIENCE??"",clientId=env.P4_STAGE_AUTH0_CLIENT_ID??"";
  if(!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.auth0\.com$/.test(domain)||
    !/^(?:https:\/\/[^\s]+|urn:[A-Za-z0-9:._/-]+)$/.test(audience)||audience.length>256||
    !/^[A-Za-z0-9_-]{16,128}$/.test(clientId))return null;
  return Object.freeze({issuer:"https://"+domain+"/",audience,clientId});
}
/** Purpose/shape checks only, used strictly after SDK signature verification. */
export function stageVerifiedClaims(raw:unknown,policy:StageIdentityPolicy,now:number):StageIdentity|null {
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||!Number.isSafeInteger(now))return null;
  const c=raw as Record<string,unknown>;
  if(c.iss!==policy.issuer||typeof c.sub!=="string"||!/^auth0\|[A-Za-z0-9_-]{3,180}$/.test(c.sub)||
    c.azp!==policy.clientId||c.gty==="client-credentials"||
    !(c.aud===policy.audience||(Array.isArray(c.aud)&&c.aud.length<=8&&c.aud.every(x=>typeof x==="string")&&c.aud.includes(policy.audience)))||
    typeof c.iat!=="number"||!Number.isSafeInteger(c.iat)||c.iat>now+30||
    typeof c.exp!=="number"||!Number.isSafeInteger(c.exp)||c.exp<=now||c.exp<=c.iat||c.exp-c.iat>86400||
    (c.nbf!==undefined&&(typeof c.nbf!=="number"||!Number.isSafeInteger(c.nbf)||c.nbf>now))||
    typeof c.scope!=="string"||c.scope.length>512||!c.scope.split(" ").includes("read:identity"))return null;
  return Object.freeze({issuer:policy.issuer,subject:c.sub});
}
/** Unmounted until isolated provider configuration and deployment are authorized. */
export function createStageMembershipRouter(policy:StageIdentityPolicy,reader:StageMembershipReader,directoryEnabled=false){
  const router=Router();
  router.use((_req,res,next)=>{res.setHeader("Cache-Control","no-store, private");next();});
  const verify=auth({issuerBaseURL:policy.issuer,audience:policy.audience,tokenSigningAlg:"RS256"});
  if(directoryEnabled&&reader.list)router.get("/directory",verify,async(req,res)=>{
    const keys=Object.keys(req.query),after=req.query.after??null;
    if((keys.length!==0&&(keys.length!==1||keys[0]!=="after"))||
       (after!==null&&!isCanonicalUuidV4(after))){res.status(403).json({error:{code:"ACCESS_DENIED"}});return;}
    const identity=stageVerifiedClaims((req as Request&{auth?:{payload?:unknown}}).auth?.payload,policy,Math.floor(Date.now()/1000));
    if(!identity){res.status(401).json({error:{code:"IDENTITY_REQUIRED"}});return;}
    try{
      const page=await reader.list!(identity,after);
      let prior=after;
      if(page.items.length>20)throw Error("PROJECTION_DENIED");
      const items=page.items.map(row=>{
        if(!isCanonicalUuidV4(row.organizationId)||(prior!==null&&row.organizationId<=prior)||
          (row.membershipRole!=="OWNER"&&row.membershipRole!=="MEMBER"))throw Error("PROJECTION_DENIED");
        prior=row.organizationId;
        return {organizationId:row.organizationId,membershipRole:row.membershipRole};
      });
      if(page.nextCursor!==null&&(items.length!==20||page.nextCursor!==prior))throw Error("PROJECTION_DENIED");
      res.json({scope:"staging-organization-directory",items,nextCursor:page.nextCursor,applicationAccess:false});
    }catch{res.status(503).json({error:{code:"UNAVAILABLE"}});}
  });
  router.get("/:orgId/membership-check",verify,async(req,res)=>{
    if(!isCanonicalUuidV4(req.params.orgId)||Object.keys(req.query).length){
      res.status(403).json({error:{code:"ACCESS_DENIED"}});return;
    }
    const payload=(req as Request&{auth?:{payload?:unknown}}).auth?.payload;
    const identity=stageVerifiedClaims(payload,policy,Math.floor(Date.now()/1000));
    if(!identity){res.status(401).json({error:{code:"IDENTITY_REQUIRED"}});return;}
    try {
      const row=await reader.read(identity,req.params.orgId);
      if(!row||row.organizationId!==req.params.orgId||!isCanonicalUuidV4(row.actorId)||
        (row.role!=="OWNER"&&row.role!=="MEMBER")){
        res.status(403).json({error:{code:"ACCESS_DENIED"}});return;
      }
      res.json({scope:"staging-membership-only",organizationId:row.organizationId,membershipRole:row.role,applicationAccess:false});
    }catch{res.status(503).json({error:{code:"UNAVAILABLE"}});}
  });
  router.use((_req,res)=>{res.status(404).json({error:{code:"NOT_FOUND"}});});
  const error:ErrorRequestHandler=(err,_req,res,_next)=>{
    const unauthorized=err&&typeof err==="object"&&"status" in err&&err.status===401;
    res.status(unauthorized?401:503).json({error:{code:unauthorized?"IDENTITY_REQUIRED":"UNAVAILABLE"}});
  };
  router.use(error);
  return router;
}
