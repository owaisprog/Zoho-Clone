import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {readAuth0ApiConfiguration} from "../src/auth/auth0-config.js";
import {assertApprovedBackendRuntimeEnvironment}
 from "../src/runtime-env.js";

const valid={
 P3_APP_ENV:"ci",AUTH0_DOMAIN:"fixture.us.auth0.com",
 AUTH0_AUDIENCE:"urn:zoho-clone:fixture",
};
describe("P4 R35 backend Auth0 issuer/audience consistency rehearsal",()=>{
 it("reads a strict identity-only Auth0 issuer and API audience",()=>{
  assert.deepEqual(readAuth0ApiConfiguration(valid),{
   issuerBaseURL:"https://fixture.us.auth0.com/",
   audience:"urn:zoho-clone:fixture",
  });
  assert.doesNotThrow(()=>assertApprovedBackendRuntimeEnvironment(valid));
 });
 it("rejects fake provider hosts and malicious API audiences",()=>{
  for(const patch of [
   {AUTH0_DOMAIN:"evil.example.com"},
   {AUTH0_DOMAIN:"fixture.us.auth0.com/extra"},
   {AUTH0_AUDIENCE:"urn:space invalid"},
   {AUTH0_AUDIENCE:"abc"},
  ]){
   const env={...valid,...patch};
   assert.equal(readAuth0ApiConfiguration(env),null);
   assert.throws(()=>assertApprovedBackendRuntimeEnvironment(env));
  }
 });
 it("refuses staging/production entrypoints and publicly named secrets",()=>{
  assert.throws(()=>assertApprovedBackendRuntimeEnvironment({
   ...valid,P3_APP_ENV:"staging",
  }));
  assert.throws(()=>assertApprovedBackendRuntimeEnvironment({
   ...valid,NEXT_PUBLIC_AUTH0_SECRET:"private fixture",
  }));
 });
});
