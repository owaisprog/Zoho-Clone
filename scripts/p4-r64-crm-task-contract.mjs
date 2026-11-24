#!/usr/bin/env node
/** R64 CRM task owner, CAS, append-only audit and no live application activation. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const required=[
 ["backend/db/candidates/043_p4_r64_ci_crm_followup_tasks.sql",
  ["zoho_clone_synthetic_ci","SECURITY DEFINER","require_current_owner",
   "FOR UPDATE","r64_task_event_immutable",
   "FORCE ROW LEVEL SECURITY","GRANT EXECUTE ON FUNCTION"]],
 ["backend/src/platform/p4-r64-ci-lead-tasks.ts",
  ["SET LOCAL ROLE p4_synthetic_ci_runtime",
   "p4_r64_ci.create_task","p4_r64_ci.complete_task",
   "p4_r64_ci.list_tasks","rows.rows.length>20"]],
 ["backend/src/platform/p4-r64-ci-lead-tasks-router.ts",
  ['"/:orgId/leads/:leadId/tasks"','"/:orgId/leads/:leadId/tasks/:taskId/complete"',
   "resolveVerifiedActor(req)"]],
 ["frontend/src/lib/p4-r64-ci-task-client.ts",
  ["parseP4R64Task",'credentials:"omit"',
   "INVALID_RESPONSE","expectedRevision"]],
 ["scripts/p4-r64-crm-task-smoke.ts",
  ["P4 R64 signed real CRM follow-up due tasks",
   "real-immutable-task-event-audit",
   "duplicate-and-wrong-lead-completion-rejected"]],
];
for(const [path,fragments] of required)
 for(const fragment of fragments)
  if(!read(path).includes(fragment))
   throw Error("P4_R64_TASK_SOURCE_BOUNDARY_DRIFT");
for(const file of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/app/page.tsx","frontend/src/app/layout.tsx"]){
 if(read(file).includes("p4-r64-ci-"))
  throw Error("P4_R64_LIVE_APP_IMPORT_DENIED");
}
console.log("P4 R64 signed owner CRM task CAS, immutable audit and no live app import PASS; NO_GO");
