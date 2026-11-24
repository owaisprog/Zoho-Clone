import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R58CiCrmLeadStages}
 from "../src/platform/p4-r58-ci-crm-lead-stages.js";
import {P4R28Denied}
 from "../src/platform/p4-r28-ci-org-service.js";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const ORG="10000000-0000-4000-8000-000000000001";
const ID="10000000-0000-4000-8000-000000000002";
const OWNER={userId:"user_demo_alice",verified:true as const};
const denied=(code:string)=>(e:unknown)=>e instanceof P4R28Denied&&e.code===code;
test("R58 stage backend denies non-CI environments and absent actors",async()=>{
 const svc=new P4R58CiCrmLeadStages({} as never,{...ENV,CI:"false"});
 await assert.rejects(svc.history(OWNER,ORG,ID),denied("UNAVAILABLE"));
 const guarded=new P4R58CiCrmLeadStages({} as never,ENV);
 await assert.rejects(guarded.history(null,ORG,ID),denied("IDENTITY_REQUIRED"));
});
test("R58 stage change validates status and expected revision before SQL",async()=>{
 const svc=new P4R58CiCrmLeadStages({} as never,ENV);
 await assert.rejects(svc.change(OWNER,ORG,ID,{
  status:"QUALIFIED",expectedRevision:-1}),denied("INVALID_INPUT"));
 await assert.rejects(svc.change(OWNER,ORG,"not-uuid",{
  status:"CONTACTED",expectedRevision:0}),denied("INVALID_INPUT"));
});
