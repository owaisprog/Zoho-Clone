/** CI-only signed owner organization discovery, deliberately unmounted elsewhere. */
import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R80CiManagerDirectory} from "./p4-r80-ci-manager-directory.js";
export function createP4R80CiManagerDirectoryRouter(deps:{
 service:P4R80CiManagerDirectory;
 resolveVerifiedActor(req:Request):Promise<P4R28Actor|null>;
},env:NodeJS.ProcessEnv=process.env):Router{
 assertP4V1CiPrismaEnvironment(env);
 if(env.NODE_ENV==="production"||!deps?.service||
  typeof deps.resolveVerifiedActor!=="function")
  throw Error("P4_R80_CI_ONLY_ROUTER_DISABLED");
 const router=Router();
 router.use((_req,res,next)=>{
  res.setHeader("Cache-Control","no-store, private");
  res.setHeader("Pragma","no-cache");
  res.setHeader("X-Content-Type-Options","nosniff");
  next();
 });
 router.get("/manager-organizations",async(req,res)=>{
  try{
   if(Object.keys(req.query).length!==0)
    throw new P4R28Denied(400,"INVALID_INPUT");
   const actor=await deps.resolveVerifiedActor(req);
   const data=await deps.service.list(actor);
   res.status(200).json({scope:"disposable-ci-only",data});
  }catch(e){
   const status=e instanceof P4R28Denied?e.status:503;
   const code=e instanceof P4R28Denied?e.code:"UNAVAILABLE";
   res.status(status).json({error:{code}});
  }
 });
 return router;
}
