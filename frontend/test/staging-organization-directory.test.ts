import {test} from "node:test";
import assert from "node:assert/strict";
import {listStageOrganizations,parseDirectoryPage} from "../src/lib/staging-organization-directory";
const id="97000000-0000-4000-8000-000000000001";
const env={VERCEL:"1",VERCEL_ENV:"preview",P4_VERCEL_SYNTHETIC_PREVIEW:"true",P4_STAGE_OWNER_ACTIVATION:"approved",P4_STAGE_ORG_DIRECTORY_ENABLED:"true",
 P4_STAGE_MEMBERSHIP_ENABLED:"true",P4_STAGING_API_ORIGIN:"https://fictional-api.vercel.app",P4_STAGE_API_HOST:"fictional-api.vercel.app",
 AUTH0_DOMAIN:"fixture.us.auth0.com",AUTH0_AUDIENCE:"urn:zoho:stage",AUTH0_CLIENT_ID:"fictional-web-client-123",AUTH0_CLIENT_SECRET:"fake-only",AUTH0_SECRET:"a".repeat(64),
 P4_STAGE_AUTH0_DOMAIN:"fixture.us.auth0.com",P4_STAGE_AUTH0_AUDIENCE:"urn:zoho:stage",P4_STAGE_AUTH0_CLIENT_ID:"fictional-web-client-123"};
const session={hasSession:async()=>true,getToken:async()=>"fake.payload.signature"};
const page={scope:"staging-organization-directory",items:[{organizationId:id,membershipRole:"OWNER"}],nextCursor:null,applicationAccess:false};
test("directory validates strict redacted projection, cursor and ordering",()=>{
 assert.equal(parseDirectoryPage(page,null).status,"verified");
 for(const bad of [{...page,applicationAccess:true},{...page,nextCursor:id},{...page,items:[...page.items,...page.items]},{...page,items:[{...page.items[0],actorId:id}]},{...page,items:[{organizationId:id,membershipRole:"ADMIN"}]}])
  assert.equal(parseDirectoryPage(bad,null).status,"unavailable");
 assert.equal(parseDirectoryPage(page,id).status,"unavailable");
});
test("directory server bridge pins target, denies disabled or missing identity",async()=>{
 const never=async()=>{assert.fail("unexpected network");};
 assert.equal((await listStageOrganizations(null,session,{...env,P4_STAGE_ORG_DIRECTORY_ENABLED:"false"},never)).status,"disabled");
 assert.equal((await listStageOrganizations(null,{...session,hasSession:async()=>false},env,never)).status,"unauthenticated");
 assert.equal((await listStageOrganizations("../",session,env,never)).status,"denied");
 const result=await listStageOrganizations(null,session,env,async(url,options)=>{
  assert.equal(String(url),"https://fictional-api.vercel.app/api/v1/staging/organizations/directory");
  assert.equal(new Headers(options?.headers).get("authorization"),"Bearer fake.payload.signature");
  assert.equal(options?.redirect,"error");assert.equal(options?.credentials,"omit");
  return Response.json(page);
 });
 assert.equal(result.status,"verified");assert.equal(result.applicationAccess,false);
});
