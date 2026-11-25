import assert from "node:assert/strict";
import {test} from "node:test";
import express from "express";
import request from "supertest";
import {checkP4R81SdkPayload,checkP4R81Membership,readP4R81Policy,createP4R81ProviderTenantRouter} from "../src/platform/p4-r81-provider-tenant.js";
import {requireCanonicalUuidV4} from "../src/platform/p4-approved-uuid.js";
const env={P3_APP_ENV:"ci",P4_PROVIDER_PREPARATION:"true",AUTH0_DOMAIN:"fixture.us.auth0.com",AUTH0_AUDIENCE:"urn:zoho-clone:fixture",P4_AUTH0_WEB_CLIENT_ID:"fictionalClientId0001"};
const policy=readP4R81Policy(env)!;
const now=2_000_000_000;
const payload={iss:policy.issuer,sub:"auth0|fixture-user",aud:policy.audience,azp:policy.clientId,scope:"read:identity",iat:now-5,exp:now+300};
const org=requireCanonicalUuidV4("10000000-0000-4000-8000-000000000001");
const user=requireCanonicalUuidV4("20000000-0000-4000-8000-000000000001");
test("R81 exact signed-claim shape and purpose; ignores token roles and email",()=>{
 assert.deepEqual(checkP4R81SdkPayload({...payload,roles:["OWNER"],email_verified:true,org_id:org},policy,now),{issuer:policy.issuer,subject:payload.sub});
 assert.ok(checkP4R81SdkPayload({...payload,aud:[policy.audience,"https://fixture.us.auth0.com/userinfo"]},policy,now));
 for(const patch of [{iss:"https://foreign.us.auth0.com/"},{aud:"urn:wrong"},{azp:"differentClient0001"},{sub:"service@clients"},{gty:"client-credentials"},{scope:"openid"},{exp:now},{iat:now+31},{nbf:now+1},{exp:now+90000},{sub:"user_demo_alice"}])assert.equal(checkP4R81SdkPayload({...payload,...patch},policy,now),null);
});
test("R81 membership response exact UUID and minimal allowlist",()=>{
 assert.deepEqual(checkP4R81Membership({actorId:user,organizationId:org,role:"MEMBER"},org),{actorId:user,organizationId:org,role:"MEMBER"});
 for(const row of [null,{actorId:"user_demo_bob",organizationId:org,role:"MEMBER"},{actorId:user,organizationId:user,role:"OWNER"},{actorId:user,organizationId:org,role:"ADMIN"},{actorId:user,organizationId:org,role:"OWNER",email:"fixture@example.com"}])assert.equal(checkP4R81Membership(row,org),null);
});
test("R81 preparation switch and real SDK unauthenticated denial, no reader or external fetch",async()=>{
 let calls=0;const reader={async read(){calls++;return null;}};
 assert.throws(()=>createP4R81ProviderTenantRouter(reader,{...env,P4_PROVIDER_PREPARATION:"false"}));
 assert.throws(()=>createP4R81ProviderTenantRouter(reader,{...env,P3_APP_ENV:"staging"}));
 assert.throws(()=>createP4R81ProviderTenantRouter(reader,{...env,NODE_ENV:"production"}));
 const app=express();app.use("/prepare",createP4R81ProviderTenantRouter(reader,env));
 const r=await request(app).get("/prepare/"+org+"/membership-check").set("x-actor-id",user).set("x-role","OWNER");
 assert.equal(r.status,401);assert.deepEqual(r.body,{error:{code:"IDENTITY_REQUIRED"}});assert.equal(r.headers["cache-control"],"no-store, private");
 assert.equal((await request(app).post("/prepare/"+org+"/membership-check")).status,404);
 const missing=express();missing.use(createP4R81ProviderTenantRouter(reader,{...env,P4_AUTH0_WEB_CLIENT_ID:""}));
 assert.equal((await request(missing).get("/"+org+"/membership-check")).status,503);
 assert.equal(calls,0);
});
test("R81 normal Express app does not import or mount preparation router",async()=>{
 const {createApp}=await import("../src/app.js");const r=await request(createApp({logRequest:()=>{}})).get("/api/v1/organizations/"+org+"/membership-check");assert.equal(r.status,404);
});
