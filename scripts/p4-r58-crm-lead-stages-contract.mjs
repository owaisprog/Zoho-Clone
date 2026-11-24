#!/usr/bin/env node
/** R58 strict owner CRM lead status, immutable audit and no live imports. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const checks=[
 ["backend/db/candidates/039_p4_r58_ci_crm_lead_stage.sql",
  ["zoho_clone_synthetic_ci","SECURITY DEFINER","require_current_owner",
   "FOR UPDATE","prior_rev<>p_expected","p4_r57_ci.lead_events",
   "GRANT EXECUTE ON FUNCTION"]],
 ["backend/src/platform/p4-r58-ci-crm-lead-stages.ts",
  ["BEGIN ISOLATION LEVEL REPEATABLE READ","SET LOCAL ROLE p4_synthetic_ci_runtime",
   "p4_r58_ci.change_lead_status","p4_r58_ci.list_lead_history",
   "Object.freeze(events)"]],
 ["backend/src/platform/p4-r58-ci-crm-lead-stages-router.ts",
  ['"/:orgId/leads/:leadId/status"','"/:orgId/leads/:leadId/history"',
   "resolveVerifiedActor(req)","no-store, private"]],
 ["frontend/src/lib/p4-r58-ci-crm-lead-stage-client.ts",
  ["parseP4R58LeadHistory",'credentials:"omit"',
   "INVALID_RESPONSE","no-store, private"]],
 ["scripts/p4-r58-crm-lead-stages-smoke.ts",
  ["P4 R58 signed CRM persisted NEW-CONTACTED-QUALIFIED/LOST",
   "stale-revision-and-forbidden-skip","SQL-audit-is-truly-immutable"]],
];
for(const [path,patterns] of checks)
 for(const pattern of patterns)
  if(!read(path).includes(pattern))
   throw Error("P4_R58_SOURCE_CONTRACT_DRIFT");
for(const path of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/app/page.tsx","frontend/src/app/layout.tsx"]){
 const s=read(path);
 if(s.includes("p4-r58-ci-")||s.includes("p4_r58_ci"))
  throw Error("P4_R58_LIVE_APP_ROUTE_DENIED");
}
console.log("P4 R58 owner-only CRM stage CAS and immutable audit source contract PASS; NO_GO");
