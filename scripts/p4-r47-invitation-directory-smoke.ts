/**
 * R47 full CI owner workflow: directory + issue + cancel + renew + accept.
 * Signed fake RS256 JWT, localhost Express, real disposable PostgreSQL.
 */
import assert from "node:assert/strict";
import {createHash,generateKeyPairSync,randomBytes,randomUUID,sign}
 from "node:crypto";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import express from "express";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment}
 from "../backend/src/platform/p4-v1-ci-prisma.js";
import {P4R28CiOrganizationService}
 from "../backend/src/platform/p4-r28-ci-org-service.js";
import {P4R32CiOutboxIssuer,P4R32CiOutboxWorker,P4R32CiRecipientMailbox}
 from "../backend/src/platform/p4-r32-ci-outbox.js";
import {P4R45CiRenewalIssuer}
 from "../backend/src/platform/p4-r45-ci-renewal-issuer.js";
import {P4R46CiInvitationCanceler}
 from "../backend/src/platform/p4-r46-ci-invitation-canceler.js";
import {P4R47CiInvitationDirectory}
 from "../backend/src/platform/p4-r47-ci-invitation-directory.js";
import {P4R30CiAcceptanceService}
 from "../backend/src/platform/p4-r30-ci-invitation-acceptance.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R34CiHttpClient}
 from "../frontend/src/lib/p4-r34-ci-http-client.js";
import {P4R47CiInvitationDirectoryClient,P4R47CiInvitationError}
 from "../frontend/src/lib/p4-r47-ci-invitation-directory-client.js";
import {P4R47CiInvitationController}
 from "../frontend/src/lib/p4-r47-ci-invitation-controller.js";
const ALICE="user_demo_alice",BOB="user_demo_bob";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:6});
 const key=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),kid:"r33-ci-key-r47",
  alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const now=Math.floor(Date.now()/1000);
 const enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const jwt=(sub:string)=>{
  const h=enc({typ:"JWT",alg:"RS256",kid:jwk.kid});
  const p=enc({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,
   iat:now-5,exp:now+300,email_verified:true});
  const value=h+"."+p;
  return value+"."+sign("RSA-SHA256",Buffer.from(value),pair.privateKey)
   .toString("base64url");
 };
 const ownerJwt=jwt("auth0|demo-alice"),bobJwt=jwt("auth0|demo-bob");
 const issuer=new P4R32CiOutboxIssuer(pool,key,process.env);
 const worker=new P4R32CiOutboxWorker(pool,key,process.env);
 const mailbox=new P4R32CiRecipientMailbox();
 const deliverTo=async(email:string):Promise<string|null>=>{
  for(let attempt=0;attempt<30;attempt++){
   const token=mailbox.take(email);
   if(token)return token;
   const outcome=await worker.deliverOne(mailbox);
   if(outcome==="empty")break;
  }
  return mailbox.take(email);
 };
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer,acceptance:new P4R30CiAcceptanceService(pool,process.env),
  renewer:new P4R45CiRenewalIssuer(pool,key,process.env),
  canceler:new P4R46CiInvitationCanceler(pool,process.env),
  invitations:new P4R47CiInvitationDirectory(pool,process.env),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const address=server.address() as AddressInfo;
 const base="http://127.0.0.1:"+address.port+"/";
 const directory=new P4R47CiInvitationDirectoryClient(base,
  async()=>ownerJwt,fetch,process.env);
 const owner=new P4R34CiHttpClient(base,async kind=>
  kind==="owner"?ownerJwt:bobJwt,fetch,process.env);
 const ctl=new P4R47CiInvitationController(directory,owner);
 try{
  phase="independent-tenant-and-verified-recipient";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const org=await orgs.create({userId:ALICE,verified:true},{
   name:"Demo R47 Inbox",slug:"demo-r47-inbox",
  });
  const other=await orgs.create({userId:ALICE,verified:true},{
   name:"Demo R47 Foreign",slug:"demo-r47-foreign",
  });
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id=$1",[BOB]);
  phase="empty-list-and-typed-issue";
  assert.deepEqual(await directory.list(org.id,"all",""),[]);
  assert.equal((await ctl.refresh(org.id,"all","")).phase,"ready");
  const issued=await ctl.issue(org.id,"bob@example.com");
  assert.equal(issued.phase,"updated");
  assert.equal(issued.invitations.length,1);
  const bobInvite=issued.invitations[0]!;
  assert.equal(bobInvite.status,"pending");
  phase="recipient-acceptance-appears-in-owner-list";
  const bobToken=await deliverTo("bob@example.com");
  assert.ok(bobToken);
  assert.deepEqual(await owner.accept(bobToken),{
   accepted:true,membershipActivated:true,
  });
  const accepted=await ctl.refresh(org.id,"accepted","bob");
  assert.equal(accepted.phase,"ready");
  assert.deepEqual(accepted.invitations.map(x=>x.id),[bobInvite.id]);
  phase="signed-cancel-and-renew-reflected-in-list";
  await ctl.refresh(org.id,"all","");
  const created=await ctl.issue(org.id,"carla@example.com");
  assert.equal(created.phase,"updated");
  const carlaInvite=created.invitations.find(x=>
   x.recipientEmail==="carla@example.com");
  assert.ok(carlaInvite);
  const revoked=await ctl.cancel(org.id,carlaInvite.id,1);
  assert.equal(revoked.phase,"updated");
  assert.equal(revoked.invitations.find(x=>x.id===carlaInvite.id)?.status,
   "revoked");
  const renewed=await ctl.renew(org.id,carlaInvite.id,2);
  assert.equal(renewed.phase,"updated");
  const newer=renewed.invitations.find(x=>
   x.recipientEmail==="carla@example.com"&&x.status==="pending");
  assert.ok(newer&&newer.id!==carlaInvite.id);
  phase="effective-expiry-from-real-database";
  const diana=await ctl.issue(org.id,"diana@example.com");
  const dianaInvite=diana.invitations.find(x=>
   x.recipientEmail==="diana@example.com");
  assert.ok(dianaInvite);
  await pool.query("UPDATE p4_synthetic.invitations SET"+
   " issued_at=now()-interval '49 hours',"+
   " expires_at=now()-interval '1 hour' WHERE id=$1",[dianaInvite.id]);
  const snapshot=await ctl.refresh(org.id,"all","");
  assert.equal(snapshot.phase,"ready");
  assert.deepEqual(snapshot.invitations.map(x=>x.status).sort(),
   ["accepted","expired","pending","revoked"].sort());
  for(const status of ["accepted","revoked","expired","pending"] as const){
   const entries=await directory.list(org.id,status,"");
   assert.equal(entries.length,1);
   assert.equal(entries[0]?.status,status);
  }
  assert.deepEqual((await directory.list(org.id,"all","CARLA"))
   .map(x=>x.id).sort(),[carlaInvite.id,newer.id].sort());
  assert.deepEqual(await directory.list(other.id,"all",""),[]);
  phase="unauthorized-member-forged-signed-tenant";
  const memberClient=new P4R47CiInvitationDirectoryClient(base,
   async()=>bobJwt,fetch,process.env);
  await assert.rejects(memberClient.list(org.id,"all",""),
   e=>e instanceof P4R47CiInvitationError&&e.status===403);
  const fake=new P4R47CiInvitationDirectoryClient(base,
   async()=>"a.b.c",fetch,process.env);
  await assert.rejects(fake.list(org.id,"all",""),
   e=>e instanceof P4R47CiInvitationError&&e.status===401);
  await assert.rejects(directory.list(
   "10000000-0000-4000-8000-000000000099","all",""),
   e=>e instanceof P4R47CiInvitationError&&e.status===403);
  phase="revoked-owner-clears-stale-view";
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id=$2",[org.id,ALICE]);
  try{
   assert.equal((await ctl.refresh(org.id,"all","")).phase,"denied");
   assert.deepEqual(ctl.snapshot().invitations,[]);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id=$2",[org.id,ALICE]);
  }
  phase="bounded-list-requires-explicit-future-pagination";
  for(let i=0;i<17;i++){
   const id=randomUUID(),email="r47extra"+i+"@example.com";
   const hash=createHash("sha256").update(id).digest("hex");
   await pool.query(
    "INSERT INTO p4_synthetic.invitations"+
    " (id,org_id,invited_by,recipient_email,granted_role,token_hash,"+
    " issued_at,expires_at,status) VALUES"+
    " ($1,$2,$3,$4,'MEMBER',$5,now(),now()+interval '48 hours','revoked')",
    [id,org.id,ALICE,email,hash]);
  }
  await assert.rejects(directory.list(org.id,"all",""),
   e=>e instanceof P4R47CiInvitationError&&e.status===503);
  assert.equal((await directory.list(org.id,"accepted","bob")).length,1);
  phase="sanitized-response-and-session-cleanup";
  const direct=await pool.query(
   "SELECT has_function_privilege('p4_synthetic_ci_runtime',"+
   " 'p4_r47_ci.owner_invitations(uuid,text,text)','EXECUTE') AS invoke");
  assert.deepEqual(direct.rows,[{invoke:true}]);
  const publicText=JSON.stringify(snapshot);
  for(const secret of [bobToken,ownerJwt,bobJwt,"token_hash",
   "encrypted_token","postgresql://","auth0|","auth_tag"])
   assert.equal(publicText.includes(secret),false);
  const context=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(context.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R47 signed persisted owner invitation directory, issue/cancel/renew/accept and effective expiry lifecycle PASS; NO_GO\n");
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
 process.stderr.write("P4 R47 signed invitation owner directory FAILED at "+phase+"\n");
 process.exitCode=1;
});
