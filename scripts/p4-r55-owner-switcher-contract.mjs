#!/usr/bin/env node
/** R55 real React org switcher must not enter live Next.js app until gates. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const checks=[
 ["frontend/src/lib/p4-r55-ci-owner-org-switcher.ts",
  ["this.owners.list()","this.workspace.reset()","selectedId:null",
   "async select(","async discover(","this.workspace.issue",
   "this.workspace.cancel","this.workspace.renew",
   "this.workspace.changeRole","this.workspace.revokeMember"]],
 ["frontend/src/components/p4-r55-ci-owner-org-switcher.tsx",
  ['"use client"',"Active owner organization",
   "P4R53CiOwnerWorkspacePanel","P4R55CiOwnerSwitcherBound",
   "onChange={e=>p.onSelect(e.target.value)}"]],
 ["frontend/test/p4-r55-ci-owner-org-switcher.test.ts",
  ["tenant switch","revoked owner","pending write blocks tenant switch",
   "renderToStaticMarkup"]],
 ["scripts/p4-r55-owner-switcher-smoke.ts",
  ["P4 R55 signed React organization switcher",
   "write-with-selected-tenant-only",
   "fresh-owner-check-after-revocation"]],
];
for(const [path,required] of checks)
 for(const fragment of required)
  if(!read(path).includes(fragment))throw Error("P4_R55_SOURCE_DRIFT");
for(const file of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/app/page.tsx","frontend/src/app/layout.tsx",
 "frontend/src/components/p4-functional-workspace.tsx"]){
 const source=read(file);
 if(source.includes("p4-r55-ci-")||source.includes("P4R55CiOwnerSwitcher"))
  throw Error("P4_R55_LIVE_IMPORT_DENIED");
}
console.log("P4 R55 real CI-only React owner org selector, state reset and no public import PASS; NO_GO");
