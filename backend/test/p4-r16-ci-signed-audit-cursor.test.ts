import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {
 issueP4R16CiAuditCursor,verifyP4R16CiAuditCursor,
} from "../src/platform/p4-r16-ci-signed-audit-cursor.js";
import {P4R7CiReadDeniedError} from "../src/platform/p4-r7-ci-prisma-reader.js";
const S={organizationId:"20000000-0000-4000-8000-000000000001",
 actorId:"10000000-0000-4000-8000-0000000000a1"};
const OTHER_ORG={...S,organizationId:"20000000-0000-4000-8000-000000000002"};
const OTHER_ACTOR={...S,actorId:"10000000-0000-4000-8000-0000000000f1"};
const AFTER="70000000-0000-4000-8000-000000000001";
const NOW=2000000000;
const KEY="p4_R16_fictional_only_signing_key_abcdefghijklmnopqrstuvwxyz";
function good(){return issueP4R16CiAuditCursor(S,AFTER,5,NOW,KEY);}
describe("P4 R16 CI-only signed audit cursor",()=>{
 it("roundtrips with version, actor, tenant, limit and five-minute expiry",()=>{
  const t=good();
  assert.match(t,/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(verifyP4R16CiAuditCursor(t,S,5,NOW,KEY),AFTER);
  assert.equal(verifyP4R16CiAuditCursor(t,S,5,NOW+299,KEY),AFTER);
  assert.ok(!t.includes(AFTER)&&!t.includes(S.actorId));
 });
 it("denies wrong actor, tenant, page size and signing key",()=>{
  const t=good();
  for(const [s,limit,key] of [
   [OTHER_ORG,5,KEY],[OTHER_ACTOR,5,KEY],[S,6,KEY],
   [S,5,"p4_R16_other_fictional_key_abcdefghijklmnopqrstuvwxyz"],
  ] as const){
   assert.throws(()=>verifyP4R16CiAuditCursor(t,s,limit,NOW,key),
    P4R7CiReadDeniedError);
  }
 });
 it("denies expired, future-issued and malformed clock values",()=>{
  const t=good();
  for(const n of [NOW+300,NOW-1,-1,NaN,1.2]){
   assert.throws(()=>verifyP4R16CiAuditCursor(t,S,5,n,KEY),
    P4R7CiReadDeniedError);
  }
 });
 it("denies modified encoded data and signature",()=>{
  const t=good();
  const [body,mac]=t.split(".");
  assert.ok(body&&mac);
  for(const forged of [
   "A"+body.slice(1)+"."+mac,
   body+"."+mac.slice(0,-1)+(mac.endsWith("A")?"B":"A"),
   body+"."+mac.slice(0,-1),
   body+"."+mac+"x",
  ])assert.throws(()=>verifyP4R16CiAuditCursor(forged,S,5,NOW,KEY),
   P4R7CiReadDeniedError);
 });
 it("denies token with extra sections, unsafe base64 and oversized input",()=>{
  for(const t of ["","x","a.b.c","$%*.$%*","A".repeat(1025),{},null]){
   assert.throws(()=>verifyP4R16CiAuditCursor(t,S,5,NOW,KEY),
    P4R7CiReadDeniedError);
  }
 });
 it("denies invalid scope, cursor, limit, clock or weak key on signing",()=>{
  for(const [scope,after,limit,now,key] of [
   [OTHER_ORG,"bad",5,NOW,KEY],[{...S,actorId:"x"},AFTER,5,NOW,KEY],
   [S,AFTER,21,NOW,KEY],[S,AFTER,0,NOW,KEY],
   [S,AFTER,5,-1,KEY],[S,AFTER,5,NOW,"short"],
  ] as const){
   assert.throws(()=>issueP4R16CiAuditCursor(scope,after,limit,now,key),
    P4R7CiReadDeniedError);
  }
 });
 it("denies noncanonical uppercase or replay to another page size",()=>{
  const t=good();
  assert.throws(()=>verifyP4R16CiAuditCursor(t,S,20,NOW,KEY),
   P4R7CiReadDeniedError);
  assert.throws(()=>issueP4R16CiAuditCursor(S,AFTER.toUpperCase(),5,NOW,KEY),
   P4R7CiReadDeniedError);
 });
});
