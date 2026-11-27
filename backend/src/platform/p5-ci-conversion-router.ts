import express,{Router,type Request,type ErrorRequestHandler} from "express";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
import {LeadError} from "./p5-ci-leads.js";
import type {CiP5Conversion} from "./p5-ci-conversion.js";
export function createCiP5ConversionRouter(db:Pick<CiP5Conversion,"convert"|"deals">,verified:(req:Request)=>Promise<StageIdentity|null>){
 const router=Router();
 router.use((_q,r,next)=>{r.setHeader("Cache-Control","no-store, private");r.setHeader("X-Content-Type-Options","nosniff");next();});
 router.post("/:orgId/crm/leads/:leadId/convert",express.json({limit:"1kb",strict:true}),async(req,res)=>{
  try{const x=await verified(req);if(!x){res.status(401).json({status:"denied",applicationAccess:false});return;}
   if(!isCanonicalUuidV4(req.params.orgId)||!isCanonicalUuidV4(req.params.leadId)||Object.keys(req.query).length||!req.is("application/json"))throw new LeadError(400);
   const data=await db.convert(x,req.params.orgId,req.params.leadId,req.body);
   res.status(data.outcome==="converted"?201:200).json({scope:"p5-synthetic",data,applicationAccess:false});
  }catch(e){res.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}
 });
 router.get("/:orgId/crm/deals",async(req,res)=>{
  try{const x=await verified(req);if(!x){res.status(401).json({status:"denied",applicationAccess:false});return;}
   const after=req.query.after??null;if(!isCanonicalUuidV4(req.params.orgId)||Object.keys(req.query).some(k=>k!=="after")||(after!==null&&!isCanonicalUuidV4(after)))throw new LeadError(400);
   res.json({scope:"p5-synthetic",data:await db.deals(x,req.params.orgId,after),applicationAccess:false});
  }catch(e){res.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}
 });
 const malformed:ErrorRequestHandler=(_e,_q,r,_n)=>{r.status(400).json({status:"denied",applicationAccess:false});};router.use(malformed);return router;
}
