import assert from "node:assert/strict";
import {describe,it} from "node:test";
import request from "supertest";
import {createApp} from "../src/app.js";
const app=createApp({logRequest:()=>{}});
describe("P4 R28 production source graph unmounted organization write API",()=>{
 it("normal Express app never mounts R28 organization create",async()=>{
  const response=await request(app).post("/_p4_r28_ci/organizations")
   .set("x-role","OWNER").set("x-user-id","user_demo_alice")
   .send({name:"Demo Fixture",slug:"demo-fixture"});
  assert.equal(response.status,404);
  assert.deepEqual(response.body,{
   error:{code:"NOT_FOUND",message:"Endpoint is not available"},
  });
 });
 it("normal Express app never mounts R28 organization read",async()=>{
  const response=await request(app).get(
   "/_p4_r28_ci/organizations/10000000-0000-4000-8000-000000000099");
  assert.equal(response.status,404);
 });
 it("similarly named public organization writes remain absent",async()=>{
  const response=await request(app).post("/api/v1/organizations")
   .send({name:"Demo Fixture",slug:"demo-fixture"});
  assert.equal(response.status,404);
 });
 it("HTTP liveness remains safe and unaltered",async()=>{
  const response=await request(app).get("/health/live");
  assert.equal(response.status,200);
  assert.equal(response.body.scope,"synthetic-only");
 });
});
