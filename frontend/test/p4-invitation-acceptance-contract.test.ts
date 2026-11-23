import test from "node:test";
import assert from "node:assert/strict";
import {parseP4RecipientAcceptance,P4_RECIPIENT_ACCEPT_API}
 from "../src/lib/p4-invitation-acceptance-contract";
const OK={scope:"disposable-ci-only",
 data:{accepted:true,membershipActivated:true}};
test("accepted membership response has only two safe flags",()=>{
 const v=parseP4RecipientAcceptance(OK);
 assert.deepEqual(v,{accepted:true,membershipActivated:true});
 assert.ok(Object.isFrozen(v));
});
test("response schema cannot include raw invitation token, email or user IDs",()=>{
 for(const injected of [
  {scope:"disposable-ci-only",data:{...OK.data,token:"private"}},
  {scope:"disposable-ci-only",data:{...OK.data,recipientEmail:"user@example.com"}},
  {scope:"disposable-ci-only",data:{...OK.data,organizationId:"foreign"}},
  {...OK,credential:"private"},
 ])assert.equal(parseP4RecipientAcceptance(injected),null);
});
test("rejections, partial grants, wrong shape and scope are never success",()=>{
 for(const bad of [
  null,[],{}, {error:{code:"ACCESS_DENIED"}},
  {scope:"public",data:OK.data},
  {scope:"disposable-ci-only",data:{accepted:false,membershipActivated:true}},
  {scope:"disposable-ci-only",data:{accepted:true,membershipActivated:false}},
 ])assert.equal(parseP4RecipientAcceptance(bad),null);
});
test("real recipient network integration remains unconnected",()=>{
 assert.equal(P4_RECIPIENT_ACCEPT_API,
  "DISABLED_PENDING_APPROVED_AUTH0_AND_RLS");
});
