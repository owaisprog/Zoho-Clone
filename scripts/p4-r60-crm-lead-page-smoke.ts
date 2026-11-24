/** R60 signed 25 genuine tenant-bound CRM leads paginated 20+5 in PostgreSQL. */
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
import {P4R32CiOutboxIssuer} from "../backend/src/platform/p4-r32-ci-outbox.js";
import {P4R30CiAcceptanceService}
 from "../backend/src/platform/p4-r30-ci-invitation-acceptance.js";
import {P4R57CiCrmLeads} from "../backend/src/platform/p4-r57-ci-crm-leads.js";
import {P4R60CiCrmLeadPager}
 from "../backend/src/platform/p4-r60-ci-crm-lead-pager.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../backend/src/platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {P4R57CiCrmLeadClient,P4R57CiCrmError}
 from "../frontend/src/lib/p4-r57-ci-crm-lead-client.js";
import {P4R60CiCrmLeadPageClient,P4R60CiPageError}
 from "../frontend/src/lib/p4-r60-ci-crm-lead-page-client.js";
import {P4R60CiCrmLeadPageController}
 from "../frontend/src/lib/p4-r60-ci-crm-lead-page-controller.js";
let phase="setup";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:8});
 const aes=randomBytes(32),cursorKey=randomBytes(32);
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),
  kid:"r33-ci-key-r60",alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const now=Math.floor(Date.now()/1000);
 const enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const jwt=(sub:string)=>{
  const h=enc({typ:"JWT",alg:"RS256",kid:jwk.kid});
  const p=enc({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,
   iat:now-5,exp:now+300,email_verified:true});
  const msg=h+"."+p;
  return msg+"."+sign("RSA-SHA256",Buffer.from(msg),pair.privateKey).toString("base64url");
 };
 const ownerJwt=jwt("auth0|demo-alice"),memberJwt=jwt("auth0|demo-bob");
 let time=Date.now();
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r33_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper:new P4R33CiActorMapper(pool,[jwk],()=>now,process.env),
  issuer:new P4R32CiOutboxIssuer(pool,aes,process.env),
  acceptance:new P4R30CiAcceptanceService(pool,process.env),
  crmLeads:new P4R57CiCrmLeads(pool,process.env),
  crmLeadPages:new P4R60CiCrmLeadPager(pool,cursorKey,process.env,()=>time),
 }));
 const server=createServer(app);
 await new Promise<void>((resolve,reject)=>{
  server.once("error",reject);server.listen(0,"127.0.0.1",resolve);
 });
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port+"/";
 const writer=new P4R57CiCrmLeadClient(base,async()=>ownerJwt,fetch,process.env);
 const pages=new P4R60CiCrmLeadPageClient(base,async()=>ownerJwt,fetch,process.env);
 const member=new P4R60CiCrmLeadPageClient(base,async()=>memberJwt,fetch,process.env);
 const controller=new P4R60CiCrmLeadPageController(pages);
 const bad=(code:number)=>(e:unknown)=>e instanceof P4R60CiPageError&&e.status===code;
 try{
  phase="owner-and-member-fictional-fixtures";
  const orgs=new P4R28CiOrganizationService(pool,process.env);
  const org=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R60 CRM Pages",slug:"demo-r60-crm-pages",
  });
  const other=await orgs.create({userId:"user_demo_alice",verified:true},{
   name:"Demo R60 Other",slug:"demo-r60-other",
  });
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id='user_demo_bob'");
  await pool.query("INSERT INTO p4_synthetic.memberships"+
   " (org_id,user_id,role,active) VALUES($1,'user_demo_bob','MEMBER',true)",
   [org.id]);
  phase="insert-25-real-leads-under-signed-owner";
  for(let i=0;i<25;i++){
   const lead=await writer.create(org.id,{companyName:"Demo Lead Number "+i,
    contactEmail:"lead"+i+"@example.com",source:i%2===0?"EVENT":"WEBSITE"});
   assert.equal(lead.revision,0);
  }
  phase="legacy-list-blocks-over-20-without-truncation";
  await assert.rejects(writer.list(org.id),
   e=>e instanceof P4R57CiCrmError&&e.status===503);
  phase="signed-owner-pages-exactly-20-plus-5";
  let v=await controller.refresh(org.id);
  assert.equal(v.phase,"ready");assert.equal(v.leads.length,20);
  assert.ok(v.nextCursor);
  const first=v.nextCursor!;
  v=await controller.more();
  assert.equal(v.leads.length,25);assert.equal(v.nextCursor,null);
  assert.equal(new Set(v.leads.map(x=>x.leadId)).size,25);
  assert.equal(new Set(v.leads.map(x=>x.contactEmail)).size,25);
  phase="filter-and-search-scope";
  const filter=await pages.page(org.id,"NEW","number 1");
  assert.ok(filter.items.length>0);
  assert.ok(filter.items.every(x=>x.status==="NEW"&&
   x.companyName.toLowerCase().includes("number 1")));
  assert.deepEqual((await pages.page(other.id)).items,[]);
  phase="tamper-cross-org-filter-and-expiry";
  const mutated=first.slice(0,-1)+(first.at(-1)==="a"?"b":"a");
  await assert.rejects(pages.page(org.id,"all","",mutated),bad(400));
  await assert.rejects(pages.page(org.id,"NEW","",first),bad(400));
  await assert.rejects(pages.page(other.id,"all","",first),bad(400));
  time+=11*60*1000;
  await assert.rejects(pages.page(org.id,"all","",first),bad(400));
  time-=11*60*1000;
  phase="member-and-forged-identity-denials";
  await assert.rejects(member.page(org.id),bad(403));
  const forged=new P4R60CiCrmLeadPageClient(base,async()=>"a.b.c",fetch,process.env);
  await assert.rejects(forged.page(org.id),bad(401));
  phase="revoked-owner-clears-existing-leads";
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  try{
   assert.equal((await controller.refresh(org.id)).phase,"denied");
   assert.deepEqual(controller.snapshot().leads,[]);
  }finally{
   await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
    " WHERE org_id=$1 AND user_id='user_demo_alice'",[org.id]);
  }
  phase="no-sensitive-data-and-scope-leaks";
  const serialized=JSON.stringify(v);
  for(const word of [ownerJwt,memberJwt,"auth0|","token_hash","postgresql://"])
   assert.equal(serialized.includes(word),false);
  const check=await pool.query("SELECT current_user AS role,"+
   "nullif(current_setting('app.actor_id',true),'') AS actor,"+
   "nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(check.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R60 signed real CRM lead pagination 25 rows 20+5, filter HMAC/TTL/tenant and owner RLS PASS; NO_GO\n");
 }finally{
  await pool.query("UPDATE p4_synthetic.identity_subjects SET"+
   " email_verified=false,canonical_email='alice@example.com'"+
   " WHERE user_id='user_demo_bob'");
  aes.fill(0);cursorKey.fill(0);
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await pool.end();
 }
}
main().catch(e=>{
 const x=e as {name?:string;status?:number;code?:string};
 process.stderr.write("P4 R60 CRM lead pages FAILED at "+phase+
  " type="+(x.name??"unknown")+" status="+(x.status??"none")+
  " code="+(x.code??"none")+"\n");process.exitCode=1;
});
