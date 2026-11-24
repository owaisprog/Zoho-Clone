import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R49CiMemberPager}
 from "../src/platform/p4-r49-ci-member-pager.js";
import {P4R28Denied} from "../src/platform/p4-r28-ci-org-service.js";
const ORG="10000000-0000-4000-8000-000000000001";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const ACTOR={userId:"user_demo_alice",verified:true as const};
const bad=(status:number,code:P4R28Denied["code"])=>(e:unknown)=>
 e instanceof P4R28Denied&&e.status===status&&e.code===code;
test("R49 refuses real environments and keys not 32 bytes",async()=>{
 for(const [key,env] of [[Buffer.alloc(32),{...ENV,CI:"false"}],
  [Buffer.alloc(16),ENV]] as const){
  const service=new P4R49CiMemberPager({} as never,key,env);
  await assert.rejects(service.page(ACTOR,ORG,"all","",null),
   bad(503,"UNAVAILABLE"));
 }
});
test("R49 denies unsigned actors, malformed tenant and invalid filters",async()=>{
 const service=new P4R49CiMemberPager({} as never,Buffer.alloc(32),ENV);
 await assert.rejects(service.page(null,ORG,"all","",null),
  bad(401,"IDENTITY_REQUIRED"));
 await assert.rejects(service.page(ACTOR,"bad","all","",null),
  bad(403,"ACCESS_DENIED"));
 for(const [status,search,cursor] of [["OWNER","",null],
  ["all","%",null],["all","x".repeat(41),null],
  ["all","","garbage"]] as const){
  await assert.rejects(service.page(ACTOR,ORG,status,search,cursor),
   bad(400,"INVALID_INPUT"));
 }
});
