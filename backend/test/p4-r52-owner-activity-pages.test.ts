import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R52CiOwnerActivityPager}
 from "../src/platform/p4-r52-ci-owner-activity-pager.js";
import {P4R28Denied} from "../src/platform/p4-r28-ci-org-service.js";
const ORG="10000000-0000-4000-8000-000000000001";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const ALICE={userId:"user_demo_alice",verified:true as const};
const error=(status:number,code:P4R28Denied["code"])=>(e:unknown)=>
 e instanceof P4R28Denied&&e.status===status&&e.code===code;
test("R52 page rejects production env and invalid HMAC length",async()=>{
 const svc=new P4R52CiOwnerActivityPager({} as never,
  Buffer.alloc(32),{...ENV,CI:"false"});
 await assert.rejects(svc.page(ALICE,ORG,"all",null),
  error(503,"UNAVAILABLE"));
 const key=new P4R52CiOwnerActivityPager({} as never,Buffer.alloc(5),ENV);
 await assert.rejects(key.page(ALICE,ORG,"all",null),
  error(503,"UNAVAILABLE"));
});
test("R52 missing identity, invalid org or filter fail before connecting",async()=>{
 const svc=new P4R52CiOwnerActivityPager({} as never,Buffer.alloc(32),ENV);
 await assert.rejects(svc.page(null,ORG,"all",null),
  error(401,"IDENTITY_REQUIRED"));
 await assert.rejects(svc.page(ALICE,"foreign","all",null),
  error(403,"ACCESS_DENIED"));
 await assert.rejects(svc.page(ALICE,ORG,"OWNER",null),
  error(400,"INVALID_INPUT"));
 await assert.rejects(svc.page(ALICE,ORG,"all","invalid"),
  error(400,"INVALID_INPUT"));
});
