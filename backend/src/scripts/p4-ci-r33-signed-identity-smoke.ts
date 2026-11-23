/** CI-only real RSA JWT -> database mapping -> outbox -> acceptance. */
import assert from "node:assert/strict";
import {generateKeyPairSync,randomBytes,sign} from "node:crypto";
import express from "express";
import request from "supertest";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "../platform/p4-v1-ci-prisma.js";
import {P4R28CiOrganizationService} from "../platform/p4-r28-ci-org-service.js";
import {P4R32CiOutboxIssuer,P4R32CiOutboxWorker,P4R32CiRecipientMailbox}
 from "../platform/p4-r32-ci-outbox.js";
import {P4R30CiAcceptanceService}
 from "../platform/p4-r30-ci-invitation-acceptance.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../platform/p4-r33-ci-jwt-verifier.js";
const ALICE={userId:"user_demo_alice",verified:true} as const;
const CARLA={userId:"user_demo_carla",verified:true} as const;
let phase="init";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:5});
 const now=Math.floor(Date.now()/1000);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),kid:"r33-ci-key-primary",
  alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const make=(sub:string,overrides:Record<string,unknown>={},
  headerOverride:Record<string,unknown>={})=>{
  const h=encode({alg:"RS256",typ:"JWT",kid:jwk.kid,...headerOverride});
  const p=encode({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,iat:now-10,
   exp:now+300,email_verified:true,...overrides});
  const signed=h+"."+p;
  return signed+"."+sign("RSA-SHA256",Buffer.from(signed),pair.privateKey)
   .toString("base64url");
 };
 const aliceJwt=make("auth0|user_demo_alice");
 const carlaJwt=make("auth0|user_demo_carla");
 const aliceHeaders={Authorization:"Bearer "+aliceJwt};
 const carlaHeaders={Authorization:"Bearer "+carlaJwt};
 const key=randomBytes(32);
 const mapper=new P4R33CiActorMapper(pool,[jwk],()=>now,process.env);
 const issuer=new P4R32CiOutboxIssuer(pool,key,process.env);
 const worker=new P4R32CiOutboxWorker(pool,key,process.env);
 const mailbox=new P4R32CiRecipientMailbox();
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper,issuer,acceptance:new P4R30CiAcceptanceService(pool,process.env),
 }));
 const orgs=new P4R28CiOrganizationService(pool,process.env);
 try{
  await pool.query("INSERT INTO p4_synthetic.users(id) VALUES ($1)"+
   " ON CONFLICT (id) DO NOTHING",[CARLA.userId]);
  await pool.query("INSERT INTO p4_synthetic.identity_subjects"+
   " (issuer,external_subject,user_id,canonical_email,email_verified)"+
   " VALUES ($1,$2,$3,'carla@example.com',true)"+
   " ON CONFLICT (issuer,external_subject) DO NOTHING",
   [CI_ISSUER,"auth0|"+CARLA.userId,CARLA.userId]);
  const org=await orgs.create(ALICE,{
   name:"Demo R33 Signed",slug:"demo-r33-signed",
  });
  const route="/_p4_r33_ci/owner/"+org.id+"/issue";
  phase="reject-unverified-and-forged";
  const missing=await request(app).post(route)
   .set("x-user-id",ALICE.userId).set("x-role","OWNER")
   .send({recipientEmail:"carla@example.com"});
  phase="missing-"+missing.status+"-"+String(missing.body?.error?.code??"ok");
  assert.equal(missing.status,401);
  const badAudience=await request(app).post(route)
   .set("Authorization","Bearer "+make("auth0|user_demo_alice",
    {aud:"urn:forged"})).send({recipientEmail:"carla@example.com"});
  phase="bad-audience-"+badAudience.status+"-"+String(badAudience.body?.error?.code??"ok");
  assert.equal(badAudience.status,401);
  const invalidIssuer=await request(app).post(route)
   .set("Authorization","Bearer "+make("auth0|user_demo_alice",
    {iss:"https://evil.example.com/"}))
   .send({recipientEmail:"carla@example.com"});
  phase="invalid-issuer-"+invalidIssuer.status+"-"+String(invalidIssuer.body?.error?.code??"ok");
  assert.equal(invalidIssuer.status,401);
  const forged=carlaJwt.split(".");
  forged[1]=encode({iss:CI_ISSUER,aud:CI_AUDIENCE,
   sub:"auth0|user_demo_alice",iat:now-10,exp:now+300,email_verified:true});
  const badSignature=await request(app).post(route)
   .set("Authorization","Bearer "+forged.join("."))
   .send({recipientEmail:"carla@example.com"});
  phase="forged-signature-"+badSignature.status+"-"+String(badSignature.body?.error?.code??"ok");
  assert.equal(badSignature.status,401);
  phase="direct-jwt-validation";
  const {verifyP4R33CiToken}=await import("../platform/p4-r33-ci-jwt-verifier.js");
  assert.equal(verifyP4R33CiToken(carlaJwt,[jwk],now,process.env).emailVerified,true);
  phase="db-subject-mapping";
  const mapping=await pool.query(
   "SELECT user_id,canonical_email,email_verified FROM p4_synthetic.identity_subjects"+
   " WHERE issuer=$1 AND external_subject=$2 AND email_verified=true LIMIT 2",
   [CI_ISSUER,"auth0|user_demo_carla"]);
  assert.equal(mapping.rowCount,1);
  assert.equal(mapping.rows[0].email_verified,true);
  assert.equal(mapping.rows[0].canonical_email,"carla@example.com");
  phase="direct-mapped-resolver";
  const mappedActor=await mapper.resolve({header:(name:string)=>
   name==="authorization"?"Bearer "+carlaJwt:undefined} as never);
  assert.equal(mappedActor?.userId,CARLA.userId);
  const nonOwner=await request(app).post(route)
   .set(carlaHeaders).set("x-role","OWNER")
   .send({recipientEmail:"carla@example.com"});
  phase="non-owner-"+nonOwner.status+"-"+String(nonOwner.body?.error?.code??"ok");
  assert.equal(nonOwner.status,403);
  phase="signed-owner-issue";
  const issued=await request(app).post(route).set(aliceHeaders)
   .send({recipientEmail:"carla@example.com"});
  assert.equal(issued.status,201);
  assert.equal(issued.body.data.role,"MEMBER");
  assert.equal(issued.headers["cache-control"],"no-store, private");
  assert.equal(await worker.deliverOne(mailbox),"delivered");
  const token=mailbox.take("carla@example.com");
  assert.ok(token);
  phase="signed-recipient-accept";
  const accept="/_p4_r33_ci/recipient/accept";
  assert.equal((await request(app).post(accept)
   .set(aliceHeaders).send({token})).status,403);
  const accepted=await request(app).post(accept)
   .set(carlaHeaders).send({token});
  assert.equal(accepted.status,200);
  assert.deepEqual(accepted.body.data,{
   accepted:true,membershipActivated:true,
  });
  assert.equal((await request(app).post(accept)
   .set(carlaHeaders).send({token})).status,403);
  const member=await pool.query(
   "SELECT m.role,m.active,i.status"+
   " FROM p4_synthetic.memberships m"+
   " JOIN p4_synthetic.invitations i ON i.org_id=m.org_id"+
   " WHERE m.org_id=$1 AND m.user_id=$2 AND i.id=$3",
   [org.id,CARLA.userId,issued.body.data.id]);
  assert.deepEqual(member.rows,[{role:"MEMBER",active:true,status:"accepted"}]);
  phase="verified-email-revocation";
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=false WHERE user_id=$1",[CARLA.userId]);
  try{
   const denied=await request(app).post(accept)
    .set(carlaHeaders).send({token:"ab".repeat(32)});
   assert.equal(denied.status,401);
  }finally{
   await pool.query("UPDATE p4_synthetic.identity_subjects"+
    " SET email_verified=true WHERE user_id=$1",[CARLA.userId]);
  }
  phase="leaks-and-pool";
  for(const response of [missing,badAudience,invalidIssuer,
   badSignature,nonOwner,issued,accepted]){
   const output=JSON.stringify(response.body);
   for(const privateValue of [aliceJwt,carlaJwt,token,
    "token_hash","encrypted_token","auth0|","postgresql://"]){
    assert.equal(output.includes(privateValue),false);
   }
  }
  const context=await pool.query(
   "SELECT current_user AS role,"+
   " nullif(current_setting('app.actor_id',true),'') AS actor,"+
   " nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(context.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R33 signed RS256 fictional issuer and DB recipient map to protected issuance/redemption PASS\n");
 }finally{key.fill(0);await pool.end();}
}
main().catch(()=>{
 process.stderr.write("P4 R33 signed identity integration FAILED at "+phase+"\n");
 process.exitCode=1;
});
