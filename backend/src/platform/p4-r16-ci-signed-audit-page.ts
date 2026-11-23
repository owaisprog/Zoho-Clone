/**
 * P4 Batch 16: CI-only signed pagination over the R15 restricted reader.
 * Each page re-checks active PostgreSQL memberships and entitlement.
 */
import type {PrismaClient} from "../generated/p4-r7-ci/client.js";
import {assertP4V1CiPrismaEnvironment} from "./p4-v1-ci-prisma.js";
import {P4R7CiReadDeniedError,type P4R7CiScope} from "./p4-r7-ci-prisma-reader.js";
import {readP4R15CiAuditPage,type P4R15AuditEvent}
 from "./p4-r15-ci-audit-page.js";
import {issueP4R16CiAuditCursor,verifyP4R16CiAuditCursor}
 from "./p4-r16-ci-signed-audit-cursor.js";
export type P4R16SafeAuditPage=Readonly<{
 data:readonly P4R15AuditEvent[];nextCursor:string|null;
}>;
export async function readP4R16CiSignedAuditPage(
 prisma:PrismaClient,scope:P4R7CiScope,
 options:Readonly<{limit?:number;cursor?:string}>,
 nowSeconds:number,signingKey:string,env:NodeJS.ProcessEnv=process.env,
):Promise<P4R16SafeAuditPage>{
 try{assertP4V1CiPrismaEnvironment(env);}
 catch{throw new P4R7CiReadDeniedError();}
 const limit=options?.limit??20;
 // Validate the parameters before asking PostgreSQL about any resource.
 const after=options?.cursor===undefined?null:
  verifyP4R16CiAuditCursor(options.cursor,scope,limit,nowSeconds,signingKey);
 const page=await readP4R15CiAuditPage(prisma,scope,
  {limit,afterId:after},env);
 if(page.nextCursor===null)
  return Object.freeze({data:page.data,nextCursor:null});
 return Object.freeze({
  data:page.data,
  nextCursor:issueP4R16CiAuditCursor(
   scope,page.nextCursor,limit,nowSeconds,signingKey),
 });
}
