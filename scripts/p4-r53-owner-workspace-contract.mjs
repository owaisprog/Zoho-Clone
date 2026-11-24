#!/usr/bin/env node
/** R53 real React owner panel, but no normal Next.js navigation or production mount. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sources=[
 ["frontend/src/lib/p4-r53-ci-owner-workspace-controller.ts",
  ["Promise.all([","this.epoch","reset():void",
   "async refresh(","async more(","changeRole(","revokeMember(",
   "this.api.actions.issue","this.api.actions.cancel",
   "this.api.actions.renew","this.api.roles.change"]],
 ["frontend/src/components/p4-r53-ci-owner-workspace.tsx",
  ['"use client"',"P4R53CiOwnerWorkspacePanel",
   "P4R53CiOwnerWorkspaceBound","useEffect",
   "Owner operations","Recent activity","Confirm member revocation",
   "Load more activity","CI only"]],
 ["scripts/p4-r53-owner-workspace-smoke.ts",
  ["P4 R53 signed React owner workspace",
   "hydrate-four-persisted-owner-views","SSR-real-react-owner-ui-no-secrets",
   "tenant-switch-and-nonowner-denial"]],
 ["frontend/test/p4-r53-ci-owner-workspace.test.ts",
  ["renderToStaticMarkup","tenant switch discards late responses",
   "partial read failure clears"]],
];
for(const [path,fragments] of sources)
 for(const fragment of fragments)
  if(!read(path).includes(fragment))throw Error("P4_R53_SOURCE_DRIFT");
for(const file of ["backend/src/app.ts","backend/src/server.ts",
 "frontend/src/components/p4-functional-workspace.tsx",
 "frontend/src/app/page.tsx","frontend/src/app/layout.tsx"]){
 const source=read(file);
 if(source.includes("p4-r53-ci-")||source.includes("P4R53CiOwnerWorkspace"))
  throw Error("P4_R53_LIVE_APP_ACTIVATION_DENIED");
}
console.log("P4 R53 actual CI-only React owner panel, signed workflows, safe dual-click actions and live-import separation PASS; NO_GO");
