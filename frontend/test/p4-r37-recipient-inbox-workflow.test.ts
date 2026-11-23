import assert from "node:assert/strict";
import {test} from "node:test";
import {
 INITIAL_SANDBOX,addSandboxOrganization,addSandboxInvitation,
 selectSandboxOrganization,resolveSandboxInvitation,
 summarizeSandboxInvitations,getRecipientSandboxInbox,
 acceptSandboxInvitationAsRecipient,SandboxWorkflowError,
} from "../src/lib/p4-functional-workflow";

const NOW=2_000_000_000_000;
const original=()=>{
 let state=addSandboxOrganization(INITIAL_SANDBOX,
  "Demo R37 Maple","demo-r37-maple").state;
 state=addSandboxInvitation(state,"carla@example.com",NOW).state;
 return state;
};
function deny(action:()=>unknown,code:SandboxWorkflowError["code"]){
 assert.throws(action,e=>e instanceof SandboxWorkflowError&&e.code===code);
}
test("R37 summary counts pending invites and active owner in selected org",()=>{
 const s=original();
 assert.deepEqual(summarizeSandboxInvitations(s,NOW),{
  pending:1,accepted:0,revoked:0,expired:0,activeMembers:1,
 });
});
test("R37 inbox shows only matching fictional recipient in selected tenant",()=>{
 let s=original();
 s=addSandboxInvitation(s,"diana@example.com",NOW).state;
 const inbox=getRecipientSandboxInbox(s,"carla@example.com",NOW);
 assert.equal(inbox.length,1);
 assert.equal(inbox[0]?.email,"carla@example.com");
 assert.equal(inbox[0]?.displayedStatus,"pending");
 assert.ok(Object.isFrozen(inbox));
 assert.equal(getRecipientSandboxInbox(s,"nobody@example.com",NOW).length,0);
});
test("R37 recipient identity is a demo input, not a tenant access grant",()=>{
 const s=original(),id=s.organizations[0]!.invitations[0]!.id;
 deny(()=>acceptSandboxInvitationAsRecipient(s,id,"diana@example.com",NOW),
  "FORBIDDEN");
 deny(()=>acceptSandboxInvitationAsRecipient(s,id,"CARLA@example.com",NOW),
  "INVALID_INPUT");
 deny(()=>acceptSandboxInvitationAsRecipient(s,id,"carla@merchant.com",NOW),
  "INVALID_INPUT");
 assert.equal(s.organizations[0]?.members.length,1);
});
test("R37 fictional recipient acceptance adds exactly one active member",()=>{
 const s=original(),id=s.organizations[0]!.invitations[0]!.id;
 const a=acceptSandboxInvitationAsRecipient(s,id,"carla@example.com",NOW+1);
 assert.equal(a.state.organizations[0]?.invitations[0]?.status,"accepted");
 assert.deepEqual(a.state.organizations[0]?.members[1],{
  email:"carla@example.com",role:"SALES_REP",active:true,
 });
 assert.deepEqual(summarizeSandboxInvitations(a.state,NOW+1),{
  pending:0,accepted:1,revoked:0,expired:0,activeMembers:2,
 });
 deny(()=>acceptSandboxInvitationAsRecipient(
  a.state,id,"carla@example.com",NOW+2),"INVALID_STATE");
});
test("R37 expired and revoked fictional invitations cannot be accepted",()=>{
 const s=original(),id=s.organizations[0]!.invitations[0]!.id;
 const expired=NOW+7*24*60*60*1000;
 assert.equal(getRecipientSandboxInbox(s,"carla@example.com",expired)[0]
  ?.displayedStatus,"expired");
 deny(()=>acceptSandboxInvitationAsRecipient(
  s,id,"carla@example.com",expired),"INVALID_STATE");
 const revoked=resolveSandboxInvitation(s,id,"revoke",NOW+1).state;
 deny(()=>acceptSandboxInvitationAsRecipient(
  revoked,id,"carla@example.com",NOW+2),"INVALID_STATE");
});
test("R37 status summary preserves accepted/revoked/expired categories",()=>{
 let s=original();
 s=addSandboxInvitation(s,"diana@example.com",NOW).state;
 s=addSandboxInvitation(s,"eve@example.com",NOW).state;
 const invites=s.organizations[0]!.invitations;
 s=acceptSandboxInvitationAsRecipient(s,invites[0]!.id,
  "carla@example.com",NOW+1).state;
 s=resolveSandboxInvitation(s,invites[1]!.id,"revoke",NOW+2).state;
 const result=summarizeSandboxInvitations(s,NOW+7*24*60*60*1000);
 assert.deepEqual(result,{
  pending:0,accepted:1,revoked:1,expired:1,activeMembers:2,
 });
});
test("R37 selecting another organization hides current recipient inbox",()=>{
 let s=original();
 const other=addSandboxOrganization(s,"Demo R37 Other","demo-r37-other");
 s=other.state;
 assert.equal(getRecipientSandboxInbox(s,"carla@example.com",NOW).length,0);
 const originalId=s.organizations[0]!.id;
 s=selectSandboxOrganization(s,originalId).state;
 assert.equal(getRecipientSandboxInbox(s,"carla@example.com",NOW).length,1);
});
test("R37 wrong invite IDs and missing organizations do not reveal foreign rows",()=>{
 const s=original();
 deny(()=>acceptSandboxInvitationAsRecipient(
  s,"sandbox-invite-foreign","carla@example.com",NOW),"FORBIDDEN");
 deny(()=>getRecipientSandboxInbox({...s,selectedId:"not-found"},
  "carla@example.com",NOW),"NOT_FOUND");
 deny(()=>summarizeSandboxInvitations(s,Number.NaN),"INVALID_INPUT");
});
test("R37 state never embeds signed JWT, raw token or backend authorization",()=>{
 const s=original();
 const text=JSON.stringify(getRecipientSandboxInbox(s,"carla@example.com",NOW));
 for(const value of ["token_hash","Bearer ","Authorization","postgresql://"]){
  assert.equal(text.includes(value),false);
 }
 assert.equal(INITIAL_SANDBOX.organizations.length,0);
});
