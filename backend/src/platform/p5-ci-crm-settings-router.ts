import express,{Router,type Request,type ErrorRequestHandler} from "express";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import type {StageIdentity} from "./staging-membership-db.js";
import {LeadError} from "./p5-ci-leads.js";
import type {CiP5CrmSettings} from "./p5-ci-crm-settings.js";
export function createCiP5CrmSettingsRouter(db:CiP5CrmSettings,verified:(req:Request)=>Promise<StageIdentity|null>){
 const router=Router(),path="/:orgId/crm";
 const handle=(write:boolean,run:(x:StageIdentity,org:string,id:unknown,body:unknown)=>Promise<unknown>)=>async(q:Request,r:express.Response)=>{
 try{const x=await verified(q);if(!x){r.status(401).json({status:"denied",applicationAccess:false});return;}
 if(!isCanonicalUuidV4(q.params.orgId)||Object.keys(q.query).length||(write&&!q.is("application/json")))throw new LeadError(400);
 r.setHeader("Cache-Control","no-store, private");r.json({scope:"p5-synthetic",data:await run(x,q.params.orgId,q.params.id,q.body),applicationAccess:false});
 }catch(e){r.status(e instanceof LeadError?e.status:503).json({status:"denied",applicationAccess:false});}};
 const json=express.json({limit:"1kb",strict:true});
 router.get(path+"/settings",handle(false,(x,o)=>db.crmSettings(x,o)));
 router.patch(path+"/settings",json,handle(true,(x,o,_i,b)=>db.saveCrmSettings(x,o,b)));
 router.get(path+"/accounts/:id/relations",handle(false,(x,o,i)=>db.accountRelations(x,o,i)));
 router.post(path+"/accounts/:id/relations",json,handle(true,(x,o,i,b)=>db.saveRelation(x,o,i,b)));
 router.get(path+"/custom-fields/:id",handle(false,(x,o,i)=>db.customFields(x,o,i)));
 router.post(path+"/custom-fields",json,handle(true,(x,o,_i,b)=>db.createCustomField(x,o,b)));
 router.post(path+"/custom-fields/:id",json,handle(true,(x,o,i,b)=>db.saveCustomValue(x,o,i,b)));
 const malformed:ErrorRequestHandler=(_e,_q,r,_n)=>{r.status(400).json({status:"denied",applicationAccess:false});};router.use(malformed);return router;
}
