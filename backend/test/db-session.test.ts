import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  withPreviewDbTransaction, type PgPoolLike, type PgConnection,
} from "../src/internal/db-session.js";
import { authorizePreview } from "../src/internal/policy.js";
import { createFictionalLeadRepository } from "../src/internal/fixtures.js";
import { ScopedSqlLeadReader } from "../src/internal/sql-lead-reads.js";
import { InternalApiError } from "../src/internal/contracts.js";

const actor = { userId:"user_demo_alice",verified:true } as const;
const repo = createFictionalLeadRepository();
const ctx = authorizePreview(actor,repo.findMembership("org_demo_orchid",actor.userId),"org_demo_orchid","read");

function mockPool(rows: Record<string,unknown>[] = []) {
  const calls: { sql:string; values:readonly unknown[] }[] = [];
  let released = 0;
  const conn: PgConnection = {
    query:async (sql, values = []) => { calls.push({sql,values}); return {rows}; },
    release:() => { released++; },
  };
  const pool: PgPoolLike = {connect:async()=>conn};
  return {pool,calls,get released(){return released;}};
}

describe("P3.20 tenant-safe PostgreSQL adapter boundaries", () => {
  it("sets LOCAL context within transaction and clears connection on completion", async () => {
    const db = mockPool();
    const result = await withPreviewDbTransaction(db.pool,ctx,async conn => {
      await conn.query("SELECT 1"); return "ok";
    });
    assert.equal(result,"ok");
    assert.deepEqual(db.calls.map(x=>x.sql),[
      "BEGIN",
      "SELECT set_config('app.tenant_id', $1, true), set_config('app.actor_id', $2, true)",
      "SELECT 1", "COMMIT",
    ]);
    assert.deepEqual(db.calls[1]?.values,["org_demo_orchid","user_demo_alice"]);
    assert.equal(db.released,1);
  });
  it("rolls back and releases on any query or operation failure", async () => {
    const db = mockPool();
    await assert.rejects(withPreviewDbTransaction(db.pool,ctx,async () => {
      throw new Error("synthetic query failed");
    }),/synthetic query failed/);
    assert.equal(db.calls.at(-1)?.sql,"ROLLBACK");
    assert.equal(db.released,1);
  });
  it("denies forged or inactive contexts before connecting", async () => {
    let connected = false;
    const pool: PgPoolLike = {connect:async()=>{connected=true;throw Error("should not connect");}};
    const forged = {...ctx,orgId:"org_demo_cedar"};
    await assert.rejects(withPreviewDbTransaction(pool,forged,async()=>null),(error:unknown)=>
      error instanceof InternalApiError && error.httpStatus === 403);
    assert.equal(connected,false);
    const suspended = {...ctx,membership:{...ctx.membership,active:false}};
    await assert.rejects(withPreviewDbTransaction(pool,suspended,async()=>null));
    assert.equal(connected,false);
  });
  it("uses parameterized tenant+owner SQL and excludes contacts for reader role", async () => {
    const bob={userId:"user_demo_bob",verified:true} as const;
    const bobCtx=authorizePreview(bob,repo.findMembership("org_demo_orchid",bob.userId),"org_demo_orchid","read");
    const db=mockPool([{id:"LEAD-DEMO-201",organization:"Demo Orchid Shops",stage:"new",version:1}]);
    const response=await new ScopedSqlLeadReader(db.pool).list(bobCtx);
    assert.equal(response.count,1);
    assert.equal(response.data[0]?.email,undefined);
    const query=db.calls.find(x=>x.sql.includes("FROM synthetic.leads"));
    assert.ok(query);
    assert.match(query.sql,/WHERE org_id = \$1 AND \(owner_id = \$2 OR \$3::boolean\)/);
    assert.ok(!query.sql.includes("contact, email"));
    assert.deepEqual(query.values,["org_demo_orchid","user_demo_bob",true]);
  });
  it("gets one row with tenant-scoped id and never trusts a chosen org", async () => {
    const db=mockPool([{
      id:"LEAD-DEMO-201",organization:"Demo Orchid Shops",stage:"new",
      version:1,contact:"Example Contact A",email:"orchid@example.com",
    }]);
    const response=await new ScopedSqlLeadReader(db.pool).read(ctx,"LEAD-DEMO-201");
    assert.equal(response.email,"orchid@example.com");
    const query=db.calls.find(x=>x.sql.includes("FROM synthetic.leads"));
    assert.ok(query);
    assert.match(query.sql,/WHERE org_id = \$1 AND id = \$2/);
    assert.deepEqual(query.values,["org_demo_orchid","LEAD-DEMO-201","user_demo_alice",false]);
    await assert.rejects(new ScopedSqlLeadReader(db.pool).read(ctx,"REAL-123"));
  });
  it("fails closed for unexpected database records and never leaks their content", async () => {
    const db=mockPool([{id:"LEAD-DEMO-201",organization:"Actual Private Client",stage:"new",version:1}]);
    await assert.rejects(new ScopedSqlLeadReader(db.pool).list(ctx),(error:unknown)=>
      error instanceof InternalApiError && error.httpStatus === 503);
  });
});