/** R68 signed owner-only cross-lead due queue HTTP route; CI only. */
import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R68CiDueQueue} from "./p4-r68-ci-due-queue.js";
export function createP4R68CiDueQueueRouter(deps:{
 queue:P4R68CiDueQueue;
 resolveVerifiedActor(req:Request):Promise<P4R28Actor|null>;
},env:NodeJS.ProcessEnv=process.env):Router{
 assertP4V1CiPrismaEnvironment(env);
 if(env.NODE_ENV==="production"||!deps?.queue||
  typeof deps.resolveVerifiedActor!=="function")
  throw Error("P4_R68_CI_ONLY_ROUTER_DISABLED");
 const router=Router();
 router.use((_req,res,next)=>{
  res.setHeader("Cache-Control","no-store, private");
  res.setHeader("X-Content-Type-Options","nosniff");next();
 });
 router.get("/:orgId/tasks/due",async(req,res)=>{
  try{
   if(Object.keys(req.query).sort().join(",")!=="cursor,through")
    throw new P4R28Denied(400,"INVALID_INPUT");
   const actor=await deps.resolveVerifiedActor(req);
   const data=await deps.queue.page(actor,req.params.orgId,req.query.through,
    req.query.cursor===""?null:req.query.cursor);
   res.status(200).json({scope:"disposable-ci-only",data});
  }catch(e){
   const status=e instanceof P4R28Denied?e.status:503;
   const code=e instanceof P4R28Denied?e.code:"UNAVAILABLE";
   res.status(status).json({error:{code}});
  }
 });
 return router;
}
