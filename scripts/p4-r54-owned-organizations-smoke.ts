/** R54 signed fictional owner multi-organization discovery in real CI PG. */
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
import {P4R54CiOwnedOrganizations}
 from "../backend/src/platform/p4-r54-ci-owned-organizations.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R54CiOwnedOrganizationsClient,P4R54CiOrganizationError}
 from "../frontend/src/lib/p4-r54-ci-owned-organizations-client.js";
let phase="start";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:6});
 const key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r54",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const now=Math.floor(Date.now()/1000);
 const enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const jwt=(sub:string)=>{
  const h=enc({typ:"JWT",alg:"RS256",kid:jwk.kid});
  const p=enc({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,
   iat:now-5,exp:now+300,email_verified:true});
  const data=h+"."+p;
  return data+"."+sign("RSA-SHA256",Buffer.from(data),pair.privateKey)
   .toString("base64url");
 };
 const alice=jwt("auth0|demo-alice"),bob=jwt("auth0|demo-bob");
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer:new P4R32CiOutboxIssuer(pool,key,process.env),
  acceptance:new P4R30CiAcceptanceService(pool,process.env),
  ownerOrganizations:new P4R54CiOwnedOrganizations(pool,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port+"/";
 const owner=new P4R54CiOwnedOrganizationsClient(base,async()=>alice,fetch,process.env);
 const member=new P4R54CiOwnedOrganizationsClient(base,async()=>bob,fetch,process.env);
 try{
  phase="verified-fictional-actors-and-owner-orgs";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  const ownedA=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R54 Alpha",slug:"demo-r54-alpha",
  });
  const ownedB=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R54 Beta",slug:"demo-r54-beta",
  });
  const bobOwned=await orgs.create({userId:"user_demo_bob",verified:true},{
   name:"Demo R54 Bob",slug:"demo-r54-bob",
  });
  phase="signed-owner-and-nonowner-discovery";
  const a=await owner.list();
  assert.deepEqual(a.map(x=>x.id),[ownedA.id,ownedB.id]);
  assert.deepEqual(a.map(x=>x.ownerRole),["OWNER","OWNER"]);
  const b=await member.list();
  assert.deepEqual(b.map(x=>x.id),[bobOwned.id]);
  for(const record of [...a,...b]){
   assert.equal(JSON.stringify(record).includes("email"),false);
   assert.equal(JSON.stringify(record).includes("external_subject"),false);
  }
  phase="revoked-owner-is-not-listed";
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[ownedB.id]);
  assert.deepEqual((await owner.list()).map(x=>x.id),[ownedA.id]);
  assert.deepEqual((await member.list()).map(x=>x.id),[bobOwned.id]);
  phase="forged-JWT-denied";
  const forged=new P4R54CiOwnedOrganizationsClient(
   base,async()=>"a.b.c",fetch,process.env);
  await assert.rejects(forged.list(),
   e=>e instanceof P4R54CiOrganizationError&&e.status===401);
  phase="restricted-function-only-execution-and-clean-session";
  const client=await pool.connect();
  try{
   await client.query("BEGIN");
   await client.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
   const grants=await client.query("SELECT"+
    " has_function_privilege(current_user,"+
    " 'p4_r54_ci.list_owned_organizations()','EXECUTE') AS permitted");
   assert.equal(grants.rows[0]?.permitted,true);
   // No fake actor in this session: even valid EXECUTE cannot enumerate.
   await assert.rejects(client.query(
    "SELECT * FROM p4_r54_ci.list_owned_organizations()"));
   await client.query("ROLLBACK");
  }finally{client.release();}
  const scope=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R54 signed owned-organization chooser, revoked and foreign owner isolation, denied runtime table read PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=false,canonical_email='alice@example.com'"+
   " WHERE user_id='user_demo_bob'");
  key.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(e=>{
 const x=e as {name?:string;code?:string;status?:number};
 process.stderr.write("P4 R54 owner chooser smoke FAILED at "+phase+
  " type="+(x.name??"unknown")+" code="+(x.code??"none")+
  " status="+(x.status??"none")+"\n");process.exitCode=1;
});
