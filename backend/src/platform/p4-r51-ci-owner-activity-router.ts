/** P4 R51 unmounted owner activity HTTP; signed CI R33 only. */
import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R51CiOwnerActivityService} from "./p4-r51-ci-owner-activity.js";
export function createP4R51CiOwnerActivityRouter(deps:{
 service:P4R51CiOwnerActivityService;
 resolveVerifiedActor(req:Request):Promise<P4R28Actor|null>;
},env:NodeJS.ProcessEnv=process.env):Router{
 assertP4V1CiPrismaEnvironment(env);
 if(env.NODE_ENV==="production"||!deps?.service||
  typeof deps.resolveVerifiedActor!=="function")
  throw Error("P4_R51_CI_ONLY_ROUTER_DISABLED");
 const router=Router();
 router.use((_req,res,next)=>{
  res.setHeader("Cache-Control","no-store, private");
  res.setHeader("Pragma","no-cache");
  res.setHeader("X-Content-Type-Options","nosniff");
  next();
 });
 router.get("/:orgId/activity",async(req,res)=>{
  try{
   if(Object.keys(req.query).join(",")!=="kind")
    throw new P4R28Denied(400,"INVALID_INPUT");
   const actor=await deps.resolveVerifiedActor(req);
   const data=await deps.service.list(actor,req.params.orgId,req.query.kind);
   res.status(200).json({scope:"disposable-ci-only",data});
  }catch(e){
   const status=e instanceof P4R28Denied?e.status:503;
   const code=e instanceof P4R28Denied?e.code:"UNAVAILABLE";
   res.status(status).json({error:{code}});
  }
 });
 return router;
}
