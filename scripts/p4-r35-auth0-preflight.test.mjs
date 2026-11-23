import assert from "node:assert/strict";
import {test} from "node:test";
import {evaluateP4R35IdentityPreflight}
 from "./p4-r35-auth0-preflight.mjs";

const VALID={
 P3_APP_ENV:"ci",AUTH0_DOMAIN:"fixture.us.auth0.com",
 AUTH0_AUDIENCE:"urn:zoho-clone:fixture",
 AUTH0_CLIENT_ID:"fictional-web",AUTH0_CLIENT_SECRET:"not-real-secret",
 AUTH0_SECRET:"f".repeat(64),APP_BASE_URL:"http://127.0.0.1:3000",
 API_INTERNAL_URL:"http://127.0.0.1:4000",
 AUTH0_EXPECTED_API_DOMAIN:"fixture.us.auth0.com",
 AUTH0_EXPECTED_API_AUDIENCE:"urn:zoho-clone:fixture",
};
test("R35 valid fake configuration only certifies shape, not live readiness",()=>{
 const r=evaluateP4R35IdentityPreflight(VALID);
 assert.deepEqual(r.issueCodes,[]);
 assert.equal(r.status,"LOCAL_IDENTITY_CONFIGURATION_SHAPE_COMPLETE");
 assert.equal(r.checked,"SYNTAX_ONLY");
 assert.equal(r.release,"NO_GO");
 assert.equal(r.liveAuth0Verified,false);
 assert.equal(r.stagingApproved,false);
 assert.equal(r.formalAcceptanceExecuted,0);
});
test("R35 rejects frontend/backend issuer or audience drift",()=>{
 const a=evaluateP4R35IdentityPreflight({
  ...VALID,AUTH0_EXPECTED_API_AUDIENCE:"urn:other",
 });
 assert.ok(a.issueCodes.includes("BACKEND_AUDIENCE_MISMATCH"));
 const b=evaluateP4R35IdentityPreflight({
  ...VALID,AUTH0_EXPECTED_API_DOMAIN:"other.us.auth0.com",
 });
 assert.ok(b.issueCodes.includes("BACKEND_ISSUER_DOMAIN_MISMATCH"));
});
test("R35 rejects public secrets without ever printing their values",()=>{
 const r=evaluateP4R35IdentityPreflight({
  ...VALID,NEXT_PUBLIC_AUTH0_CLIENT_SECRET:"do-not-disclose-me",
 });
 assert.ok(r.issueCodes.includes("PUBLIC_CREDENTIAL_EXPOSURE"));
 assert.equal(JSON.stringify(r).includes("do-not-disclose-me"),false);
});
test("R35 rejects remote API/origin, staging and requested live activation",()=>{
 for(const patch of [
  {API_INTERNAL_URL:"https://api.real.example"},
  {APP_BASE_URL:"https://preview.example"},
  {P3_APP_ENV:"staging"},
  {P4_ALLOW_LIVE_IDENTITY:"true"},
 ]){
  const r=evaluateP4R35IdentityPreflight({...VALID,...patch});
  assert.equal(r.status,"BLOCKED");assert.equal(r.release,"NO_GO");
 }
});
