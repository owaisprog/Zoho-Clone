#!/usr/bin/env node
/**
 * P4 R37: static source graph boundary for the WORKING but browser-memory
 * invitation demo. This prevents accidental network and secret persistence
 * until separately approved authenticated APIs exist. Not a browser e2e test.
 */
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
function source(path){return readFileSync(resolve(root,path),"utf8");}
const paths=[
 "frontend/src/lib/p4-functional-workflow.ts",
 "frontend/src/components/p4-functional-workspace.tsx",
 "frontend/src/app/app/organization/workflow/page.tsx",
];
const files=paths.map(source);
const banned=[
 /\bfetch\s*\(/,/\blocalStorage\b/,/\bsessionStorage\b/,
 /\bdocument\.cookie\b/,/\bWebSocket\b/,/\bEventSource\b/,
 /Authorization\s*:/,/\/api\/v1\//,
];
for(const [index,content] of files.entries()){
 if(banned.some(p=>p.test(content)))
  throw Error("P4_R37_BROWSER_BOUNDARY_FAIL_"+index);
}
const [model,ui,page]=files;
if(!model.includes("acceptSandboxInvitationAsRecipient")||
 !model.includes("getRecipientSandboxInbox")||
 !model.includes("summarizeSandboxInvitations")||
 !ui.includes("Simulate recipient acceptance")||
 !ui.includes("This is not a login or identity check")||
 !page.includes("not a live account.")||
 !source("frontend/src/components/workspace-shell.tsx")
  .includes('/app/organization/workflow'))
 throw Error("P4_R37_USER_FACING_GUARD_MISSING");
console.log("P4 R37 separate fictional owner and recipient UI, no network/storage PASS");
