/** R32 CI-only encrypted-outbox issue HTTP adapter. NOT mounted publicly. */
import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R32CiOutboxIssuer} from "./p4-r32-ci-outbox.js";
export function createP4R32CiOutboxRouter(deps:{
 issuer:P4R32CiOutboxIssuer;
 resolveVerifiedActor(req:Request):Promise<P4R28Actor|null>;
}):Router{
 assertP4V1CiPrismaEnvironment(process.env);
 if(process.env.NODE_ENV==="production"||!deps?.issuer||
  typeof deps.resolveVerifiedActor!=="function")
  throw Error("P4_R32_CI_ONLY_ROUTER_DISABLED");
 const router=Router();
 router.use((_req,res,next)=>{
  res.setHeader("Cache-Control","no-store, private");
  res.setHeader("Pragma","no-cache");
  res.setHeader("X-Content-Type-Options","nosniff");
  next();
 });
 router.post("/:orgId/issue",async(req,res)=>{
  try{
   const actor=await deps.resolveVerifiedActor(req);
   const data=await deps.issuer.issue(actor,req.params.orgId,req.body);
   res.status(201).json({scope:"disposable-ci-only",data});
  }catch(error){
   const status=error instanceof P4R28Denied?error.status:503;
   const code=error instanceof P4R28Denied?error.code:"UNAVAILABLE";
   res.status(status).json({error:{code}});
  }
 });
 return router;
}
