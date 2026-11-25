import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import express from "express";
import pg from "pg";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk} from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {assertP4V1CiPrismaEnvironment} from "../backend/src/platform/p4-v1-ci-prisma.js";
import {P4R84CiRuntime} from "../backend/src/platform/p4-r84-ci-runtime.js";
import {createP4R84CiPlatformRouter} from "../backend/src/platform/p4-r84-ci-platform.js";
const a="84000000-0000-4000-8000-000000000001",b="84000000-0000-4000-8000-000000000002",owner="84000000-0000-4000-8000-000000000003",rep="84000000-0000-4000-8000-000000000004",outsider="84000000-0000-4000-8000-000000000005";
const conn={host:"127.0.0.1",port:5432,database:"zoho_clone_synthetic_ci",password:"fake_ci_not_for_real_accounts"};
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const admin=new pg.Pool({...conn,user:"demo_ci"}),db=new P4R84CiRuntime();
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),kid:"r33-ci-key-r84",alg:"RS256",use:"sig"} as P4R33CiJwk;
 const jwt=(sub:string)=>{const now=Math.floor(Date.now()/1000),enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");const msg=enc({typ:"JWT",alg:"RS256",kid:jwk.kid})+"."+enc({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,iat:now-5,exp:now+300,email_verified:true,roles:["OWNER"]});return msg+"."+sign("RSA-SHA256",Buffer.from(msg),pair.privateKey).toString("base64url");};
 const app=express();app.use("/platform",createP4R84CiPlatformRouter(db,[jwk]));const server=createServer(app);await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port;
 const get=async(org:string,path:string,sub:string,status=200)=>{const r=await fetch(base+"/platform/"+org+"/"+path,{headers:{Authorization:"Bearer "+jwt(sub),"x-role":"OWNER"}});assert.equal(r.status,status);assert.equal(r.headers.get("cache-control"),"no-store, private");return (await r.json()).data;};
 try{
  await admin.query("INSERT INTO p4_r82_ci.users(id) VALUES($1),($2),($3)",[owner,rep,outsider]);
  await admin.query("INSERT INTO p4_r82_ci.identity_subjects(issuer,external_subject,user_id,verified) VALUES($1,'auth0|r84-owner',$2,true),($1,'auth0|r84-rep',$3,true),($1,'auth0|r84-outsider',$4,true)",[CI_ISSUER,owner,rep,outsider]);
  await admin.query("INSERT INTO p4_r82_ci.organizations(id,slug,display_name,created_by) VALUES($1,'demo-r84-a','Demo R84 A',$3),($2,'demo-r84-b','Demo R84 B',$4)",[a,b,owner,outsider]);
  await admin.query("INSERT INTO p4_r82_ci.memberships(organization_id,user_id,role) VALUES($1,$3,'OWNER'),($1,$4,'MEMBER'),($2,$5,'OWNER')",[a,b,owner,rep,outsider]);
  await admin.query("INSERT INTO p4_r84_ci.app_entitlements VALUES($1,'platform',true),($1,'crm',true),($2,'platform',true)",[a,b]);
  await admin.query("INSERT INTO p4_r84_ci.sales_roles VALUES($1,$2,'SALES_REP',true)",[a,rep]);
  await admin.query("INSERT INTO p4_r84_ci.audit_events(organization_id,id,actor_id,action) VALUES($1,'84000000-0000-4000-8000-000000000011',$3,'membership.changed'),($2,'84000000-0000-4000-8000-000000000012',$4,'membership.changed')",[a,b,owner,outsider]);
  assert.deepEqual(await get(a,"navigation","auth0|r84-owner"),{organizationId:a,membershipRole:"OWNER",crmAvailable:false});
  assert.deepEqual(await get(a,"navigation","auth0|r84-rep"),{organizationId:a,membershipRole:"MEMBER",crmAvailable:true});
  assert.deepEqual(await get(a,"organization","auth0|r84-owner"),{id:a,displayName:"Demo R84 A"});
  assert.equal((await get(a,"members","auth0|r84-owner")).items.length,2);
  assert.equal((await get(a,"audit","auth0|r84-owner")).items.length,1);
  assert.equal((await get(a,"entitlements","auth0|r84-owner")).length,2);
  for(const resource of ["organization","members","audit","entitlements"])await get(a,resource,"auth0|r84-rep",403);
  await get(b,"navigation","auth0|r84-rep",403);await get(a,"navigation","auth0|r84-outsider",403);
  await get(a,"navigation?role=OWNER","auth0|r84-rep",400);
  await admin.query("UPDATE p4_r84_ci.app_entitlements SET active=false WHERE organization_id=$1 AND app_code='crm'",[a]);
  assert.equal((await get(a,"navigation","auth0|r84-rep")).crmAvailable,false);
  await admin.query("UPDATE p4_r84_ci.app_entitlements SET active=true WHERE organization_id=$1 AND app_code='crm'",[a]);
  await admin.query("UPDATE p4_r82_ci.memberships SET active=false WHERE organization_id=$1 AND user_id=$2",[a,rep]);await get(a,"navigation","auth0|r84-rep",403);
  await admin.query("UPDATE p4_r82_ci.memberships SET active=true WHERE organization_id=$1 AND user_id=$2",[a,rep]);
  await assert.rejects(db.run("READ ONLY",c=>c.query("SELECT * FROM p4_r84_ci.audit_events")));
  await assert.rejects(admin.query("DELETE FROM p4_r84_ci.audit_events WHERE organization_id=$1",[a]));
  console.log("R84 signed UUID platform API, owner metadata, CRM entitlement, revocation and immutable audit PASS; NO_GO");
 }finally{await new Promise<void>(r=>server.close(()=>r()));await Promise.all([db.close(),admin.end()]);}
}
main().catch(e=>{console.error("R84 smoke failed",e instanceof Error?e.name:"unknown");process.exitCode=1;});
