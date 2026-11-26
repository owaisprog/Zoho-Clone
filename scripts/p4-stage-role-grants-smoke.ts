import assert from "node:assert/strict";
import pg from "pg";
import express from "express";
import request from "supertest";
import {generateKeyPairSync,sign} from "node:crypto";
import {assertP4V1CiPrismaEnvironment} from "../backend/src/platform/p4-v1-ci-prisma.js";
import {CI_ISSUER,CI_AUDIENCE,verifyP4R33CiToken,type P4R33CiJwk} from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {CiStageRoleGrants} from "../backend/src/platform/p4-ci-stage-role-grants.js";
import {createCiStageRoleRouter} from "../backend/src/platform/p4-ci-stage-role-router.js";
const a="98000000-0000-4000-8000-000000000001",b="98000000-0000-4000-8000-000000000002",owner="98000000-0000-4000-8000-000000000003",member="98000000-0000-4000-8000-000000000004",foreign="98000000-0000-4000-8000-000000000005",key="98000000-0000-4000-8000-000000000006";
const identity={issuer:CI_ISSUER,subject:"auth0|stage-grant-owner"};
const common={host:"127.0.0.1",port:5432,database:"zoho_clone_synthetic_ci",password:"fake_ci_not_for_real_accounts",max:2,connectionTimeoutMillis:2000};
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const admin=new pg.Pool({...common,user:"demo_ci"});
 const db=new CiStageRoleGrants({...process.env,P4_STAGE_GRANTS_CI:"true"});
 const raw=new pg.Pool({...common,user:"p4_stage_grant_writer"});
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),kid:"r33-ci-key-stagegrant",alg:"RS256",use:"sig"} as P4R33CiJwk;
 const token=(sub:string)=>{
  const now=Math.floor(Date.now()/1000),enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
  const message=enc({typ:"JWT",alg:"RS256",kid:jwk.kid})+"."+enc({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,iat:now-1,exp:now+300,email_verified:true});
  return message+"."+sign("RSA-SHA256",Buffer.from(message),pair.privateKey).toString("base64url");
 };
 const app=express();app.use("/stage",createCiStageRoleRouter(db,async req=>{
  try{return verifyP4R33CiToken(req.get("authorization")?.replace(/^Bearer /,""),[jwk],Math.floor(Date.now()/1000));}catch{return null;}
 }));
 const endpoint=(org:string,target:string)=>"/stage/"+org+"/targets/"+target+"/sales-grants";
 const command={role:"SALES_REP",expectedActive:false,nextActive:true,expectedRevision:0,requestId:key};
 try{
  await admin.query("ALTER ROLE p4_stage_grant_writer PASSWORD 'fake_ci_not_for_real_accounts'");
  await admin.query("INSERT INTO platform_stage.users(id) VALUES($1),($2),($3)",[owner,member,foreign]);
  await admin.query("INSERT INTO platform_stage.organizations(id) VALUES($1),($2)",[a,b]);
  await admin.query("INSERT INTO platform_stage.identity_subjects(issuer,subject,user_id,verified) VALUES($1,$2,$3,true),($1,$4,$5,true)",[CI_ISSUER,identity.subject,owner,"auth0|stage-grant-member",member]);
  await admin.query("INSERT INTO platform_stage.memberships(organization_id,user_id,role) VALUES($1,$2,'OWNER'),($1,$3,'MEMBER'),($4,$5,'MEMBER')",[a,owner,member,b,foreign]);
  await admin.query("INSERT INTO platform_stage.sales_grants(organization_id,user_id,role_code) VALUES($1,$2,'SALES_REP'),($3,$4,'SALES_REP')",[a,member,b,foreign]);
  const auth="Bearer "+token(identity.subject);
  assert.equal((await request(app).get(endpoint(a,member))).status,401);
  const list=await request(app).get(endpoint(a,member)).set("Authorization",auth);
  assert.equal(list.status,200);assert.deepEqual(list.body,{status:"verified",items:[{role:"SALES_REP",active:false,revision:0}],applicationAccess:false});
  assert.equal((await request(app).get(endpoint(b,foreign)).set("Authorization",auth)).status,403);
  assert.equal((await request(app).post(endpoint(a,member)).set("Authorization","Bearer "+token("auth0|stage-grant-member")).set("x-role","OWNER").send(command)).status,403);
  assert.equal((await request(app).post(endpoint(a,owner)).set("Authorization",auth).send(command)).status,403);
  assert.equal((await request(app).post(endpoint(a,member)).set("Authorization",auth).send({...command,role:"ORG_OWNER"})).status,400);
  assert.equal((await request(app).post(endpoint(a,member)).set("Authorization",auth).send({...command,role:"SALES_MANAGER"})).status,403);
  const run=()=>request(app).post(endpoint(a,member)).set("Authorization",auth).send(command);
  const applied=await run();assert.equal(applied.status,200);assert.equal(applied.body.status,"applied");
  const replay=await run();assert.equal(replay.body.status,"replay");
  assert.equal((await request(app).post(endpoint(a,member)).set("Authorization",auth).send({...command,expectedRevision:1})).status,409);
  assert.equal((await request(app).post(endpoint(a,member)).set("Authorization",auth).send({...command,requestId:"98000000-0000-4000-8000-000000000007"})).status,409);
  assert.deepEqual(await db.list(identity,a,member),[{role:"SALES_REP",active:true,revision:1}]);
  const next={...command,expectedActive:true,nextActive:false,expectedRevision:1,requestId:"98000000-0000-4000-8000-000000000008"};
  const parallel=await Promise.all([db.toggle(identity,a,member,next),db.toggle(identity,a,member,{...next,requestId:"98000000-0000-4000-8000-000000000009"})]);
  assert.equal(parallel.filter(x=>x==="applied").length,1);assert.equal(parallel.filter(x=>x==="conflict").length,1);
  assert.equal(Number((await admin.query("SELECT count(*) FROM platform_stage.grant_audit WHERE organization_id=$1",[a])).rows[0].count),2);
  await assert.rejects(raw.query("SELECT * FROM platform_stage.sales_grants"));
  await assert.rejects(raw.query("UPDATE platform_stage.sales_grants SET active=true"));
  await assert.rejects(raw.query("DELETE FROM platform_stage.grant_audit"));
  await admin.query("UPDATE platform_stage.memberships SET active=false WHERE organization_id=$1 AND user_id=$2",[a,owner]);
  assert.equal(await db.toggle(identity,a,member,command),"denied");
  await assert.rejects(db.list(identity,a,member));
  console.log("P4_STAGE_ROLE_GRANTS_PASS: signed fictional identity, owner-only existing role toggles, replay, concurrent CAS, audit and revoked membership denial");
 }finally{await Promise.all([admin.end(),db.close(),raw.end()]);}
}
main().catch(e=>{console.error("P4_STAGE_ROLE_GRANTS_FAIL",e instanceof Error?e.name:"unknown");process.exitCode=1;});
