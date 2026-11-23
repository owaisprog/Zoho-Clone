import assert from "node:assert/strict";
import test from "node:test";
import {parseSafeInvitationDraft,P4_INVITATION_API_INTEGRATION}
 from "../src/lib/p4-invitation-api-contract";
import {parseP4RecipientAcceptance,P4_RECIPIENT_ACCEPT_API}
 from "../src/lib/p4-invitation-acceptance-contract";

const issued={
 id:"10000000-0000-4000-8000-000000000001",
 organizationId:"10000000-0000-4000-8000-000000000002",
 recipientEmail:"carla@example.com",role:"MEMBER",status:"pending",
 issuedAt:"2030-01-01T00:00:00.000Z",
 expiresAt:"2030-01-03T00:00:00.000Z",version:1,
};
test("R31 issued invitation metadata is compatible with strict R29 UI contract",()=>{
 assert.deepEqual(parseSafeInvitationDraft(issued),issued);
});
test("R31 issued metadata must never contain recipient test token or hash",()=>{
 for(const secret of ["rawToken","token","token_hash","deliveryId"]){
  assert.equal(parseSafeInvitationDraft({...issued,[secret]:"secret"}),null);
 }
});
test("R30 acceptance response remains minimal and frontend network disabled",()=>{
 assert.deepEqual(parseP4RecipientAcceptance({
  scope:"disposable-ci-only",data:{accepted:true,membershipActivated:true},
 }),{accepted:true,membershipActivated:true});
 assert.equal(P4_INVITATION_API_INTEGRATION,
  "DISABLED_PENDING_LIVE_IDENTITY_APPROVAL");
 assert.equal(P4_RECIPIENT_ACCEPT_API,
  "DISABLED_PENDING_APPROVED_AUTH0_AND_RLS");
});
