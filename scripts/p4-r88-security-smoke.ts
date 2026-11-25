import assert from "node:assert/strict";
import {createHash,generateKeyPairSync,sign} from "node:crypto";
import express from "express";
import pg from "pg";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk} from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {assertP4V1CiPrismaEnvironment} from "../backend/src/platform/p4-v1-ci-prisma.js";
import {P4R84CiRuntime} from "../backend/src/platform/p4-r84-ci-runtime.js";
import {createP4R85CiFilesRouter} from "../backend/src/platform/p4-r85-ci-files.js";
import {createP4R84CiPlatformRouter} from "../backend/src/platform/p4-r84-ci-platform.js";
const a="84000000-0000-4000-8000-000000000001",b="84000000-0000-4000-8000-000000000002",owner="84000000-0000-4000-8000-000000000003",rep="84000000-0000-4000-8000-000000000004",outsider="84000000-0000-4000-8000-000000000005";
const conn={host:"127.0.0.1",port:5432,database:"zoho_clone_synthetic_ci",password:"fake_ci_not_for_real_accounts"};
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const admin=new pg.Pool({...conn,user:"demo_ci"}),db=new P4R84CiRuntime();
 const scanner=new pg.Pool({...conn,user:"p4_r85_ci_scanner"});
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),kid:"r33-ci-key-r88",alg:"RS256",use:"sig"} as P4R33CiJwk;
 const jwt=(sub:string)=>{const now=Math.floor(Date.now()/1000),enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");const msg=enc({typ:"JWT",alg:"RS256",kid:jwk.kid})+"."+enc({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,iat:now-5,exp:now+300,email_verified:true,roles:["OWNER"]});return msg+"."+sign("RSA-SHA256",Buffer.from(msg),pair.privateKey).toString("base64url");};
 const app=express();app.use(express.json({limit:"1kb"}));app.use("/files",createP4R85CiFilesRouter(db,[jwk]));app.use("/platform",createP4R84CiPlatformRouter(db,[jwk]));const server=createServer(app);await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));
 const base="http://127.0.0.1:"+(server.address() as AddressInfo).port;
 const get=async(org:string,path:string,sub:string,status=200)=>{const r=await fetch(base+"/platform/"+org+"/"+path,{headers:{Authorization:"Bearer "+jwt(sub),"x-role":"OWNER"}});assert.equal(r.status,status);assert.equal(r.headers.get("cache-control"),"no-store, private");return (await r.json()).data;};
 const parent="88000000-0000-4000-8000-000000000001";
 const call=async(org:string,path:string,sub:string,method:string,body:unknown,status=200)=>{const r=await fetch(base+"/files/"+org+"/"+path,{method,headers:{Authorization:"Bearer "+jwt(sub),"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(r.status,status);assert.equal(r.headers.get("cache-control"),"no-store, private");return r.headers.get("content-type")?.startsWith("text/plain")?await r.text():(await r.json()).data;};
 const actor="auth0|r84-rep",other="auth0|r84-outsider",root="auth0|r84-owner";
 try{
  await admin.query("INSERT INTO p4_r85_ci.attachment_parents VALUES($1,$2,$3,true)",[a,parent,rep]);
  const file=await call(a,"parents/"+parent+"/files",actor,"POST",{content:"Demo attachment epoch"}),endpoint="files/"+file.id;
  await scanner.query("SELECT p4_r85_ci.scan_fixture($1,$2,0)",[a,file.id]);
  const epochs=async()=>{const rows=(await admin.query("SELECT organization_id::text,epoch::text FROM p4_r88_ci.epochs WHERE organization_id IN ($1,$2) ORDER BY organization_id",[a,b])).rows;return rows.map(x=>BigInt(x.epoch));};
  const mutations=[
   ["UPDATE p4_r82_ci.memberships SET active=$1 WHERE organization_id=$2 AND user_id=$3",[a,rep]],
   ["UPDATE p4_r84_ci.app_entitlements SET active=$1 WHERE organization_id=$2 AND app_code='crm'",[a]],
   ["UPDATE p4_r84_ci.sales_roles SET active=$1 WHERE organization_id=$2 AND user_id=$3",[a,rep]],
   ["UPDATE p4_r85_ci.attachment_parents SET active=$1 WHERE organization_id=$2 AND id=$3",[a,parent]],
   ["UPDATE p4_r82_ci.organizations SET active=$1 WHERE id=$2",[a]],
   ["UPDATE p4_r82_ci.users SET active=$1 WHERE id=$2",[rep]],
   ["UPDATE p4_r82_ci.identity_subjects SET verified=$1 WHERE user_id=$2",[rep]],
  ] as const;
  for(const [sql,params] of mutations){
   const old=await call(a,endpoint+"/grant",actor,"POST",{}),before=await epochs();
   await admin.query(sql,[false,...params]);
   await call(a,endpoint+"/redeem",actor,"POST",{token:old.token},403);
   await admin.query(sql,[true,...params]);
   const after=await epochs();assert.ok(after[0]!>before[0]!);assert.equal(after[1],before[1]);
   await call(a,endpoint+"/redeem",actor,"POST",{token:old.token},403);
   const fresh=await call(a,endpoint+"/grant",actor,"POST",{});
   assert.equal(await call(a,endpoint+"/redeem",actor,"POST",{token:fresh.token}),"Demo attachment epoch");
   await call(a,endpoint+"/redeem",actor,"POST",{token:fresh.token},403);
  }
  const stable=await call(a,endpoint+"/grant",actor,"POST",{}),before=await epochs();
  await admin.query("UPDATE p4_r82_ci.memberships SET active=true WHERE organization_id=$1 AND user_id=$2",[a,rep]);
  assert.deepEqual(await epochs(),before);
  assert.equal(await call(a,endpoint+"/redeem",actor,"POST",{token:stable.token}),"Demo attachment epoch");
  await assert.rejects(db.run("READ ONLY",c=>c.query("SELECT * FROM p4_r88_ci.epochs")));
  await assert.rejects(db.run("READ WRITE",c=>c.query("UPDATE p4_r85_ci.download_grants SET authorization_epoch=1")));
  const pending=await call(a,endpoint+"/grant",actor,"POST",{});
  const hash=createHash("sha256").update(pending.token,"ascii").digest("hex");
  await assert.rejects(admin.query("UPDATE p4_r85_ci.download_grants SET authorization_epoch=authorization_epoch+1 WHERE token_hash=$1",[hash]));
  const role=(await admin.query("SELECT rolcanlogin,rolsuper,rolbypassrls FROM pg_roles WHERE rolname='p4_r88_ci_epoch_writer'")).rows[0];assert.deepEqual(role,{rolcanlogin:false,rolsuper:false,rolbypassrls:false});
  const rls=(await admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='p4_r88_ci.epochs'::regclass")).rows[0];assert.deepEqual(rls,{relrowsecurity:true,relforcerowsecurity:true});
  console.log("R88 authorization epoch: 7 access changes revoke old grants permanently, unrelated tenant unchanged, fresh grants valid, no-op stable, restricted epoch role PASS; NO_GO");
 }finally{await new Promise<void>(r=>server.close(()=>r()));await Promise.all([db.close(),admin.end(),scanner.end()]);}
}
main().catch(e=>{console.error("R88 smoke failed",e instanceof Error?e.name:"unknown");process.exitCode=1;});
