import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import {P4R64CiLeadTasks}
 from "../src/platform/p4-r64-ci-lead-tasks.js";
import {P4R28Denied}
 from "../src/platform/p4-r28-ci-org-service.js";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const OWNER={userId:"user_demo_alice",verified:true as const};
const err=(code:string)=>(e:unknown)=>e instanceof P4R28Denied&&e.code===code;
test("R64 tasks are disabled outside CI and require signed owner",async()=>{
 const bad=new P4R64CiLeadTasks({} as never,{...ENV,CI:"false"});
 await assert.rejects(bad.list(OWNER,randomUUID(),randomUUID()),err("UNAVAILABLE"));
 const svc=new P4R64CiLeadTasks({} as never,ENV);
 await assert.rejects(svc.list(null,randomUUID(),randomUUID()),
  err("IDENTITY_REQUIRED"));
});
test("R64 task service rejects invalid text, due dates and stale revision before DB",async()=>{
 const svc=new P4R64CiLeadTasks({} as never,ENV);
 await assert.rejects(svc.create(OWNER,randomUUID(),randomUUID(),{
  title:"Demo call customer for update",dueDate:"2026-02-30"}),
  err("INVALID_INPUT"));
 await assert.rejects(svc.complete(OWNER,randomUUID(),randomUUID(),
  randomUUID(),{expectedRevision:1}),err("INVALID_INPUT"));
});
