import assert from "node:assert/strict";
import test from "node:test";
import {
 parseSafeInvitationDraft,P4_INVITATION_API_INTEGRATION,
} from "../src/lib/p4-invitation-api-contract";
const valid={
 id:"10000000-0000-4000-8000-000000000001",
 organizationId:"10000000-0000-4000-8000-000000000002",
 recipientEmail:"new.member@example.com",
 role:"MEMBER",status:"pending",
 issuedAt:"2030-01-01T00:00:00.000Z",
 expiresAt:"2030-01-03T00:00:00.000Z",version:1,
};
test("safe backend invitation projection parses with immutable allowlisted fields",()=>{
 const parsed=parseSafeInvitationDraft(valid);
 assert.ok(parsed);
 assert.deepEqual(parsed,valid);
 assert.ok(Object.isFrozen(parsed));
});
test("rejects private hash, raw token, wrong owner or unexpected API fields",()=>{
 for(const patch of [{token_hash:"private"},{token:"unsafe"},{ownerId:"forged"}]){
  assert.equal(parseSafeInvitationDraft({...valid,...patch}),null);
 }
});
test("invalid invitations or unresolved dates do not reach state",()=>{
 for(const patch of [
  {id:"not-a-uuid"},{organizationId:"something"},{recipientEmail:"real@merchant.com"},
  {status:"sent"},{role:"OWNER"},{version:0},
  {expiresAt:"2029-12-31T00:00:00.000Z"},
  {issuedAt:"2030-02-30T00:00:00.000Z"},
 ]){
  assert.equal(parseSafeInvitationDraft({...valid,...patch}),null);
 }
 assert.equal(parseSafeInvitationDraft(null),null);
 assert.equal(parseSafeInvitationDraft([]),null);
});
test("network integration is intentionally disabled pending real auth design",()=>{
 assert.equal(P4_INVITATION_API_INTEGRATION,
  "DISABLED_PENDING_LIVE_IDENTITY_APPROVAL");
});
