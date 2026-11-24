#!/usr/bin/env node
/** P4 R50 aggregate-only, signed CI owner with production import guard. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sources=[
 ["backend/db/candidates/034_p4_r50_ci_owner_operations_summary.sql",
  ["zoho_clone_synthetic_ci","SECURITY DEFINER","require_current_owner",
   "active_members integer","sales_managers integer",
   "membership_events integer","p4_r46_ci.cancellation_events",
   "GRANT EXECUTE ON FUNCTION"]],
 ["backend/src/platform/p4-r50-ci-owner-operations.ts",
  ["BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
   "SET LOCAL ROLE p4_synthetic_ci_runtime",
   "p4_r50_ci.owner_operations_summary","Object.freeze(result)"]],
 ["backend/src/platform/p4-r50-ci-owner-operations-router.ts",
  ['"/:orgId/operations-summary"',"resolveVerifiedActor(req)",
   "no-store, private"]],
 ["frontend/src/lib/p4-r50-ci-owner-summary-client.ts",
  ["parseP4R50OwnerCounts","credentials:\"omit\"",
   "INVALID_RESPONSE","no-store, private"]],
 ["scripts/p4-r50-owner-operations-smoke.ts",
  ["P4 R50 signed owner operational summary",
   "manager-grant-and-audit","owner-revocation-erases-summary"]],
];
for(const [file,needed] of sources)
 for(const item of needed)
  if(!read(file).includes(item))throw Error("P4_R50_SOURCE_CONTRACT_DRIFT");
const sql=read("backend/db/candidates/034_p4_r50_ci_owner_operations_summary.sql");
if(sql.includes("GRANT SELECT ON p4_synthetic.memberships")||
 sql.includes("GRANT SELECT ON p4_r40_ci.role_events"))
 throw Error("P4_R50_UNSAFE_DIRECT_TABLE_GRANTS");
for(const path of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 const data=read(path);
 if(data.includes("p4-r50-ci-")||data.includes("p4_r50_ci"))
  throw Error("P4_R50_LIVE_APP_MOUNT_DENIED");
}
console.log("P4 R50 read-only aggregate-only signed owner metrics and live app boundary PASS; NO_GO");
