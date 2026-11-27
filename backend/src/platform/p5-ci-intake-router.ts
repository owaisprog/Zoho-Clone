import express,{Router,type Request,type ErrorRequestHandler} from "express";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
import {LeadError} from "./p5-ci-leads.js";
import type {CiP5Intake} from "./p5-ci-intake.js";
export function createCiP5IntakeRouter(db:Pick<CiP5Intake,"importLeads"|"importStatus"|"captureLead">,verified:(req:Request)=>Promise<StageIdentity|null>,origin:()=>string){
 const router=Router(),path="/:orgId/crm/imports";
 router.use((_q,r,next)=>{r.setHeader("Cache-Control","no-store, private");r.setHeader("X-Content-Type-Options","nosniff");r.setHeader("Referrer-Policy","no-referrer");next();});
 router.post(path+"/leads",express.json({limit:"16kb",strict:true}),async(q,r)=>{try{const x=await verified(q);if(!x){r.status(401).json({status:"denied",applicationAccess:false});return;}
 if(!isCanonicalUuidV4(q.params.orgId)||Object.keys(q.query).length||!q.is("application/json"))throw new LeadError(400);
 r.json({scope:"p5-synthetic",data:await db.importLeads(x,q.params.orgId,q.body),applicationAccess:false});
 }catch(e){r.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}});
 router.get(path+"/:id",async(q,r)=>{try{const x=await verified(q);if(!x){r.status(401).json({status:"denied",applicationAccess:false});return;}
 if(!isCanonicalUuidV4(q.params.orgId)||Object.keys(q.query).length)throw new LeadError(400);
 r.json({scope:"p5-synthetic",data:await db.importStatus(x,q.params.orgId,q.params.id),applicationAccess:false});
 }catch(e){r.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}});
 // Only mounted by the isolated localhost harness; never in the real app.
 router.post("/public/lead-capture/:token",express.json({limit:"1kb",strict:true}),async(q,r)=>{try{
 if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin())||q.get("origin")!==origin()||Object.keys(q.query).length||!q.is("application/json"))throw new LeadError(403);
 r.json({scope:"p5-synthetic",data:await db.captureLead(q.params.token,q.body),applicationAccess:false});
 }catch(e){r.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}});
 const malformed:ErrorRequestHandler=(_e,_q,r,_n)=>{r.status(400).json({status:"denied",applicationAccess:false});};router.use(malformed);return router;
}
