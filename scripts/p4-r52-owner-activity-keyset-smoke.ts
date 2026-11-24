/** R52 signed owner timeline 25 genuine audit events, real CI PostgreSQL. */
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
import {P4R51CiOwnerActivityService}
 from "../backend/src/platform/p4-r51-ci-owner-activity.js";
import {P4R52CiOwnerActivityPager}
 from "../backend/src/platform/p4-r52-ci-owner-activity-pager.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R41CiMemberRoleClient}
 from "../frontend/src/lib/p4-r41-ci-member-role-client.js";
import {P4R51CiOwnerActivityClient,P4R51CiActivityError}
 from "../frontend/src/lib/p4-r51-ci-owner-activity-client.js";
import {P4R52CiActivityPageClient,P4R52CiActivityPageError}
 from "../frontend/src/lib/p4-r52-ci-activity-page-client.js";
import {P4R52CiActivityPageController}
 from "../frontend/src/lib/p4-r52-ci-activity-page-controller.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const secret=randomBytes(32),aes=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r52",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
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
 const aliceJwt=jwt("auth0|demo-alice"),bobJwt=jwt("auth0|demo-bob");
 let fakeNow=Date.now();
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer:new P4R32CiOutboxIssuer(pool,aes,process.env),
  acceptance:new P4R30CiAcceptanceService(pool,process.env),
  roles:new P4R40CiMemberRoles(pool,process.env),
  ownerActivity:new P4R51CiOwnerActivityService(pool,process.env),
  ownerActivityPages:new P4R52CiOwnerActivityPager(pool,secret,process.env,
   ()=>fakeNow),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const addr=server.address() as AddressInfo,base="http://127.0.0.1:"+
  addr.port+"/";
 const roles=new P4R41CiMemberRoleClient(base,async()=>aliceJwt,fetch,process.env);
 const activity=new P4R52CiActivityPageClient(base,async()=>aliceJwt,fetch,process.env);
 const old=new P4R51CiOwnerActivityClient(base,async()=>aliceJwt,fetch,process.env);
 const member=new P4R52CiActivityPageClient(base,async()=>bobJwt,fetch,process.env);
 const controller=new P4R52CiActivityPageController(activity);
 try{
  phase="create-isolated-fake-orgs";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const org=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R52 Timeline",slug:"demo-r52-timeline",
  });
  const foreign=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R52 Foreign",slug:"demo-r52-foreign",
  });
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES($1,'user_demo_bob','MEMBER',true)",
   [org.id]);
  phase="create-25-real-owner-audited-role-changes";
  for(let revision=0;revision<25;revision++){
   const next=revision%2===0?"SALES_MANAGER":"SALES_REP";
   const changed=await roles.change(org.id,"user_demo_bob",next,revision);
   assert.equal(changed.revision,revision+1);
  }
  phase="previous-limit-fail-closed-not-silent-truncation";
  await assert.rejects(old.list(org.id,"role.changed"),
   e=>e instanceof P4R51CiActivityError&&e.status===503);
  phase="page-20-plus-5-real-immutable-rows";
  const first=await activity.page(org.id,"role.changed",null);
  assert.equal(first.items.length,20);assert.ok(first.nextCursor);
  const second=await activity.page(org.id,"role.changed",first.nextCursor);
  assert.equal(second.items.length,5);assert.equal(second.nextCursor,null);
  const full=[...first.items,...second.items];
  assert.equal(new Set(full.map(x=>x.eventId)).size,25);
  assert.ok(full.every(x=>x.kind==="role.changed"&&
   x.subjectId==="user_demo_bob"&&x.actorUserId==="user_demo_alice"));
  phase="controller-load-next";
  assert.equal((await controller.refresh(org.id,"role.changed")).events.length,20);
  assert.equal((await controller.more(org.id)).events.length,25);
  phase="tamper-canonical-and-scope";
  const token=first.nextCursor;
  assert.ok(token);
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const index=alphabet.indexOf(token.at(-1)!);
  assert.equal(index%4,0);
  const noncanonical=token.slice(0,-1)+alphabet[index+1];
  for(const fn of [
   ()=>activity.page(org.id,"role.changed",noncanonical),
   ()=>activity.page(org.id,"all",token),
   ()=>activity.page(foreign.id,"role.changed",token),
  ]){
   await assert.rejects(fn(),
    e=>e instanceof P4R52CiActivityPageError&&e.status===400);
  }
  fakeNow+=11*60*1000;
  await assert.rejects(activity.page(org.id,"role.changed",token),
   e=>e instanceof P4R52CiActivityPageError&&e.status===400);
  fakeNow-=11*60*1000;
  phase="fresh-nonowner-and-forged-denial";
  await assert.rejects(member.page(org.id),
   e=>e instanceof P4R52CiActivityPageError&&e.status===403);
  const forged=new P4R52CiActivityPageClient(base,async()=>"a.b.c",fetch,process.env);
  await assert.rejects(forged.page(org.id),
   e=>e instanceof P4R52CiActivityPageError&&e.status===401);
  assert.deepEqual((await activity.page(foreign.id)).items,[]);
  phase="owner-revocation-clears-paginated-state";
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  try{
   const denied=await controller.refresh(org.id,"all");
   assert.equal(denied.phase,"denied");
   assert.deepEqual(denied.events,[]);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  }
  phase="only-redacted-audit-and-clean-transaction-context";
  const output=JSON.stringify(full);
  for(const secretText of [aliceJwt,bobJwt,"bob@example.com",
   "token_hash","auth0|","postgresql://","key_time"])
   assert.equal(output.includes(secretText),false);
  const scope=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R52 signed owner audit pagination 25 real role changes 20+5, canonical HMAC, scoped cursor and revocation PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=false,canonical_email='alice@example.com'"+
   " WHERE user_id='user_demo_bob'");
  secret.fill(0);aes.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(e=>{
 const x=e as {name?:string;code?:string;status?:number};
 process.stderr.write("P4 R52 activity paging FAILED at "+phase+
  " type="+(x?.name??"unknown")+" code="+(x?.code??"none")+
  " status="+(x?.status??"none")+"\n");
 process.exitCode=1;
});
