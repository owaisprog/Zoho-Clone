import express,{Router,type Request,type ErrorRequestHandler} from "express";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
import {LeadError} from "./p5-ci-leads.js";
import type {CiP5LeadRules} from "./p5-ci-lead-rules.js";
export function createCiP5LeadRulesRouter(db:CiP5LeadRules,verified:(req:Request)=>Promise<StageIdentity|null>){
 const router=Router(),path="/:orgId/crm";
 const handler=(write:boolean,run:(x:StageIdentity,org:string,id:unknown,body:unknown)=>Promise<unknown>)=>async(q:Request,r:express.Response)=>{
 try{const x=await verified(q);if(!x){r.status(401).json({status:"denied",applicationAccess:false});return;}
 if(!isCanonicalUuidV4(q.params.orgId)||Object.keys(q.query).length||(write&&!q.is("application/json")))throw new LeadError(400);
 r.setHeader("Cache-Control","no-store, private");r.json({scope:"p5-synthetic",data:await run(x,q.params.orgId,q.params.id,q.body),applicationAccess:false});
 }catch(e){r.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}};
 router.get(path+"/lead-sources/:id",handler(false,(x,o,i)=>db.leadRules(x,o,i)));
 router.get(path+"/lead-scoring/:id",handler(false,(x,o,i)=>db.leadRules(x,o,i)));
 router.post(path+"/lead-scoring",express.json({limit:"1kb",strict:true}),handler(true,(x,o,_i,b)=>db.saveScoreRule(x,o,b)));
 router.get(path+"/assignment-rules/:id",handler(false,(x,o,i)=>db.assignmentRulePreview(x,o,i)));
 router.post(path+"/assignment-rules/:id",express.json({limit:"1kb",strict:true}),handler(true,(x,o,i,b)=>db.saveAssignmentRule(x,o,i,b)));
 router.post(path+"/leads/:id/qualify",express.json({limit:"1kb",strict:true}),handler(true,(x,o,i,b)=>db.qualifyWithReason(x,o,i,b)));
 const malformed:ErrorRequestHandler=(_e,_q,r,_n)=>{r.status(400).json({status:"denied",applicationAccess:false});};router.use(malformed);return router;
}
