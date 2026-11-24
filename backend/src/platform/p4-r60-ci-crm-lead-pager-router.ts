/** R60 signed CI-only owner lead pagination route. */
import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R60CiCrmLeadPager} from "./p4-r60-ci-crm-lead-pager.js";
export function createP4R60CiCrmLeadPagerRouter(deps:{
 pager:P4R60CiCrmLeadPager;
 resolveVerifiedActor(req:Request):Promise<P4R28Actor|null>;
},env:NodeJS.ProcessEnv=process.env):Router{
 assertP4V1CiPrismaEnvironment(env);
 if(env.NODE_ENV==="production"||!deps?.pager||
  typeof deps.resolveVerifiedActor!=="function")
  throw Error("P4_R60_CI_ONLY_ROUTER_DISABLED");
 const router=Router();
 router.use((_req,res,next)=>{
  res.setHeader("Cache-Control","no-store, private");
  res.setHeader("X-Content-Type-Options","nosniff");
  next();
 });
 router.get("/:orgId/leads/page",async(req,res)=>{
  try{
   if(Object.keys(req.query).sort().join(",")!=="cursor,q,status")
    throw new P4R28Denied(400,"INVALID_INPUT");
   const actor=await deps.resolveVerifiedActor(req);
   const data=await deps.pager.page(actor,req.params.orgId,
    req.query.status,req.query.q,req.query.cursor===""?null:req.query.cursor);
   res.status(200).json({scope:"disposable-ci-only",data});
  }catch(e){
   const status=e instanceof P4R28Denied?e.status:503;
   const code=e instanceof P4R28Denied?e.code:"UNAVAILABLE";
   res.status(status).json({error:{code}});
  }
 });
 return router;
}
