import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R43CiMemberRevokeService}
 from "../src/platform/p4-r43-ci-member-revoke-service.js";
import {P4R28Denied} from "../src/platform/p4-r28-ci-org-service.js";
import {createP4R43CiMemberRevokeRouter}
 from "../src/platform/p4-r43-ci-member-revoke-router.js";
const ORG="10000000-0000-4000-8000-000000000001";
const ALICE={userId:"user_demo_alice",verified:true as const};
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const reject=(status:number,code:P4R28Denied["code"])=>(e:unknown)=>
 e instanceof P4R28Denied&&e.status===status&&e.code===code;
test("R43 revocation cannot operate on actual non-CI database",async()=>{
 const s=new P4R43CiMemberRevokeService({} as never,{CI:"false"});
 await assert.rejects(s.revoke(ALICE,ORG,"user_demo_bob"),
  reject(503,"UNAVAILABLE"));
});
test("R43 revoked target and self owner are denied before database use",async()=>{
 const s=new P4R43CiMemberRevokeService({} as never,ENV);
 await assert.rejects(s.revoke(null,ORG,"user_demo_bob"),
  reject(401,"IDENTITY_REQUIRED"));
 await assert.rejects(s.revoke(ALICE,ORG,"user_demo_alice"),
  reject(403,"ACCESS_DENIED"));
 await assert.rejects(s.revoke(ALICE,ORG,"person@merchant.com"),
  reject(403,"ACCESS_DENIED"));
 await assert.rejects(s.revoke(ALICE,"wrong-org","user_demo_bob"),
  reject(403,"ACCESS_DENIED"));
});
test("R43 production router cannot be activated",()=>{
 assert.throws(()=>createP4R43CiMemberRevokeRouter({} as never,
  {...ENV,NODE_ENV:"production"}),/P4_V1_CI_PRISMA_DENIED/);
});
