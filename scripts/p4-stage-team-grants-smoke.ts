import assert from "node:assert/strict";
import pg from "pg";
import express from "express";
import request from "supertest";
import {generateKeyPairSync,sign} from "node:crypto";
import {assertP4V1CiPrismaEnvironment} from "../backend/src/platform/p4-v1-ci-prisma.js";
import {CI_ISSUER,CI_AUDIENCE,verifyP4R33CiToken,type P4R33CiJwk} from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {CiStageTeamGrants} from "../backend/src/platform/p4-ci-stage-team-grants.js";
import {CiStageRoleGrants} from "../backend/src/platform/p4-ci-stage-role-grants.js";
import {createCiStageTeamRouter} from "../backend/src/platform/p4-ci-stage-team-router.js";
const id=(n:number)=>"99000000-0000-4000-8000-"+String(n).padStart(12,"0");
const [a,b,owner,member,foreign,team,managed,other,unlinked]=Array.from({length:9},(_,i)=>id(i+1)) as [string,string,string,string,string,string,string,string,string];
const identity={issuer:CI_ISSUER,subject:"auth0|team-owner"},subject="auth0|team-member";
const common={host:"127.0.0.1",port:5432,database:"zoho_clone_synthetic_ci",password:"fake_ci_not_for_real_accounts",max:2,connectionTimeoutMillis:2000};
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const admin=new pg.Pool({...common,user:"demo_ci"});
 const runtime=new pg.Pool({...common,user:"p4_stage_runtime"});
 const raw=new pg.Pool({...common,user:"p4_stage_grant_writer"});
 const db=new CiStageTeamGrants({...process.env,P4_STAGE_TEAMS_CI:"true"});
 const roles=new CiStageRoleGrants({...process.env,P4_STAGE_GRANTS_CI:"true"});
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),kid:"r33-ci-key-teamgrant",alg:"RS256",use:"sig"} as P4R33CiJwk;
 const token=(sub:string)=>{
  const now=Math.floor(Date.now()/1000),enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
  const msg=enc({typ:"JWT",alg:"RS256",kid:jwk.kid})+"."+enc({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,iat:now-1,exp:now+300,email_verified:true});
  return msg+"."+sign("RSA-SHA256",Buffer.from(msg),pair.privateKey).toString("base64url");
 };
 const app=express();app.use("/stage",createCiStageTeamRouter(db,async req=>{
  try{return verifyP4R33CiToken(req.get("authorization")?.replace(/^Bearer /,""),[jwk],Math.floor(Date.now()/1000));}catch{return null;}
 }));
 const endpoint=(org:string,target:string)=>"/stage/"+org+"/targets/"+target+"/team-grants";
 const auth="Bearer "+token(identity.subject);
 const command={teamId:team,expectedActive:false,nextActive:true,expectedRevision:0,requestId:id(10)};
 const check=async(org:string,teamId:string,sub=subject)=>(await runtime.query("SELECT platform_stage.team_membership_check($1,$2,$3,$4) AS allowed",[CI_ISSUER,sub,org,teamId])).rows[0].allowed;
 const send=(cmd:unknown,org=a,target=member,bearer=auth)=>request(app).post(endpoint(org,target)).set("Authorization",bearer).send(cmd);
 try{
  await admin.query("INSERT INTO platform_stage.users(id) VALUES($1),($2),($3)",[owner,member,foreign]);
  await admin.query("INSERT INTO platform_stage.organizations(id) VALUES($1),($2)",[a,b]);
  await admin.query("INSERT INTO platform_stage.identity_subjects(issuer,subject,user_id,verified) VALUES($1,$2,$3,true),($1,$4,$5,true)",[CI_ISSUER,identity.subject,owner,subject,member]);
  await admin.query("INSERT INTO platform_stage.memberships(organization_id,user_id,role) VALUES($1,$2,'OWNER'),($1,$3,'MEMBER'),($4,$5,'MEMBER')",[a,owner,member,b,foreign]);
  await admin.query("INSERT INTO platform_stage.teams(organization_id,id) VALUES($1,$2),($1,$3),($4,$5),($1,$6)",[a,team,managed,b,other,unlinked]);
  await admin.query("INSERT INTO platform_stage.team_grants(organization_id,user_id,team_id,managed) VALUES($1,$2,$3,false),($1,$2,$4,true),($5,$6,$7,false)",[a,member,team,managed,b,foreign,other]);
  await admin.query("INSERT INTO platform_stage.sales_grants(organization_id,user_id,role_code) VALUES($1,$2,'SALES_REP')",[a,member]);
  await assert.rejects(admin.query("INSERT INTO platform_stage.team_grants(organization_id,user_id,team_id) VALUES($1,$2,$3)",[a,member,other]));
  assert.equal((await request(app).get(endpoint(a,member))).status,401);
  const list=await request(app).get(endpoint(a,member)).set("Authorization",auth);
  assert.equal(list.status,200);assert.deepEqual(list.body,{status:"verified",items:[{teamId:team,active:false,revision:0}],nextCursor:null,applicationAccess:false});
  assert.equal((await request(app).get(endpoint(b,foreign)).set("Authorization",auth)).status,403);
  assert.equal((await send(command,a,member,"Bearer "+token(subject))).status,403);
  assert.equal((await send({...command,teamId:managed})).status,403);
  assert.equal((await send({...command,teamId:other})).status,403);
  assert.equal((await send({...command,teamId:unlinked})).status,403);
  assert.equal((await send({...command,managed:false})).status,400);
  assert.equal((await send(command,a,owner)).status,403);
  assert.equal(await check(a,team),false);
  assert.equal((await send(command)).body.status,"applied");
  assert.equal(await check(a,team),true);assert.equal(await check(b,team),false);assert.equal(await check(a,team,identity.subject),false);
  assert.equal((await send(command)).body.status,"replay");
  assert.equal(await roles.toggle(identity,a,member,{role:"SALES_REP",expectedActive:false,nextActive:true,expectedRevision:0,requestId:command.requestId}),"conflict");
  assert.equal((await send({...command,expectedRevision:1})).status,409);
  const revoke={...command,expectedActive:true,nextActive:false,expectedRevision:1,requestId:id(11)};
  const parallel=await Promise.all([db.toggle(identity,a,member,revoke),db.toggle(identity,a,member,{...revoke,requestId:id(12)})]);
  assert.equal(parallel.filter(x=>x==="applied").length,1);assert.equal(parallel.filter(x=>x==="conflict").length,1);
  assert.equal(await check(a,team),false);
  assert.equal(Number((await admin.query("SELECT count(*) FROM platform_stage.grant_audit WHERE organization_id=$1",[a])).rows[0].count),2);
  await assert.rejects(raw.query("UPDATE platform_stage.team_grants SET managed=false"));
  await assert.rejects(raw.query("SELECT * FROM platform_stage.team_grants"));
  await assert.rejects(runtime.query("SELECT * FROM platform_stage.team_grants"));
  await admin.query("UPDATE platform_stage.memberships SET active=false WHERE organization_id=$1 AND user_id=$2",[a,member]);
  assert.equal(await check(a,team),false);assert.equal((await send(command)).status,403);
  await admin.query("UPDATE platform_stage.memberships SET active=true WHERE organization_id=$1 AND user_id=$2",[a,member]);
  await admin.query("UPDATE platform_stage.memberships SET active=false WHERE organization_id=$1 AND user_id=$2",[a,owner]);
  assert.equal((await send(command)).status,403);
  console.log("P4_STAGE_TEAM_GRANTS_PASS: signed owner, unmanaged existing links, tenant FK, immediate revocation, shared audit and replay");
 }finally{await Promise.all([admin.end(),runtime.end(),raw.end(),db.close(),roles.close()]);}
}
main().catch(e=>{console.error("P4_STAGE_TEAM_GRANTS_FAIL",e instanceof Error?e.name:"unknown");process.exitCode=1;});
