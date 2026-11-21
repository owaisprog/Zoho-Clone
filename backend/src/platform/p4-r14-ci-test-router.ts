/** Disposable CI-only HTTP adapter. NEVER imported into backend/src/app.ts. */
import { Router,type Request } from "express";
import type { PrismaClient } from "../generated/p4-r7-ci/client.js";
import type { P4VerifiedProviderToken } from "./p4-auth0-subject-bridge.js";
import {
  resolveP4V1CiActor,type P4V1CiIdentityLookup,
} from "./p4-v1-ci-identity.js";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {
  readP4R14CiOrganization,readP4R14CiRoleSummaries,
} from "./p4-r14-ci-org-role-reader.js";

type Deps=Readonly<{
 prisma:PrismaClient;
 mappingLookup:P4V1CiIdentityLookup;
 resolveVerifiedSdkEvidence(req:Request):Promise<P4VerifiedProviderToken|null>;
 expectedIssuer:string;expectedAudience:string;
 nowEpochSeconds():number;
}>;
export function createP4R14CiTestRouter(deps:Deps):Router{
 assertP4V1CiPrismaEnvironment(process.env);
 if(process.env.NODE_ENV==="production"||
    typeof deps?.resolveVerifiedSdkEvidence!=="function"||
    typeof deps?.nowEpochSeconds!=="function")
  throw new Error("P4_R14_TEST_ROUTER_DISABLED");
 const router=Router();
 async function get(req:Request,res:import("express").Response,kind:"org"|"roles"){
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
  if(typeof req.params.orgId!=="string"||
     Object.keys(req.query).length!==0){
   res.status(403).json({error:{code:"P4_ACCESS_DENIED"}});
   return;
  }
  try{
   const scope={organizationId:req.params.orgId,actorId};
   const data=kind==="org"?
    await readP4R14CiOrganization(deps.prisma,scope,process.env):
    await readP4R14CiRoleSummaries(deps.prisma,scope,20,process.env);
   res.status(200).json({scope:"disposable-ci-only",data});
  }catch{
   res.status(403).json({error:{code:"P4_ACCESS_DENIED"}});
  }
 }
 router.get("/:orgId/iam/organization",async(req,res)=>get(req,res,"org"));
 router.get("/:orgId/iam/role-summaries",async(req,res)=>get(req,res,"roles"));
 return router;
}
