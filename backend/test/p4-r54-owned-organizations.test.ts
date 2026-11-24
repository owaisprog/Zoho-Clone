import assert from "node:assert/strict";
import {test} from "node:test";
import {P4R54CiOwnedOrganizations}
 from "../src/platform/p4-r54-ci-owned-organizations.js";
import {P4R28Denied}
 from "../src/platform/p4-r28-ci-org-service.js";
const ENV:NodeJS.ProcessEnv={CI:"true",GITHUB_ACTIONS:"true",
 PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",
 PGUSER:"demo_ci",PGPASSWORD:"fake_ci_not_for_real_accounts"};
const err=(status:number,code:string)=>(e:unknown)=>
 e instanceof P4R28Denied&&e.status===status&&e.code===code;
test("R54 org discovery disabled outside disposable CI",async()=>{
 const srv=new P4R54CiOwnedOrganizations({} as never,{...ENV,CI:"false"});
 await assert.rejects(srv.list({userId:"user_demo_alice",verified:true}),
  err(503,"UNAVAILABLE"));
});
test("R54 org discovery requires a verified mapped actor",async()=>{
 const srv=new P4R54CiOwnedOrganizations({} as never,ENV);
 await assert.rejects(srv.list(null),err(401,"IDENTITY_REQUIRED"));
 await assert.rejects(srv.list({userId:"invalid",verified:true} as never),
  err(401,"IDENTITY_REQUIRED"));
});
