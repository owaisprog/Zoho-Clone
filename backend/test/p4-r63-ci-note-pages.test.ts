import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import {P4R63CiNotePager}
 from "../src/platform/p4-r63-ci-note-pager.js";
import {P4R28Denied}
 from "../src/platform/p4-r28-ci-org-service.js";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const OWNER={userId:"user_demo_alice",verified:true as const};
const err=(code:string)=>(e:unknown)=>e instanceof P4R28Denied&&e.code===code;
test("R63 HMAC pagination cannot run outside disposable CI",async()=>{
 const svc=new P4R63CiNotePager({} as never,Buffer.alloc(32),
  {...ENV,CI:"false"});
 await assert.rejects(svc.page(OWNER,randomUUID(),randomUUID(),null),
  err("UNAVAILABLE"));
});
test("R63 validation denies nonowner actors and malformed cursors before DB",async()=>{
 const p=new P4R63CiNotePager({} as never,Buffer.alloc(32),ENV);
 await assert.rejects(p.page(null,randomUUID(),randomUUID(),null),
  err("IDENTITY_REQUIRED"));
 await assert.rejects(p.page(OWNER,randomUUID(),"bad",null),
  err("INVALID_INPUT"));
 await assert.rejects(p.page(OWNER,randomUUID(),randomUUID(),"unsigned"),
  err("INVALID_INPUT"));
});
