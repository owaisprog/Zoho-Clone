import assert from "node:assert/strict";
import {describe,it} from "node:test";
import type {P4VerifiedProviderToken}
 from "../src/platform/p4-auth0-subject-bridge.js";
import {resolveP4V1CiActor,P4V1CiIdentityDeniedError,
 type P4V1CiIdentityLookup} from "../src/platform/p4-v1-ci-identity.js";
const NOW=2_000_000_000;
const ID="10000000-0000-4000-8000-0000000000a1";
const expected={issuer:"https://demo.us.auth0.com/",audience:"urn:zoho-clone:demo"};
const good: P4VerifiedProviderToken={
 issuer:expected.issuer,audience:expected.audience,subject:"auth0|demo-alice",
 expiresAtEpochSeconds:NOW+100,cryptographicallyVerified:true,
};
function lookup(fn?:(issuer:string,subject:string)=>Promise<{
 userId:string;emailVerified:boolean;}|null>){
 let calls=0;
 const adapter:P4V1CiIdentityLookup={
  async findVerifiedIssuerSubject(issuer,subject){
   calls++;return fn?fn(issuer,subject):{userId:ID,emailVerified:true};
  },
 };
 return {adapter,get calls(){return calls;}};
}
describe("P4 R22 synthetic identity precondition matrix",()=>{
 it("resolves only verified, mapped, email-verified subject",async()=>{
  const l=lookup();
  assert.equal(await resolveP4V1CiActor(good,expected,l.adapter,NOW),ID);
  assert.equal(l.calls,1);
 });
 it("supports matching multi-audience synthetic evidence",async()=>{
  const l=lookup();
  assert.equal(await resolveP4V1CiActor({...good,
   audience:[expected.audience,"urn:another:audience"]},
   expected,l.adapter,NOW),ID);
 });
 it("denies missing, forged verification, foreign issuer/audience before lookup",async()=>{
  for(const e of [null,{...good,cryptographicallyVerified:false},
   {...good,issuer:"https://other.us.auth0.com/"},
   {...good,audience:"urn:foreign-service"},
   {...good,audience:[]},{...good,audience:[expected.audience,4]},
  ]){
   const l=lookup();
   await assert.rejects(resolveP4V1CiActor(e as P4VerifiedProviderToken,
    expected,l.adapter,NOW),P4V1CiIdentityDeniedError);
   assert.equal(l.calls,0);
  }
 });
 it("denies expired token, long-lived future token, invalid current time",async()=>{
  for(const [expires,now] of [[NOW,NOW],[NOW-1,NOW],
   [NOW+86_401,NOW],[NOW+1,Number.NaN],[NOW+100,2.5]]){
   const l=lookup();
   await assert.rejects(resolveP4V1CiActor({...good,
    expiresAtEpochSeconds:expires},expected,l.adapter,now),
    P4V1CiIdentityDeniedError);
   assert.equal(l.calls,0);
  }
 });
 it("denies malformed external subject or unsafe issuer config",async()=>{
  for(const e of [{...good,subject:"../../private"},
   {...good,subject:"x"},{...good,subject:"invalid subject"}]){
   const l=lookup();
   await assert.rejects(resolveP4V1CiActor(e,expected,l.adapter,NOW),
    P4V1CiIdentityDeniedError);
   assert.equal(l.calls,0);
  }
  const l=lookup();
  await assert.rejects(resolveP4V1CiActor(good,
   {...expected,issuer:"http://fake.example/"},l.adapter,NOW),
   P4V1CiIdentityDeniedError);
  assert.equal(l.calls,0);
 });
 it("denies unmapped, unverified-email and malformed UUID users",async()=>{
  for(const output of [null,{userId:ID,emailVerified:false},
   {userId:"not-canonical",emailVerified:true}]){
   const l=lookup(async()=>output);
   await assert.rejects(resolveP4V1CiActor(good,expected,l.adapter,NOW),
    P4V1CiIdentityDeniedError);
   assert.equal(l.calls,1);
  }
 });
 it("converts mapping provider faults to uniform denial",async()=>{
  const l=lookup(async()=>{throw Error("PRIVATE_SUBJECT_DATABASE_ERROR");});
  await assert.rejects(resolveP4V1CiActor(good,expected,l.adapter,NOW),
   err=>err instanceof P4V1CiIdentityDeniedError&&
    !err.message.includes("PRIVATE_SUBJECT_DATABASE_ERROR"));
 });
 it("never relies on fake browser role or organization props",async()=>{
  const tampered={...good,role:"ORG_OWNER",organizationId:"bad"};
  const l=lookup();
  assert.equal(await resolveP4V1CiActor(tampered,expected,l.adapter,NOW),ID);
  assert.equal(l.calls,1);
 });
});
