import express,{Router,type Request,type ErrorRequestHandler} from "express";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
import {LeadError} from "./p5-ci-leads.js";
import type {CiP5Forecast} from "./p5-ci-forecast.js";
export function createCiP5ForecastRouter(db:Pick<CiP5Forecast,"forecast"|"saveForecast"|"report">,verified:(req:Request)=>Promise<StageIdentity|null>){
 const router=Router(),path="/:orgId/crm/reports";
 router.use((_q,r,next)=>{r.setHeader("Cache-Control","no-store, private");r.setHeader("X-Content-Type-Options","nosniff");next();});
 router.get(path,async(q,r)=>{try{const x=await verified(q);if(!x){r.status(401).json({status:"denied",applicationAccess:false});return;}
 if(!isCanonicalUuidV4(q.params.orgId)||Object.keys(q.query).some(k=>!["pipelineId","from","to"].includes(k)))throw new LeadError(400);
 r.json({scope:"p5-synthetic",data:await db.report(x,q.params.orgId,q.query.pipelineId,q.query.from,q.query.to),applicationAccess:false});
 }catch(e){r.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}});
 router.get(path+"/forecast/:dealId",async(q,r)=>{try{const x=await verified(q);if(!x){r.status(401).json({status:"denied",applicationAccess:false});return;}
 if(!isCanonicalUuidV4(q.params.orgId)||Object.keys(q.query).length)throw new LeadError(400);
 r.json({scope:"p5-synthetic",data:await db.forecast(x,q.params.orgId,q.params.dealId),applicationAccess:false});
 }catch(e){r.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}});
 router.post(path+"/forecast/:dealId",express.json({limit:"1kb",strict:true}),async(q,r)=>{try{const x=await verified(q);if(!x){r.status(401).json({status:"denied",applicationAccess:false});return;}
 if(!isCanonicalUuidV4(q.params.orgId)||Object.keys(q.query).length||!q.is("application/json"))throw new LeadError(400);
 r.json({scope:"p5-synthetic",data:await db.saveForecast(x,q.params.orgId,q.params.dealId,q.body),applicationAccess:false});
 }catch(e){r.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}});
 const malformed:ErrorRequestHandler=(_e,_q,r,_n)=>{r.status(400).json({status:"denied",applicationAccess:false});};router.use(malformed);return router;
}
