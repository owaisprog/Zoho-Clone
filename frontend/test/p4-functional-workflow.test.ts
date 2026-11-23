import test from "node:test";
import assert from "node:assert/strict";
import {
 INITIAL_SANDBOX,addSandboxOrganization,selectSandboxOrganization,
 addSandboxInvitation,resolveSandboxInvitation,revokeSandboxMember,
 displayedSandboxStatus,SandboxWorkflowError,
} from "../src/lib/p4-functional-workflow";
const NOW=2_000_000_000_000;
function org(){
 return addSandboxOrganization(INITIAL_SANDBOX,
  "Demo Maple Payments","demo-maple-payments").state;
}
function invited(){
 return addSandboxInvitation(org(),"new.member@example.com",NOW).state;
}
const fails=(fn:()=>unknown,code:SandboxWorkflowError["code"])=>{
 assert.throws(fn,e=>e instanceof SandboxWorkflowError&&e.code===code);
};
test("creates a fictional org and owner member atomically in state",()=>{
 const state=org();assert.equal(state.organizations.length,1);
 assert.equal(state.selectedId,state.organizations[0]?.id);
 assert.deepEqual(state.organizations[0]?.members,
  [{email:"demo.owner@example.com",role:"ORG_OWNER",active:true}]);
 assert.equal(INITIAL_SANDBOX.organizations.length,0);
 assert.ok(Object.isFrozen(state.organizations));
});
test("creates and switches two independent demo workspaces",()=>{
 let a=org();
 a=addSandboxOrganization(a,"Demo Cedar Systems","demo-cedar-systems").state;
 const selected=a.organizations[0]!.id;
 a=selectSandboxOrganization(a,selected).state;
 assert.equal(a.selectedId,selected);
 a=addSandboxInvitation(a,"rep@example.com",NOW).state;
 assert.equal(a.organizations[0]?.invitations.length,1);
 assert.equal(a.organizations[1]?.invitations.length,0);
});
test("blocks duplicates, invalid names, slugs, and reserved workspace names",()=>{
 const a=org();
 fails(()=>addSandboxOrganization(a,"Real Merchant","merchant"),"INVALID_INPUT");
 fails(()=>addSandboxOrganization(a,"Demo Admin","demo-admin"),"INVALID_INPUT");
 fails(()=>addSandboxOrganization(a,"Demo Cedar Systems","demo-maple-payments"),"CONFLICT");
 fails(()=>selectSandboxOrganization(a,"sandbox-org-foreign"),"NOT_FOUND");
});
test("pending invite creates no membership, accept adds fictional sales member",()=>{
 const before=invited();const i=before.organizations[0]!.invitations[0]!;
 assert.equal(before.organizations[0]?.members.length,1);
 assert.equal(i.status,"pending");
 assert.equal(displayedSandboxStatus(i,NOW+7*86400000),"expired");
 const after=resolveSandboxInvitation(before,i.id,"accept",NOW+1000).state;
 assert.equal(after.organizations[0]?.members.length,2);
 assert.deepEqual(after.organizations[0]?.members[1],
  {email:"new.member@example.com",role:"SALES_REP",active:true});
 assert.equal(after.organizations[0]?.invitations[0]?.status,"accepted");
});
test("revoke pending invite does not add a member; terminal state immutable",()=>{
 const before=invited();const i=before.organizations[0]!.invitations[0]!.id;
 const after=resolveSandboxInvitation(before,i,"revoke",NOW+10).state;
 assert.equal(after.organizations[0]?.invitations[0]?.status,"revoked");
 assert.equal(after.organizations[0]?.members.length,1);
 fails(()=>resolveSandboxInvitation(after,i,"accept",NOW+20),"INVALID_STATE");
});
test("expired invitation cannot be accepted, can still be revoked",()=>{
 const a=invited();const id=a.organizations[0]!.invitations[0]!.id;
 fails(()=>resolveSandboxInvitation(a,id,"accept",NOW+7*86400000),"INVALID_STATE");
 const b=resolveSandboxInvitation(a,id,"revoke",NOW+7*86400000).state;
 assert.equal(b.organizations[0]?.invitations[0]?.status,"revoked");
});
test("prevents duplicate pending invites and real recipient domains",()=>{
 const a=invited();
 fails(()=>addSandboxInvitation(a,"new.member@example.com",NOW),"CONFLICT");
 fails(()=>addSandboxInvitation(a,"person@realmerchant.com",NOW),"INVALID_INPUT");
 fails(()=>addSandboxInvitation(a,"demo.owner@example.com",NOW),"INVALID_INPUT");
 fails(()=>addSandboxInvitation(a,"rep@example.com",NaN),"INVALID_INPUT");
});
test("revokes a sales member while preserving last owner",()=>{
 const a=invited();const id=a.organizations[0]!.invitations[0]!.id;
 const b=resolveSandboxInvitation(a,id,"accept",NOW+1).state;
 fails(()=>revokeSandboxMember(b,"demo.owner@example.com"),"FORBIDDEN");
 const c=revokeSandboxMember(b,"new.member@example.com").state;
 assert.equal(c.organizations[0]?.members[1]?.active,false);
 assert.equal(c.organizations[0]?.members[0]?.active,true);
 fails(()=>revokeSandboxMember(c,"new.member@example.com"),"NOT_FOUND");
});
test("missing current organization and invite never leak foreign records",()=>{
 const a=org();
 fails(()=>addSandboxInvitation({...a,selectedId:"other"},"a@example.com",NOW),"NOT_FOUND");
 fails(()=>resolveSandboxInvitation(a,"other","accept",NOW),"NOT_FOUND");
});
test("supports 5 organizations and refuses unbounded memory growth",()=>{
 let a=org();
 for(let i=0;i<4;i++){
  a=addSandboxOrganization(a,"Demo Company "+String.fromCharCode(65+i),
   "demo-company-"+i).state;
 }
 assert.equal(a.organizations.length,5);
 fails(()=>addSandboxOrganization(a,"Demo More Company","demo-more"),"INVALID_STATE");
});
test("rejects time travel, invalid timestamps and owner impersonation",()=>{
 const a=invited();const id=a.organizations[0]!.invitations[0]!.id;
 fails(()=>resolveSandboxInvitation(a,id,"accept",NOW-1),"INVALID_INPUT");
 fails(()=>resolveSandboxInvitation(a,id,"accept",NaN),"INVALID_INPUT");
 const modified={...a,organizations:a.organizations.map(o=>({...o,members:[]}))};
 fails(()=>addSandboxInvitation(modified,"someone@example.com",NOW),"FORBIDDEN");
});
test("no external persistence hooks or network credentials are in workflow model",()=>{
 const a=invited();
 assert.equal(JSON.stringify(a).includes("Bearer"),false);
 assert.equal(JSON.stringify(a).includes("token_hash"),false);
 assert.equal(INITIAL_SANDBOX.organizations.length,0);
});
