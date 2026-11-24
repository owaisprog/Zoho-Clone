import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R57CiCrmLeads}
 from "../src/platform/p4-r57-ci-crm-leads.js";
import {P4R28Denied}
 from "../src/platform/p4-r28-ci-org-service.js";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const ORG="10000000-0000-4000-8000-000000000001";
const OWNER={userId:"user_demo_alice",verified:true as const};
const denied=(code:string)=>(e:unknown)=>e instanceof P4R28Denied&&e.code===code;
test("R57 CRM service is strictly disabled outside CI",async()=>{
 const svc=new P4R57CiCrmLeads({} as never,{...ENV,CI:"false"});
 await assert.rejects(svc.list(OWNER,ORG),denied("UNAVAILABLE"));
});
test("R57 CRM lead creation enforces fictional email/tenant and signed identity",async()=>{
 const svc=new P4R57CiCrmLeads({} as never,ENV);
 await assert.rejects(svc.list(null,ORG),denied("IDENTITY_REQUIRED"));
 await assert.rejects(svc.list(OWNER,"bad"),denied("ACCESS_DENIED"));
 await assert.rejects(svc.create(OWNER,ORG,{companyName:"Real Company",
  contactEmail:"real@gmail.com",source:"WEBSITE"}),denied("INVALID_INPUT"));
});
