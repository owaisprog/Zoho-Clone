import assert from "node:assert/strict";
import {test} from "node:test";
import {
 INITIAL_SANDBOX,addSandboxOrganization,addSandboxInvitation,
 selectSandboxOrganization,resolveSandboxInvitation,renewSandboxInvitation,
 revokeSandboxMember,acceptSandboxInvitationAsRecipient,
 summarizeSandboxInvitations,SandboxWorkflowError,
} from "../src/lib/p4-functional-workflow";

const NOW=2_000_000_000_000;
const WEEK=7*24*60*60*1000;
function start(){
 let s=addSandboxOrganization(INITIAL_SANDBOX,"Demo R38 One","demo-r38-one").state;
 return addSandboxInvitation(s,"rep@example.com",NOW).state;
}
function denied(fn:()=>unknown,code:SandboxWorkflowError["code"]){
 assert.throws(fn,e=>e instanceof SandboxWorkflowError&&e.code===code);
}
test("R38 expired demo invitation renews with new ID, seven-day window and terminal history",()=>{
 const before=start(),original=before.organizations[0]!.invitations[0]!;
 const renewed=renewSandboxInvitation(before,original.id,NOW+WEEK);
 const org=renewed.state.organizations[0]!;
 assert.equal(org.invitations.length,2);
 assert.equal(org.invitations[0]?.status,"expired");
 assert.equal(org.invitations[1]?.status,"pending");
 assert.notEqual(org.invitations[1]?.id,original.id);
 assert.equal(org.invitations[1]?.createdAt,new Date(NOW+WEEK).toISOString());
 assert.equal(org.invitations[1]?.expiresAt,new Date(NOW+2*WEEK).toISOString());
 assert.equal(before.organizations[0]!.invitations[0]!.status,"pending");
 assert.ok(Object.isFrozen(org.invitations));
 assert.deepEqual(summarizeSandboxInvitations(renewed.state,NOW+WEEK),{
  pending:1,accepted:0,revoked:0,expired:1,activeMembers:1,
 });
});
test("R38 revoked invitation renews without rewriting revoked history",()=>{
 let s=start(),id=s.organizations[0]!.invitations[0]!.id;
 s=resolveSandboxInvitation(s,id,"revoke",NOW+1).state;
 s=renewSandboxInvitation(s,id,NOW+2).state;
 assert.equal(s.organizations[0]!.invitations[0]!.status,"revoked");
 assert.equal(s.organizations[0]!.invitations[1]!.status,"pending");
 denied(()=>renewSandboxInvitation(s,id,NOW+3),"CONFLICT");
});
test("R38 pending and accepted invitations cannot be renewed",()=>{
 const s=start(),id=s.organizations[0]!.invitations[0]!.id;
 denied(()=>renewSandboxInvitation(s,id,NOW+1),"INVALID_STATE");
 const accepted=acceptSandboxInvitationAsRecipient(s,id,"rep@example.com",NOW+1).state;
 denied(()=>renewSandboxInvitation(accepted,id,NOW+2),"INVALID_STATE");
});
test("R38 new acceptance after revocation revives one existing member record",()=>{
 let s=start(),id=s.organizations[0]!.invitations[0]!.id;
 s=acceptSandboxInvitationAsRecipient(s,id,"rep@example.com",NOW+1).state;
 s=revokeSandboxMember(s,"rep@example.com").state;
 assert.equal(s.organizations[0]!.members[1]?.active,false);
 s=addSandboxInvitation(s,"rep@example.com",NOW+2).state;
 id=s.organizations[0]!.invitations[1]!.id;
 s=acceptSandboxInvitationAsRecipient(s,id,"rep@example.com",NOW+3).state;
 assert.equal(s.organizations[0]!.members.length,2);
 assert.equal(s.organizations[0]!.members[1]?.active,true);
 assert.equal(s.organizations[0]!.members[0]?.role,"ORG_OWNER");
 assert.equal(s.organizations[0]!.members[0]?.active,true);
});
test("R38 revocation affects just the selected organization on re-invitation",()=>{
 let s=start();const firstId=s.organizations[0]!.id;
 s=addSandboxOrganization(s,"Demo R38 Two","demo-r38-two").state;
 s=addSandboxInvitation(s,"rep@example.com",NOW).state;
 const second=s.organizations[1]!.invitations[0]!;
 s=resolveSandboxInvitation(s,second.id,"revoke",NOW+1).state;
 s=renewSandboxInvitation(s,second.id,NOW+2).state;
 assert.equal(s.organizations[0]!.invitations.length,1);
 assert.equal(s.organizations[1]!.invitations.length,2);
 s=selectSandboxOrganization(s,firstId).state;
 denied(()=>renewSandboxInvitation(s,second.id,NOW+3),"NOT_FOUND");
});
test("R38 invalid timestamp, time travel, non-existent ID and forged owner fail closed",()=>{
 const s=start(),id=s.organizations[0]!.invitations[0]!.id;
 denied(()=>renewSandboxInvitation(s,id,NaN),"INVALID_INPUT");
 denied(()=>renewSandboxInvitation(s,id,NOW-1),"INVALID_INPUT");
 denied(()=>renewSandboxInvitation(s,"other",NOW+WEEK),"NOT_FOUND");
 const fake={...s,organizations:s.organizations.map(o=>({...o,members:[]}))};
 denied(()=>renewSandboxInvitation(fake,id,NOW+WEEK),"FORBIDDEN");
});
test("R38 renewal is denied if current member already active",()=>{
 const s=start(),id=s.organizations[0]!.invitations[0]!.id;
 const tampered={...s,organizations:s.organizations.map(o=>({
  ...o,members:[...o.members,{email:"rep@example.com",role:"SALES_REP" as const,active:true}]
 }))};
 denied(()=>renewSandboxInvitation(tampered,id,NOW+WEEK),"CONFLICT");
});
test("R38 refuses renewal with another pending invite for the same recipient",()=>{
 let s=start(),id=s.organizations[0]!.invitations[0]!.id;
 s=resolveSandboxInvitation(s,id,"revoke",NOW+1).state;
 s=addSandboxInvitation(s,"rep@example.com",NOW+2).state;
 denied(()=>renewSandboxInvitation(s,id,NOW+3),"CONFLICT");
});
test("R38 cap prevents unlimited renewed invitations",()=>{
 let s=start();
 for(let j=1;j<15;j++){
  const current=s.organizations[0]!.invitations.at(-1)!;
  s=renewSandboxInvitation(s,current.id,NOW+j*WEEK).state;
 }
 assert.equal(s.organizations[0]?.invitations.length,15);
 const last=s.organizations[0]!.invitations.at(-1)!;
 denied(()=>renewSandboxInvitation(s,last.id,NOW+15*WEEK),"INVALID_STATE");
});
test("R38 acceptance prevents duplicate active members even for malformed old state",()=>{
 const s=start(),id=s.organizations[0]!.invitations[0]!.id;
 const bad={...s,organizations:s.organizations.map(o=>({...o,
  members:[...o.members,{email:"rep@example.com",role:"SALES_REP" as const,active:true}]
 }))};
 denied(()=>acceptSandboxInvitationAsRecipient(bad,id,"rep@example.com",NOW+1),"CONFLICT");
});
test("R38 renewed invitation can be accepted only once by matching demo recipient",()=>{
 const s=start(),id=s.organizations[0]!.invitations[0]!.id;
 const next=renewSandboxInvitation(s,id,NOW+WEEK).state;
 const current=next.organizations[0]!.invitations[1]!.id;
 denied(()=>acceptSandboxInvitationAsRecipient(next,current,"wrong@example.com",NOW+WEEK+1),"FORBIDDEN");
 const accepted=acceptSandboxInvitationAsRecipient(next,current,"rep@example.com",NOW+WEEK+1).state;
 denied(()=>acceptSandboxInvitationAsRecipient(accepted,current,"rep@example.com",NOW+WEEK+2),"INVALID_STATE");
 assert.equal(accepted.organizations[0]!.members.length,2);
 assert.equal(JSON.stringify(accepted).includes("token_hash"),false);
});
