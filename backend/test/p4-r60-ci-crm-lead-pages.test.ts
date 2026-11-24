import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R60CiCrmLeadPager}
 from "../src/platform/p4-r60-ci-crm-lead-pager.js";
import {P4R28Denied} from "../src/platform/p4-r28-ci-org-service.js";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const ORG="10000000-0000-4000-8000-000000000001";
const OWNER={userId:"user_demo_alice",verified:true as const};
const denied=(status:number,code:string)=>(e:unknown)=>
 e instanceof P4R28Denied&&e.status===status&&e.code===code;
test("R60 CRM paging requires CI and 32-byte signing key",async()=>{
 await assert.rejects(new P4R60CiCrmLeadPager({} as never,
  Buffer.alloc(32),{...ENV,CI:"false"}).page(OWNER,ORG,"all","",null),
  denied(503,"UNAVAILABLE"));
 await assert.rejects(new P4R60CiCrmLeadPager({} as never,
  Buffer.alloc(2),ENV).page(OWNER,ORG,"all","",null),
  denied(503,"UNAVAILABLE"));
});
test("R60 CRM paging rejects missing identity, wrong org and invalid cursor before DB",async()=>{
 const pager=new P4R60CiCrmLeadPager({} as never,Buffer.alloc(32),ENV);
 await assert.rejects(pager.page(null,ORG,"all","",null),
  denied(401,"IDENTITY_REQUIRED"));
 await assert.rejects(pager.page(OWNER,"bad","all","",null),
  denied(403,"ACCESS_DENIED"));
 await assert.rejects(pager.page(OWNER,ORG,"STATUS","",null),
  denied(400,"INVALID_INPUT"));
 await assert.rejects(pager.page(OWNER,ORG,"all","","forged.cursor"),
  denied(400,"INVALID_INPUT"));
});
