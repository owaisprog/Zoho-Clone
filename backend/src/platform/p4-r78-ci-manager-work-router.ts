import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R78CiManagerWork} from "./p4-r78-ci-manager-work.js";
export function createP4R78CiManagerWorkRouter(service:P4R78CiManagerWork,resolve:(r:Request)=>Promise<P4R28Actor|null>,env=process.env){
 assertP4V1CiPrismaEnvironment(env);const router=Router();
 router.use((_q,r,next)=>{r.setHeader("Cache-Control","no-store, private");r.setHeader("X-Content-Type-Options","nosniff");next();});
 const error=(r:import("express").Response,e:unknown)=>r.status(e instanceof P4R28Denied?e.status:503).json({error:{code:e instanceof P4R28Denied?e.code:"UNAVAILABLE"}});
 const clean=(q:Request)=>{if(Object.keys(q.query).length)throw new P4R28Denied(400,"INVALID_INPUT");};
 router.get("/:orgId/manager-members",async(q,r)=>{try{r.json({scope:"disposable-ci-only",data:await service.members(await resolve(q),q.params.orgId,q.query)});}catch(e){error(r,e);}});
 router.get("/:orgId/manager-work",async(q,r)=>{try{r.json({scope:"disposable-ci-only",data:await service.work(await resolve(q),q.params.orgId,q.query)});}catch(e){error(r,e);}});
 router.post("/:orgId/manager-tasks",async(q,r)=>{try{clean(q);r.json({scope:"disposable-ci-only",data:await service.create(await resolve(q),q.params.orgId,q.body)});}catch(e){error(r,e);}});
 router.patch("/:orgId/manager-tasks/:id",async(q,r)=>{try{clean(q);r.json({scope:"disposable-ci-only",data:await service.reassign(await resolve(q),q.params.orgId,q.params.id,q.body)});}catch(e){error(r,e);}});
 router.patch("/:orgId/manager-deals/:id/stage",async(q,r)=>{try{clean(q);r.json({scope:"disposable-ci-only",data:await service.stage(await resolve(q),q.params.orgId,q.params.id,q.body)});}catch(e){error(r,e);}});
 return router;
}
