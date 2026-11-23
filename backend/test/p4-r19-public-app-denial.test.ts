/** P4 Batch 19: actual normal Express app must not expose CI IAM routes. */
import assert from "node:assert/strict";
import {describe,it} from "node:test";
import request from "supertest";
import {createApp} from "../src/app.js";

const A="20000000-0000-4000-8000-000000000001";
const endpoints=[
 "/api/v1/internal/organizations/"+A+"/iam/rotated-audit",
 "/api/v1/organizations/"+A+"/iam/rotated-audit",
 "/api/v1/organizations/"+A+"/iam/audit-page",
 "/api/v1/organizations/"+A+"/iam/organization",
 "/api/v1/organizations/"+A+"/iam/role-summaries",
 "/_p4_r17_ci/"+A+"/iam/rotated-audit",
 "/_p4_r16_ci/"+A+"/iam/signed-audit",
 "/_p4_r15_ci/"+A+"/iam/audit-page",
];
function app(){return createApp({logRequest:()=>{}});}
describe("P4 R19 normal production Express route surface",()=>{
 it("rejects all private synthetic IAM GET routes even with forged auth headers",async()=>{
  const e=app();
  for(const url of endpoints){
   const r=await request(e).get(url)
    .set("Authorization","Bearer fake-ci-token")
    .set("x-role","ORG_OWNER").set("x-organization-id",A);
   assert.equal(r.status,404,url);
   assert.equal(r.body.error.code,"NOT_FOUND");
   assert.equal(r.headers["cache-control"],"no-store");
   assert.equal(JSON.stringify(r.body).includes("fake-ci-token"),false);
  }
 });
 it("does not mount test router through any HTTP verb",async()=>{
  const e=app();
  const url=endpoints[5];
  for(const method of ["post","put","patch","delete"] as const){
   const r=await request(e)[method](url).send({role:"ORG_OWNER"});
   assert.equal(r.status,404);
   assert.equal(r.body.error.code,"NOT_FOUND");
  }
 });
 it("does not leak internal membership data via query or path tricks",async()=>{
  const e=app();
  for(const suffix of ["?limit=1","?cursor=fake","?export=csv"]){
   const r=await request(e).get(endpoints[5]+suffix);
   assert.equal(r.status,404);
   assert.equal(JSON.stringify(r.body).includes("token_hash"),false);
  }
 });
 it("continues exposing only synthetic liveness, without IAM permissions",async()=>{
  const r=await request(app()).get("/health/live");
  assert.equal(r.status,200);
  assert.equal(r.body.scope,"synthetic-only");
  assert.equal("organizationAccess" in r.body,false);
 });
});
