/** Test-only route factory. Never mount in application entrypoints. */
import express,{Router,type Request,type ErrorRequestHandler} from "express";
import {isCanonicalUuidV4} from "./p4-approved-uuid.js";
import {parseTeamCommand,type CiStageTeamGrants} from "./p4-ci-stage-team-grants.js";
import type {StageIdentity} from "./staging-membership-db.js";
type Verified=(req:Request)=>Promise<StageIdentity|null>;
export function createCiStageTeamRouter(db:Pick<CiStageTeamGrants,"list"|"toggle">,verified:Verified){
 const r=Router();
 r.use((_req,res,next)=>{res.setHeader("Cache-Control","no-store, private");next();});
 r.use(express.json({limit:"1kb",strict:true}));
 const path="/:orgId/targets/:targetId/team-grants";
 r.get(path,async(req,res)=>{
  const id=await verified(req);
  if(!id){res.status(401).json({status:"unauthenticated",applicationAccess:false});return;}
  const after=req.query.after??null,keys=Object.keys(req.query);
  if(!isCanonicalUuidV4(req.params.orgId)||!isCanonicalUuidV4(req.params.targetId)||(keys.length!==0&&(keys.length!==1||keys[0]!=="after"))||(after!==null&&!isCanonicalUuidV4(after))){res.status(403).json({status:"denied",applicationAccess:false});return;}
  try{res.json({status:"verified",...await db.list(id,req.params.orgId,req.params.targetId,after),applicationAccess:false});}
  catch(e){res.status(typeof e==="object"&&e!==null&&"code" in e&&e.code==="42501"?403:503).json({status:typeof e==="object"&&e!==null&&"code" in e&&e.code==="42501"?"denied":"unavailable",applicationAccess:false});}
 });
 r.post(path,async(req,res)=>{
  const id=await verified(req);
  if(!id){res.status(401).json({status:"unauthenticated",applicationAccess:false});return;}
  if(!isCanonicalUuidV4(req.params.orgId)||!isCanonicalUuidV4(req.params.targetId)||Object.keys(req.query).length){res.status(403).json({status:"denied",applicationAccess:false});return;}
  let cmd;try{cmd=parseTeamCommand(req.body);}catch{res.status(400).json({status:"denied",applicationAccess:false});return;}
  try{const status=await db.toggle(id,req.params.orgId,req.params.targetId,cmd);
   res.status(status==="applied"||status==="replay"?200:status==="conflict"?409:status==="denied"?403:503).json({status,applicationAccess:false});
  }catch{res.status(503).json({status:"unavailable",applicationAccess:false});}
 });
 const error:ErrorRequestHandler=(_err,_req,res,_next)=>{res.status(400).json({status:"denied",applicationAccess:false});};
 r.use(error);
 return r;
}
