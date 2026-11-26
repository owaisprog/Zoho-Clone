import assert from "node:assert/strict";
import {generateKeyPairSync,sign,randomBytes} from "node:crypto";
import {spawnSync} from "node:child_process";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import express,{type Request} from "express";
import pg from "pg";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import {chromium,type Browser} from "playwright";
import {PrismaPg} from "@prisma/adapter-pg";
import {PrismaClient} from "../backend/src/generated/p4-stage/client.js";
import {PrismaStageMembershipReader} from "../backend/src/platform/staging-membership-db.js";
import {isCanonicalUuidV4} from "../backend/src/platform/p4-approved-uuid.js";
import {assertP4V1CiPrismaEnvironment} from "../backend/src/platform/p4-v1-ci-prisma.js";
import {CI_ISSUER,CI_AUDIENCE,verifyP4R33CiToken,type P4R33CiJwk} from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {CiStageRoleGrants} from "../backend/src/platform/p4-ci-stage-role-grants.js";
import {CiStageTeamGrants} from "../backend/src/platform/p4-ci-stage-team-grants.js";
import {createCiStageRoleRouter} from "../backend/src/platform/p4-ci-stage-role-router.js";
import {createCiStageTeamRouter} from "../backend/src/platform/p4-ci-stage-team-router.js";
const id=(n:number)=>"99100000-0000-4000-8000-"+String(n).padStart(12,"0");
const a=id(1),b=id(2),owner=id(3),member=id(4),team=id(5);
const subject="auth0|workspace-owner",memberSubject="auth0|workspace-member";
const common={host:"127.0.0.1",port:5432,database:"zoho_clone_synthetic_ci",password:"fake_ci_not_for_real_accounts",max:2,connectionTimeoutMillis:2000};
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 if(process.env.P4_PERMISSION_WORKSPACE_CI!=="true"||process.env.VERCEL!==undefined||process.env.VERCEL_ENV!==undefined)throw Error("DISPOSABLE_ONLY");
 const dir=mkdtempSync(join(tmpdir(),"p4-permission-workspace-")),bundle=join(dir,"bundle.js");
 const build=spawnSync("node_modules/.bin/esbuild",["scripts/p4-permission-workspace-entry.tsx","--bundle","--platform=browser","--format=iife","--jsx=automatic","--tsconfig=frontend/tsconfig.json","--define:process.env.NODE_ENV=\"production\"","--outfile="+bundle],{stdio:"pipe",timeout:30000});
 if(build.status!==0){rmSync(dir,{recursive:true,force:true});throw Error("P4_WORKSPACE_BUNDLE_FAILED");}
 const admin=new pg.Pool({...common,user:"demo_ci"});
 const prisma=new PrismaClient({adapter:new PrismaPg({...common,user:"p4_stage_runtime"})});
 const reader=new PrismaStageMembershipReader(prisma,"zoho_clone_synthetic_ci");
 const roles=new CiStageRoleGrants({...process.env,P4_STAGE_GRANTS_CI:"true"});
 const teams=new CiStageTeamGrants({...process.env,P4_STAGE_TEAMS_CI:"true"});
 const pair=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...pair.publicKey.export({format:"jwk"}),kid:"r33-ci-key-workspace",alg:"RS256",use:"sig"} as P4R33CiJwk;
 const token=(sub:string)=>{
  const now=Math.floor(Date.now()/1000),enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
  const msg=enc({typ:"JWT",alg:"RS256",kid:jwk.kid})+"."+enc({iss:CI_ISSUER,aud:CI_AUDIENCE,sub,iat:now-1,exp:now+300,email_verified:true});
  return msg+"."+sign("RSA-SHA256",Buffer.from(msg),pair.privateKey).toString("base64url");
 };
 const ownerSession=randomBytes(32).toString("hex"),memberSession=randomBytes(32).toString("hex");
 const sessions=new Map([[ownerSession,token(subject)],[memberSession,token(memberSubject)]]);
 const verified=async(req:Request)=>{
  const matches=(req.get("cookie")??"").split(";").map(x=>x.trim()).filter(x=>x.startsWith("p4_fixture="));
  if(matches.length!==1||req.get("authorization"))return null;
  const signed=sessions.get(matches[0]!.slice("p4_fixture=".length));
  try{return verifyP4R33CiToken(signed,[jwk],Math.floor(Date.now()/1000));}catch{return null;}
 };
 const app=express();app.disable("x-powered-by");
 let base="";
 app.get("/",(_q,r)=>{r.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");r.setHeader("Cache-Control","no-store");r.type("html").send('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Permission workspace fixture</title></head><body><div id="root"></div><script defer src="/workspace.js"></script></body></html>');});
 app.get("/workspace.js",(_q,r)=>{r.setHeader("Cache-Control","no-store");r.type("application/javascript").send(readFileSync(bundle));});
 const mount="/api/permission-workspace";
 app.use(mount,(req,res,next)=>{
  res.setHeader("Cache-Control","no-store, private");
  if(req.get("x-p4-permission-workspace")!=="1"||(req.get("sec-fetch-site")&&req.get("sec-fetch-site")!=="same-origin")||
     (req.method!=="GET"&&(req.method!=="POST"||req.get("origin")!==base))){
   res.status(403).json({status:"denied",applicationAccess:false});return;
  }next();
 });
 app.get(mount+"/directory",async(req,res)=>{
  const identity=await verified(req);if(!identity){res.status(401).json({status:"unauthenticated",applicationAccess:false});return;}
  const after=req.query.after??null,keys=Object.keys(req.query);
  if((keys.length!==0&&(keys.length!==1||keys[0]!=="after"))||(after!==null&&!isCanonicalUuidV4(after))){res.status(403).json({status:"denied",applicationAccess:false});return;}
  try{res.json({scope:"staging-organization-directory",...await reader.list(identity,after),applicationAccess:false});}catch{res.status(503).json({status:"unavailable",applicationAccess:false});}
 });
 app.use(mount,createCiStageRoleRouter(roles,verified),createCiStageTeamRouter(teams,verified));
 const server=createServer(app);let browser:Browser|undefined;let stage="setup";
 try{
  await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));base="http://127.0.0.1:"+(server.address() as AddressInfo).port;
  await admin.query("INSERT INTO platform_stage.users(id) VALUES($1),($2)",[owner,member]);
  await admin.query("INSERT INTO platform_stage.organizations(id) VALUES($1),($2)",[a,b]);
  await admin.query("INSERT INTO platform_stage.identity_subjects(issuer,subject,user_id,verified) VALUES($1,$2,$3,true),($1,$4,$5,true)",[CI_ISSUER,subject,owner,memberSubject,member]);
  await admin.query("INSERT INTO platform_stage.memberships(organization_id,user_id,role) VALUES($1,$3,'OWNER'),($1,$4,'MEMBER'),($2,$3,'MEMBER')",[a,b,owner,member]);
  await admin.query("INSERT INTO platform_stage.sales_grants(organization_id,user_id,role_code) VALUES($1,$2,'SALES_REP')",[a,member]);
  await admin.query("INSERT INTO platform_stage.teams(organization_id,id) VALUES($1,$2)",[a,team]);
  await admin.query("INSERT INTO platform_stage.team_grants(organization_id,user_id,team_id) VALUES($1,$2,$3)",[a,member,team]);
  stage="browser";browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext();await ctx.route("**/*",route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await ctx.addCookies([{name:"p4_fixture",value:ownerSession,url:base,httpOnly:true,sameSite:"Strict"}]);
  const page=await ctx.newPage();page.setDefaultTimeout(10000);let errors=0;page.on("pageerror",()=>{errors++;});
  await page.goto(base);await page.getByRole("button",{name:"Refresh organizations"}).click();
  await page.getByText("Active organizations loaded.",{exact:true}).waitFor();
  await page.getByLabel("Organization",{exact:true}).selectOption(b);
  await page.getByText("Permission management unavailable for members.",{exact:true}).waitFor();
  assert.equal(await page.getByRole("heading",{name:"Sales role permissions"}).count(),0);
  await page.getByLabel("Organization",{exact:true}).selectOption(a);
  stage="role";await page.locator("#stage-grant-target").fill(member);
  await page.getByRole("button",{name:"Load grants",exact:true}).click();
  await page.getByText("Existing sales grants loaded.",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Activate",exact:true}).click();
  await page.getByText("Change recorded. Reload grants to see current state.",{exact:true}).waitFor();
  stage="team";await page.locator("#stage-team-target").fill(member);
  await page.getByRole("button",{name:"Load team grants"}).click();
  await page.getByText("Existing unmanaged team grants loaded.",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Activate",exact:true}).click();
  await page.getByText("Change recorded. Reload grants.",{exact:true}).waitFor();
  assert.equal(Number((await admin.query("SELECT count(*) FROM platform_stage.grant_audit WHERE organization_id=$1",[a])).rows[0].count),2);
  stage="revocation";await admin.query("UPDATE platform_stage.memberships SET active=false WHERE organization_id=$1 AND user_id=$2",[a,owner]);
  await page.getByRole("button",{name:"Load team grants"}).click();await page.getByText("Team grants unavailable or access denied.",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Refresh organizations"}).click();await page.getByText("Active organizations loaded.",{exact:true}).waitFor();
  assert.equal(await page.getByRole("heading",{name:"Team permissions"}).count(),0);
  assert.equal(await page.locator('#permission-org option[value="'+a+'"]').count(),0);
  stage="member-denial";await ctx.addCookies([{name:"p4_fixture",value:memberSession,url:base,httpOnly:true,sameSite:"Strict"}]);
  await page.getByRole("button",{name:"Refresh organizations"}).click();await page.getByText("Active organizations loaded.",{exact:true}).waitFor();
  await page.getByLabel("Organization",{exact:true}).selectOption(a);await page.getByText("Permission management unavailable for members.",{exact:true}).waitFor();
  const direct=await page.evaluate(async({a,member})=>{const r=await fetch("/api/permission-workspace/"+a+"/targets/"+member+"/sales-grants",{headers:{"X-P4-Permission-Workspace":"1"}});return r.status;},{a,member});assert.equal(direct,403);
  const missingHeader=await page.evaluate(async()=> (await fetch("/api/permission-workspace/directory")).status);assert.equal(missingHeader,403);
  assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length,cookie:document.cookie})),{local:0,session:0,cookie:""});assert.equal(errors,0);
  console.log("P4_PERMISSION_WORKSPACE_PASS: real React organization switch, role/team toggles, atomic audit, revoked owner and member denial; NO_GO");
 }catch(e){console.error("P4_PERMISSION_WORKSPACE_FAIL stage="+stage+" type="+(e instanceof Error?e.name:"unknown"));throw Error("P4_PERMISSION_WORKSPACE_FAILED");}
 finally{await browser?.close();await new Promise<void>(r=>server.close(()=>r()));await Promise.all([admin.end(),prisma.$disconnect(),roles.close(),teams.close()]);rmSync(dir,{recursive:true,force:true});}
}
main().catch(()=>{process.exitCode=1;});
