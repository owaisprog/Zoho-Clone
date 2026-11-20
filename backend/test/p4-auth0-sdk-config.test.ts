import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import request from "supertest";
import { auth0IdentityCheckMiddleware } from "../src/auth/auth0-api.js";
import { createP4Auth0DevelopmentReadRouter } from "../src/platform/p4-auth0-development-router.js";

const CONFIG={ AUTH0_DOMAIN:"demo.us.auth0.com", AUTH0_AUDIENCE:"urn:zoho-clone:demo" };
describe("P4 Auth0 SDK environment consistency, CI-safe no real login",()=>{
  it("returns a deny-by-default 503 for missing or incomplete configuration",async()=>{
    for(const config of [{}, {AUTH0_DOMAIN:"fake.example",AUTH0_AUDIENCE:"urn:demo:test"}]){
      const app=express();app.use("/test",auth0IdentityCheckMiddleware(config));
      const r=await request(app).get("/test/data")
        .set("Authorization","Bearer fake")
        .set("x-role","OWNER");
      assert.equal(r.status,503);
    }
  });
  it("requires signed bearer verification even when browser sends forged actor headers",async()=>{
    const app=express();
    app.use("/secure",auth0IdentityCheckMiddleware(CONFIG));
    app.get("/secure/ok",(_req,res)=>res.status(200).json({ok:true}));
    const r=await request(app).get("/secure/ok")
      .set("x-org-id","20000000-0000-4000-8000-000000000001")
      .set("x-role","OWNER");
    assert.equal(r.status,401);
    assert.notEqual(r.body?.ok,true);
  });
  it("uses the same explicit Auth0 issuer/audience when composing the dev-only router",async()=>{
    const app=express();
    app.use("/dev",createP4Auth0DevelopmentReadRouter({
      mappingLookup:{async findByIssuerAndSubject(){throw Error("unreachable");}},
      memberships:{
        async listForUser(){throw Error("unreachable");},
        async findForUserInOrg(){throw Error("unreachable");},
      },
      tenantPool:{async connect(){throw Error("unreachable");}},
      nowEpochSeconds:()=>2_000_000_000,
    },CONFIG));
    const r=await request(app).get(
      "/dev/10000000-0000-4000-8000-000000000001/settings",
    ).set("x-role","OWNER");
    assert.equal(r.status,401);
  });
});
