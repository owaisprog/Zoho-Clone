import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R76CiSharing} from "./p4-r76-ci-sharing.js";
export function createP4R76CiSharingRouter(service:P4R76CiSharing,resolve:(r:Request)=>Promise<P4R28Actor|null>,env=process.env){
 assertP4V1CiPrismaEnvironment(env);const router=Router();
 router.use((_q,r,next)=>{r.setHeader("Cache-Control","no-store, private");r.setHeader("X-Content-Type-Options","nosniff");next();});
 const error=(r:import("express").Response,e:unknown)=>r.status(e instanceof P4R28Denied?e.status:503).json({error:{code:e instanceof P4R28Denied?e.code:"UNAVAILABLE"}});
 const clean=(q:Request)=>{if(Object.keys(q.query).length)throw new P4R28Denied(400,"INVALID_INPUT");};
 router.get("/:orgId/share-teams",async(q,r)=>{try{clean(q);r.json({scope:"disposable-ci-only",data:await service.teams(await resolve(q),q.params.orgId)});}catch(e){error(r,e);}});
 router.get("/:orgId/shared-records",async(q,r)=>{try{r.json({scope:"disposable-ci-only",data:await service.shared(await resolve(q),q.params.orgId,q.query)});}catch(e){error(r,e);}});
 router.get("/:orgId/shares/:kind/:id",async(q,r)=>{try{clean(q);r.json({scope:"disposable-ci-only",data:await service.get(await resolve(q),q.params.orgId,q.params.kind,q.params.id)});}catch(e){error(r,e);}});
 router.patch("/:orgId/shares/:kind/:id",async(q,r)=>{try{clean(q);r.json({scope:"disposable-ci-only",data:await service.set(await resolve(q),q.params.orgId,q.params.kind,q.params.id,q.body)});}catch(e){error(r,e);}});
 return router;
}
