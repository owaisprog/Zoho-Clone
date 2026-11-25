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
