import express,{Router,type Request,type ErrorRequestHandler} from "express";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
import {LeadError} from "./p5-ci-leads.js";
import type {CiP5Pipelines} from "./p5-ci-pipelines.js";
export function createCiP5PipelineRouter(db:Pick<CiP5Pipelines,"pipelines"|"writePipeline">,verified:(req:Request)=>Promise<StageIdentity|null>){
 const router=Router(),scope="/:orgId/crm/pipelines";
 router.use((_q,r,next)=>{r.setHeader("Cache-Control","no-store, private");r.setHeader("X-Content-Type-Options","nosniff");next();});
 router.get(scope,async(req,res)=>{
  try{const x=await verified(req);if(!x){res.status(401).json({status:"denied",applicationAccess:false});return;}
   const after=req.query.after??null;if(!isCanonicalUuidV4(req.params.orgId)||Object.keys(req.query).some(k=>k!=="after")||(after!==null&&!isCanonicalUuidV4(after)))throw new LeadError(400);
   res.json({scope:"p5-synthetic",data:await db.pipelines(x,req.params.orgId,after),applicationAccess:false});
  }catch(e){res.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}
 });
 const write=async(req:Request,res:express.Response)=>{
  try{const x=await verified(req);if(!x){res.status(401).json({status:"denied",applicationAccess:false});return;}
   const org=req.params.orgId,id=req.method==="PATCH"?req.params.pipelineId:null;
   if(!isCanonicalUuidV4(org)||(id!==null&&!isCanonicalUuidV4(id))||Object.keys(req.query).length||!req.is("application/json"))throw new LeadError(400);
   const data=await db.writePipeline(x,org,id,req.body);res.status(data.outcome==="created"?201:200).json({scope:"p5-synthetic",data,applicationAccess:false});
  }catch(e){res.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}
 };
 router.post(scope,express.json({limit:"2kb",strict:true}),write);
 router.patch(scope+"/:pipelineId",express.json({limit:"2kb",strict:true}),write);
 const malformed:ErrorRequestHandler=(_e,_q,r,_n)=>{r.status(400).json({status:"denied",applicationAccess:false});};router.use(malformed);return router;
}
