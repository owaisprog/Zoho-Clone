import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R77CiSearch} from "./p4-r77-ci-search.js";
export function createP4R77CiSearchRouter(service:P4R77CiSearch,resolve:(r:Request)=>Promise<P4R28Actor|null>,env=process.env){
 assertP4V1CiPrismaEnvironment(env);const router=Router();
 router.use((_q,r,next)=>{r.setHeader("Cache-Control","no-store, private");r.setHeader("X-Content-Type-Options","nosniff");next();});
 router.get("/:orgId/search",async(q,r)=>{try{r.json({scope:"disposable-ci-only",data:await service.search(await resolve(q),q.params.orgId,q.query)});}catch(e){r.status(e instanceof P4R28Denied?e.status:503).json({error:{code:e instanceof P4R28Denied?e.code:"UNAVAILABLE"}});}});
 return router;
}
