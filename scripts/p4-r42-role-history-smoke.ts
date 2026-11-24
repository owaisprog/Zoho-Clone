/** R42: typed frontend history -> signed Express -> disposable PostgreSQL event log. */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import {generateKeyPairSync,randomBytes,sign} from "node:crypto";
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
import {P4R42CiHistoryController}
 from "../frontend/src/lib/p4-r42-ci-role-history-controller.js";
let phase="init";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:5});
 const key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r42",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const now=Math.floor(Date.now()/1000);
 const enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const make=(sub:string)=>{
  const h=enc({typ:"JWT",alg:"RS256",kid:jwk.kid});
  const p=enc({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,
   iat:now-5,exp:now+300,email_verified:true});
  const signed=h+"."+p;
  return signed+"."+sign("RSA-SHA256",Buffer.from(signed),pair.privateKey)
   .toString("base64url");
 };
 const alice=make("auth0|demo-alice"),bob=make("auth0|demo-bob");
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer:new P4R32CiOutboxIssuer(pool,key,process.env),
  acceptance:new P4R30CiAcceptanceService(pool,process.env),
  roles:new P4R40CiMemberRoles(pool,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const address=server.address() as AddressInfo;
 const base="http://127.0.0.1:"+address.port+"/";
 const owner=new P4R41CiMemberRoleClient(base,async()=>alice,fetch,process.env);
 const outsider=new P4R41CiMemberRoleClient(base,async()=>bob,fetch,process.env);
 const historyCtl=new P4R42CiHistoryController(owner);
 try{
  phase="create-ci-isolated-org";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const o1=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R42 History",slug:"demo-r42-history",
  });
  const o2=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R42 Isolated",slug:"demo-r42-isolated",
  });
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES($1,$2,'MEMBER',true)",
   [o1.id,"user_demo_bob"]);
  // Bob has an active membership but no OWNER permission. Verify denial
  // even after DB identity mapping declares the email verified.
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  phase="empty-history";
  assert.deepEqual(await owner.history(o1.id),[]);
  phase="atomic-history-write";
  await owner.change(o1.id,"user_demo_bob","SALES_MANAGER",0);
  await owner.change(o1.id,"user_demo_bob","SALES_REP",1);
  phase="history-read-projection";
  const view=await historyCtl.refresh(o1.id);
  assert.equal(view.phase,"ready");
  assert.equal(view.entries.length,2);
  assert.deepEqual(view.entries.map(x=>x.revision),[2,1]);
  assert.deepEqual(view.entries.map(x=>x.afterRole),["SALES_REP","SALES_MANAGER"]);
  assert.ok(view.entries.every(x=>x.actorUserId==="user_demo_alice"&&
   x.targetUserId==="user_demo_bob"));
  assert.deepEqual(await owner.history(o2.id),[]);
  phase="non-owner-signed-denial";
  await assert.rejects(outsider.history(o1.id),
   e=>e instanceof P4R41CiError&&e.status===403&&e.code==="ACCESS_DENIED");
  phase="invalid-jwt-and-tenant";
  const unsigned=new P4R41CiMemberRoleClient(base,async()=>"a.b.c",fetch,process.env);
  await assert.rejects(unsigned.history(o1.id),
   e=>e instanceof P4R41CiError&&e.status===401);
  await assert.rejects(owner.history("10000000-0000-4000-8000-000000000099"),
   e=>e instanceof P4R41CiError&&e.status===403);
  phase="current-owner-revoked";
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[o1.id]);
  try{
   await assert.rejects(owner.history(o1.id),
    e=>e instanceof P4R41CiError&&e.status===403);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[o1.id]);
  }
  phase="direct-table-grant-and-secret-check";
  const table=await pool.query(
   "SELECT has_table_privilege('p4_synthetic_ci_runtime',"+
   " 'p4_r40_ci.role_events','SELECT') AS can_read");
  assert.deepEqual(table.rows,[{can_read:false}]);
  const serialized=JSON.stringify(view);
  for(const secret of [alice,bob,"token_hash","request_id",
   "encrypted_token","postgresql://","auth0|"]){
   assert.equal(serialized.includes(secret),false);
  }
  const context=await pool.query("SELECT current_user AS role,"+
   " nullif(current_setting('app.actor_id',true),'') AS actor,"+
   " nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(context.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R42 signed scoped role history typed client, immutable PostgreSQL events, fresh owner and tenant isolation PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=false,canonical_email='alice@example.com'"+
   " WHERE user_id='user_demo_bob'");
  key.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(()=>{
 process.stderr.write("P4 R42 signed history integration FAILED at "+phase+"\n");
 process.exitCode=1;
});
