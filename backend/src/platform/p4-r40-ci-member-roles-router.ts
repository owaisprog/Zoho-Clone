/** P4 R40 signed-fictional-identity Express roles; CI test mounting only. */
import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R40CiMemberRoles} from "./p4-r40-ci-member-roles.js";

export function createP4R40CiMemberRolesRouter(deps:{
 service:P4R40CiMemberRoles;
 resolveVerifiedActor(req:Request):Promise<P4R28Actor|null>;
},env:NodeJS.ProcessEnv=process.env):Router{
 assertP4V1CiPrismaEnvironment(env);
 if(env.NODE_ENV==="production"||!deps?.service||
  typeof deps.resolveVerifiedActor!=="function")
  throw Error("P4_R40_CI_ONLY_ROUTER_DISABLED");
 const router=Router();
 router.use((_req,res,next)=>{
  res.setHeader("Cache-Control","no-store, private");
  res.setHeader("Pragma","no-cache");
  res.setHeader("X-Content-Type-Options","nosniff");
  next();
 });
 router.get("/:orgId/members",async(req,res)=>{
  try{
   const actor=await deps.resolveVerifiedActor(req);
   const data=await deps.service.list(actor,req.params.orgId);
   res.status(200).json({scope:"disposable-ci-only",data});
  }catch(error){
   const status=error instanceof P4R28Denied?error.status:503;
   const code=error instanceof P4R28Denied?error.code:"UNAVAILABLE";
   res.status(status).json({error:{code}});
  }
 });
 router.get("/:orgId/role-history",async(req,res)=>{
  try{
   const actor=await deps.resolveVerifiedActor(req);
   const data=await deps.service.history(actor,req.params.orgId);
   res.status(200).json({scope:"disposable-ci-only",data});
  }catch(error){
   const status=error instanceof P4R28Denied?error.status:503;
   const code=error instanceof P4R28Denied?error.code:"UNAVAILABLE";
   res.status(status).json({error:{code}});
  }
 });
 router.patch("/:orgId/members/:memberId/role",async(req,res)=>{
  try{
   const actor=await deps.resolveVerifiedActor(req);
   const data=await deps.service.change(actor,req.params.orgId,
    req.params.memberId,req.body);
   res.status(200).json({scope:"disposable-ci-only",data});
  }catch(error){
   const status=error instanceof P4R28Denied?error.status:503;
   const code=error instanceof P4R28Denied?error.code:"UNAVAILABLE";
   res.status(status).json({error:{code}});
  }
 });
 return router;
}
