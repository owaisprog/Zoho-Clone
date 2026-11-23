import assert from "node:assert/strict";
import {describe,it} from "node:test";
import request from "supertest";
import {createApp} from "../src/app.js";
const app=createApp({logRequest:()=>{}});
describe("P4 R31 external applications never expose CI fixture mailboxes",()=>{
 it("does not mount R31 issue route in standard Express",async()=>{
  const r=await request(app).post(
   "/_p4_r31_ci/10000000-0000-4000-8000-000000000001/issue")
   .set("x-role","OWNER").set("x-user-id","user_demo_alice")
   .send({recipientEmail:"carla@example.com"});
  assert.equal(r.status,404);
  assert.deepEqual(r.body,{error:{code:"NOT_FOUND",
   message:"Endpoint is not available"}});
 });
 it("does not expose any test-mailbox or invitation-token retrieval endpoint",async()=>{
  for(const url of ["/_p4_r31_ci/mailbox","/api/v1/invitations/issue",
   "/api/v1/invitations/test-mailbox"]){
   const r=await request(app).get(url);
   assert.equal(r.status,404);
  }
 });
});
