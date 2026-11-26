import {test} from "node:test";
import assert from "node:assert/strict";
import {localWorkerConfig,processDemoJob,runLocalWorker} from "../src/platform/p4-ci-local-worker.js";
const env={P4_LOCAL_WORKER_ENABLED:"true",P4_LOCAL_REDIS_URL:"redis://127.0.0.1:6380"};
const runId="87000000-0000-4000-8000-000000000001";
const data={scope:"synthetic-only",kind:"demo-report",runId};
test("local worker requires explicit opt-in and exactly the loopback Docker endpoint",()=>{
 assert.equal(localWorkerConfig(env).port,6380);
 for(const override of [
  {P4_LOCAL_WORKER_ENABLED:"false"},{NODE_ENV:"production"},{VERCEL:"1"},
  {VERCEL_ENV:"preview"},{P4_STAGE_OWNER_ACTIVATION:"approved"},
  {P4_LOCAL_REDIS_URL:"rediss://redis.example:6380"},{P4_LOCAL_REDIS_URL:"redis://localhost:6380"},
  {P4_LOCAL_REDIS_URL:"redis://127.0.0.1:6379"},{P4_LOCAL_REDIS_URL:"redis://127.0.0.1:6380/1"},
  {P4_LOCAL_REDIS_URL:"redis://user:fixture@127.0.0.1:6380"},
 ])assert.throws(()=>localWorkerConfig({...env,...override}),/P4_LOCAL_WORKER_DENIED/);
});
test("only fixed synthetic report and exact run identifier accepted",()=>{
 assert.deepEqual(processDemoJob("demo-report",runId,data,runId),{scope:"synthetic-only",records:3,total:60});
 for(const payload of [null,[],{...data,email:"fixture@example.invalid"},{...data,runId:"wrong"},{...data,scope:"live"},{...data,kind:"email"}]){
  assert.throws(()=>processDemoJob("demo-report",runId,payload,runId),/P4_LOCAL_WORKER_DENIED/);
 }
 assert.throws(()=>processDemoJob("email",runId,data,runId),/P4_LOCAL_WORKER_DENIED/);
 assert.throws(()=>processDemoJob("demo-report","other",data,runId),/P4_LOCAL_WORKER_DENIED/);
});
test("disabled execution rejects before connecting",async()=>{
 await assert.rejects(runLocalWorker({}),/P4_LOCAL_WORKER_DENIED/);
});
