import express,{Router,type Request,type ErrorRequestHandler} from "express";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
import {LeadError,type CiP5Leads} from "./p5-ci-leads.js";
/** Only the disposable signed-session browser harness mounts this router. */
export function createCiP5LeadRouter(db:Pick<CiP5Leads,"list"|"detail"|"create"|"change"|"history">,verified:(req:Request)=>Promise<StageIdentity|null>){
 const router=Router();
 router.use((_req,res,next)=>{res.setHeader("Cache-Control","no-store, private");res.setHeader("X-Content-Type-Options","nosniff");next();});
 const scope="/:orgId/crm/leads";
 const error=(e:unknown)=>e instanceof LeadError?e.status:503;
 const auth=async(req:Request)=>{const x=await verified(req);return x;};
 router.get(scope,async(req,res)=>{
  try{const x=await auth(req);if(!x){res.status(401).json({status:"denied",applicationAccess:false});return;}
   const after=req.query.after??null,keys=Object.keys(req.query);
   if(!isCanonicalUuidV4(req.params.orgId)||keys.some(k=>!["after","search","source","status"].includes(k))||(after!==null&&!isCanonicalUuidV4(after)))throw new LeadError(400);
   res.json({scope:"p5-synthetic",data:await db.list(x,req.params.orgId,after,{search:req.query.search??"",source:req.query.source??null,status:req.query.status??null}),applicationAccess:false});
  }catch(e){res.status(error(e)).json({status:"denied",applicationAccess:false});}
 });
 router.get(scope+"/:leadId",async(req,res)=>{
  try{const x=await auth(req);if(!x){res.status(401).json({status:"denied",applicationAccess:false});return;}
   if(!isCanonicalUuidV4(req.params.orgId)||!isCanonicalUuidV4(req.params.leadId)||Object.keys(req.query).length)throw new LeadError(400);
   res.json({scope:"p5-synthetic",data:await db.detail(x,req.params.orgId,req.params.leadId),applicationAccess:false});
  }catch(e){res.status(error(e)).json({status:"denied",applicationAccess:false});}
 });
 router.post(scope,express.json({limit:"1kb",strict:true}),async(req,res)=>{
  try{const x=await auth(req);if(!x){res.status(401).json({status:"denied",applicationAccess:false});return;}
   if(!isCanonicalUuidV4(req.params.orgId)||Object.keys(req.query).length||!req.is("application/json"))throw new LeadError(400);
   const data=await db.create(x,req.params.orgId,req.body);res.status(data.outcome==="created"?201:200).json({scope:"p5-synthetic",data,applicationAccess:false});
  }catch(e){res.status(error(e)).json({status:"denied",applicationAccess:false});}
 });
 router.patch(scope+"/:leadId",express.json({limit:"1kb",strict:true}),async(req,res)=>{
  try{const x=await auth(req);if(!x){res.status(401).json({status:"denied",applicationAccess:false});return;}
   if(!isCanonicalUuidV4(req.params.orgId)||!isCanonicalUuidV4(req.params.leadId)||Object.keys(req.query).length||!req.is("application/json"))throw new LeadError(400);
   res.json({scope:"p5-synthetic",data:await db.change(x,req.params.orgId,req.params.leadId,req.body),applicationAccess:false});
  }catch(e){res.status(error(e)).json({status:"denied",applicationAccess:false});}
 });
 router.get(scope+"/:leadId/history",async(req,res)=>{
  try{const x=await auth(req);if(!x){res.status(401).json({status:"denied",applicationAccess:false});return;}
   const keys=Object.keys(req.query),after=req.query.after??"-1";
   if(!isCanonicalUuidV4(req.params.orgId)||!isCanonicalUuidV4(req.params.leadId)||keys.some(k=>k!=="after")||typeof after!=="string"||!(/^(?:-1|0|[1-9][0-9]{0,6})$/).test(after))throw new LeadError(400);
   res.json({scope:"p5-synthetic",data:await db.history(x,req.params.orgId,req.params.leadId,Number(after)),applicationAccess:false});
  }catch(e){res.status(error(e)).json({status:"denied",applicationAccess:false});}
 });
 const malformed:ErrorRequestHandler=(_err,_req,res,_next)=>{res.status(400).json({status:"denied",applicationAccess:false});};
 router.use(malformed);return router;
}
