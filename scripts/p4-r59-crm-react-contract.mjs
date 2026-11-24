#!/usr/bin/env node
/** R59 actual fictional CRM UI controller and normal app import boundary. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const checks=[
 ["frontend/src/lib/p4-r59-ci-crm-workspace-controller.ts",
  ["this.owners.list()","this.leads.list(","this.leads.create(",
   "this.stages.history(","this.stages.change(",
   "selectedLeadId:selection","reset():void","this.epoch"]],
 ["frontend/src/components/p4-r59-ci-crm-workspace.tsx",
  ['"use client"',"P4R59CiCrmWorkspaceBound",
   "CRM Leads","Lead directory","Create Lead",
   "Mark Contacted","Qualify Lead","Mark Lost",
   "Lead details","Final stage"]],
 ["frontend/test/p4-r59-ci-crm-react-workspace.test.ts",
  ["renderToStaticMarkup","tenant","signed stage change",
   "stale read failure"]],
 ["scripts/p4-r59-crm-react-workspace-smoke.ts",
  ["P4 R59 real React CRM lead creation qualification lost audit",
   "real-react-workflow-new-contacted-qualified",
   "tenant-B-has-no-A-data","unauthorized-member-and-revoked-owner-denial"]],
];
for(const [path,required] of checks)
 for(const frag of required)
  if(!read(path).includes(frag))throw Error("P4_R59_CRM_SOURCE_DRIFT");
for(const file of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/app/page.tsx","frontend/src/app/layout.tsx",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 const s=read(file);
 if(s.includes("p4-r59-ci-")||s.includes("P4R59CiCrmWorkspace"))
  throw Error("P4_R59_UNAUTHORIZED_LIVE_APP_ACTIVATION");
}
console.log("P4 R59 functional synthetic CRM React UI, signed tenant/audit model and no live imports PASS; NO_GO");
