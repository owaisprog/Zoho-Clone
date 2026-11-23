/** P4 Batch 15 synthetic CI only, never imported from app.ts. */
import { Router,type Request } from "express";
import type { PrismaClient } from "../generated/p4-r7-ci/client.js";
import type { P4VerifiedProviderToken } from "./p4-auth0-subject-bridge.js";
import { resolveP4V1CiActor,type P4V1CiIdentityLookup } from "./p4-v1-ci-identity.js";
import { assertP4V1CiPrismaEnvironment } from "./p4-v1-ci-prisma.js";
import { readP4R15CiAuditPage } from "./p4-r15-ci-audit-page.js";
type Deps=Readonly<{
 prisma:PrismaClient;
 mappingLookup:P4V1CiIdentityLookup;
 resolveVerifiedSdkEvidence(req:Request):Promise<P4VerifiedProviderToken|null>;
 expectedIssuer:string;expectedAudience:string;
 nowEpochSeconds():number;
}>;
export function createP4R15CiAuditTestRouter(deps:Deps):Router{
 assertP4V1CiPrismaEnvironment(process.env);
 if(process.env.NODE_ENV==="production"||
   typeof deps?.resolveVerifiedSdkEvidence!=="function"||
   typeof deps?.nowEpochSeconds!=="function")
  throw new Error("P4_R15_CI_ROUTER_DISABLED");
 const r=Router();
 r.get("/:orgId/iam/audit-page",async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  let actorId:string;
  try{
   actorId=await resolveP4V1CiActor(
    await deps.resolveVerifiedSdkEvidence(req),
    {issuer:deps.expectedIssuer,audience:deps.expectedAudience},
    deps.mappingLookup,deps.nowEpochSeconds());
  }catch{
   res.status(401).json({error:{code:"P4_IDENTITY_REQUIRED"}});
   return;
  }
  const params=req.query;
  const q=Object.keys(params);
  if(typeof req.params.orgId!=="string"||
     q.some(k=>k!=="limit"&&k!=="afterId")||
     (params.limit!==undefined&&typeof params.limit!=="string")||
     (params.afterId!==undefined&&typeof params.afterId!=="string")||
     (typeof params.limit==="string"&&!/^(?:[1-9]|1\d|20)$/.test(params.limit))){
   res.status(403).json({error:{code:"P4_ACCESS_DENIED"}});
   return;
  }
  try{
   const data=await readP4R15CiAuditPage(deps.prisma,
    {organizationId:req.params.orgId,actorId},
    {...(params.limit===undefined?{}:{limit:Number(params.limit)}),
     ...(params.afterId===undefined?{}:{afterId:params.afterId as string})},
    process.env);
   res.status(200).json({scope:"disposable-ci-only",...data});
  }catch{
   res.status(403).json({error:{code:"P4_ACCESS_DENIED"}});
  }
 });
 return r;
}
