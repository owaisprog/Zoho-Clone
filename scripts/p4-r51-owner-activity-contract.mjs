#!/usr/bin/env node
/** R51 source graph, no production import or private audit table grant. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sources=[
 ["backend/db/candidates/035_p4_r51_ci_owner_activity.sql",
  ["zoho_clone_synthetic_ci","SECURITY DEFINER","require_current_owner",
   "p4_r40_ci.role_events","p4_r43_ci.membership_events",
   "p4_r45_ci.renewal_events","p4_r46_ci.cancellation_events",
   "LIMIT 21","GRANT EXECUTE ON FUNCTION"]],
 ["backend/src/platform/p4-r51-ci-owner-activity.ts",
  ["BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
   "SET LOCAL ROLE p4_synthetic_ci_runtime","p4_r51_ci.owner_activity",
   "data.rows.length>20"]],
 ["backend/src/platform/p4-r51-ci-owner-activity-router.ts",
  ['"/:orgId/activity"',"resolveVerifiedActor(req)","no-store, private"]],
 ["frontend/src/lib/p4-r51-ci-owner-activity-client.ts",
  ["parseP4R51Activity","credentials:\"omit\"",
   "INVALID_RESPONSE","no-store, private"]],
 ["scripts/p4-r51-owner-activity-smoke.ts",
  ["P4 R51 signed owner audit feed",
   "write-genuine-audit-events","owner-revocation-clears"]],
];
for(const [path,needed] of sources)
 for(const fragment of needed)
  if(!read(path).includes(fragment))throw Error("P4_R51_SOURCE_DRIFT");
const sql=read("backend/db/candidates/035_p4_r51_ci_owner_activity.sql");
if(sql.includes("GRANT SELECT ON p4_r40_ci.role_events")||
 sql.includes("GRANT SELECT ON p4_r43_ci.membership_events"))
 throw Error("P4_R51_DIRECT_AUDIT_READ_DENIED");
for(const name of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 const code=read(name);
 if(code.includes("p4-r51-ci-")||code.includes("p4_r51_ci"))
  throw Error("P4_R51_LIVE_MOUNT_DENIED");
}
console.log("P4 R51 fictional signed owner activity and production import isolation PASS; NO_GO");
