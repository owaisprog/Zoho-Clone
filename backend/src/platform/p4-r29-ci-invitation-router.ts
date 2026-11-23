/** CI-only, unmounted invitation draft API. No real identity or emails. */
import {Router,type Request} from "express";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R28Denied,type P4R28Actor} from "./p4-r28-ci-org-service.js";
import {P4R29CiInvitationService} from "./p4-r29-ci-invitation-service.js";
export type P4R29CiRouterDeps=Readonly<{
 service:P4R29CiInvitationService;
 resolveVerifiedActor(req:Request):Promise<P4R28Actor|null>;
}>;
export function createP4R29CiInvitationRouter(deps:P4R29CiRouterDeps):Router{
 assertP4V1CiPrismaEnvironment(process.env);
 if(process.env.NODE_ENV==="production"||!deps?.service||
  typeof deps.resolveVerifiedActor!=="function")
  throw Error("P4_R29_CI_ONLY_ROUTER_DISABLED");
 const r=Router();
 r.use((_req,res,next)=>{
  res.setHeader("Cache-Control","no-store, private");
  res.setHeader("Pragma","no-cache");next();
 });
 async function run(req:Request,res:import("express").Response,kind:"create"|"list"|"revoke"){
  try{
   const actor=await deps.resolveVerifiedActor(req);
   const org=req.params.orgId;
   const result=kind==="create"?
    await deps.service.create(actor,org,req.body):
    kind==="list"?
    await deps.service.list(actor,org):
    await deps.service.revoke(actor,org,req.params.inviteId);
   res.status(kind==="create"?201:200)
    .json({scope:"disposable-ci-only",data:result});
  }catch(error){
   const status=error instanceof P4R28Denied?error.status:503;
   const code=error instanceof P4R28Denied?error.code:"UNAVAILABLE";
   res.status(status).json({error:{code}});
  }
 }
 r.post("/:orgId/invitations",async(req,res)=>run(req,res,"create"));
 r.get("/:orgId/invitations",async(req,res)=>run(req,res,"list"));
 r.post("/:orgId/invitations/:inviteId/revoke",async(req,res)=>run(req,res,"revoke"));
 return r;
}
