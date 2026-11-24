import assert from "node:assert/strict";
import {test} from "node:test";
import {
 INITIAL_SANDBOX,addSandboxOrganization,addSandboxInvitation,
 acceptSandboxInvitationAsRecipient,selectSandboxOrganization,
 revokeSandboxMember,changeSandboxMemberRole,getSandboxMemberDirectory,
 listSandboxRoleChanges,SandboxWorkflowError,
} from "../src/lib/p4-functional-workflow";

const NOW=2_000_000_000_000;
function start(){
 let s=addSandboxOrganization(INITIAL_SANDBOX,"Demo R39 Maple","demo-r39-maple").state;
 s=addSandboxInvitation(s,"rep@example.com",NOW).state;
 const id=s.organizations[0]!.invitations[0]!.id;
 return acceptSandboxInvitationAsRecipient(s,id,"rep@example.com",NOW+1).state;
}
function denied(fn:()=>unknown,code:SandboxWorkflowError["code"]){
 assert.throws(fn,e=>e instanceof SandboxWorkflowError&&e.code===code);
}
test("R39 directory scopes sorted, frozen members to selected fictional organization",()=>{
 let s=start();
 s=addSandboxOrganization(s,"Demo R39 Cedar","demo-r39-cedar").state;
 assert.deepEqual(getSandboxMemberDirectory(s,"","all").map(m=>m.email),
  ["demo.owner@example.com"]);
 s=selectSandboxOrganization(s,s.organizations[0]!.id).state;
 const rows=getSandboxMemberDirectory(s,"");
 assert.deepEqual(rows.map(m=>m.email),["demo.owner@example.com","rep@example.com"]);
 assert.ok(Object.isFrozen(rows));
 assert.ok(Object.isFrozen(rows[0]));
});
test("R39 directory searches fictional email/role and filters active and revoked",()=>{
 let s=start();
 assert.deepEqual(getSandboxMemberDirectory(s,"rep","active").map(m=>m.email),
  ["rep@example.com"]);
 assert.equal(getSandboxMemberDirectory(s,"ORG_OWNER").length,1);
 assert.equal(getSandboxMemberDirectory(s,"  SALES_REP  ").length,1);
 s=revokeSandboxMember(s,"rep@example.com").state;
 assert.deepEqual(getSandboxMemberDirectory(s,"","revoked").map(m=>m.email),
  ["rep@example.com"]);
 assert.equal(getSandboxMemberDirectory(s,"rep","active").length,0);
});
test("R39 malformed directory filters, oversized query and nonexistent tenant fail closed",()=>{
 const s=start();
 denied(()=>getSandboxMemberDirectory(s,"a".repeat(65)),"INVALID_INPUT");
 denied(()=>getSandboxMemberDirectory(s,"","other" as "all"),"INVALID_INPUT");
 denied(()=>getSandboxMemberDirectory({...s,selectedId:"outside"},""),"NOT_FOUND");
});
test("R39 role edit updates exactly one active sales rep and appends immutable role event",()=>{
 const s=start(),before=s.organizations[0]!.members[1]!;
 const result=changeSandboxMemberRole(s,"rep@example.com","SALES_MANAGER",NOW+2);
 const org=result.state.organizations[0]!;
 assert.equal(org.members[1]?.role,"SALES_MANAGER");
 assert.equal(org.members[0]?.role,"ORG_OWNER");
 assert.equal(before.role,"SALES_REP");
 assert.equal(org.roleChanges.length,1);
 assert.deepEqual(org.roleChanges[0],{
  id:"sandbox-role-change-"+result.state.revision,
  email:"rep@example.com",fromRole:"SALES_REP",toRole:"SALES_MANAGER",
  occurredAt:new Date(NOW+2).toISOString(),
 });
 assert.ok(Object.isFrozen(org.roleChanges));
 assert.ok(Object.isFrozen(org.roleChanges[0]));
 assert.equal(s.organizations[0]!.roleChanges.length,0);
});
test("R39 role demotion is explicit and an unchanged role is rejected",()=>{
 let s=changeSandboxMemberRole(start(),"rep@example.com","SALES_MANAGER",NOW+2).state;
 denied(()=>changeSandboxMemberRole(s,"rep@example.com","SALES_MANAGER",NOW+3),"CONFLICT");
 s=changeSandboxMemberRole(s,"rep@example.com","SALES_REP",NOW+4).state;
 assert.equal(s.organizations[0]!.members[1]?.role,"SALES_REP");
 assert.deepEqual(listSandboxRoleChanges(s).map(x=>x.toRole),["SALES_REP","SALES_MANAGER"]);
});
test("R39 owner role and revoked member are not editable",()=>{
 let s=start();
 denied(()=>changeSandboxMemberRole(s,"demo.owner@example.com","SALES_REP",NOW+2),
  "FORBIDDEN");
 s=revokeSandboxMember(s,"rep@example.com").state;
 denied(()=>changeSandboxMemberRole(s,"rep@example.com","SALES_MANAGER",NOW+3),
  "FORBIDDEN");
 assert.equal(s.organizations[0]!.members[0]?.active,true);
});
test("R39 rejects invented role, non-example email, unknown member and invalid clock",()=>{
 const s=start();
 denied(()=>changeSandboxMemberRole(s,"rep@example.com","ORG_OWNER",NOW+2),
  "INVALID_INPUT");
 denied(()=>changeSandboxMemberRole(s,"rep@merchant.com","SALES_MANAGER",NOW+2),
  "FORBIDDEN");
 denied(()=>changeSandboxMemberRole(s,"absent@example.com","SALES_MANAGER",NOW+2),
  "NOT_FOUND");
 denied(()=>changeSandboxMemberRole(s,"rep@example.com","SALES_MANAGER",NaN),
  "INVALID_INPUT");
});
test("R39 cannot edit or read roles across selected fictional tenants",()=>{
 let s=start(),first=s.organizations[0]!.id;
 s=addSandboxOrganization(s,"Demo R39 Second","demo-r39-second").state;
 denied(()=>changeSandboxMemberRole(s,"rep@example.com","SALES_MANAGER",NOW+2),
  "NOT_FOUND");
 assert.equal(listSandboxRoleChanges(s).length,0);
 s=selectSandboxOrganization(s,first).state;
 s=changeSandboxMemberRole(s,"rep@example.com","SALES_MANAGER",NOW+2).state;
 assert.equal(listSandboxRoleChanges(s).length,1);
 s=selectSandboxOrganization(s,s.organizations[1]!.id).state;
 assert.equal(listSandboxRoleChanges(s).length,0);
});
test("R39 duplicate forged member entries reject role changes",()=>{
 const s=start(),other=s.organizations[0]!.members[1]!;
 const fake={...s,organizations:s.organizations.map(o=>({...o,
  members:[...o.members,{...other}]
 }))};
 denied(()=>changeSandboxMemberRole(fake,"rep@example.com","SALES_MANAGER",NOW+2),
  "CONFLICT");
});
test("R39 demo role change history is capped to bound in-tab memory",()=>{
 let s=start();
 for(let i=0;i<30;i++){
  s=changeSandboxMemberRole(s,"rep@example.com",
   i%2===0?"SALES_MANAGER":"SALES_REP",NOW+i+2).state;
 }
 assert.equal(listSandboxRoleChanges(s).length,30);
 denied(()=>changeSandboxMemberRole(s,"rep@example.com","SALES_MANAGER",NOW+33),
  "INVALID_STATE");
});
test("R39 re-invited revoked manager receives invitation SALES_REP, never prior manager role",()=>{
 let s=start();
 s=changeSandboxMemberRole(s,"rep@example.com","SALES_MANAGER",NOW+2).state;
 s=revokeSandboxMember(s,"rep@example.com").state;
 s=addSandboxInvitation(s,"rep@example.com",NOW+3).state;
 const id=s.organizations[0]!.invitations.at(-1)!.id;
 s=acceptSandboxInvitationAsRecipient(s,id,"rep@example.com",NOW+4).state;
 assert.equal(s.organizations[0]!.members.length,2);
 assert.equal(s.organizations[0]!.members[1]?.role,"SALES_REP");
 assert.equal(s.organizations[0]!.members[1]?.active,true);
});
test("R39 role events stay fictional and carry no tokens, credentials or real audit claims",()=>{
 let s=start();
 s=changeSandboxMemberRole(s,"rep@example.com","SALES_MANAGER",NOW+2).state;
 const serialized=JSON.stringify(listSandboxRoleChanges(s));
 for(const secret of ["Bearer ","token_hash","Authorization","postgresql://"]){
  assert.equal(serialized.includes(secret),false);
 }
 assert.equal(INITIAL_SANDBOX.organizations.length,0);
});
