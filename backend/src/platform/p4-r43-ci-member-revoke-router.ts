/** R43 CI-only, unmounted member revocation HTTP route. */
import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R43CiMemberRevokeService}
 from "./p4-r43-ci-member-revoke-service.js";
export function createP4R43CiMemberRevokeRouter(deps:{
 service:P4R43CiMemberRevokeService;
 resolveVerifiedActor(req:Request):Promise<P4R28Actor|null>;
},env:NodeJS.ProcessEnv=process.env):Router{
 assertP4V1CiPrismaEnvironment(env);
 if(env.NODE_ENV==="production"||!deps?.service||
  typeof deps.resolveVerifiedActor!=="function")
  throw Error("P4_R43_CI_ONLY_ROUTER_DISABLED");
 const router=Router();
 router.use((_req,res,next)=>{
  res.setHeader("Cache-Control","no-store, private");
  res.setHeader("Pragma","no-cache");
  res.setHeader("X-Content-Type-Options","nosniff");
  next();
 });
 router.post("/:orgId/members/:memberId/revoke",async(req,res)=>{
  try{
   // No user role, organization, actor or request ID taken from the body.
   if(req.body!==undefined&&
    (!req.body||typeof req.body!=="object"||
     Array.isArray(req.body)||Object.keys(req.body).length!==0)){
    res.status(400).json({error:{code:"INVALID_INPUT"}});return;
   }
   const actor=await deps.resolveVerifiedActor(req);
   const data=await deps.service.revoke(actor,req.params.orgId,
    req.params.memberId);
   res.status(200).json({scope:"disposable-ci-only",data});
  }catch(error){
   const status=error instanceof P4R28Denied?error.status:503;
   const code=error instanceof P4R28Denied?error.code:"UNAVAILABLE";
   res.status(status).json({error:{code}});
  }
 });
 return router;
}
