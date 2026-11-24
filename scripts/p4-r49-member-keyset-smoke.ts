/** R49 signed member list >20 with actual disposable PostgreSQL and HMAC cursors. */
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
import {P4R49CiMemberPager}
 from "../backend/src/platform/p4-r49-ci-member-pager.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R49CiMemberPageClient,P4R49CiPageError}
 from "../frontend/src/lib/p4-r49-ci-member-page-client.js";
import {P4R49CiMemberPageController}
 from "../frontend/src/lib/p4-r49-ci-member-page-controller.js";
let phase="start";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:5});
 const aes=randomBytes(32),hmac=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r49",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const now=Math.floor(Date.now()/1000);
 const enc=(x:unknown)=>Buffer.from(JSON.stringify(x)).toString("base64url");
 const jwt=(sub:string)=>{
  const h=enc({typ:"JWT",alg:"RS256",kid:jwk.kid});
  const p=enc({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,
   iat:now-5,exp:now+300,email_verified:true});
  const message=h+"."+p;
  return message+"."+sign("RSA-SHA256",Buffer.from(message),pair.privateKey)
   .toString("base64url");
 };
 const aliceJwt=jwt("auth0|demo-alice"),bobJwt=jwt("auth0|demo-bob");
 let cursorNow=Date.now();
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer:new P4R32CiOutboxIssuer(pool,aes,process.env),
  acceptance:new P4R30CiAcceptanceService(pool,process.env),
  memberPages:new P4R49CiMemberPager(pool,hmac,process.env,()=>cursorNow),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const addr=server.address() as AddressInfo;
 const base="http://127.0.0.1:"+addr.port+"/";
 const owner=new P4R49CiMemberPageClient(base,async()=>aliceJwt,fetch,process.env);
 const nonOwner=new P4R49CiMemberPageClient(base,async()=>bobJwt,fetch,process.env);
 const ctl=new P4R49CiMemberPageController(owner);
 try{
  phase="real-fictional-owner-fixtures";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const org=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R49 Member Pages",slug:"demo-r49-member-pages",
  });
  const foreign=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R49 Foreign",slug:"demo-r49-foreign",
  });
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  const ids=Array.from({length:25},(_,i)=>
   "user_demo_a"+String.fromCharCode(97+i));
  for(let i=0;i<ids.length;i++){
   const id=ids[i]!;
   await pool.query("INSERT INTO p4_synthetic.users(id) VALUES($1)"+
    " ON CONFLICT(id) DO NOTHING",[id]);
   await pool.query("INSERT INTO p4_synthetic.memberships"+
    "(org_id,user_id,role,active) VALUES($1,$2,'MEMBER',$3)",
    [org.id,id,i>=3]);
  }
  phase="page-first-second-and-deduplicate";
  const first=await owner.page(org.id,"all","");
  assert.equal(first.items.length,20);assert.ok(first.nextCursor);
  const second=await owner.page(org.id,"all","",first.nextCursor);
  assert.equal(second.items.length,5);assert.equal(second.nextCursor,null);
  const combined=[...first.items,...second.items];
  assert.deepEqual(combined.map(x=>x.userId),ids);
  assert.equal(new Set(combined.map(x=>x.userId)).size,25);
  assert.equal(combined.every(x=>x.email===null&&
   x.role==="SALES_REP"&&x.revision===0),true);
  phase="status-filtered-list";
  assert.deepEqual((await owner.page(org.id,"revoked","")).items.map(x=>x.userId),
   ids.slice(0,3));
  const activeFirst=await owner.page(org.id,"active","");
  const activeSecond=await owner.page(org.id,"active","",activeFirst.nextCursor);
  assert.equal(activeFirst.items.length,20);
  assert.equal(activeSecond.items.length,2);
  assert.deepEqual([...activeFirst.items,...activeSecond.items].map(x=>x.userId),
   ids.slice(3));
  phase="controller-join-both-pages";
  assert.equal((await ctl.refresh(org.id,"all","")).members.length,20);
  assert.equal((await ctl.more(org.id)).members.length,25);
  phase="cursor-scope-tamper-expiry";
  const cursor=first.nextCursor;
  assert.ok(cursor);
  const tampered=cursor.slice(0,-1)+(cursor.endsWith("A")?"B":"A");
  for(const call of [
   ()=>owner.page(org.id,"all","",tampered),
   ()=>owner.page(org.id,"active","",cursor),
   ()=>owner.page(org.id,"all","user",cursor),
   ()=>owner.page(foreign.id,"all","",cursor),
  ]){
   await assert.rejects(call(),e=>e instanceof P4R49CiPageError&&e.status===400);
  }
  cursorNow+=11*60*1000;
  await assert.rejects(owner.page(org.id,"all","",cursor),
   e=>e instanceof P4R49CiPageError&&e.status===400);
  cursorNow-=11*60*1000;
  phase="verified-nonowner-and-forged-denials";
  await assert.rejects(nonOwner.page(org.id,"all",""),
   e=>e instanceof P4R49CiPageError&&e.status===403);
  const fake=new P4R49CiMemberPageClient(base,async()=>"a.b.c",fetch,process.env);
  await assert.rejects(fake.page(org.id,"all",""),
   e=>e instanceof P4R49CiPageError&&e.status===401);
  assert.deepEqual((await owner.page(foreign.id,"all","")).items,[]);
  phase="owner-revocation-clears-stale-controller";
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  try{
   const denied=await ctl.refresh(org.id,"all","");
   assert.equal(denied.phase,"denied");assert.deepEqual(denied.members,[]);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  }
  phase="no-leak-or-connection-context";
  const output=JSON.stringify(combined);
  for(const secret of [aliceJwt,bobJwt,"auth0|","token_hash",
   "encrypted_token","postgresql://","providerSub"])
   assert.equal(output.includes(secret),false);
  const scope=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scope.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R49 signed HMAC paginated member directory 25/25 active/revoked statuses, scoped cursor and owner revocation PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=false,canonical_email='alice@example.com'"+
   " WHERE user_id='user_demo_bob'");
  aes.fill(0);hmac.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(e=>{
 const x=e as {name?:string;code?:string;status?:number};
 process.stderr.write("P4 R49 member pagination smoke FAILED at "+phase+
  " type="+(x?.name??"unknown")+" code="+(x?.code??"none")+
  " status="+(x?.status??"none")+"\n");
 process.exitCode=1;
});
