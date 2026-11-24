#!/usr/bin/env node
/** R62 functional CRM React UI remains isolated from public Next.js routes. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const checks=[
 ["frontend/src/lib/p4-r62-ci-crm-workspace-controller.ts",
  ["this.owners.list()","this.pager.page(","this.leads.create(",
   "this.stages.history(","this.stages.change(","this.notes.add(",
   "this.notes.list(","reset():void"]],
 ["frontend/src/components/p4-r62-ci-crm-workspace.tsx",
  ['"use client"',"P4R59CiCrmWorkspacePanel",
   "P4R62CiCrmWorkspaceBound","Load more leads",
   "Search persisted leads","Lead follow-up notes","Save follow-up note"]],
 ["frontend/test/p4-r62-ci-crm-workspace-complete.test.ts",
  ["renderToStaticMarkup","20+5 pages","immutable history",
   "revoked owner"]],
 ["scripts/p4-r62-crm-workspace-fullstack-smoke.ts",
  ["P4 R62 signed actual React CRM 25 leads 20+5",
   "select-older-lead-on-page-two","write-then-reread-immutable-follow-up-note",
   "nonowner-and-revoked-owner-clear-everything"]],
];
for(const [path,fragments] of checks)
 for(const fragment of fragments)
  if(!read(path).includes(fragment))
   throw Error("P4_R62_SOURCE_CONTRACT_DRIFT");
for(const file of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/app/page.tsx","frontend/src/app/layout.tsx",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 const src=read(file);
 if(src.includes("p4-r62-ci-")||src.includes("P4R62CiCrmWorkspace"))
  throw Error("P4_R62_LIVE_APP_ACTIVATION_DENIED");
}
console.log("P4 R62 signed fictional CRM React pagination notes and no production imports PASS; NO_GO");
