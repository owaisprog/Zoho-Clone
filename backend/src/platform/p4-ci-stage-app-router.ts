import {Router,type Request} from "express";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import {AppAccessDenied,type CiStageAppAccess,type Resource} from "./p4-ci-stage-app-access.js";
import type {StageIdentity} from "./staging-membership-db.js";
/** Disposable harness only. Never mount on live routes. */
export function createCiStageAppRouter(db:Pick<CiStageAppAccess,"read">,verified:(req:Request)=>Promise<StageIdentity|null>){
 const router=Router();
 router.get("/:orgId/app/:resource",async(req,res)=>{
  res.setHeader("Cache-Control","no-store, private");res.setHeader("X-Content-Type-Options","nosniff");
  try{
   const identity=await verified(req);
   if(!identity){res.status(401).json({status:"unauthenticated",applicationAccess:false});return;}
   const org=req.params.orgId,resource=req.params.resource,keys=Object.keys(req.query);
   const after=req.query.after??null,id=req.query.id??null;
   if(!isCanonicalUuidV4(org)||!["navigation","leads","lead"].includes(resource)||
    (resource==="navigation"&&keys.length!==0)||(resource==="leads"&&keys.some(x=>x!=="after"))||
    (resource==="lead"&&(keys.length!==1||keys[0]!=="id"))||(after!==null&&!isCanonicalUuidV4(after))||(id!==null&&!isCanonicalUuidV4(id)))throw new AppAccessDenied(403);
   res.json({scope:"disposable-app-read",data:await db.read(identity,org,resource as Resource,after,id),applicationAccess:false});
  }catch(e){const status=e instanceof AppAccessDenied?e.status:503;res.status(status).json({status:status===503?"unavailable":"denied",applicationAccess:false});}
 });
 return router;
}
