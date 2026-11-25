import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R79CiActivity} from "./p4-r79-ci-activity.js";
export function createP4R79CiActivityRouter(service:P4R79CiActivity,resolve:(r:Request)=>Promise<P4R28Actor|null>,env=process.env){
 assertP4V1CiPrismaEnvironment(env);const router=Router();
 router.use((_q,r,next)=>{r.setHeader("Cache-Control","no-store, private");r.setHeader("X-Content-Type-Options","nosniff");next();});
 const error=(r:import("express").Response,e:unknown)=>r.status(e instanceof P4R28Denied?e.status:503).json({error:{code:e instanceof P4R28Denied?e.code:"UNAVAILABLE"}});
 router.get("/:orgId/activity",async(q,r)=>{try{r.json({scope:"disposable-ci-only",data:await service.history(await resolve(q),q.params.orgId,q.query)});}catch(e){error(r,e);}});
 router.get("/:orgId/workload",async(q,r)=>{try{r.json({scope:"disposable-ci-only",data:await service.workload(await resolve(q),q.params.orgId,q.query)});}catch(e){error(r,e);}});
 return router;
}
