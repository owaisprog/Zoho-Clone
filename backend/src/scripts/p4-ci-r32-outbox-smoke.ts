/** Real disposable PostgreSQL + HTTP R32 end-to-end, no live accounts. */
import assert from "node:assert/strict";
import {randomBytes,createHash} from "node:crypto";
import express from "express";
import request from "supertest";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "../platform/p4-v1-ci-prisma.js";
import {P4R28CiOrganizationService} from "../platform/p4-r28-ci-org-service.js";
import {P4R30CiAcceptanceService} from "../platform/p4-r30-ci-invitation-acceptance.js";
import {createP4R30CiInvitationAcceptanceRouter}
 from "../platform/p4-r30-ci-invitation-accept-router.js";
import {P4R32CiOutboxIssuer,P4R32CiOutboxWorker,P4R32CiRecipientMailbox}
 from "../platform/p4-r32-ci-outbox.js";
import {createP4R32CiOutboxRouter} from "../platform/p4-r32-ci-outbox-router.js";
const ALICE={userId:"user_demo_alice",verified:true} as const;
const BOB={userId:"user_demo_bob",verified:true} as const;
const CARLA={userId:"user_demo_carla",verified:true} as const;
let phase="init";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:5});
 const key=randomBytes(32);
 const issuer=new P4R32CiOutboxIssuer(pool,key,process.env);
 const worker=new P4R32CiOutboxWorker(pool,key,process.env);
 const badWorker=new P4R32CiOutboxWorker(pool,randomBytes(32),process.env);
 const mailbox=new P4R32CiRecipientMailbox();
 const appFor=(actor:typeof ALICE|typeof BOB|null)=>{
  const app=express();app.use(express.json({limit:"16kb"}));
  app.use("/_p4_r32_ci",createP4R32CiOutboxRouter({
   issuer,resolveVerifiedActor:async()=>actor,
  }));return app;
 };
 const owner=appFor(ALICE),foreign=appFor(BOB),anon=appFor(null);
 const acceptApp=express();acceptApp.use(express.json());
 acceptApp.use("/_p4_r30_ci",createP4R30CiInvitationAcceptanceRouter({
  service:new P4R30CiAcceptanceService(pool,process.env),
  resolveVerifiedActor:async()=>CARLA,
 }));
 const organizations=new P4R28CiOrganizationService(pool,process.env);
 try{
  await pool.query("INSERT INTO p4_synthetic.users(id) VALUES ($1)"+
    " ON CONFLICT (id) DO NOTHING",[CARLA.userId]);
  await pool.query("INSERT INTO p4_synthetic.identity_subjects"+
    " (issuer,external_subject,user_id,canonical_email,email_verified)"+
    " VALUES ('https://demo.us.auth0.com/',$1,$2,'carla@example.com',true)"+
    " ON CONFLICT (issuer,external_subject) DO NOTHING",
    ["auth0|"+CARLA.userId,CARLA.userId]);
  const org=await organizations.create(ALICE,{
   name:"Demo R32 Durable",slug:"demo-r32-durable",
  });
  const url="/_p4_r32_ci/"+org.id+"/issue";
  phase="auth";
  assert.equal((await request(anon).post(url).set("x-user-id",ALICE.userId)
    .send({recipientEmail:"carla@example.com"})).status,401);
  assert.equal((await request(foreign).post(url).set("x-role","OWNER")
    .send({recipientEmail:"carla@example.com"})).status,403);
  assert.equal((await request(owner).post(url).send({
   recipientEmail:"carla@example.com",role:"OWNER",
  })).status,400);
  phase="atomic-issuance";
  const issue=await request(owner).post(url)
    .send({recipientEmail:"carla@example.com"});
  assert.equal(issue.status,201);
  assert.equal(issue.headers["cache-control"],"no-store, private");
  const id=issue.body.data.id as string;
  const row=await pool.query(
   "SELECT i.status,i.token_hash,q.status AS delivery,q.encrypted_token,q.nonce,"+
   " q.auth_tag,q.attempts"+
   " FROM p4_synthetic.invitations i JOIN p4_r32_ci.delivery_outbox q"+
   " ON q.invitation_id=i.id WHERE i.id=$1",[id]);
  assert.equal(row.rowCount,1);
  assert.equal(row.rows[0].status,"pending");
  assert.equal(row.rows[0].delivery,"queued");
  assert.match(row.rows[0].token_hash,/^[0-9a-f]{64}$/);
  assert.match(row.rows[0].encrypted_token,/^[0-9a-f]{128}$/);
  assert.notEqual(row.rows[0].encrypted_token,row.rows[0].token_hash);
  assert.equal((await request(owner).post(url)
   .send({recipientEmail:"carla@example.com"})).status,409);
  assert.equal((await pool.query(
   "SELECT count(*)::integer AS count FROM p4_r32_ci.delivery_outbox"+
   " WHERE org_id=$1",[org.id])).rows[0].count,1);
  phase="wrong-key-retry";
  assert.equal(await badWorker.deliverOne(mailbox),"retry");
  assert.equal(mailbox.count(),0);
  // Advance the synthetic queue clock explicitly; no timers/background tasks.
  await pool.query("UPDATE p4_r32_ci.delivery_outbox"+
   " SET next_attempt_at=now()-interval '1 second'"+
   " WHERE invitation_id=$1",[id]);
  phase="new-worker-instance-recovers";
  const restarted=new P4R32CiOutboxWorker(pool,key,process.env);
  assert.equal(await restarted.deliverOne(mailbox),"delivered");
  assert.equal(await worker.deliverOne(mailbox),"empty");
  assert.equal(mailbox.count(),1);
  const token=mailbox.take("carla@example.com");
  assert.ok(token);
  assert.equal(createHash("sha256").update(token,"utf8").digest("hex"),
   row.rows[0].token_hash);
  phase="recipient-acceptance";
  const accepted=await request(acceptApp).post("/_p4_r30_ci/accept")
   .send({token});
  assert.equal(accepted.status,200);
  assert.deepEqual(accepted.body.data,{
   accepted:true,membershipActivated:true,
  });
  const final=await pool.query(
   "SELECT i.status,i.version,m.role,m.active,q.status AS delivery,"+
   " q.attempts,q.delivered_at IS NOT NULL AS delivered"+
   " FROM p4_synthetic.invitations i"+
   " JOIN p4_synthetic.memberships m ON m.org_id=i.org_id AND m.user_id=$2"+
   " JOIN p4_r32_ci.delivery_outbox q ON q.invitation_id=i.id"+
   " WHERE i.id=$1",[id,CARLA.userId]);
  assert.deepEqual(final.rows,[{status:"accepted",version:2,role:"MEMBER",
   active:true,delivery:"delivered",attempts:2,delivered:true}]);
  assert.equal((await request(acceptApp).post("/_p4_r30_ci/accept")
   .send({token})).status,403);
  phase="revoked-delivery-dead";
  const secondOrg=await organizations.create(ALICE,{
   name:"Demo R32 Revoked",slug:"demo-r32-revoked",
  });
  const rev=await request(owner).post(
   "/_p4_r32_ci/"+secondOrg.id+"/issue")
   .send({recipientEmail:"carla@example.com"});
  assert.equal(rev.status,201);
  await pool.query("UPDATE p4_synthetic.invitations SET status='revoked',"+
   "version=version+1 WHERE id=$1",[rev.body.data.id]);
  assert.equal(await worker.deliverOne(mailbox),"dead");
  assert.equal(mailbox.count(),0);
  phase="retry-exhaustion";
  const third=await organizations.create(ALICE,{
   name:"Demo R32 Exhaustion",slug:"demo-r32-exhaustion",
  });
  const exhausting=await request(owner).post(
   "/_p4_r32_ci/"+third.id+"/issue")
   .send({recipientEmail:"carla@example.com"});
  assert.equal(exhausting.status,201);
  const failRecipient=new P4R32CiRecipientMailbox(true);
  for(let attempt=0;attempt<3;attempt++){
   const result=await worker.deliverOne(failRecipient);
   assert.equal(result,attempt===2?"dead":"retry");
   await pool.query("UPDATE p4_r32_ci.delivery_outbox"+
    " SET next_attempt_at=now()-interval '1 second'"+
    " WHERE invitation_id=$1 AND status='queued'",[exhausting.body.data.id]);
  }
  assert.equal(await worker.deliverOne(mailbox),"empty");
  phase="no-leaks";
  for(const response of [issue,rev,exhausting,accepted]){
   const output=JSON.stringify(response.body);
   for(const secret of [token,row.rows[0].token_hash,
    row.rows[0].encrypted_token,"nonce","auth_tag","auth0|"]){
    assert.equal(output.includes(secret),false);
   }
  }
  const context=await pool.query(
   "SELECT current_user AS role,"+
   " nullif(current_setting('app.actor_id',true),'') AS actor,"+
   " nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(context.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R32 encrypted durable outbox issue/restart/retry/dead/redemption PASS\n");
 }finally{key.fill(0);await pool.end();}
}
main().catch(()=>{process.stderr.write(
 "P4 R32 durable outbox smoke FAILED at "+phase+"\n");process.exitCode=1;});
