#!/usr/bin/env node
/** R65 actual React CRM task UI and signed 25-note integration, CI-only. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const checks=[
 ["frontend/src/lib/p4-r62-ci-crm-workspace-controller.ts",
  ["private async readNotes(","this.notePages.page(",
   "return this.notes.list("]],
 ["frontend/src/components/p4-r62-ci-crm-workspace.tsx",
  ["Load more notes","onMoreNotes","displayedNotes"]],
 ["frontend/src/lib/p4-r65-ci-followup-workspace-controller.ts",
  ["this.crm.changeStage(","this.notePages.page(",
   "this.tasksApi.create(","this.tasksApi.complete(",
   "this.tasksApi.list(","this.crm.reset()","reset():void"]],
 ["frontend/src/components/p4-r65-ci-followup-workspace.tsx",
  ['"use client"',"P4R65CiFollowUpWorkspaceBound",
   "P4R62CiCrmWorkspacePanel","Add follow-up task",
   "Lead follow-up tasks","Mark Done","onMoreNotes={p.onMoreNotes}"]],
 ["frontend/test/p4-r65-ci-followup-workspace.test.ts",
  ["renderToStaticMarkup","20+5","organization switching",
   "denied task read"]],
 ["scripts/p4-r65-followup-react-smoke.ts",
  ["P4 R65 real React CRM 25 paged notes",
   "write-25-notes-on-real-persisted-lead",
   "task-completed-with-one-use-audit",
   "member-revoked-owner-and-forged-identity-denial"]],
];
for(const [path,needles] of checks)
 for(const n of needles)
  if(!read(path).includes(n))throw Error("P4_R65_REACT_SOURCE_DRIFT");
for(const path of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/app/page.tsx","frontend/src/app/layout.tsx",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 const content=read(path);
 if(content.includes("p4-r65-ci-")||content.includes("P4R65CiFollowUp"))
  throw Error("P4_R65_PRODUCTION_UI_ACTIVATION_DENIED");
}
console.log("P4 R65 React follow-up tasks and paged notes CI boundary PASS; NO_GO");
