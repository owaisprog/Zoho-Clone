import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {rehearseP4R36Readiness,P4R36CiRollbackDrill}
 from "../src/platform/p4-r36-ci-readiness-rehearsal.js";
const ENV={CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
 PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",PGUSER:"demo_ci",
 PGPASSWORD:"fake_ci_not_for_real_accounts"};
const green={identity:async()=>true,database:async()=>true,
 delivery:async()=>true};
describe("P4 R36 synthetic staging dependency and recovery preflight",()=>{
 it("healthy fictional probes never approve staging or production",async()=>{
  const result=await rehearseP4R36Readiness(green,ENV);
  assert.deepEqual(result.dependencies,{
   identity:"simulated-pass",database:"simulated-pass",
   delivery:"simulated-pass",
  });
  assert.equal(result.release,"NO_GO");
  assert.equal(result.canDeploy,false);
  assert.equal(result.stagingProvisioned,false);
  assert.ok(result.blockers.includes("ORIGINAL_ACCEPTANCE_727_NOT_EXECUTED"));
 });
 it("failed dependency and thrown private errors return safe codes",async()=>{
  const result=await rehearseP4R36Readiness({
   identity:async()=>true,
   database:async()=>{throw Error("postgres://secret");},
   delivery:async()=>false,
  },ENV);
  assert.equal(result.dependencies.database,"fail");
  assert.equal(result.dependencies.delivery,"fail");
  assert.equal(JSON.stringify(result).includes("secret"),false);
  assert.ok(result.blockers.includes("DATABASE_DEPENDENCY_FAILED"));
 });
 it("refuses live staging, owner Neon or non-CI execution",async()=>{
  for(const patch of [{CI:"false"},{GITHUB_ACTIONS:"false"},
   {NODE_ENV:"production"},{PGHOST:"neon.tech"},
   {PGDATABASE:"production"}]){
   await assert.rejects(
    rehearseP4R36Readiness(green,{...ENV,...patch}),
    /P4_R36_CI_ONLY/);
  }
 });
 it("rejects missing fixture probes before generating any readiness claim",async()=>{
  await assert.rejects(rehearseP4R36Readiness({
   identity:async()=>true,database:null as never,delivery:async()=>true,
  },ENV),/P4_R36_INVALID_FIXTURE_PROBES/);
 });
 it("does not simulate a canary without snapshot preparation",()=>{
  const drill=new P4R36CiRollbackDrill();
  assert.throws(()=>drill.simulateCanary(),/R36_SNAPSHOT_REQUIRED/);
  assert.equal(drill.view().deploymentTriggered,false);
 });
 it("rolls back a fictional fault in strict sequence without deploying",()=>{
  const drill=new P4R36CiRollbackDrill();
  drill.prepareSnapshot();drill.simulateCanary();drill.injectFailure();
  drill.simulateRollback();
  assert.deepEqual(drill.view(),{
   state:"restored-in-memory",release:"NO_GO",deploymentTriggered:false,
  });
  assert.throws(()=>drill.simulateCanary(),/R36_SNAPSHOT_REQUIRED|R36_INVALID_SEQUENCE/);
 });
 it("blocks fake rollback before an actual simulated fault",()=>{
  const drill=new P4R36CiRollbackDrill();
  drill.prepareSnapshot();drill.simulateCanary();
  assert.throws(()=>drill.simulateRollback(),/R36_INVALID_SEQUENCE/);
 });
});
