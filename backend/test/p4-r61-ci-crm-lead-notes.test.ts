import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R61CiLeadNotes}
 from "../src/platform/p4-r61-ci-lead-notes.js";
import {P4R28Denied}
 from "../src/platform/p4-r28-ci-org-service.js";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const ORG="10000000-0000-4000-8000-000000000001";
const LEAD="10000000-0000-4000-8000-000000000002";
const owner={userId:"user_demo_alice",verified:true as const};
const err=(code:string)=>(e:unknown)=>e instanceof P4R28Denied&&e.code===code;
test("R61 synthetic note service disabled outside CI and requires signed actor",async()=>{
 const svc=new P4R61CiLeadNotes({} as never,{...ENV,CI:"false"});
 await assert.rejects(svc.list(owner,ORG,LEAD),err("UNAVAILABLE"));
 const guarded=new P4R61CiLeadNotes({} as never,ENV);
 await assert.rejects(guarded.list(null,ORG,LEAD),err("IDENTITY_REQUIRED"));
});
test("R61 rejects real PII-like note input and malformed lead before DB",async()=>{
 const svc=new P4R61CiLeadNotes({} as never,ENV);
 await assert.rejects(svc.add(owner,ORG,LEAD,{
  noteText:"real alice@gmail.com"}),err("INVALID_INPUT"));
 await assert.rejects(svc.add(owner,ORG,"not-uuid",{
  noteText:"Demo called for follow up"}),err("INVALID_INPUT"));
});
