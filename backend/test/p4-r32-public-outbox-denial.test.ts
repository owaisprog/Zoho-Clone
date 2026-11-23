import assert from "node:assert/strict";
import {test} from "node:test";
import request from "supertest";
import {createApp} from "../src/app.js";
const app=createApp({logRequest:()=>{}});
test("R32 outbox issuance is not exposed by the ordinary Express app",async()=>{
 const res=await request(app).post("/_p4_r32_ci/10000000-0000-4000-8000-000000000001/issue")
  .set("x-role","OWNER").send({recipientEmail:"carla@example.com"});
 assert.equal(res.status,404);
});
test("outbox worker and decrypted tokens have no HTTP endpoints",async()=>{
 for(const url of ["/_p4_r32_ci/work","/_p4_r32_ci/mailbox",
   "/api/v1/invitations/outbox"]){
  assert.equal((await request(app).get(url)).status,404);
 }
});
