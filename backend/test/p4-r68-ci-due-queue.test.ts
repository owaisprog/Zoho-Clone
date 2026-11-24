import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import {P4R68CiDueQueue} from "../src/platform/p4-r68-ci-due-queue.js";
import {P4R28Denied} from "../src/platform/p4-r28-ci-org-service.js";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const OWNER={userId:"user_demo_alice",verified:true as const};
const err=(code:string)=>(e:unknown)=>e instanceof P4R28Denied&&e.code===code;
test("R68 due queue refuses non-CI runtimes and unverified actors",async()=>{
 const blocked=new P4R68CiDueQueue({} as never,Buffer.alloc(32),{...ENV,CI:"false"});
 await assert.rejects(blocked.page(OWNER,randomUUID(),"2026-12-31",null),
  err("UNAVAILABLE"));
 const service=new P4R68CiDueQueue({} as never,Buffer.alloc(32),ENV);
 await assert.rejects(service.page(null,randomUUID(),"2026-12-31",null),
  err("IDENTITY_REQUIRED"));
});
test("R68 due queue validates ISO dates and requires signed scoped cursor",async()=>{
 const service=new P4R68CiDueQueue({} as never,Buffer.alloc(32),ENV);
 await assert.rejects(service.page(OWNER,randomUUID(),"2026-02-30",null),
  err("INVALID_INPUT"));
 await assert.rejects(service.page(OWNER,randomUUID(),"2026-12-31","unsigned"),
  err("INVALID_INPUT"));
 await assert.rejects(service.page(OWNER,randomUUID(),"2026-12-31","aaa.bbb"),
  err("INVALID_INPUT"));
});
