/** P4 Batch 17: CI-only audit pages with explicit rotation and fresh grants. */
import type {PrismaClient} from "../generated/p4-r7-ci/client.js";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R7CiReadDeniedError,type P4R7CiScope}
 from "./p4-r7-ci-prisma-reader.js";
import {readP4R15CiAuditPage,type P4R15AuditEvent}
 from "./p4-r15-ci-audit-page.js";
import {issueP4R17CiRotatingCursor,verifyP4R17CiRotatingCursor,
 type P4R17CiKeyring} from "./p4-r17-ci-audit-keyring.js";
export type P4R17AuditPage=Readonly<{
 data:readonly P4R15AuditEvent[];nextCursor:string|null;
}>;
export async function readP4R17CiRotatedAuditPage(
 prisma:PrismaClient,scope:P4R7CiScope,
 options:Readonly<{limit?:number;cursor?:string}>,
 nowSeconds:number,ring:P4R17CiKeyring,
 env:NodeJS.ProcessEnv=process.env,
):Promise<P4R17AuditPage>{
 try{assertP4V1CiPrismaEnvironment(env);}
 catch{throw new P4R7CiReadDeniedError();}
 const limit=options?.limit??20;
 // Ensure a fully validated ring even for the empty or final page.
 // This also prevents issuing a successful response with no configured key.
 const validatorId="70000000-0000-4000-8000-000000000001";
 issueP4R17CiRotatingCursor(scope,validatorId,limit,nowSeconds,ring);
 const after=options?.cursor===undefined?null:
  verifyP4R17CiRotatingCursor(
   options.cursor,scope,limit,nowSeconds,ring);
 const page=await readP4R15CiAuditPage(prisma,scope,
  {limit,afterId:after},env);
 if(page.nextCursor===null)
  return Object.freeze({data:page.data,nextCursor:null});
 return Object.freeze({
  data:page.data,nextCursor:issueP4R17CiRotatingCursor(
   scope,page.nextCursor,limit,nowSeconds,ring),
 });
}
