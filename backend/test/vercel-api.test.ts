import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createVercelApi } from "../src/index.js";
const preview = { VERCEL:"1", VERCEL_ENV:"preview", P4_VERCEL_SYNTHETIC_PREVIEW:"true" };
test("Vercel entrypoint is closed by default and in production", async () => {
  for (const env of [{}, {...preview,VERCEL_ENV:"production"}, {...preview,VERCEL:"0"}, {...preview,P4_VERCEL_SYNTHETIC_PREVIEW:"false"}]) {
    const res = await request(createVercelApi(env)).get("/health/live");
    assert.equal(res.status,503);
    assert.equal(res.headers["cache-control"],"no-store");
  }
});
test("enabled fictional preview only exposes liveness, not dependency readiness or writes", async () => {
  const api = request(createVercelApi(preview));
  const live = await api.get("/health/live");
  assert.equal(live.status,200);
  assert.deepEqual(live.body,{status:"alive",scope:"synthetic-only"});
  assert.equal((await api.get("/api/v1/health")).status,200);
  assert.equal((await api.get("/health/ready")).status,503);
  assert.equal((await api.get("/api/v1/auth/check").set("Authorization","Bearer fictional")).status,503);
  for (const path of ["/api/v1/demo/leads","/api/v1/internal/organizations","/api/v1/organizations","/api/v1/crm/leads"]) {
    assert.equal((await api.get(path)).status,404);
    assert.equal((await api.post(path).send({fictional:true})).status,404);
  }
});

test("membership is absent without owner activation or complete config; enabled route denies missing bearer",async()=>{
 const org="97000000-0000-4000-8000-000000000001",path="/api/v1/staging/organizations/"+org+"/membership-check";
 const candidate={...preview,P4_STAGE_MEMBERSHIP_ENABLED:"true",P4_STAGE_AUTH0_DOMAIN:"fixture.us.auth0.com",
 P4_STAGE_AUTH0_AUDIENCE:"urn:zoho:staging",P4_STAGE_AUTH0_CLIENT_ID:"fictional-client-id-1234",
 P4_STAGE_DATABASE_HOST:"ep-example.us-east-1.aws.neon.tech",
 P4_STAGE_DATABASE_URL:"postgresql://p4_stage_runtime:fake_fixture@ep-example.us-east-1.aws.neon.tech/zoho_clone_staging?sslmode=verify-full"};
 assert.equal((await request(createVercelApi(candidate)).get(path)).status,404);
 assert.equal((await request(createVercelApi({...candidate,P4_STAGE_OWNER_ACTIVATION:"approved",P4_STAGE_DATABASE_URL:""})).get(path)).status,404);
 const app=createVercelApi({...candidate,P4_STAGE_OWNER_ACTIVATION:"approved"});
 assert.equal((await request(app).get(path)).status,401);
 assert.equal((await request(app).post(path)).status,404);
 assert.equal((await request(app).get("/health/ready")).status,503);
});
