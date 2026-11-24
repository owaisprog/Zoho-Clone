/**
 * P4 R44 fullstack owner directory: typed frontend HTTP -> signed RS256
 * Express -> fresh SQL membership state in disposable PostgreSQL only.
 */
import assert from "node:assert/strict";
import {generateKeyPairSync,randomBytes,sign} from "node:crypto";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import express from "express";
import request from "supertest";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment}
 from "../backend/src/platform/p4-v1-ci-prisma.js";
import {P4R28CiOrganizationService}
 from "../backend/src/platform/p4-r28-ci-org-service.js";
import {P4R32CiOutboxIssuer,P4R32CiOutboxWorker,P4R32CiRecipientMailbox}
 from "../backend/src/platform/p4-r32-ci-outbox.js";
import {P4R30CiAcceptanceService}
 from "../backend/src/platform/p4-r30-ci-invitation-acceptance.js";
import {P4R40CiMemberRoles}
 from "../backend/src/platform/p4-r40-ci-member-roles.js";
import {P4R43CiMemberRevokeService}
 from "../backend/src/platform/p4-r43-ci-member-revoke-service.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R41CiMemberRoleClient,P4R41CiError}
 from "../frontend/src/lib/p4-r41-ci-member-role-client.js";
import {P4R34CiHttpClient}
 from "../frontend/src/lib/p4-r34-ci-http-client.js";
import {P4R44CiDirectoryController}
 from "../frontend/src/lib/p4-r44-ci-member-directory-controller.js";

const ALICE="user_demo_alice",BOB="user_demo_bob",CARLA="user_demo_carla";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:6});
 const key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r44",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const now=Math.floor(Date.now()/1000);
 const encode=(data:unknown)=>Buffer.from(JSON.stringify(data)).toString("base64url");
 const jwt=(sub:string)=>{
  const header=encode({alg:"RS256",typ:"JWT",kid:jwk.kid});
  const payload=encode({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,
   iat:now-5,exp:now+300,email_verified:true});
  const message=header+"."+payload;
  return message+"."+sign("RSA-SHA256",Buffer.from(message),pair.privateKey)
   .toString("base64url");
 };
 const ownerJwt=jwt("auth0|demo-alice"),bobJwt=jwt("auth0|demo-bob");
 const issuer=new P4R32CiOutboxIssuer(pool,key,process.env);
 const worker=new P4R32CiOutboxWorker(pool,key,process.env);
 const mailbox=new P4R32CiRecipientMailbox();
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer,
  acceptance:new P4R30CiAcceptanceService(pool,process.env),
  roles:new P4R40CiMemberRoles(pool,process.env),
  revoker:new P4R43CiMemberRevokeService(pool,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const address=server.address() as AddressInfo;
 const base="http://127.0.0.1:"+address.port+"/";
 const owner=new P4R41CiMemberRoleClient(base,async()=>ownerJwt,fetch,process.env);
 const member=new P4R41CiMemberRoleClient(base,async()=>bobJwt,fetch,process.env);
 const inviteClient=new P4R34CiHttpClient(base,async who=>
  who==="owner"?ownerJwt:bobJwt,fetch,process.env);
 const ctl=new P4R44CiDirectoryController(owner);
 try{
  phase="create-isolated-fictional-organizations";
  const orgService=new P4R28CiOrganizationService(pool,process.env);
  const org=await orgService.create({userId:ALICE,verified:true},{
   name:"Demo R44 Directory",slug:"demo-r44-directory",
  });
  const other=await orgService.create({userId:ALICE,verified:true},{
   name:"Demo R44 Secondary",slug:"demo-r44-secondary",
  });
  await pool.query("INSERT INTO p4_synthetic.users(id) VALUES ($1)"+
   " ON CONFLICT (id) DO NOTHING",[CARLA]);
  await pool.query("INSERT INTO p4_synthetic.identity_subjects"+
   " (issuer,external_subject,user_id,canonical_email,email_verified)"+
   " VALUES ($1,$2,$3,'carla@example.com',true)"+
   " ON CONFLICT (issuer,external_subject) DO UPDATE"+
   " SET canonical_email='carla@example.com',email_verified=true",
   [CI_ISSUER,"auth0|user_demo_carla",CARLA]);
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id=$1",[BOB]);
  for(const id of [BOB,CARLA]){
   await pool.query("INSERT INTO p4_synthetic.memberships"+
    " (org_id,user_id,role,active) VALUES ($1,$2,'MEMBER',true)",
    [org.id,id]);
  }
  phase="owner-read-filter-and-query";
  const initial=await ctl.refresh(org.id,"all","");
  assert.equal(initial.phase,"ready");
  assert.deepEqual(initial.members.map(m=>[m.userId,m.email,m.active]),[
   [BOB,"bob@example.com",true],[CARLA,"carla@example.com",true],
  ]);
  assert.deepEqual((await owner.directory(org.id,"active","bob")).map(x=>x.userId),
   [BOB]);
  assert.deepEqual((await owner.directory(org.id,"all","CARLA@EXAMPLE.COM"))
   .map(x=>x.userId),[CARLA]);
  assert.deepEqual(await owner.directory(org.id,"revoked",""),[]);
  assert.deepEqual(await owner.directory(other.id,"all",""),[]);
  phase="owner-query-denials-and-cross-tenant";
  const endpoint="/_p4_r33_ci/owner/"+org.id+"/member-directory";
  const malformed=await request(app).get(endpoint+"?status=all&q=&role=OWNER")
   .set("Authorization","Bearer "+ownerJwt);
  assert.equal(malformed.status,400);
  assert.deepEqual(malformed.body,{error:{code:"INVALID_INPUT"}});
  await assert.rejects(member.directory(org.id,"all",""),
   e=>e instanceof P4R41CiError&&e.status===403&&e.code==="ACCESS_DENIED");
  const forged=new P4R41CiMemberRoleClient(base,async()=>"a.b.c",fetch,process.env);
  await assert.rejects(forged.directory(org.id,"all",""),
   e=>e instanceof P4R41CiError&&e.status===401);
  await assert.rejects(owner.directory(
   "10000000-0000-4000-8000-000000000099","all",""),
   e=>e instanceof P4R41CiError&&e.status===403);
  phase="privilege-change-visible-in-directory";
  await owner.change(org.id,BOB,"SALES_MANAGER",0);
  const elevated=await owner.directory(org.id,"active","bob");
  assert.deepEqual(elevated,[{
   userId:BOB,email:"bob@example.com",role:"SALES_MANAGER",
   revision:1,active:true,
  }]);
  phase="revoke-and-refresh-live-state";
  const revoked=await ctl.revokeAndRefresh(org.id,BOB);
  assert.equal(revoked.phase,"updated");
  const revokedRow=revoked.members.find(m=>m.userId===BOB);
  assert.deepEqual(revokedRow,{userId:BOB,email:"bob@example.com",
   role:"SALES_MANAGER",revision:1,active:false});
  assert.deepEqual((await owner.directory(org.id,"revoked",""))
   .map(x=>x.userId),[BOB]);
  assert.deepEqual((await owner.directory(org.id,"active",""))
   .map(x=>x.userId),[CARLA]);
  assert.deepEqual((await owner.members(org.id)).map(x=>x.userId),[CARLA]);
  phase="recipient-bound-reactivation";
  const issued=await inviteClient.issue(org.id,"bob@example.com");
  assert.equal(issued.status,"pending");
  assert.equal(await worker.deliverOne(mailbox),"delivered");
  const token=mailbox.take("bob@example.com");
  assert.ok(token);
  assert.deepEqual(await inviteClient.accept(token),{
   accepted:true,membershipActivated:true,
  });
  await assert.rejects(inviteClient.accept(token),
   e=>e instanceof Error);
  const reactivated=await ctl.refresh(org.id,"active","bob");
  assert.equal(reactivated.phase,"ready");
  assert.deepEqual(reactivated.members,[{
   userId:BOB,email:"bob@example.com",role:"SALES_REP",
   revision:2,active:true,
  }]);
  assert.deepEqual(await owner.directory(org.id,"revoked",""),[]);
  phase="verified-email-visibility";
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=false WHERE user_id=$1",[CARLA]);
  const withoutEmail=await owner.directory(org.id,"all","carla");
  assert.deepEqual(withoutEmail,[{
   userId:CARLA,email:null,role:"SALES_REP",revision:0,active:true,
  }]);
  assert.deepEqual(await owner.directory(org.id,"all","carla@example.com"),[]);
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=true WHERE user_id=$1",[CARLA]);
  phase="owner-revocation-clears-controller";
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id=$2",[org.id,ALICE]);
  try{
   const denied=await ctl.refresh(org.id,"all","");
   assert.equal(denied.phase,"denied");
   assert.deepEqual(denied.members,[]);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id=$2",[org.id,ALICE]);
  }
  phase="bounded-directory-fails-closed";
  const extras=Array.from({length:19},(_,i)=>
   "user_demo_x"+String.fromCharCode(97+i));
  for(const id of extras){
   await pool.query("INSERT INTO p4_synthetic.users(id) VALUES ($1)"+
    " ON CONFLICT (id) DO NOTHING",[id]);
   await pool.query("INSERT INTO p4_synthetic.memberships"+
    " (org_id,user_id,role,active) VALUES($1,$2,'MEMBER',true)",
    [org.id,id]);
  }
  await assert.rejects(owner.directory(org.id,"all",""),
   e=>e instanceof P4R41CiError&&e.status===503&&e.code==="UNAVAILABLE");
  assert.deepEqual((await owner.directory(org.id,"all","bob"))
   .map(x=>x.userId),[BOB]);
  phase="database-grants-and-no-secret-leak";
  const grant=await pool.query("SELECT has_function_privilege("+
   "'p4_synthetic_ci_runtime',"+
   "'p4_r44_ci.search_member_directory(uuid,text,text)','EXECUTE') AS invoke");
  assert.deepEqual(grant.rows,[{invoke:true}]);
  const output=JSON.stringify(reactivated)+JSON.stringify(malformed.body);
  for(const secret of [ownerJwt,bobJwt,token,"auth0|","token_hash",
   "encrypted_token","postgresql://","request_id"]){
   assert.equal(output.includes(secret),false);
  }
  const scope=await pool.query("SELECT current_user AS role,"+
   " nullif(current_setting('app.actor_id',true),'') AS actor,"+
   " nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R44 signed owner directory, actual PostgreSQL active/revoked search, member revoke and recipient reactivation PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=false,canonical_email='alice@example.com'"+
   " WHERE user_id=$1",[BOB]);
  key.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(()=>{
 process.stderr.write("P4 R44 signed member directory integration FAILED at "+phase+"\n");
 process.exitCode=1;
});
