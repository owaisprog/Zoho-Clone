import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {readAuth0WebConfiguration} from "../src/lib/auth0-config";

const valid={
 AUTH0_DOMAIN:"fixture.us.auth0.com",
 AUTH0_AUDIENCE:"urn:zoho-clone:fixture",
 AUTH0_CLIENT_ID:"fictional-web-id",
 AUTH0_CLIENT_SECRET:"fictional-secret-not-real",
 AUTH0_SECRET:"a".repeat(64),
};
describe("P4 R35 Auth0 web and API audience agreement",()=>{
 it("permits syntactically complete local identity-only setup",()=>{
  assert.deepEqual(readAuth0WebConfiguration(valid),{
   domain:valid.AUTH0_DOMAIN,audience:valid.AUTH0_AUDIENCE,
  });
 });
 it("rejects invalid or missing audiences and whitespace",()=>{
  for(const audience of ["", "not-an-audience",
   "https://api.example.com/audience space", "urn:my issuer",
   "urn:"+ "a".repeat(300)]){
   assert.equal(readAuth0WebConfiguration({...valid,
    AUTH0_AUDIENCE:audience}),null);
  }
 });
 it("does not create a session with missing or partial secrets",()=>{
  for(const change of [{AUTH0_CLIENT_ID:""},
   {AUTH0_CLIENT_SECRET:""},{AUTH0_SECRET:"bad"},
   {AUTH0_DOMAIN:"https://attacker.test/"},
   {AUTH0_DOMAIN:"localhost"}]){
   assert.equal(readAuth0WebConfiguration({...valid,...change}),null);
  }
 });
});
