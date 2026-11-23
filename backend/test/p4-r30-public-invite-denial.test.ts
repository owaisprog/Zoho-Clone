import assert from "node:assert/strict";
import {describe,it} from "node:test";
import request from "supertest";
import {createApp} from "../src/app.js";
const app=createApp({logRequest:()=>{}});
describe("P4 R30 production application has no invitation redemption route",()=>{
 it("keeps internal redemption endpoint unmounted",async()=>{
  const r=await request(app).post("/_p4_r30_ci/accept")
   .set("x-user-id","user_demo_carla").set("x-role","OWNER")
   .send({token:"ab".repeat(32)});
  assert.equal(r.status,404);
  assert.deepEqual(r.body,{error:{code:"NOT_FOUND",
   message:"Endpoint is not available"}});
 });
 it("no generic production invitation acceptance route is activated",async()=>{
  const r=await request(app).post("/api/v1/invitations/accept")
   .send({token:"ab".repeat(32)});
  assert.equal(r.status,404);
 });
});
