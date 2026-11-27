import {Router,type Request} from "express";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
import {LeadError} from "./p5-ci-leads.js";
import type {CiP5SalesBoard} from "./p5-ci-sales-board.js";
export function createCiP5SalesBoardRouter(db:Pick<CiP5SalesBoard,"board">,verified:(req:Request)=>Promise<StageIdentity|null>){
 const router=Router();
 router.get("/:orgId/crm/board",async(req,res)=>{
  res.setHeader("Cache-Control","no-store, private");res.setHeader("X-Content-Type-Options","nosniff");
  try{const x=await verified(req);if(!x){res.status(401).json({status:"denied",applicationAccess:false});return;}
   if(!isCanonicalUuidV4(req.params.orgId)||Object.keys(req.query).some(k=>!["pipelineId","search","stage","after"].includes(k)))throw new LeadError(400);
   res.json({scope:"p5-synthetic",data:await db.board(x,req.params.orgId,req.query.pipelineId,req.query.search??"",req.query.stage??null,req.query.after??null),applicationAccess:false});
  }catch(e){res.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}
 });
 return router;
}
