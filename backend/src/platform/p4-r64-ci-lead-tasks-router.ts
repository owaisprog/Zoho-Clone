/** R64 signed owner-only fictional CRM task endpoints. */
import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R64CiLeadTasks} from "./p4-r64-ci-lead-tasks.js";
export function createP4R64CiLeadTasksRouter(deps:{
 service:P4R64CiLeadTasks;
 resolveVerifiedActor(req:Request):Promise<P4R28Actor|null>;
},env:NodeJS.ProcessEnv=process.env):Router{
 assertP4V1CiPrismaEnvironment(env);
 if(env.NODE_ENV==="production"||!deps?.service||
  typeof deps.resolveVerifiedActor!=="function")
  throw Error("P4_R64_CI_ONLY_ROUTER_DISABLED");
 const router=Router();
 router.use((_req,res,next)=>{
  res.setHeader("Cache-Control","no-store, private");
  res.setHeader("X-Content-Type-Options","nosniff");next();
 });
 const reply=(res:import("express").Response,e:unknown)=>{
  const status=e instanceof P4R28Denied?e.status:503;
  const code=e instanceof P4R28Denied?e.code:"UNAVAILABLE";
  return res.status(status).json({error:{code}});
 };
 router.get("/:orgId/leads/:leadId/tasks",async(req,res)=>{
  try{
   if(Object.keys(req.query).length!==0)
    throw new P4R28Denied(400,"INVALID_INPUT");
   const actor=await deps.resolveVerifiedActor(req);
   const data=await deps.service.list(actor,req.params.orgId,req.params.leadId);
   res.status(200).json({scope:"disposable-ci-only",data});
  }catch(e){reply(res,e);}
 });
 router.post("/:orgId/leads/:leadId/tasks",async(req,res)=>{
  try{
   if(Object.keys(req.query).length!==0)
    throw new P4R28Denied(400,"INVALID_INPUT");
   const actor=await deps.resolveVerifiedActor(req);
   const data=await deps.service.create(actor,req.params.orgId,
    req.params.leadId,req.body);
   res.status(200).json({scope:"disposable-ci-only",data});
  }catch(e){reply(res,e);}
 });
 router.patch("/:orgId/leads/:leadId/tasks/:taskId/complete",async(req,res)=>{
  try{
   if(Object.keys(req.query).length!==0)
    throw new P4R28Denied(400,"INVALID_INPUT");
   const actor=await deps.resolveVerifiedActor(req);
   const data=await deps.service.complete(actor,req.params.orgId,
    req.params.leadId,req.params.taskId,req.body);
   res.status(200).json({scope:"disposable-ci-only",data});
  }catch(e){reply(res,e);}
 });
 return router;
}
