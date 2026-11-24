#!/usr/bin/env node
/** Owner timeline page remains restricted and disconnected from live SaaS. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sources=[
 ["backend/db/candidates/036_p4_r52_ci_owner_activity_keyset.sql",
  ["zoho_clone_synthetic_ci","SECURITY DEFINER","require_current_owner",
   "(a.at,a.eid)<(p_after_time,p_after_id)","LIMIT 21","key_time",
   "GRANT EXECUTE ON FUNCTION"]],
 ["backend/src/platform/p4-r52-ci-owner-activity-pager.ts",
  ["createHmac","timingSafeEqual",
   'received.toString("base64url")!==signature',
   "p4_r52_ci.owner_activity_page",
   "SET LOCAL ROLE p4_synthetic_ci_runtime","nextCursor"]],
 ["backend/src/platform/p4-r52-ci-owner-activity-pager-router.ts",
  ['"/:orgId/activity/page"',"resolveVerifiedActor(req)"]],
 ["frontend/src/lib/p4-r52-ci-activity-page-client.ts",
  ["parseP4R51Activity",'credentials:"omit"',
   "INVALID_RESPONSE","no-store, private"]],
 ["scripts/p4-r52-owner-activity-keyset-smoke.ts",
  ["P4 R52 signed owner audit pagination",
   "previous-limit-fail-closed","tamper-canonical-and-scope"]],
];
for(const [file,fragments] of sources)
 for(const fragment of fragments)
  if(!read(file).includes(fragment))throw Error("P4_R52_SOURCE_BOUNDARY_DRIFT");
for(const path of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 const code=read(path);
 if(code.includes("p4-r52-ci-")||code.includes("p4_r52_ci"))
  throw Error("P4_R52_LIVE_ROUTE_IMPORT_DENIED");
}
console.log("P4 R52 owner-only canonical HMAC activity keyset and live app isolation PASS; NO_GO");
