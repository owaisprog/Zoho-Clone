/** CI-only signed audit cursor router. Never imported from app.ts. */
import {Router,type Request} from "express";
import type {PrismaClient} from "../generated/p4-r7-ci/client.js";
import type {P4VerifiedProviderToken} from "./p4-auth0-subject-bridge.js";
import {resolveP4V1CiActor,type P4V1CiIdentityLookup}
 from "./p4-v1-ci-identity.js";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {readP4R16CiSignedAuditPage}
 from "./p4-r16-ci-signed-audit-page.js";
type Deps=Readonly<{
 prisma:PrismaClient;mappingLookup:P4V1CiIdentityLookup;
 resolveVerifiedSdkEvidence(req:Request):Promise<P4VerifiedProviderToken|null>;
 expectedIssuer:string;expectedAudience:string;nowEpochSeconds():number;
 syntheticSigningKey:string;
}>;
export function createP4R16CiAuditTestRouter(deps:Deps):Router{
 assertP4V1CiPrismaEnvironment(process.env);
 if(process.env.NODE_ENV==="production"||
  typeof deps?.resolveVerifiedSdkEvidence!=="function"||
  typeof deps?.nowEpochSeconds!=="function"||
  typeof deps?.syntheticSigningKey!=="string")
  throw new Error("P4_R16_CI_ROUTER_DISABLED");
 const r=Router();
 r.get("/:orgId/iam/signed-audit",async(req,res)=>{
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
  const q=req.query;
  if(typeof req.params.orgId!=="string"||
   Object.keys(q).some(k=>k!=="limit"&&k!=="cursor")||
   (q.cursor!==undefined&&typeof q.cursor!=="string")||
   (q.limit!==undefined&&(typeof q.limit!=="string"||
    !/^(?:[1-9]|1\d|20)$/.test(q.limit)))){
   res.status(403).json({error:{code:"P4_ACCESS_DENIED"}});
   return;
  }
  try{
   const data=await readP4R16CiSignedAuditPage(
    deps.prisma,{organizationId:req.params.orgId,actorId},
    {...(q.limit===undefined?{}:{limit:Number(q.limit)}),
     ...(q.cursor===undefined?{}:{cursor:q.cursor as string})},
    deps.nowEpochSeconds(),deps.syntheticSigningKey,process.env);
   res.status(200).json({scope:"disposable-ci-only",...data});
  }catch{
   res.status(403).json({error:{code:"P4_ACCESS_DENIED"}});
  }
 });
 return r;
}
