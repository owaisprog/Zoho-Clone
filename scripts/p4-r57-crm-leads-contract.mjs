#!/usr/bin/env node
/** R57 owner-scoped persisted fictional CRM, no public import or table grants. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const files=[
 ["backend/db/candidates/038_p4_r57_ci_crm_leads.sql",
 ["zoho_clone_synthetic_ci","SECURITY DEFINER","require_current_owner",
  "UNIQUE(org_id,request_id)","FORCE ROW LEVEL SECURITY",
  "immutable_event","GRANT EXECUTE ON FUNCTION"]],
 ["backend/src/platform/p4-r57-ci-crm-leads.ts",
 ["BEGIN ISOLATION LEVEL REPEATABLE READ","SET LOCAL ROLE p4_synthetic_ci_runtime",
  "p4_r57_ci.create_lead","p4_r57_ci.list_leads",
  "response.rows.length"]],
 ["backend/src/platform/p4-r57-ci-crm-leads-router.ts",
 ['"/:orgId/leads"',"resolveVerifiedActor(req)",
  "no-store, private"]],
 ["frontend/src/lib/p4-r57-ci-crm-lead-client.ts",
 ["parseP4R57LeadList",'credentials:"omit"',
  "INVALID_RESPONSE","no-store, private"]],
 ["scripts/p4-r57-crm-lead-fullstack-smoke.ts",
 ["P4 R57 signed real CRM lead PostgreSQL",
  "immutable-create-event","owner-revocation-clears"]],
];
for(const [path,patterns] of files)
 for(const fragment of patterns)
  if(!read(path).includes(fragment))
   throw Error("P4_R57_SOURCE_BOUNDARY_DRIFT");
for(const path of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/app/page.tsx","frontend/src/app/layout.tsx",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 const s=read(path);
 if(s.includes("p4-r57-ci-")||s.includes("p4_r57_ci"))
  throw Error("P4_R57_PRODUCTION_MOUNT_DENIED");
}
console.log("P4 R57 owner-only persisted fictional CRM and customer app isolation PASS; NO_GO");
