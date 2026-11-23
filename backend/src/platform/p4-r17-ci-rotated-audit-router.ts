/** P4 R17 CI-only test endpoint; never imported from production app.ts. */
import {Router,type Request} from "express";
import type {PrismaClient} from "../generated/p4-r7-ci/client.js";
import type {P4VerifiedProviderToken} from "./p4-auth0-subject-bridge.js";
import {resolveP4V1CiActor,type P4V1CiIdentityLookup}
 from "./p4-v1-ci-identity.js";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {readP4R17CiRotatedAuditPage} from "./p4-r17-ci-rotated-audit-page.js";
import type {P4R17CiKeyring} from "./p4-r17-ci-audit-keyring.js";
type Deps=Readonly<{
 prisma:PrismaClient;mappingLookup:P4V1CiIdentityLookup;
 resolveVerifiedSdkEvidence(req:Request):Promise<P4VerifiedProviderToken|null>;
 expectedIssuer:string;expectedAudience:string;nowEpochSeconds():number;
 syntheticKeyring:P4R17CiKeyring;
}>;
export function createP4R17CiRotatedAuditRouter(deps:Deps):Router{
 assertP4V1CiPrismaEnvironment(process.env);
 if(process.env.NODE_ENV==="production"||
  typeof deps?.resolveVerifiedSdkEvidence!=="function"||
  typeof deps?.nowEpochSeconds!=="function"||
  !deps?.syntheticKeyring)throw new Error("P4_R17_CI_ROUTER_DISABLED");
 const router=Router();
 router.get("/:orgId/iam/rotated-audit",async(req,res)=>{
  res.setHeader("Cache-Control","no-store, private");
  res.setHeader("Pragma","no-cache");
  res.setHeader("X-Content-Type-Options","nosniff");
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
   const data=await readP4R17CiRotatedAuditPage(
    deps.prisma,{organizationId:req.params.orgId,actorId},
    {...(q.limit===undefined?{}:{limit:Number(q.limit)}),
     ...(q.cursor===undefined?{}:{cursor:q.cursor as string})},
    deps.nowEpochSeconds(),deps.syntheticKeyring,process.env);
   res.status(200).json({scope:"disposable-ci-only",...data});
  }catch{
   res.status(403).json({error:{code:"P4_ACCESS_DENIED"}});
  }
 });
 return router;
}
