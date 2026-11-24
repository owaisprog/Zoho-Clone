/** R48 real signed owner cursor page -> PostgreSQL 25 rows with tie timestamps. */
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
import {P4R32CiOutboxIssuer}
 from "../backend/src/platform/p4-r32-ci-outbox.js";
import {P4R30CiAcceptanceService}
 from "../backend/src/platform/p4-r30-ci-invitation-acceptance.js";
import {P4R48CiInvitationPager}
 from "../backend/src/platform/p4-r48-ci-invitation-pager.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R48CiInvitationPageClient,P4R48CiPageError}
 from "../frontend/src/lib/p4-r48-ci-invitation-page-client.js";
import {P4R48CiInvitationPageController}
 from "../frontend/src/lib/p4-r48-ci-invitation-page-controller.js";
let phase="start";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:5});
 const aes=randomBytes(32),hmac=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),kid:"r48-local-test",
  alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const time=Math.floor(Date.now()/1000);
 const enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const jwt=(sub:string)=>{
  const h=enc({typ:"JWT",alg:"RS256",kid:jwk.kid});
  const p=enc({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,iat:time-5,
   exp:time+300,email_verified:true});
  const data=h+"."+p;
  return data+"."+sign("RSA-SHA256",Buffer.from(data),pair.privateKey)
   .toString("base64url");
 };
 const ownerJwt=jwt("auth0|demo-alice"),otherJwt=jwt("auth0|demo-bob");
 let fakeNow=Date.now();
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>time,process.env),
  issuer:new P4R32CiOutboxIssuer(pool,aes,process.env),
  acceptance:new P4R30CiAcceptanceService(pool,process.env),
  invitationPages:new P4R48CiInvitationPager(pool,hmac,process.env,()=>fakeNow),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const address=server.address() as AddressInfo,base="http://127.0.0.1:"+
  address.port+"/";
 const owner=new P4R48CiInvitationPageClient(base,async()=>ownerJwt,fetch,process.env);
 const member=new P4R48CiInvitationPageClient(base,async()=>otherJwt,fetch,process.env);
 const ctl=new P4R48CiInvitationPageController(owner);
 try{
  phase="create-two-fake-orgs";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const org=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R48 Pages",slug:"demo-r48-pages",
  });
  const foreign=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R48 Other",slug:"demo-r48-other",
  });
  phase="seed-25-tie-timestamp-invitations";
  const fixtureTime=new Date(Date.now()-3600000);
  const ids:string[]=[];
  for(let i=0;i<25;i++){
   const id=randomUUID();ids.push(id);
   const email="r48fake"+String(i).padStart(2,"0")+"@example.com";
   const hash=createHash("sha256").update(id).digest("hex");
   await pool.query(
    "INSERT INTO p4_synthetic.invitations"+
    " (id,org_id,invited_by,recipient_email,granted_role,token_hash,"+
    " issued_at,expires_at,status) VALUES"+
    " ($1,$2,'user_demo_alice',$3,'MEMBER',$4,$5,$6,'revoked')",
    [id,org.id,email,hash,fixtureTime,new Date(fixtureTime.getTime()+48*3600000)]);
  }
  phase="page-1-and-page-2-no-gaps";
  const first=await owner.page(org.id,"revoked","");
  process.stdout.write("P4 R48 first-page count="+first.items.length+" has-next="+Boolean(first.nextCursor)+"\n");
  assert.equal(first.items.length,20);assert.ok(first.nextCursor);
  const second=await owner.page(org.id,"revoked","",first.nextCursor);
  process.stdout.write("P4 R48 second-page count="+second.items.length+" has-next="+Boolean(second.nextCursor)+"\n");
  assert.equal(second.items.length,5);assert.equal(second.nextCursor,null);
  const all=[...first.items,...second.items];
  assert.equal(new Set(all.map(x=>x.id)).size,25);
  assert.deepEqual(all.map(x=>x.id),ids.slice().sort().reverse());
  phase="controller-fetch-more";
  assert.equal((await ctl.refresh(org.id,"revoked","")).items.length,20);
  const expanded=await ctl.more(org.id);
  assert.equal(expanded.phase,"ready");assert.equal(expanded.items.length,25);
  phase="cursor-integrity-tenant-filter-and-expiry";
  const badCursor=first.nextCursor.slice(0,-1)+
   (first.nextCursor.endsWith("A")?"B":"A");
  for(const call of [
   ()=>owner.page(org.id,"revoked","",badCursor),
   ()=>owner.page(org.id,"all","",first.nextCursor),
   ()=>owner.page(org.id,"revoked","r48",first.nextCursor),
   ()=>owner.page(foreign.id,"revoked","",first.nextCursor),
  ]){
   await assert.rejects(call(),e=>e instanceof P4R48CiPageError&&e.status===400);
  }
  fakeNow+=11*60*1000;
  await assert.rejects(owner.page(org.id,"revoked","",first.nextCursor),
   e=>e instanceof P4R48CiPageError&&e.status===400);
  fakeNow-=11*60*1000;
  phase="owner-and-auth-authorization";
  await assert.rejects(member.page(org.id,"all",""),
   e=>e instanceof P4R48CiPageError&&e.status===403);
  const forged=new P4R48CiInvitationPageClient(base,async()=>"a.b.c",
   fetch,process.env);
  await assert.rejects(forged.page(org.id,"all",""),
   e=>e instanceof P4R48CiPageError&&e.status===401);
  assert.deepEqual((await owner.page(foreign.id,"all","")).items,[]);
  phase="owner-revocation-fail-close-controller";
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  try{
   const denied=await ctl.refresh(org.id,"all","");
   assert.equal(denied.phase,"denied");assert.deepEqual(denied.items,[]);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  }
  phase="no-secret-projection-and-role-cleanup";
  const output=JSON.stringify(all);
  for(const secret of [ownerJwt,otherJwt,"token_hash","auth0|",
   "encrypted_token","postgresql://","key_time"])
   assert.equal(output.includes(secret),false);
  const scoped=await pool.query("SELECT current_user AS role,"+
   " nullif(current_setting('app.actor_id',true),'') AS actor,"+
   " nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(scoped.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R48 signed HMAC keyset invitation paging 25/25 tie timestamp, filter/tenant/cursor/revocation isolation PASS; NO_GO\n");
 }finally{
  aes.fill(0);hmac.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(error=>{
 const safe=error instanceof Error?error as Error&{status?:number;code?:string;actual?:unknown;expected?:unknown}:null;
 process.stderr.write("P4 R48 CI keyset integration FAILED at "+phase+
  " type="+(safe?.name??"unknown")+
  " status="+(safe?.status??"none")+
  " code="+(safe?.code??"none")+
  " actualType="+typeof safe?.actual+
  " actualCount="+(Array.isArray(safe?.actual)?safe.actual.length:"n/a")+
  "\\n");
 process.exitCode=1;
});
