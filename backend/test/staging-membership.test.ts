import {test} from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import {readStageDatabaseUrl} from "../src/platform/staging-membership-db.js";
import {readStageIdentityPolicy,stageVerifiedClaims,createStageMembershipRouter} from "../src/platform/staging-membership-auth.js";
const env={VERCEL:"1",VERCEL_ENV:"preview",P4_VERCEL_SYNTHETIC_PREVIEW:"true",P4_STAGE_MEMBERSHIP_ENABLED:"true",
 P4_STAGE_AUTH0_DOMAIN:"fixture.us.auth0.com",P4_STAGE_AUTH0_AUDIENCE:"urn:zoho:staging",P4_STAGE_AUTH0_CLIENT_ID:"fictional-client-id-1234",
 P4_STAGE_DATABASE_HOST:"ep-example.us-east-1.aws.neon.tech"};
const org="97000000-0000-4000-8000-000000000001";
const url="postgresql://p4_stage_runtime:fake_fixture@ep-example.us-east-1.aws.neon.tech/zoho_clone_staging?sslmode=verify-full";
test("staging configuration rejects non-preview, other database, roles and hosts",()=>{
 assert.equal(readStageDatabaseUrl({...env,P4_STAGE_DATABASE_URL:url}),url);
 assert.ok(readStageIdentityPolicy(env));
 for(const x of [{...env,VERCEL_ENV:"production"},{...env,P4_STAGE_MEMBERSHIP_ENABLED:"false"}]){
  assert.equal(readStageDatabaseUrl({...x,P4_STAGE_DATABASE_URL:url}),null);assert.equal(readStageIdentityPolicy(x),null);
 }
 for(const bad of [url.replace("zoho_clone_staging","zoho_clone_synthetic"),url.replace("p4_stage_runtime","admin"),url.replace("ep-example","ep-other"),url.replace("verify-full","disable"),url+"&options=unsafe"]){
  assert.equal(readStageDatabaseUrl({...env,P4_STAGE_DATABASE_URL:bad}),null);
 }
});
test("post-verification claim checks reject incorrect issuer, audience, client, scope, expiry and service tokens",()=>{
 const p=readStageIdentityPolicy(env)!;
 const good={iss:p.issuer,sub:"auth0|fixture-user",aud:p.audience,azp:p.clientId,iat:100,exp:200,scope:"read:identity"};
 assert.deepEqual(stageVerifiedClaims(good,p,150),{issuer:p.issuer,subject:good.sub});
 for(const bad of [{iss:"https://other.auth0.com/"},{aud:"urn:other"},{azp:"other"},{scope:"read:crm"},{exp:150},{iat:190},{gty:"client-credentials"},{sub:"invalid"},{nbf:151}]){
  assert.equal(stageVerifiedClaims({...good,...bad},p,150),null);
 }
});
test("real SDK middleware denies missing token without querying database",async()=>{
 let reads=0;const app=express();
 app.use("/stage",createStageMembershipRouter(readStageIdentityPolicy(env)!,{read:async()=>{reads++;return null;}}));
 const result=await request(app).get("/stage/"+org+"/membership-check");
 assert.equal(result.status,401);assert.equal(reads,0);
 assert.equal((await request(app).post("/stage/"+org+"/membership-check")).status,404);
});

test("directory flag is opt-in and SDK denies unsigned requests before list",async()=>{
 let lists=0;const reader={read:async()=>null,list:async()=>{lists++;return {items:[],nextCursor:null};}};
 const disabled=express();disabled.use("/stage",createStageMembershipRouter(readStageIdentityPolicy(env)!,reader));
 assert.equal((await request(disabled).get("/stage/directory")).status,404);
 const enabled=express();enabled.use("/stage",createStageMembershipRouter(readStageIdentityPolicy(env)!,reader,true));
 assert.equal((await request(enabled).get("/stage/directory")).status,401);
 assert.equal((await request(enabled).post("/stage/directory")).status,404);assert.equal(lists,0);
});
