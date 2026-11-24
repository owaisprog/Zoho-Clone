/** R48 paginated owner invitation route is only mounted by signed CI router. */
import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R48CiInvitationPager} from "./p4-r48-ci-invitation-pager.js";
export function createP4R48CiInvitationPagerRouter(deps:{
 pager:P4R48CiInvitationPager;
 resolveVerifiedActor(req:Request):Promise<P4R28Actor|null>;
},env:NodeJS.ProcessEnv=process.env):Router{
 assertP4V1CiPrismaEnvironment(env);
 if(env.NODE_ENV==="production"||!deps?.pager||
  typeof deps.resolveVerifiedActor!=="function")
  throw Error("P4_R48_CI_ONLY_ROUTER_DISABLED");
 const router=Router();
 router.use((_req,res,next)=>{
  res.setHeader("Cache-Control","no-store, private");
  res.setHeader("Pragma","no-cache");
  res.setHeader("X-Content-Type-Options","nosniff");
  next();
 });
 router.get("/:orgId/invitations/page",async(req,res)=>{
  try{
   if(Object.keys(req.query).sort().join(",")!=="cursor,q,status")
    throw new P4R28Denied(400,"INVALID_INPUT");
   const actor=await deps.resolveVerifiedActor(req);
   const data=await deps.pager.page(actor,req.params.orgId,
    req.query.status,req.query.q,
    req.query.cursor===""?null:req.query.cursor);
   res.status(200).json({scope:"disposable-ci-only",data});
  }catch(error){
   const status=error instanceof P4R28Denied?error.status:503;
   const code=error instanceof P4R28Denied?error.code:"UNAVAILABLE";
   res.status(status).json({error:{code}});
  }
 });
 return router;
}
