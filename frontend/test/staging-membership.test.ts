import {test} from "node:test";
import assert from "node:assert/strict";
import {checkStageMembership,readStageWebBinding} from "../src/lib/staging-membership";
const org="97000000-0000-4000-8000-000000000001",other="97000000-0000-4000-8000-000000000002";
const env={VERCEL:"1",VERCEL_ENV:"preview",P4_VERCEL_SYNTHETIC_PREVIEW:"true",P4_STAGE_OWNER_ACTIVATION:"approved",
 P4_STAGE_MEMBERSHIP_ENABLED:"true",P4_STAGING_API_ORIGIN:"https://fictional-api.vercel.app",P4_STAGE_API_HOST:"fictional-api.vercel.app",
 AUTH0_DOMAIN:"fixture.us.auth0.com",AUTH0_AUDIENCE:"urn:zoho:stage",AUTH0_CLIENT_ID:"fictional-web-client-123",AUTH0_CLIENT_SECRET:"fake-only",AUTH0_SECRET:"a".repeat(64),
 P4_STAGE_AUTH0_DOMAIN:"fixture.us.auth0.com",P4_STAGE_AUTH0_AUDIENCE:"urn:zoho:stage",P4_STAGE_AUTH0_CLIENT_ID:"fictional-web-client-123"};
const session={hasSession:async()=>true,getToken:async()=>"fake.payload.signature"};
const good={scope:"staging-membership-only",organizationId:org,membershipRole:"OWNER",applicationAccess:false};
test("stage binding denies wrong API host, issuer, audience, client and production",async()=>{
 for(const change of [{VERCEL_ENV:"production"},{P4_STAGE_OWNER_ACTIVATION:"pending"},{P4_STAGE_API_HOST:"other.vercel.app"},{AUTH0_DOMAIN:"other.auth0.com"},{AUTH0_AUDIENCE:"urn:other"},{AUTH0_CLIENT_ID:"other-client"}]){
  assert.equal(readStageWebBinding({...env,...change}),null);
  const never=async()=>{assert.fail("must not access session or network");};
  assert.deepEqual(await checkStageMembership(org,{hasSession:never,getToken:never},{...env,...change},never),{status:"disabled",applicationAccess:false});
 }
});
test("bridge sends exact server bearer only to pinned host and returns minimal membership",async()=>{
 const fetcher:typeof fetch=async(url,options)=>{
  assert.equal(String(url),"https://fictional-api.vercel.app/api/v1/staging/organizations/"+org+"/membership-check");
  assert.equal(new Headers(options?.headers).get("authorization"),"Bearer fake.payload.signature");
  assert.equal(options?.redirect,"error");assert.equal(options?.cache,"no-store");assert.equal(options?.credentials,"omit");
  return Response.json(good);
 };
 assert.deepEqual(await checkStageMembership(org,session,env,fetcher),{status:"verified",organizationId:org,membershipRole:"OWNER",applicationAccess:false});
});
test("denies malformed IDs, no session, mismatch, extra fields, excessive body and upstream denial",async()=>{
 const never=async()=>{assert.fail("must not fetch");};
 assert.equal((await checkStageMembership("../other",session,env,never)).status,"denied");
 assert.equal((await checkStageMembership(org,{hasSession:async()=>false,getToken:never},env,never)).status,"unauthenticated");
 for(const bad of [{...good,organizationId:other},{...good,applicationAccess:true},{...good,actorId:other},{...good,membershipRole:"ADMIN"},{...good,scope:"identity-only"}]){
  assert.equal((await checkStageMembership(org,session,env,async()=>Response.json(bad))).status,"unavailable");
 }
 assert.equal((await checkStageMembership(org,session,env,async()=>new Response("x".repeat(2049),{headers:{"Content-Type":"application/json"}}))).status,"unavailable");
 assert.equal((await checkStageMembership(org,session,env,async()=>new Response(null,{status:403}))).status,"denied");
 assert.equal((await checkStageMembership(org,session,env,async()=>new Response(null,{status:401}))).status,"unauthenticated");
});
