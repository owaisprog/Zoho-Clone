#!/usr/bin/env node
/** P4 R43 production import, role-reset and safe invitation contract. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("backend/db/candidates/027_p4_r43_ci_member_revoke_reset.sql");
const service=read("backend/src/platform/p4-r43-ci-member-revoke-service.ts");
const router=read("backend/src/platform/p4-r43-ci-member-revoke-router.ts");
const signed=read("backend/src/platform/p4-r33-ci-verified-workflow.ts");
const client=read("frontend/src/lib/p4-r41-ci-member-role-client.ts");
const smoke=read("scripts/p4-r43-member-reactivation-smoke.ts");
for(const [source,patterns] of [
 [sql,["zoho_clone_synthetic_ci","FORCE ROW LEVEL SECURITY",
  "CREATE OR REPLACE FUNCTION p4_r30_ci.redeem_fictional_invitation",
  "reset_after_member_reactivation","role_code='SALES_REP'",
  "revision=revision+1","require_current_owner",
  "current_setting('role',true)","GEN_RANDOM_UUID".toLowerCase(),
  "member.reactivated","member.revoked","REVOKE ALL ON"]],
 [service,["SET LOCAL ROLE p4_synthetic_ci_runtime","randomUUID()",
  "p4_r43_ci.revoke_member","P4003","P4009"]],
 [router,["no-store, private","resolveVerifiedActor(req)",
  "req.body","/:orgId/members/:memberId/revoke"]],
 [signed,["if(deps.revoker)router.use","createP4R43CiMemberRevokeRouter"]],
 [client,["async revoke(","method:\"GET\"|\"PATCH\"|\"POST\"",
  "Object.keys(raw).join(\",\")"]],
 [smoke,["signed atomic member revoke","recipient/accept",
  "membership_events","role_code:\"SALES_REP\""]],
 ]){
 for(const match of patterns)if(!source.includes(match))
  throw Error("P4_R43_SECURITY_CONTRACT_DRIFT");
}
for(const path of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 if(read(path).includes("p4-r43-ci-member-revoke"))
  throw Error("P4_R43_PRODUCTION_IMPORT_DENIED");
}
if(sql.includes("GRANT SELECT ON p4_r43_ci.membership_events")||
 sql.includes("GRANT UPDATE ON p4_r43_ci.membership_events"))
 throw Error("P4_R43_DIRECT_AUDIT_GRANT_DENIED");
console.log("P4 R43 atomic signed revoked member and safe invitation reactivation CI-only boundary PASS; NO_GO");
