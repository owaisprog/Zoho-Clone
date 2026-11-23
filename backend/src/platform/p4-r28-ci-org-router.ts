/**
 * CI-only HTTP adapter for a real PostgreSQL transactional organization workflow.
 * UNMOUNTED in src/app.ts and src/server.ts. In production this constructor
 * always throws. Synthetic identity is supplied ONLY by trusted CI fixtures.
 */
import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28CiOrganizationService,P4R28Denied,type P4R28Actor}
 from "./p4-r28-ci-org-service.js";
export type P4R28RouterDeps=Readonly<{
 service:P4R28CiOrganizationService;
 resolveVerifiedActor(req:Request):Promise<P4R28Actor|null>;
}>;
export function createP4R28CiOrgRouter(deps:P4R28RouterDeps):Router{
 assertP4V1CiPrismaEnvironment(process.env);
 if(process.env.NODE_ENV==="production"||!deps?.service||
  typeof deps.resolveVerifiedActor!=="function")
  throw new Error("P4_R28_CI_ONLY_ROUTER_DISABLED");
 const router=Router();
 router.use((_req,res,next)=>{
  res.setHeader("Cache-Control","no-store, private");
  res.setHeader("Pragma","no-cache");
  next();
 });
 async function run(req:Request,res:import("express").Response,create:boolean){
  try{
   const actor=await deps.resolveVerifiedActor(req);
   const result=create?
    await deps.service.create(actor,req.body):
    await deps.service.read(actor,req.params.orgId);
   res.status(create?201:200).json({scope:"disposable-ci-only",data:result});
  }catch(error){
   const status=error instanceof P4R28Denied?error.status:503;
   const code=error instanceof P4R28Denied?error.code:"UNAVAILABLE";
   res.status(status).json({error:{code}});
  }
 }
 router.post("/",async(req,res)=>run(req,res,true));
 router.get("/:orgId",async(req,res)=>run(req,res,false));
 return router;
}
