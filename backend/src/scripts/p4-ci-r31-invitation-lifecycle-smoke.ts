/**
 * P4 R31: end-to-end disposable CI workflow: owner HTTP issuance ->
 * private in-process fictional mailbox -> recipient HTTP redemption ->
 * one persisted active MEMBER. No real email/Auth0 or externally accessible API.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import express from "express";
import request from "supertest";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "../platform/p4-v1-ci-prisma.js";
import {P4R28CiOrganizationService} from "../platform/p4-r28-ci-org-service.js";
import {P4R29CiInvitationService} from "../platform/p4-r29-ci-invitation-service.js";
import {P4R30CiAcceptanceService} from "../platform/p4-r30-ci-invitation-acceptance.js";
import {createP4R30CiInvitationAcceptanceRouter}
 from "../platform/p4-r30-ci-invitation-accept-router.js";
import {P4R31CiInvitationIssuer,P4R31CiFixtureMailbox}
 from "../platform/p4-r31-ci-invitation-issuer.js";
import {createP4R31CiInvitationIssuerRouter}
 from "../platform/p4-r31-ci-invitation-issue-router.js";

const ALICE={userId:"user_demo_alice",verified:true} as const;
const BOB={userId:"user_demo_bob",verified:true} as const;
const CARLA={userId:"user_demo_carla",verified:true} as const;
const DIANA={userId:"user_demo_diana",verified:true} as const;
let phase="initialize";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:5});
 const orgs=new P4R28CiOrganizationService(pool,process.env);
 const drafts=new P4R29CiInvitationService(pool,process.env);
 const redeem=new P4R30CiAcceptanceService(pool,process.env);
 const mailbox=new P4R31CiFixtureMailbox(10);
 const issuer=new P4R31CiInvitationIssuer(pool,mailbox,process.env);
 const issueAppFor=(actor:typeof ALICE|typeof BOB|null,
  useIssuer=issuer)=>{
  const app=express();app.use(express.json({limit:"16kb"}));
  app.use("/_p4_r31_ci",createP4R31CiInvitationIssuerRouter({
   issuer:useIssuer,resolveVerifiedActor:async()=>actor,
  }));
  return app;
 };
 const acceptAppFor=(actor:typeof CARLA|typeof DIANA|null)=>{
  const app=express();app.use(express.json({limit:"16kb"}));
  app.use("/_p4_r30_ci",createP4R30CiInvitationAcceptanceRouter({
   service:redeem,resolveVerifiedActor:async()=>actor,
  }));
  return app;
 };
 const alice=issueAppFor(ALICE),bob=issueAppFor(BOB),
  anonymous=issueAppFor(null);
 const carla=acceptAppFor(CARLA),diana=acceptAppFor(DIANA),
  missing=acceptAppFor(null);
 const createOrg=async(label:string,slug:string)=>
  orgs.create(ALICE,{name:label,slug});
 const url=(id:string)=>"/_p4_r31_ci/"+id+"/issue";
 const accept="/_p4_r30_ci/accept";
 const create=async(id:string,email:string)=>
  request(alice).post(url(id)).send({recipientEmail:email});
 try{
  // Identity fixture never originates from request user headers.
  for(const [user,email] of [["user_demo_carla","carla@example.com"],
    ["user_demo_diana","diana@example.com"]] as const){
   await pool.query("INSERT INTO p4_synthetic.users(id) VALUES ($1)"+
    " ON CONFLICT (id) DO NOTHING",[user]);
   await pool.query(
    "INSERT INTO p4_synthetic.identity_subjects"+
    " (issuer,external_subject,user_id,canonical_email,email_verified)"+
    " VALUES ('https://demo.us.auth0.com/',$1,$2,$3,true)"+
    " ON CONFLICT (issuer,external_subject) DO NOTHING",
    ["auth0|"+user,user,email]);
  }
  const primary=await createOrg("Demo R31 Workflow","demo-r31-workflow");
  phase="anonymous-and-cross-owner";
  const anonymousIssue=await request(anonymous).post(url(primary.id))
   .set("x-user-id",ALICE.userId).set("x-role","OWNER")
   .send({recipientEmail:"carla@example.com"});
  assert.equal(anonymousIssue.status,401);
  const foreignIssue=await request(bob).post(url(primary.id))
   .set("x-user-id",ALICE.userId).set("x-role","OWNER")
   .send({recipientEmail:"carla@example.com"});
  assert.equal(foreignIssue.status,403);
  const forged=await request(alice).post(url(primary.id))
   .send({recipientEmail:"carla@example.com",role:"OWNER"});
  assert.equal(forged.status,400);
  phase="issued-and-delivered";
  const issued=await create(primary.id,"carla@example.com");
  assert.equal(issued.status,201);
  assert.equal(issued.headers["cache-control"],"no-store, private");
  assert.deepEqual(Object.keys(issued.body.data).sort(),[
   "expiresAt","id","issuedAt","organizationId","recipientEmail",
   "role","status","version",
  ]);
  assert.equal(issued.body.data.status,"pending");
  assert.equal(issued.body.data.role,"MEMBER");
  assert.equal(mailbox.pendingCount(),1);
  const firstToken=mailbox.takeForFixtureTest("carla@example.com");
  assert.ok(firstToken);
  assert.match(firstToken,/^[0-9a-f]{64}$/);
  assert.equal(mailbox.takeForFixtureTest("carla@example.com"),null);
  const stored=await pool.query(
   "SELECT token_hash,status,version FROM p4_synthetic.invitations WHERE id=$1",
   [issued.body.data.id]);
  assert.equal(stored.rows[0].token_hash,
   createHash("sha256").update(firstToken).digest("hex"));
  assert.notEqual(stored.rows[0].token_hash,firstToken);
  const listed=await drafts.list(ALICE,primary.id);
  assert.equal(listed.length,1);
  assert.equal(listed[0]?.id,issued.body.data.id);
  phase="wrong-recipient";
  const wrong=await request(diana).post(accept).send({token:firstToken})
   .set("x-recipient-email","carla@example.com");
  assert.equal(wrong.status,403);
  assert.deepEqual(wrong.body,{error:{code:"ACCESS_DENIED"}});
  phase="single-use-acceptance";
  const accepted=await request(carla).post(accept).send({token:firstToken});
  assert.equal(accepted.status,200);
  assert.deepEqual(accepted.body,{scope:"disposable-ci-only",
   data:{accepted:true,membershipActivated:true}});
  const membership=await pool.query(
   "SELECT i.status,i.version,m.role,m.active"+
   " FROM p4_synthetic.invitations i JOIN p4_synthetic.memberships m"+
   " ON m.org_id=i.org_id AND m.user_id=$2 WHERE i.id=$1",
   [issued.body.data.id,CARLA.userId]);
  assert.deepEqual(membership.rows,[{status:"accepted",version:2,
   role:"MEMBER",active:true}]);
  const replay=await request(carla).post(accept).send({token:firstToken});
  assert.equal(replay.status,403);
  assert.equal((await request(missing).post(accept)
   .set("x-user-id",CARLA.userId).send({token:firstToken})).status,401);
  phase="revoked-undelivered";
  const revokedOrg=await createOrg("Demo R31 Revoked","demo-r31-revoked");
  const revokedIssue=await create(revokedOrg.id,"carla@example.com");
  assert.equal(revokedIssue.status,201);
  const revokedToken=mailbox.takeForFixtureTest("carla@example.com");
  assert.ok(revokedToken);
  const revoked=await drafts.revoke(ALICE,revokedOrg.id,revokedIssue.body.data.id);
  assert.equal(revoked.status,"revoked");
  assert.equal((await request(carla).post(accept)
   .send({token:revokedToken})).status,403);
  phase="expired-undelivered";
  const expiredOrg=await createOrg("Demo R31 Expired","demo-r31-expired");
  const expiredIssue=await create(expiredOrg.id,"carla@example.com");
  assert.equal(expiredIssue.status,201);
  const expiredToken=mailbox.takeForFixtureTest("carla@example.com");
  assert.ok(expiredToken);
  await pool.query(
   "UPDATE p4_synthetic.invitations"+
   " SET issued_at=now()-interval '49 hours',"+
   " expires_at=now()-interval '1 hour' WHERE id=$1",
   [expiredIssue.body.data.id]);
  assert.equal((await request(carla).post(accept)
   .send({token:expiredToken})).status,403);
  phase="concurrent-redeem";
  const raceOrg=await createOrg("Demo R31 Race","demo-r31-race");
  const raceIssue=await create(raceOrg.id,"diana@example.com");
  assert.equal(raceIssue.status,201);
  const raceToken=mailbox.takeForFixtureTest("diana@example.com");
  assert.ok(raceToken);
  const race=await Promise.all(Array.from({length:4},()=>
   request(diana).post(accept).send({token:raceToken})));
  assert.deepEqual(race.map(r=>r.status).sort(),[200,403,403,403]);
  const raceRow=await pool.query(
   "SELECT status,version FROM p4_synthetic.invitations WHERE id=$1",
   [raceIssue.body.data.id]);
  assert.deepEqual(raceRow.rows,[{status:"accepted",version:2}]);
  phase="concurrent-issue";
  const duplicateOrg=await createOrg("Demo R31 Duplicate","demo-r31-duplicate");
  const duplicates=await Promise.all(Array.from({length:2},()=>
   create(duplicateOrg.id,"carla@example.com")));
  assert.deepEqual(duplicates.map(r=>r.status).sort(),[201,409]);
  assert.equal(mailbox.pendingCount(),1);
  assert.ok(mailbox.takeForFixtureTest("carla@example.com"));
  phase="delivery-failure-compensation";
  const outageOrg=await createOrg("Demo R31 Outage","demo-r31-outage");
  const disabledMailbox=new P4R31CiFixtureMailbox(0);
  const outageIssuer=new P4R31CiInvitationIssuer(pool,disabledMailbox,process.env);
  const outage=await request(issueAppFor(ALICE,outageIssuer))
   .post(url(outageOrg.id)).send({recipientEmail:"diana@example.com"});
  assert.equal(outage.status,503);
  assert.deepEqual(outage.body,{error:{code:"UNAVAILABLE"}});
  assert.equal(disabledMailbox.pendingCount(),0);
  const committedAfterOutage=await pool.query(
   "SELECT status FROM p4_synthetic.invitations"+
   " WHERE org_id=$1 AND recipient_email=$2",
   [outageOrg.id,"diana@example.com"]);
  assert.deepEqual(committedAfterOutage.rows,[{status:"revoked"}]);
  phase="response-privacy-and-context";
  const sensitive=[firstToken,revokedToken,expiredToken,raceToken,
   stored.rows[0].token_hash,"auth0|","user_demo_alice","postgresql://",
   "token_hash","raw_token"];
  for(const response of [anonymousIssue,foreignIssue,forged,issued,wrong,
   accepted,replay,revokedIssue,expiredIssue,raceIssue,...race,
   ...duplicates,outage]){
   const serialized=JSON.stringify(response.body);
   for(const secret of sensitive)assert.equal(serialized.includes(secret),false);
  }
  const context=await pool.query(
   "SELECT current_user AS role,"+
   " nullif(current_setting('app.actor_id',true),'') AS actor,"+
   " nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(context.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R31 CI-only owner issue -> private fixture mailbox -> "+
   "recipient redeem -> active member, replay/race/revoke/expiry/failure PASS\n");
 }finally{await pool.end();}
}
main().catch(()=>{
 process.stderr.write("P4 R31 disposable issuance-to-redemption FAILED at "+phase+"\n");
 process.exitCode=1;
});
