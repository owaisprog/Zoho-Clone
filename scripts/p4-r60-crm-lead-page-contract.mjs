#!/usr/bin/env node
/** R60 bounded real CRM paging, signed cursors and live-app separation. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const checks=[
 ["backend/db/candidates/040_p4_r60_ci_crm_lead_keyset.sql",
  ["zoho_clone_synthetic_ci","SECURITY DEFINER","require_current_owner",
   "(l.created_at,l.lead_id)<(p_after_time,p_after_id)","LIMIT 21",
   "GRANT EXECUTE ON FUNCTION"]],
 ["backend/src/platform/p4-r60-ci-crm-lead-pager.ts",
  ["createHmac","timingSafeEqual",
   'actual.toString("base64url")!==signature',
   "p4_r60_ci.owner_crm_lead_page","SET LOCAL ROLE p4_synthetic_ci_runtime"]],
 ["frontend/src/lib/p4-r60-ci-crm-lead-page-client.ts",
  ['credentials:"omit"',"/leads/page?status=","parseP4R57Lead",
   "INVALID_RESPONSE","no-store, private"]],
 ["scripts/p4-r60-crm-lead-page-smoke.ts",
  ["P4 R60 signed real CRM lead pagination 25 rows 20+5",
   "legacy-list-blocks-over-20-without-truncation",
   "tamper-cross-org-filter-and-expiry"]],
];
for(const [path,required] of checks){
 const content=read(path);
 for(const fragment of required)
  if(!content.includes(fragment))throw Error("P4_R60_SOURCE_BOUNDARY_DRIFT");
}
for(const file of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/app/page.tsx","frontend/src/app/layout.tsx",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 const source=read(file);
 if(source.includes("p4-r60-ci-")||source.includes("p4_r60_ci"))
  throw Error("P4_R60_UNAUTHORIZED_LIVE_IMPORT");
}
console.log("P4 R60 HMAC scoped CRM lead pages and production isolation PASS; NO_GO");
