import { createStageDatabaseReader } from "./staging-membership-db.js";
import { createStageMembershipRouter, readStageIdentityPolicy } from "./staging-membership-auth.js";
/**
 * Single staging composition point. Remains deliberately unmounted until
 * isolated resources, provider policy, and actual preview are approved.
 * Configuration is validated before creating a Prisma adapter.
 */
export function createStageMembershipIntegration(env:Readonly<Record<string,string|undefined>>=process.env){
  const policy=readStageIdentityPolicy(env);
  if(!policy)return null;
  const db=createStageDatabaseReader(env);
  if(!db)return null;
  return {router:createStageMembershipRouter(policy,db.reader,env.P4_STAGE_OWNER_ACTIVATION==="approved"&&env.P4_STAGE_ORG_DIRECTORY_ENABLED==="true"),close:db.close};
}
