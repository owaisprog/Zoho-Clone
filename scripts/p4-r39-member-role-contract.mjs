#!/usr/bin/env node
/** P4 R39 fictional member role contract, never a live authorization approval. */
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const model=read("frontend/src/lib/p4-functional-workflow.ts");
const ui=read("frontend/src/components/p4-functional-workspace.tsx");
const tests=read("frontend/test/p4-r39-membership-admin.test.ts");
const requirements=[
 [model,["export function getSandboxMemberDirectory(","export function changeSandboxMemberRole(",
  "export function listSandboxRoleChanges(","role:current.role,active:true",
  'role==="SALES_REP"||role==="SALES_MANAGER"',
  'member.role==="SALES_REP"||member.role==="SALES_MANAGER"',
  'org.roleChanges.length<30',"current.role"]],
 [ui,["Search members by email or role","Membership status",
  "Fictional role for ","Role change history","grants no real app or tenant permissions",
  "changeSandboxMemberRole(s,m.email,e.target.value,initialNow())"]],
 [tests,["re-invited revoked manager","duplicate forged member entries",
  "role change history is capped","cannot edit or read roles across"]],
];
for(const [source,fragments] of requirements){
 if(fragments.some(fragment=>!source.includes(fragment)))
  throw Error("P4_R39_MEMBERSHIP_CONTRACT_DRIFT");
}
console.log("P4 R39 fictional member admin, role downgrade and history contract PASS; NO_GO");
