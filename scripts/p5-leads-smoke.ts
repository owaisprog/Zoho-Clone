import assert from "node:assert/strict";
import {generateKeyPairSync,sign,randomBytes} from "node:crypto";
import {spawnSync} from "node:child_process";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import express,{type Request} from "express";
import pg from "pg";
import request from "supertest";
import {chromium,type Browser} from "playwright";
import {assertP4V1CiPrismaEnvironment} from "../backend/src/platform/p4-v1-ci-prisma.js";
import {CI_ISSUER,CI_AUDIENCE,verifyP4R33CiToken,type P4R33CiJwk} from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {CiP5Leads} from "../backend/src/platform/p5-ci-leads.js";
import {createCiP5LeadRouter} from "../backend/src/platform/p5-ci-leads-router.js";
const id=(n:number)=>"99300000-0000-4000-8000-"+String(n).padStart(12,"0");
const a=id(1),b=id(2),rep=id(3),other=id(4),owner=id(5),manager=id(6),team=id(7);
const subject="auth0|p5-lead-rep",otherSubject="auth0|p5-lead-other",ownerSubject="auth0|p5-lead-owner",managerSubject="auth0|p5-lead-manager";
const identity=(subject:string)=>({issuer:CI_ISSUER,subject});
const conn={host:"127.0.0.1",port:5432,database:"zoho_clone_synthetic_ci",password:"fake_ci_not_for_real_accounts",max:2,connectionTimeoutMillis:2000};
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 if(process.env.P5_LEADS_CI!=="true"||process.env.VERCEL!==undefined||process.env.VERCEL_ENV!==undefined)throw Error("DISPOSABLE_ONLY");
 const dir=mkdtempSync(join(tmpdir(),"p5-leads-")),bundle=join(dir,"bundle.js");
 const build=spawnSync("node_modules/.bin/esbuild",["scripts/p5-leads-entry.tsx","--bundle","--platform=browser","--format=iife","--jsx=automatic","--tsconfig=frontend/tsconfig.json","--define:process.env.NODE_ENV=\"production\"","--outfile="+bundle],{stdio:"pipe",timeout:30000});
 if(build.status!==0){rmSync(dir,{recursive:true,force:true});throw Error("P5_BUNDLE_FAILED");}
 const admin=new pg.Pool({...conn,user:"demo_ci"}),raw=new pg.Pool({...conn,user:"p5_ci_runtime"}),db=new CiP5Leads();
 const pair=generateKeyPairSync("rsa",{modulusLength:2048}),jwk={...pair.publicKey.export({format:"jwk"}),kid:"r33-ci-key-p5leads",alg:"RS256",use:"sig"} as P4R33CiJwk;
 function token(sub:string){
  const now=Math.floor(Date.now()/1000),enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
  const msg=enc({typ:"JWT",alg:"RS256",kid:jwk.kid})+"."+enc({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,iat:now-1,exp:now+300,email_verified:true});
  return msg+"."+sign("RSA-SHA256",Buffer.from(msg),pair.privateKey).toString("base64url");
 }
 const sessions=new Map<string,string>();const cookie=(sub:string)=>{const key=randomBytes(32).toString("hex");sessions.set(key,token(sub));return key;};
 const repCookie=cookie(subject),otherCookie=cookie(otherSubject),ownerCookie=cookie(ownerSubject),managerCookie=cookie(managerSubject);
 const verified=async(req:Request)=>{
  const matches=(req.get("cookie")??"").split(";").map(x=>x.trim()).filter(x=>x.startsWith("p5_fixture="));
  if(matches.length!==1||req.get("authorization"))return null;
  try{return verifyP4R33CiToken(sessions.get(matches[0]!.slice("p5_fixture=".length)),[jwk],Math.floor(Date.now()/1000));}catch{return null;}
 };
 const app=express();app.disable("x-powered-by");let base="";
 app.get("/",(_q,r)=>{r.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");r.setHeader("Cache-Control","no-store");r.type("html").send('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>P5 lead fixture</title></head><body><div id="root" data-org="'+a+'"></div><script defer src="/workspace.js"></script></body></html>');});
 app.get("/workspace.js",(_q,r)=>{r.setHeader("Cache-Control","no-store");r.type("application/javascript").send(readFileSync(bundle));});
 app.use("/api/p5",(req,res,next)=>{
  res.setHeader("Cache-Control","no-store, private");
  if(req.get("x-p5-leads")!=="1"||(req.get("sec-fetch-site")&&req.get("sec-fetch-site")!=="same-origin")||(req.method!=="GET"&&(req.method!=="POST"||req.get("origin")!==base))){
   res.status(403).json({status:"denied",applicationAccess:false});return;
  }next();
 },createCiP5LeadRouter(db,verified));
 const server=createServer(app);let browser:Browser|undefined,stage="setup";
 const path=(org=a)=>"/api/p5/"+org+"/crm/leads";
 const get=(url:string,key:string)=>request(app).get(url).set("x-p5-leads","1").set("Cookie","p5_fixture="+key);
 const post=(url:string,key:string,body:unknown)=>request(app).post(url).set("Origin",base).set("x-p5-leads","1").set("Cookie","p5_fixture="+key).send(body);
 const draft={id:id(10),requestId:id(11),companyName:"Demo Persisted Lead",contactEmail:"persisted@example.com",source:"WEBSITE"};
 try{
  await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));base="http://127.0.0.1:"+(server.address() as AddressInfo).port;
  await admin.query("ALTER ROLE p5_ci_runtime PASSWORD 'fake_ci_not_for_real_accounts'");
  await admin.query("INSERT INTO platform_stage.users(id) VALUES($1),($2),($3),($4)",[rep,other,owner,manager]);
  await admin.query("INSERT INTO platform_stage.organizations(id) VALUES($1),($2)",[a,b]);
  for(const [sub,u] of [[subject,rep],[otherSubject,other],[ownerSubject,owner],[managerSubject,manager]])await admin.query("INSERT INTO platform_stage.identity_subjects(issuer,subject,user_id,verified) VALUES($1,$2,$3,true)",[CI_ISSUER,sub,u]);
  await admin.query("INSERT INTO platform_stage.memberships(organization_id,user_id,role) VALUES($1,$3,'MEMBER'),($1,$4,'MEMBER'),($1,$5,'OWNER'),($1,$6,'MEMBER'),($2,$4,'MEMBER')",[a,b,rep,other,owner,manager]);
  for(const org of [a,b])await admin.query("INSERT INTO platform_stage.app_entitlements VALUES($1,'platform',true),($1,'crm',true)",[org]);
  await admin.query("INSERT INTO platform_stage.sales_grants(organization_id,user_id,role_code,active) VALUES($1,$3,'SALES_REP',true),($1,$4,'SALES_REP',true),($1,$5,'SALES_MANAGER',true),($2,$4,'SALES_REP',true)",[a,b,rep,other,manager]);
  await admin.query("INSERT INTO platform_stage.teams(organization_id,id) VALUES($1,$2)",[a,team]);
  await admin.query("INSERT INTO platform_stage.team_grants(organization_id,user_id,team_id,active) VALUES($1,$2,$3,true)",[a,manager,team]);
  stage="http";
  assert.equal((await request(app).get(path()).set("x-p5-leads","1")).status,401);
  assert.equal((await post(path(),ownerCookie,draft)).status,403);
  assert.equal((await post(path(),managerCookie,draft)).status,403);
  assert.equal((await post(path(),repCookie,{...draft,cardNumber:"fictional-prohibited"})).status,400);
  assert.equal(Number((await admin.query("SELECT count(*) FROM p5_ci.leads")).rows[0].count),0);
  const created=await post(path(),repCookie,draft);assert.equal(created.status,201);assert.equal(created.body.data.lead.companyName,draft.companyName);
  assert.equal((await post(path(),repCookie,draft)).body.data.outcome,"replay");
  assert.equal((await post(path(),repCookie,{...draft,companyName:"Demo Changed Request"})).status,409);
  assert.equal((await post(path(),repCookie,{...draft,id:id(12),requestId:id(13)})).status,409);
  assert.equal((await post(path(b),otherCookie,{...draft,id:id(14),requestId:id(15),companyName:"Demo Foreign Lead"})).status,201);
  assert.equal((await get(path()+"/"+id(14),repCookie)).status,404);
  assert.equal((await get(path(b),repCookie)).status,403);
  assert.deepEqual((await get(path(),otherCookie)).body.data.items,[]);
  assert.equal((await get(path(),ownerCookie)).status,403);
  assert.deepEqual((await get(path(),managerCookie)).body.data.items,[]);
  await admin.query("UPDATE p5_ci.leads SET team_id=$1 WHERE organization_id=$2 AND id=$3",[team,a,draft.id]);
  assert.equal((await get(path()+"/"+draft.id,managerCookie)).status,200);
  await admin.query("UPDATE platform_stage.team_grants SET active=false WHERE organization_id=$1 AND user_id=$2",[a,manager]);
  assert.equal((await get(path()+"/"+draft.id,managerCookie)).status,404);
  await assert.rejects(raw.query("SELECT * FROM p5_ci.leads"));
  await assert.rejects(raw.query("INSERT INTO p5_ci.leads(organization_id,id,owner_id,company_name,contact_email,source) VALUES($1,$2,$3,'Demo Denied','denied@example.com','EVENT')",[a,id(16),rep]));
  await assert.rejects(raw.query("DELETE FROM p5_ci.lead_events"));
  await assert.rejects(admin.query("UPDATE p5_ci.lead_events SET revision=0 WHERE organization_id=$1",[a]));
  assert.equal(Number((await admin.query("SELECT count(*) FROM p5_ci.lead_events WHERE organization_id=$1",[a])).rows[0].count),1);
  stage="pagination";
  for(let i=0;i<21;i++)await db.create(identity(subject),a,{...draft,id:id(100+i),requestId:id(200+i),companyName:"Demo Page "+i,contactEmail:"page"+i+"@example.com"});
  const first=await db.list(identity(subject),a),second=await db.list(identity(subject),a,first.nextCursor);
  assert.equal(first.items.length,20);assert.equal(second.items.length,2);assert.equal(second.nextCursor,null);
  assert.equal(new Set([...first.items,...second.items].map(x=>x.id)).size,22);
  stage="browser";
  browser=await chromium.launch({headless:true});const ctx=await browser.newContext();
  await ctx.route("**/*",route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await ctx.addCookies([{name:"p5_fixture",value:repCookie,url:base,httpOnly:true,sameSite:"Strict"}]);
  const page=await ctx.newPage();page.setDefaultTimeout(10000);let errors=0;page.on("pageerror",()=>errors++);
  await page.goto(base);
  await page.getByLabel("Company name",{exact:true}).fill("Demo Browser Lead");
  await page.getByLabel("Contact email",{exact:true}).fill("browser@example.com");
  await page.getByLabel("Lead source",{exact:true}).selectOption("REFERRAL");
  await page.getByRole("button",{name:"Save lead",exact:true}).click();
  await page.getByText("Lead saved.",{exact:true}).waitFor();
  assert.equal(Number((await admin.query("SELECT count(*) FROM p5_ci.leads WHERE organization_id=$1 AND contact_email='browser@example.com'",[a])).rows[0].count),1);
  await page.reload();await page.getByRole("button",{name:"Load leads",exact:true}).click();await page.getByText("Leads loaded.",{exact:true}).waitFor();
  await page.getByRole("button",{name:"View Demo Persisted Lead",exact:true}).click();await page.getByText("Lead details loaded.",{exact:true}).waitFor();
  await page.getByRole("region",{name:"Lead details"}).getByText("persisted@example.com",{exact:true}).waitFor();
  stage="revoke";
  await admin.query("UPDATE platform_stage.sales_grants SET active=false WHERE organization_id=$1 AND user_id=$2",[a,rep]);
  await page.getByRole("button",{name:"Load leads",exact:true}).click();await page.getByText("Request denied or invalid.",{exact:true}).waitFor();
  assert.equal(await page.getByRole("table").count(),0);assert.equal(await page.getByRole("region",{name:"Lead details"}).count(),0);
  assert.equal((await post(path(),repCookie,draft)).status,403);
  assert.equal(errors,0);
  assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length,cookie:document.cookie})),{local:0,session:0,cookie:""});
  console.log("P5_LEAD_CREATE_LIST_PASS: actual PostgreSQL, signed sessions, create/replay, paging, concealed foreign records, Chromium persistence and revocation; NO_GO");
 }catch(e){console.error("P5_LEAD_CREATE_LIST_FAIL stage="+stage+" type="+(e instanceof Error?e.name:"unknown")+" category="+(e instanceof Error&&/Timeout/i.test(e.message)?"TIMEOUT":"OTHER"));throw Error("P5_LEAD_CREATE_LIST_FAILED");}
 finally{await browser?.close();await new Promise<void>(r=>server.close(()=>r()));await Promise.all([admin.end(),raw.end(),db.close()]);rmSync(dir,{recursive:true,force:true});}
}
main().catch(()=>{process.exitCode=1;});
