import express,{Router,type Request,type ErrorRequestHandler} from "express";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
import {LeadError} from "./p5-ci-leads.js";
import type {CiP5ExportBulk} from "./p5-ci-export-bulk.js";
export function createCiP5ExportBulkRouter(db:CiP5ExportBulk,verified:(req:Request)=>Promise<StageIdentity|null>){
 const router=Router(),path="/:orgId/crm";
 const handle=(write:boolean,run:(x:StageIdentity,org:string,id:unknown,body:unknown)=>Promise<unknown>)=>async(q:Request,r:express.Response)=>{
 try{r.setHeader("Cache-Control","no-store, private");r.setHeader("X-Content-Type-Options","nosniff");
 const x=await verified(q);if(!x){r.status(401).json({status:"denied",applicationAccess:false});return;}
 if(!isCanonicalUuidV4(q.params.orgId)||Object.keys(q.query).length||(write&&!q.is("application/json")))throw new LeadError(400);
 r.json({scope:"p5-synthetic",data:await run(x,q.params.orgId,q.params.id,q.body),applicationAccess:false});
 }catch(e){r.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}};
 const json=express.json({limit:"6kb",strict:true});
 router.post(path+"/exports",json,handle(true,(x,o,_i,b)=>db.createExport(x,o,b)));
 router.get(path+"/exports/:id",handle(false,(x,o,i)=>db.exportStatus(x,o,i)));
 router.post(path+"/bulk",json,handle(true,(x,o,_i,b)=>db.bulkLeads(x,o,b)));
 const malformed:ErrorRequestHandler=(_e,_q,r,_n)=>{r.status(400).json({status:"denied",applicationAccess:false});};router.use(malformed);return router;
}
