import express,{Router,type Request,type ErrorRequestHandler} from "express";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
import {LeadError} from "./p5-ci-leads.js";
import type {CiP5Mail} from "./p5-ci-mail.js";
export function createCiP5MailRouter(db:Pick<CiP5Mail,"mail"|"saveMail">,verified:(req:Request)=>Promise<StageIdentity|null>){
 const router=Router();
 router.use((_q,r,next)=>{r.setHeader("Cache-Control","no-store, private");r.setHeader("X-Content-Type-Options","nosniff");next();});
 router.get(["/:orgId/crm/templates","/:orgId/crm/emails/:dealId"],async(q,r)=>{try{const x=await verified(q);if(!x){r.status(401).json({status:"denied",applicationAccess:false});return;}
 if(!isCanonicalUuidV4(q.params.orgId)||Object.keys(q.query).some(k=>k!=="after"))throw new LeadError(400);
 r.json({scope:"p5-synthetic",data:await db.mail(x,q.params.orgId,q.params.dealId??null,q.query.after??null),applicationAccess:false});
 }catch(e){r.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}});
 router.post(["/:orgId/crm/templates/:id","/:orgId/crm/emails/:dealId/:id"],express.json({limit:"2kb",strict:true}),async(q,r)=>{try{const x=await verified(q);if(!x){r.status(401).json({status:"denied",applicationAccess:false});return;}
 if(!isCanonicalUuidV4(q.params.orgId)||Object.keys(q.query).length||!q.is("application/json"))throw new LeadError(400);
 r.json({scope:"p5-synthetic",data:await db.saveMail(x,q.params.orgId,q.params.dealId??null,q.params.id,q.body),applicationAccess:false});
 }catch(e){r.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}});
 const malformed:ErrorRequestHandler=(_e,_q,r,_n)=>{r.status(400).json({status:"denied",applicationAccess:false});};router.use(malformed);return router;
}
