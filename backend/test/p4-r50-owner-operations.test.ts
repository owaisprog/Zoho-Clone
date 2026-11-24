import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R50CiOwnerOperations}
 from "../src/platform/p4-r50-ci-owner-operations.js";
import {P4R28Denied}
 from "../src/platform/p4-r28-ci-org-service.js";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const ORG="10000000-0000-4000-8000-000000000001";
const ALICE={userId:"user_demo_alice",verified:true as const};
const error=(status:number,code:P4R28Denied["code"])=>(e:unknown)=>
 e instanceof P4R28Denied&&e.status===status&&e.code===code;
test("R50 no real database reads when CI guard fails",async()=>{
 const service=new P4R50CiOwnerOperations({} as never,{...ENV,CI:"false"});
 await assert.rejects(service.summary(ALICE,ORG),error(503,"UNAVAILABLE"));
});
test("R50 verified actor is mandatory and caller cannot provide arbitrary org",async()=>{
 const service=new P4R50CiOwnerOperations({} as never,ENV);
 await assert.rejects(service.summary(null,ORG),error(401,"IDENTITY_REQUIRED"));
 await assert.rejects(service.summary(ALICE,"malformed-org"),
  error(403,"ACCESS_DENIED"));
});
