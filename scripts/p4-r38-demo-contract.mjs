#!/usr/bin/env node
/** P4 R38 demo-only source boundary; not proof of live authorization. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const model=read("frontend/src/lib/p4-functional-workflow.ts");
const ui=read("frontend/src/components/p4-functional-workspace.tsx");
const r37=read("scripts/p4-r37-browser-boundary.mjs");
const required=[
 [model,["export function renewSandboxInvitation(","current.createdAt<=createdAt",
  'status==="expired"||status==="revoked"',"prior.length<=1",
  "Renewed fictional invitation in this tab. No email or link was sent."]],
 [ui,["Renew demo invitation","renewSandboxInvitation(s,inv.id,initialNow())",
  "same fictional membership row","never sends an email"]],
 [r37,["fetch","localStorage","document\\.cookie","renewSandboxInvitation"]],
];
for(const [source,fragments] of required){
 if(fragments.some(part=>!source.includes(part)))throw Error("P4_R38_DEMO_CONTRACT_DRIFT");
}
console.log("P4 R38 fictional invitation renewal/reactivation contract PASS; NO_GO");
