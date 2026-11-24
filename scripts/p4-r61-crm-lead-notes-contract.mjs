#!/usr/bin/env node
/** R61 append-only CRM notes, no customer-facing route or direct grants. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const checks=[
 ["backend/db/candidates/041_p4_r61_ci_crm_lead_notes.sql",
  ["zoho_clone_synthetic_ci","SECURITY DEFINER","require_current_owner",
   "FORCE ROW LEVEL SECURITY","r61_immutable_notes","GRANT EXECUTE ON FUNCTION"]],
 ["backend/src/platform/p4-r61-ci-lead-notes.ts",
  ["BEGIN ISOLATION LEVEL REPEATABLE READ","SET LOCAL ROLE p4_synthetic_ci_runtime",
   "p4_r61_ci.add_lead_note","p4_r61_ci.list_lead_notes",
   "rows.rows.length>20"]],
 ["backend/src/platform/p4-r61-ci-lead-notes-router.ts",
  ['"/:orgId/leads/:leadId/notes"',"resolveVerifiedActor(req)",
   "no-store, private"]],
 ["frontend/src/lib/p4-r61-ci-lead-notes-client.ts",
  ["parseP4R61LeadNotes",'credentials:"omit"',
   "INVALID_RESPONSE","no-store, private"]],
 ["scripts/p4-r61-crm-lead-notes-smoke.ts",
  ["P4 R61 signed real CRM immutable follow-up notes",
   "note-update-delete-rejected-by-Postgres-trigger",
   "non-owner-and-other-tenant-denied"]],
];
for(const [path,required] of checks)
 for(const fragment of required)
  if(!read(path).includes(fragment))
   throw Error("P4_R61_SOURCE_CONTRACT_DRIFT");
for(const path of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/app/page.tsx","frontend/src/app/layout.tsx",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 const s=read(path);
 if(s.includes("p4-r61-ci-")||s.includes("p4_r61_ci"))
  throw Error("P4_R61_PRODUCTION_IMPORT_DENIED");
}
console.log("P4 R61 immutable fictional CRM note owner tenant and production route boundary PASS; NO_GO");
