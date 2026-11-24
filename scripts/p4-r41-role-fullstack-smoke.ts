/** R41 actual typed frontend HTTP -> RS256 Express -> disposable PostgreSQL. */
import assert from "node:assert/strict";
import {generateKeyPairSync,randomBytes,sign} from "node:crypto";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import express from "express";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment}
 from "../backend/src/platform/p4-v1-ci-prisma.js";
import {P4R28CiOrganizationService}
 from "../backend/src/platform/p4-r28-ci-org-service.js";
import {P4R32CiOutboxIssuer}
 from "../backend/src/platform/p4-r32-ci-outbox.js";
import {P4R30CiAcceptanceService}
 from "../backend/src/platform/p4-r30-ci-invitation-acceptance.js";
import {P4R40CiMemberRoles}
 from "../backend/src/platform/p4-r40-ci-member-roles.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R41CiMemberRoleClient,P4R41CiError}
 from "../frontend/src/lib/p4-r41-ci-member-role-client.js";
import {P4R41CiRoleController}
 from "../frontend/src/lib/p4-r41-ci-member-role-controller.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:5});
 const encKey=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r41",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const now=Math.floor(Date.now()/1000);
 const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const jwt=(sub:string)=>{
  const header=encode({typ:"JWT",alg:"RS256",kid:jwk.kid});
  const payload=encode({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,
   iat:now-5,exp:now+300,email_verified:true});
  const signed=header+"."+payload;
  return signed+"."+sign("RSA-SHA256",Buffer.from(signed),pair.privateKey)
   .toString("base64url");
 };
 const ownerJwt=jwt("auth0|demo-alice"),memberJwt=jwt("auth0|demo-bob");
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer:new P4R32CiOutboxIssuer(pool,encKey,process.env),
  acceptance:new P4R30CiAcceptanceService(pool,process.env),
  roles:new P4R40CiMemberRoles(pool,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const address=server.address() as AddressInfo;
 const base="http://127.0.0.1:"+address.port+"/";
 const client=new P4R41CiMemberRoleClient(base,async()=>ownerJwt,fetch,process.env);
 const view=new P4R41CiRoleController(client);
 try{
  phase="synthetic-org-membership";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const one=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R41 Client",slug:"demo-r41-client",
  });
  const two=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R41 Other",slug:"demo-r41-other",
  });
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES($1,$2,'MEMBER',true)",
   [one.id,"user_demo_bob"]);
  phase="real-typed-owner-read";
  const initial=await view.refresh(one.id);
  assert.equal(initial.phase,"ready");
  assert.deepEqual(initial.members,[{
   userId:"user_demo_bob",role:"SALES_REP",revision:0,
  }]);
  assert.deepEqual(await client.members(two.id),[]);
  phase="real-typed-role-change";
  const changed=await view.change(one.id,"user_demo_bob","SALES_MANAGER",0);
  assert.equal(changed.phase,"changed");
  assert.deepEqual(await client.members(one.id),[{
   userId:"user_demo_bob",role:"SALES_MANAGER",revision:1,
  }]);
  phase="real-stale-revision";
  await assert.rejects(client.change(one.id,"user_demo_bob","SALES_REP",0),
   e=>e instanceof P4R41CiError&&e.status===409&&e.code==="CONFLICT");
  const denied=await view.change(one.id,"user_demo_bob","SALES_REP",0);
  assert.equal(denied.phase,"denied");assert.deepEqual(denied.members,[]);
  phase="real-signed-non-owner";
  const member=new P4R41CiMemberRoleClient(base,async()=>memberJwt,fetch,process.env);
  // Bob's mapper is deliberately unverified by default, so identity fails closed.
  await assert.rejects(member.members(one.id),
   e=>e instanceof P4R41CiError&&[401,403].includes(e.status));
  phase="real-cross-tenant-and-bad-identity";
  const foreign="10000000-0000-4000-8000-000000000099";
  await assert.rejects(client.members(foreign),
   e=>e instanceof P4R41CiError&&e.status===403);
  const fake=new P4R41CiMemberRoleClient(base,async()=>"abc.def.ghi",fetch,process.env);
  await assert.rejects(fake.members(one.id),
   e=>e instanceof P4R41CiError&&e.status===401);
  phase="audit-secret-and-context";
  const rows=await pool.query("SELECT before_role,after_role,revision"+
   " FROM p4_r40_ci.role_events WHERE org_id=$1",[one.id]);
  assert.deepEqual(rows.rows,[{before_role:"SALES_REP",
   after_role:"SALES_MANAGER",revision:1}]);
  const serialized=JSON.stringify(view.snapshot());
  for(const secret of [ownerJwt,memberJwt,"token_hash","encrypted_token",
   "auth0|","postgresql://"]){
   assert.equal(serialized.includes(secret),false);
  }
  const scope=await pool.query("SELECT current_user AS role,"+
   " nullif(current_setting('app.actor_id',true),'') AS actor,"+
   " nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R41 typed frontend localhost signed member role HTTP -> real disposable PostgreSQL PASS; NO_GO\n");
 }finally{
  encKey.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(()=>{
 process.stderr.write("P4 R41 typed fullstack CI smoke FAILED at "+phase+"\n");
 process.exitCode=1;
});
