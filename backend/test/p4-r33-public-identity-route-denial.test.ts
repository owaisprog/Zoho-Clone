import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import {createApp} from "../src/app.js";
const app=createApp({logRequest:()=>{}});
test("signed CI-only owner issuance is unavailable in normal Express",async()=>{
 const response=await request(app).post(
  "/_p4_r33_ci/owner/10000000-0000-4000-8000-000000000001/issue")
  .set("Authorization","Bearer invalid")
  .send({recipientEmail:"carla@example.com"});
 assert.equal(response.status,404);
});
test("signed CI-only recipient redemption remains unavailable publicly",async()=>{
 const response=await request(app).post("/_p4_r33_ci/recipient/accept")
  .set("Authorization","Bearer invalid").send({token:"ab".repeat(32)});
 assert.equal(response.status,404);
});
