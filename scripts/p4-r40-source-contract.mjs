#!/usr/bin/env node
/** R40 fail-closed source boundary; CI alone is not production approval. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("backend/db/candidates/025_p4_r40_ci_member_sales_roles.sql");
const svc=read("backend/src/platform/p4-r40-ci-member-roles.ts");
const router=read("backend/src/platform/p4-r40-ci-member-roles-router.ts");
const identity=read("backend/src/platform/p4-r33-ci-verified-workflow.ts");
const app=read("backend/src/app.ts");
const server=read("backend/src/server.ts");
const smoke=read("backend/src/scripts/p4-ci-r40-signed-member-roles-smoke.ts");
for(const [source,fragments] of [
 [sql,["zoho_clone_synthetic_ci","SECURITY DEFINER",
  "FORCE ROW LEVEL SECURITY","current_setting('app.actor_id'",
  "ON CONFLICT(org_id,user_id) DO NOTHING",
  "FOR UPDATE","role_events","REVOKE ALL","P4009"]],
 [svc,["assertP4V1CiPrismaEnvironment","SET LOCAL ROLE p4_synthetic_ci_runtime",
  "expectedRevision,role","randomUUID()","P4003","P4009"]],
 [router,["no-store, private","/:orgId/members",
  "/:orgId/members/:memberId/role","resolveVerifiedActor(req)"]],
 [identity,["if(deps.roles)router.use","createP4R40CiMemberRolesRouter"]],
 [smoke,["generateKeyPairSync","concurrent-cas","revocation-and-pool-context",
  "audit-atomic-and-redaction","P4 R40 real signed fictional owner"]],
 ]){
  for(const fragment of fragments)
   if(!source.includes(fragment))throw Error("P4_R40_SOURCE_CONTRACT_FAIL");
}
for(const source of [app,server]){
 if(/p4-r40-ci-|p4-r33-ci-verified-workflow/.test(source))
  throw Error("P4_R40_PRODUCTION_IMPORT_BLOCKED");
}
if(!sql.includes("GRANT EXECUTE ON FUNCTION")||
 sql.includes("GRANT SELECT ON p4_r40_ci")||
 sql.includes("GRANT UPDATE ON p4_r40_ci"))
 throw Error("P4_R40_SQL_GRANT_DRIFT");
console.log("P4 R40 signed CI owner role API, SQL-only function and production import isolation PASS; NO_GO");
