import express,{Router,type Request,type ErrorRequestHandler} from "express";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
import {LeadError} from "./p5-ci-leads.js";
import type {CiP5SearchViews} from "./p5-ci-search-views.js";
export function createCiP5SearchViewsRouter(db:Pick<CiP5SearchViews,"search"|"views"|"saveView">,verified:(req:Request)=>Promise<StageIdentity|null>){
 const router=Router(),search="/:orgId/crm/search",views="/:orgId/crm/saved-views";
 router.use((_q,r,next)=>{r.setHeader("Cache-Control","no-store, private");r.setHeader("X-Content-Type-Options","nosniff");next();});
 router.get(search,async(q,r)=>{try{const x=await verified(q);if(!x){r.status(401).json({status:"denied",applicationAccess:false});return;}
 if(!isCanonicalUuidV4(q.params.orgId)||Object.keys(q.query).some(k=>!["q","entity","afterKind","afterId"].includes(k))||((q.query.afterKind===undefined)!==(q.query.afterId===undefined)))throw new LeadError(400);
 r.json({scope:"p5-synthetic",data:await db.search(x,q.params.orgId,q.query.q??"",q.query.entity??"ALL",q.query.afterId===undefined?null:{kind:q.query.afterKind,id:q.query.afterId}),applicationAccess:false});
 }catch(e){r.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}});
 router.get(views,async(q,r)=>{try{const x=await verified(q);if(!x){r.status(401).json({status:"denied",applicationAccess:false});return;}
 if(!isCanonicalUuidV4(q.params.orgId)||Object.keys(q.query).some(k=>k!=="after"))throw new LeadError(400);
 r.json({scope:"p5-synthetic",data:await db.views(x,q.params.orgId,q.query.after??null),applicationAccess:false});
 }catch(e){r.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}});
 router.post(views+"/:id",express.json({limit:"1kb",strict:true}),async(q,r)=>{try{const x=await verified(q);if(!x){r.status(401).json({status:"denied",applicationAccess:false});return;}
 if(!isCanonicalUuidV4(q.params.orgId)||Object.keys(q.query).length||!q.is("application/json"))throw new LeadError(400);
 r.json({scope:"p5-synthetic",data:await db.saveView(x,q.params.orgId,q.params.id,q.body),applicationAccess:false});
 }catch(e){r.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}});
 const malformed:ErrorRequestHandler=(_e,_q,r,_n)=>{r.status(400).json({status:"denied",applicationAccess:false});};router.use(malformed);return router;
}
