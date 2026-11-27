import express,{Router,type Request,type ErrorRequestHandler} from "express";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
import {LeadError} from "./p5-ci-leads.js";
import type {CiP5Accounts} from "./p5-ci-accounts.js";
export function createCiP5AccountRouter(db:Pick<CiP5Accounts,"accounts"|"account"|"writeAccount">,verified:(req:Request)=>Promise<StageIdentity|null>){
 const router=Router(),scope="/:orgId/crm/accounts";
 router.use((_req,res,next)=>{res.setHeader("Cache-Control","no-store, private");res.setHeader("X-Content-Type-Options","nosniff");next();});
 router.get(scope,async(req,res)=>{
  try{const x=await verified(req);if(!x){res.status(401).json({status:"denied",applicationAccess:false});return;}
   const after=req.query.after??null,duplicate=req.query.duplicate??"0";
   if(!isCanonicalUuidV4(req.params.orgId)||Object.keys(req.query).some(k=>!["after","search","duplicate"].includes(k))||(after!==null&&!isCanonicalUuidV4(after))||(duplicate!=="0"&&duplicate!=="1"))throw new LeadError(400);
   res.json({scope:"p5-synthetic",data:await db.accounts(x,req.params.orgId,after,req.query.search??"",duplicate==="1"),applicationAccess:false});
  }catch(e){res.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}
 });
 router.get(scope+"/:accountId",async(req,res)=>{
  try{const x=await verified(req);if(!x){res.status(401).json({status:"denied",applicationAccess:false});return;}
   if(!isCanonicalUuidV4(req.params.orgId)||!isCanonicalUuidV4(req.params.accountId)||Object.keys(req.query).length)throw new LeadError(400);
   res.json({scope:"p5-synthetic",data:await db.account(x,req.params.orgId,req.params.accountId),applicationAccess:false});
  }catch(e){res.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}
 });
 const write=async(req:Request,res:express.Response)=>{
  try{const x=await verified(req);if(!x){res.status(401).json({status:"denied",applicationAccess:false});return;}
   const org=req.params.orgId,id=req.method==="PATCH"?req.params.accountId:null;
   if(!isCanonicalUuidV4(org)||(id!==null&&!isCanonicalUuidV4(id))||Object.keys(req.query).length||!req.is("application/json"))throw new LeadError(400);
   const data=await db.writeAccount(x,org,id,req.body);res.status(data.outcome==="created"?201:200).json({scope:"p5-synthetic",data,applicationAccess:false});
  }catch(e){res.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}
 };
 router.post(scope,express.json({limit:"1kb",strict:true}),write);
 router.patch(scope+"/:accountId",express.json({limit:"1kb",strict:true}),write);
 const malformed:ErrorRequestHandler=(_err,_req,res,_next)=>{res.status(400).json({status:"denied",applicationAccess:false});};
 router.use(malformed);return router;
}
