/** P4 R30 CI ONLY: recipient redemption route, never mounted in main app. */
import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R30CiAcceptanceService} from "./p4-r30-ci-invitation-acceptance.js";

export type P4R30Deps=Readonly<{
 service:P4R30CiAcceptanceService;
 resolveVerifiedActor(req:Request):Promise<P4R28Actor|null>;
}>;
export function createP4R30CiInvitationAcceptanceRouter(deps:P4R30Deps):Router{
 assertP4V1CiPrismaEnvironment(process.env);
 if(process.env.NODE_ENV==="production"||!deps?.service||
  typeof deps.resolveVerifiedActor!=="function")
  throw Error("P4_R30_CI_ONLY_ROUTER_DISABLED");
 const router=Router();
 router.use((_req,res,next)=>{
  res.setHeader("Cache-Control","no-store, private");
  res.setHeader("Pragma","no-cache");
  res.setHeader("X-Content-Type-Options","nosniff");
  next();
 });
 router.post("/accept",async(req,res)=>{
  try{
   const actor=await deps.resolveVerifiedActor(req);
   const result=await deps.service.accept(actor,req.body);
   res.status(200).json({scope:"disposable-ci-only",data:result});
  }catch(error){
   const status=error instanceof P4R28Denied?error.status:503;
   const code=error instanceof P4R28Denied?error.code:"UNAVAILABLE";
   res.status(status).json({error:{code}});
  }
 });
 return router;
}
