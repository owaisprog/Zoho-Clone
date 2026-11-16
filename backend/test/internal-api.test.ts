import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createFictionalLeadRepository } from "../src/internal/fixtures.js";
import type { InternalPreviewTestAdapter } from "../src/internal/routes.js";
import type { VerifiedPreviewActor } from "../src/internal/contracts.js";

const ROOT = "/api/v1/internal/organizations";
const org = ROOT + "/org_demo_orchid";
const cedar = ROOT + "/org_demo_cedar";
const newLead = {organization:"Demo Sample Store",contact:"Example Person",email:"sample@example.com"};

function testFixture() {
  const repo = createFictionalLeadRepository();
  const sessionActors = new Map<string, VerifiedPreviewActor>([
    ["fixture-alice", {userId:"user_demo_alice", verified:true}],
    ["fixture-bob", {userId:"user_demo_bob", verified:true}],
    ["fixture-carla", {userId:"user_demo_carla", verified:true}],
    ["fixture-admin", {userId:"user_demo_admin", verified:true}],
    ["fixture-eve", {userId:"user_demo_eve", verified:true}],
  ]);
  // Test harness alone converts fake session labels to verified synthetic actors.
  // Production createApp() receives no adapter and exposes NONE of these routes.
  const adapter: InternalPreviewTestAdapter = {
    scope: "TEST_ONLY_FICTIONAL_RECORDS",
    repo,
    resolveVerifiedActor: async req =>
      sessionActors.get(req.header("X-Fixture-Session") ?? "") ?? null,
  };
  return { app: createApp({internalPreview:adapter}), repo };
}

describe("P3.16/17 synthetic Express service integration (NOT production auth)", () => {
  it("is UNMOUNTED by the normal production server; spoof headers do nothing", async () => {
    const app = createApp();
    for (const [method, path] of [
      ["get", org + "/leads"],
      ["post", org + "/leads"],
      ["patch", org + "/leads/LEAD-DEMO-201"],
    ] as const) {
      const res = await request(app)[method](path)
        .set("X-Fixture-Session","fixture-alice")
        .set("X-User-Id","user_demo_alice")
        .set("X-Role","SALES_EDITOR")
        .send(method === "get" ? undefined : {stage:"contacted"});
      assert.equal(res.status, 404, method);
      assert.deepEqual(res.body, {error:{code:"NOT_FOUND",message:"Endpoint is not available"}});
    }
  });

  it("enforces actor verification, org membership, and admin-no-wildcard", async () => {
    const {app} = testFixture();
    assert.equal((await request(app).get(org+"/leads")).status, 401);
    assert.equal((await request(app).get(org+"/leads").set("X-User-Id","user_demo_alice")).status, 401);
    assert.equal((await request(app).get(org+"/leads").set("X-Fixture-Session","fixture-admin")).status, 403);
    assert.equal((await request(app).get(org+"/leads").set("X-Fixture-Session","fixture-eve")).status, 404);
    assert.equal((await request(app).get(cedar+"/leads").set("X-Fixture-Session","fixture-alice")).status, 404);
    assert.equal((await request(app).get(org+"/leads").set("X-Fixture-Session","fixture-carla")).status, 404);
  });

  it("filters all list/count/read results before response and redacts contacts for read-only role", async () => {
    const {app} = testFixture();
    const alice = await request(app).get(org+"/leads").set("X-Fixture-Session","fixture-alice");
    assert.equal(alice.status,200);
    assert.equal(alice.headers["cache-control"],"no-store");
    assert.equal(alice.body.scope,"synthetic-only");
    assert.equal(alice.body.count,1);
    assert.deepEqual(alice.body.data.map((row:{id:string})=>row.id), ["LEAD-DEMO-201"]);
    assert.equal(alice.body.data[0].email,"orchid@example.com");

    const bob = await request(app).get(org+"/leads").set("X-Fixture-Session","fixture-bob");
    assert.equal(bob.status,200);
    assert.equal(bob.body.count,2);
    assert.deepEqual(bob.body.data.map((row:{id:string})=>row.id), ["LEAD-DEMO-201","LEAD-DEMO-202"]);
    assert.equal(bob.body.data[0].email,undefined);
    assert.equal(bob.body.data[0].contact,undefined);
    assert.equal((await request(app).get(org+"/leads/LEAD-DEMO-301").set("X-Fixture-Session","fixture-bob")).status,404);
    assert.equal((await request(app).get(org+"/leads/LEAD-DEMO-202").set("X-Fixture-Session","fixture-alice")).status,404);
  });

  it("allows scoped synthetic create with server-assigned owner and idempotent replay", async () => {
    const {app} = testFixture();
    const send = (body: object, key:string) => request(app).post(org+"/leads")
      .set("X-Fixture-Session","fixture-alice").set("Idempotency-Key",key).send(body);
    const first = await send(newLead,"DEMO-create-0001");
    assert.equal(first.status,201);
    assert.equal(first.body.data.organization,newLead.organization);
    assert.equal(first.body.data.version,1);
    assert.match(first.body.data.id,/^LEAD-DEMO-\d{3}$/);
    assert.equal(first.body.replayed,false);
    const duplicate = await send(newLead,"DEMO-create-0001");
    assert.equal(duplicate.status,200);
    assert.equal(duplicate.body.replayed,true);
    assert.equal(duplicate.body.data.id,first.body.data.id);
    const count = await request(app).get(org+"/leads").set("X-Fixture-Session","fixture-alice");
    assert.equal(count.body.count,2);
    assert.equal((await send({...newLead,organization:"Demo Other Store"},"DEMO-create-0001")).status,409);
  });

  it("rejects prohibited fields, real addresses, missing key and reader writes", async () => {
    const {app} = testFixture();
    const send = (body:object) => request(app).post(org+"/leads")
      .set("X-Fixture-Session","fixture-alice").set("Idempotency-Key","DEMO-create-0002").send(body);
    assert.equal((await send({...newLead, tenantId:"org_demo_cedar"})).status,400);
    assert.equal((await send({...newLead, email:"real@business.com"})).status,400);
    assert.equal((await send({...newLead, cardNumber:"4111111111111111"})).status,400);
    const noKey = await request(app).post(org+"/leads")
      .set("X-Fixture-Session","fixture-alice").send(newLead);
    assert.equal(noKey.status,400);
    const reader = await request(app).post(org+"/leads")
      .set("X-Fixture-Session","fixture-bob").set("Idempotency-Key","DEMO-create-0002").send(newLead);
    assert.equal(reader.status,403);
    assert.ok(!JSON.stringify(reader.body).includes(newLead.email));
  });

  it("enforces owned-row scope, If-Match versions and valid stage transitions", async () => {
    const {app} = testFixture();
    const target = org+"/leads/LEAD-DEMO-201";
    const patch = (body:object, version:string, key:string) => request(app).patch(target)
      .set("X-Fixture-Session","fixture-alice")
      .set("If-Match",version).set("Idempotency-Key",key).send(body);
    const leap = await patch({stage:"qualified"},'"1"',"DEMO-patch-0001");
    assert.equal(leap.status,422);
    const done = await patch({stage:"contacted"},'"1"',"DEMO-patch-0002");
    assert.equal(done.status,200);
    assert.equal(done.body.data.version,2);
    assert.equal(done.body.data.stage,"contacted");
    const replay = await patch({stage:"contacted"},'"1"',"DEMO-patch-0002");
    assert.equal(replay.status,200);
    assert.equal(replay.body.replayed,true);
    assert.equal((await patch({stage:"qualified"},'"1"',"DEMO-patch-0003")).status,409);
    assert.equal((await patch({stage:"qualified"},'"2"',"DEMO-patch-0004")).status,200);
    assert.equal((await patch({stage:"new"},'"3"',"DEMO-patch-0005")).status,422);
    assert.equal((await patch({stage:"qualified",ownerId:"user_demo_carla"},'"3"',"DEMO-patch-0006")).status,400);
    const inaccessible = await request(app).patch(org+"/leads/LEAD-DEMO-202")
      .set("X-Fixture-Session","fixture-alice").set("If-Match",'"2"')
      .set("Idempotency-Key","DEMO-patch-0007").send({stage:"qualified"});
    assert.equal(inaccessible.status,404);
  });

  it("immediately denies after synthetic membership revocation (including replay)", async () => {
    const {app,repo} = testFixture();
    const path = org+"/leads";
    const success = await request(app).get(path).set("X-Fixture-Session","fixture-alice");
    assert.equal(success.status,200);
    repo.setMembershipActive("org_demo_orchid","user_demo_alice",false);
    assert.equal((await request(app).get(path).set("X-Fixture-Session","fixture-alice")).status,404);
    assert.equal((await request(app).post(path).set("X-Fixture-Session","fixture-alice")
      .set("Idempotency-Key","DEMO-create-0001").send(newLead)).status,404);
  });

  it("never leaks stack traces or a resolver error to clients", async () => {
    const repo = createFictionalLeadRepository();
    const app = createApp({internalPreview:{
      scope:"TEST_ONLY_FICTIONAL_RECORDS",repo,
      resolveVerifiedActor:async()=>{throw new Error("unsafe-customer-secret");},
    }});
    const res = await request(app).get(org+"/leads");
    assert.equal(res.status,503);
    assert.equal(res.body.error.code,"UNAVAILABLE");
    assert.ok(!JSON.stringify(res.body).includes("unsafe-customer-secret"));
  });
});
