import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R70CiContacts} from "./p4-r70-ci-contacts.js";
export function createP4R70CiContactsRouter(service:P4R70CiContacts,resolve:(r:Request)=>Promise<P4R28Actor|null>,env=process.env){
 assertP4V1CiPrismaEnvironment(env);
 const router=Router();
 router.use((_q,r,next)=>{r.setHeader("Cache-Control","no-store, private");r.setHeader("X-Content-Type-Options","nosniff");next();});
 const error=(r:import("express").Response,e:unknown)=>r.status(e instanceof P4R28Denied?e.status:503).json({error:{code:e instanceof P4R28Denied?e.code:"UNAVAILABLE"}});
 router.get("/:orgId/contacts",async(q,r)=>{try{
  if(Object.keys(q.query).join(",")!=="after")throw new P4R28Denied(400,"INVALID_INPUT");
  r.json({scope:"disposable-ci-only",data:await service.page(await resolve(q),q.params.orgId,q.query.after===""?null:q.query.after)});
 }catch(e){error(r,e);}});
 router.post("/:orgId/contacts",async(q,r)=>{try{
  if(Object.keys(q.query).length)throw new P4R28Denied(400,"INVALID_INPUT");
  r.json({scope:"disposable-ci-only",data:await service.save(await resolve(q),q.params.orgId,null,q.body)});
 }catch(e){error(r,e);}});
 router.patch("/:orgId/contacts/:id",async(q,r)=>{try{
  if(Object.keys(q.query).length)throw new P4R28Denied(400,"INVALID_INPUT");
  r.json({scope:"disposable-ci-only",data:await service.save(await resolve(q),q.params.orgId,q.params.id,q.body)});
 }catch(e){error(r,e);}});
 return router;
}
