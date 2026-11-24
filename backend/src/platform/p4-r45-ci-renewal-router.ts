/** P4 R45 signed fictional owner renewal endpoint; CI test mounting only. */
import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R45CiRenewalIssuer} from "./p4-r45-ci-renewal-issuer.js";
export function createP4R45CiRenewalRouter(deps:{
 issuer:P4R45CiRenewalIssuer;
 resolveVerifiedActor(req:Request):Promise<P4R28Actor|null>;
},env:NodeJS.ProcessEnv=process.env):Router{
 assertP4V1CiPrismaEnvironment(env);
 if(env.NODE_ENV==="production"||!deps?.issuer||
  typeof deps.resolveVerifiedActor!=="function")
  throw Error("P4_R45_CI_ONLY_ROUTER_DISABLED");
 const router=Router();
 router.use((_req,res,next)=>{
  res.setHeader("Cache-Control","no-store, private");
  res.setHeader("Pragma","no-cache");
  res.setHeader("X-Content-Type-Options","nosniff");
  next();
 });
 router.post("/:orgId/invitations/renew",async(req,res)=>{
  try{
   const actor=await deps.resolveVerifiedActor(req);
   const data=await deps.issuer.renew(actor,req.params.orgId,req.body);
   res.status(201).json({scope:"disposable-ci-only",data});
  }catch(error){
   const status=error instanceof P4R28Denied?error.status:503;
   const code=error instanceof P4R28Denied?error.code:"UNAVAILABLE";
   res.status(status).json({error:{code}});
  }
 });
 return router;
}
