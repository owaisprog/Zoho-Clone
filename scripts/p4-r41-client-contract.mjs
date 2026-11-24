#!/usr/bin/env node
/** R41 secure test-only typed browser adapter boundary. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const client=read("frontend/src/lib/p4-r41-ci-member-role-client.ts");
const contract=read("frontend/src/lib/p4-r41-ci-member-role-contract.ts");
const smoke=read("scripts/p4-r41-role-fullstack-smoke.ts");
const app=read("frontend/src/components/p4-functional-workspace.tsx");
const server=read("backend/src/app.ts");
for(const s of [app,server]){
 if(s.includes("p4-r41-ci-member-role-")||s.includes("p4-r40-ci-member-roles"))
  throw Error("P4_R41_PRODUCTION_IMPORT_DENIED");
}
for(const p of ["GITHUB_ACTIONS","127.0.0.1","credentials:\"omit\"",
 "redirect:\"error\"","AbortSignal.timeout","INVALID_RESPONSE","no-store, private"]){
 if(!client.includes(p))throw Error("P4_R41_CLIENT_CONTRACT_DRIFT");
}
for(const p of ["Object.keys(obj).sort()","parseP4R41Members","revision","userId"]){
 if(!contract.includes(p))throw Error("P4_R41_RESPONSE_CONTRACT_DRIFT");
}
if(!smoke.includes("P4 R41 typed frontend localhost signed member role HTTP")||
 !smoke.includes("p4_r40_ci.role_events"))
 throw Error("P4_R41_SQL_SMOKE_MISSING");
console.log("P4 R41 typed localhost client and production import boundary PASS; NO_GO");
