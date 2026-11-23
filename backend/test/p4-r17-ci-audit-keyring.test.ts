import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {issueP4R17CiRotatingCursor,verifyP4R17CiRotatingCursor,
 type P4R17CiKeyring} from "../src/platform/p4-r17-ci-audit-keyring.js";
import {P4R7CiReadDeniedError} from "../src/platform/p4-r7-ci-prisma-reader.js";
const S={organizationId:"20000000-0000-4000-8000-000000000001",
 actorId:"10000000-0000-4000-8000-0000000000a1"};
const AFTER="70000000-0000-4000-8000-000000000001";
const NOW=2000000000;
const OLD="old_ci_fictional_key_abcdefghijklmnopqrstuvwxyz_1234";
const NEW="new_ci_fictional_key_abcdefghijklmnopqrstuvwxyz_5678";
const THIRD="third_ci_fictional_key_abcdefghijklmnopqrstuvwxyz_9012";
const OLD_RING:P4R17CiKeyring={current:{id:"oldkey",secret:OLD}};
const ROTATED:P4R17CiKeyring={
 current:{id:"newkey",secret:NEW},previous:{id:"oldkey",secret:OLD},
};
const RETIRED:P4R17CiKeyring={current:{id:"newkey",secret:NEW}};
function token(ring:P4R17CiKeyring=OLD_RING){
 return issueP4R17CiRotatingCursor(S,AFTER,5,NOW,ring);
}
describe("P4 R17 synthetic audit key rotation",()=>{
 it("issues versioned current-key tokens that roundtrip securely",()=>{
  const t=token();
  assert.match(t,/^r17\.oldkey\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(verifyP4R17CiRotatingCursor(t,S,5,NOW,OLD_RING),AFTER);
  assert.ok(!t.includes(AFTER)&&!t.includes(OLD));
 });
 it("accepts previous key during rotation, signs new pages with new key",()=>{
  assert.equal(verifyP4R17CiRotatingCursor(
   token(),S,5,NOW+100,ROTATED),AFTER);
  const fresh=token(ROTATED);
  assert.ok(fresh.startsWith("r17.newkey."));
  assert.equal(verifyP4R17CiRotatingCursor(
   fresh,S,5,NOW,RETIRED),AFTER);
 });
 it("rejects retired old key after removal, including within token expiry",()=>{
  assert.throws(()=>verifyP4R17CiRotatingCursor(
   token(),S,5,NOW+1,RETIRED),P4R7CiReadDeniedError);
 });
 it("denies wrong actor, organization, page size and expired token",()=>{
  const t=token();
  for(const [scope,limit,time] of [
   [{...S,organizationId:"20000000-0000-4000-8000-000000000002"},5,NOW],
   [{...S,actorId:"10000000-0000-4000-8000-0000000000e1"},5,NOW],
   [S,4,NOW],[S,5,NOW+300],
  ] as const){
   assert.throws(()=>verifyP4R17CiRotatingCursor(
    t,scope,limit,time,ROTATED),P4R7CiReadDeniedError);
  }
 });
 it("rejects modified key IDs, MAC tags, unknown or future IDs",()=>{
  const t=token();
  const [p,id,body,tag]=t.split(".");
  assert.ok(p&&id&&body&&tag);
  for(const v of [
   "r17.future."+body+"."+tag,
   "r17.newkey."+body+"."+tag,
   "r17.oldkey."+body+"."+("A"===tag[0]?"B":"A")+tag.slice(1),
   "r16."+id+"."+body+"."+tag,
   t+".invalid","",null,{}, "a".repeat(1101),
  ]){
   assert.throws(()=>verifyP4R17CiRotatingCursor(
    v,S,5,NOW,ROTATED),P4R7CiReadDeniedError);
  }
 });
 it("rejects duplicate key IDs, reused material, weak keys and extra slots",()=>{
  for(const ring of [
   {current:{id:"same",secret:NEW},previous:{id:"same",secret:OLD}},
   {current:{id:"first",secret:NEW},previous:{id:"other",secret:NEW}},
   {current:{id:"bad",secret:"short"}},
   {current:{id:"X",secret:NEW}},
   {current:{id:"newkey",secret:NEW},third:{id:"future",secret:THIRD}},
   null,
  ]){
   assert.throws(()=>issueP4R17CiRotatingCursor(
    S,AFTER,5,NOW,ring as P4R17CiKeyring),P4R7CiReadDeniedError);
  }
 });
 it("rejects invalid cursor ID, limit, clock or tenant before signing",()=>{
  for(const [scope,after,limit,time] of [
   [S,"fake",5,NOW],[S,AFTER,21,NOW],
   [S,AFTER,0,NOW],[S,AFTER,5,-1],
   [{...S,actorId:"invalid"},AFTER,5,NOW],
  ] as const){
   assert.throws(()=>issueP4R17CiRotatingCursor(
    scope,after,limit,time,ROTATED),P4R7CiReadDeniedError);
  }
 });
 it("does not confuse key ID with a key or silently fall back",()=>{
  const modified={current:{id:"other",secret:THIRD},
   previous:{id:"newkey",secret:OLD}};
  assert.throws(()=>verifyP4R17CiRotatingCursor(
   token(ROTATED),S,5,NOW,modified),P4R7CiReadDeniedError);
 });
});
