import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R51CiOwnerActivityService}
 from "../src/platform/p4-r51-ci-owner-activity.js";
import {P4R28Denied} from "../src/platform/p4-r28-ci-org-service.js";
const ORG="10000000-0000-4000-8000-000000000001";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const ALICE={userId:"user_demo_alice",verified:true as const};
const denied=(status:number,code:P4R28Denied["code"])=>(e:unknown)=>
 e instanceof P4R28Denied&&e.status===status&&e.code===code;
test("R51 owner events fail closed outside CI",async()=>{
 const svc=new P4R51CiOwnerActivityService({} as never,{...ENV,CI:"false"});
 await assert.rejects(svc.list(ALICE,ORG,"all"),denied(503,"UNAVAILABLE"));
});
test("R51 require verified actor, valid tenant and allowlisted event kind",async()=>{
 const svc=new P4R51CiOwnerActivityService({} as never,ENV);
 await assert.rejects(svc.list(null,ORG,"all"),
  denied(401,"IDENTITY_REQUIRED"));
 await assert.rejects(svc.list(ALICE,"wrong","all"),
  denied(403,"ACCESS_DENIED"));
 await assert.rejects(svc.list(ALICE,ORG,"private.audit"),
  denied(400,"INVALID_INPUT"));
});
