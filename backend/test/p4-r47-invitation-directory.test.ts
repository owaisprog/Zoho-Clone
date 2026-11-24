import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R47CiInvitationDirectory}
 from "../src/platform/p4-r47-ci-invitation-directory.js";
import {P4R28Denied} from "../src/platform/p4-r28-ci-org-service.js";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const ORG="10000000-0000-4000-8000-000000000001";
const ACTOR={userId:"user_demo_alice",verified:true as const};
const fail=(status:number,code:P4R28Denied["code"])=>(e:unknown)=>
 e instanceof P4R28Denied&&e.status===status&&e.code===code;
test("R47 directory refuses production or non-CI environment",async()=>{
 const directory=new P4R47CiInvitationDirectory({} as never,
  {...ENV,CI:"false"});
 await assert.rejects(directory.list(ACTOR,ORG,"all",""),
  fail(503,"UNAVAILABLE"));
});
test("R47 missing identity and foreign synthetic org are denied before pool",async()=>{
 const directory=new P4R47CiInvitationDirectory({} as never,ENV);
 await assert.rejects(directory.list(null,ORG,"all",""),
  fail(401,"IDENTITY_REQUIRED"));
 await assert.rejects(directory.list(ACTOR,"bad","all",""),
  fail(403,"ACCESS_DENIED"));
});
test("R47 query rejects injected filters, SQL wildcard and unbounded search",async()=>{
 const directory=new P4R47CiInvitationDirectory({} as never,ENV);
 for(const [status,query] of [["OWNER",""],["all","%"],
  ["revoked","bob?role=OWNER"],["all","a".repeat(41)],
  ["",""],[null,""]] as const){
  await assert.rejects(directory.list(ACTOR,ORG,status,query),
   fail(400,"INVALID_INPUT"));
 }
});
