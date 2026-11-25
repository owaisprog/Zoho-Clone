import assert from "node:assert/strict";
import pg from "pg";
import {P4R82CiTenantReader} from "../backend/src/platform/p4-r82-ci-tenant-reader.js";
import {assertP4V1CiPrismaEnvironment} from "../backend/src/platform/p4-v1-ci-prisma.js";
import {requireCanonicalUuidV4} from "../backend/src/platform/p4-approved-uuid.js";
const a=requireCanonicalUuidV4("82000000-0000-4000-8000-000000000001"),b=requireCanonicalUuidV4("82000000-0000-4000-8000-000000000002"),u=requireCanonicalUuidV4("82000000-0000-4000-8000-000000000003"),v=requireCanonicalUuidV4("82000000-0000-4000-8000-000000000004"),team=requireCanonicalUuidV4("82000000-0000-4000-8000-000000000005");
const identity={issuer:"https://fixture.us.auth0.com/",subject:"auth0|r82-member"};
const conn={host:"127.0.0.1",port:5432,database:"zoho_clone_synthetic_ci",password:"fake_ci_not_for_real_accounts"};
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);assert.throws(()=>new P4R82CiTenantReader({...process.env,PGDATABASE:"neon"}));
 const admin=new pg.Pool({...conn,user:"demo_ci"}),direct=new pg.Pool({...conn,user:"p4_r82_ci_runtime"}),reader=new P4R82CiTenantReader();
 const deny=(code:string)=>(e:unknown)=>!!e&&typeof e==="object"&&"code" in e&&e.code===code;
 try{
  await admin.query("INSERT INTO p4_r82_ci.users(id) VALUES($1),($2)",[u,v]);
  await admin.query("INSERT INTO p4_r82_ci.identity_subjects(issuer,external_subject,user_id,verified) VALUES($1,$2,$3,true),($1,'auth0|r82-unverified',$4,false)",[identity.issuer,identity.subject,u,v]);
  await admin.query("INSERT INTO p4_r82_ci.organizations(id,slug,display_name,created_by) VALUES($1,'demo-r82-a','Demo R82 A',$3),($2,'demo-r82-b','Demo R82 B',$4)",[a,b,u,v]);
  await admin.query("INSERT INTO p4_r82_ci.memberships(organization_id,user_id,role) VALUES($1,$3,'MEMBER'),($2,$4,'OWNER')",[a,b,u,v]);
  await admin.query("INSERT INTO p4_r82_ci.teams(organization_id,id,name,manager_user_id) VALUES($1,$2,'Demo R82 Team',$3)",[a,team,u]);
  await assert.rejects(admin.query("INSERT INTO p4_r82_ci.team_memberships(organization_id,team_id,user_id) VALUES($1,$2,$3)",[a,team,v]),deny("23503"));
  await assert.rejects(admin.query("INSERT INTO p4_r82_ci.users(id) VALUES('82000000-0000-7000-8000-000000000009')"),deny("23514"));
  const expected={actorId:u,organizationId:a,role:"MEMBER"};
  assert.deepEqual(await reader.read({identity,organizationId:a}),expected);
  assert.equal(await reader.read({identity,organizationId:b}),null);
  assert.equal(await reader.read({identity:{...identity,issuer:"https://different.us.auth0.com/"},organizationId:a}),null);
  assert.equal(await reader.read({identity:{...identity,subject:"auth0|r82-unverified"},organizationId:b}),null);
  assert.equal(await reader.read({identity:{...identity,subject:"auth0|unknown"},organizationId:a}),null);
  await assert.rejects(direct.query("SELECT * FROM p4_r82_ci.identity_subjects"),deny("42501"));
  await assert.rejects(direct.query("SELECT * FROM p4_r82_ci.memberships"),deny("42501"));
  await assert.rejects(direct.query("UPDATE p4_r82_ci.memberships SET role='OWNER'"),deny("42501"));
  await assert.rejects(direct.query("SET ROLE p4_r82_ci_lookup"),deny("42501"));
  await assert.rejects(direct.query("SET ROLE p4_r82_ci_owner"),deny("42501"));
  const roles=await admin.query("SELECT rolname,rolsuper,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname LIKE 'p4_r82_ci_%' ORDER BY rolname");
  assert.equal(roles.rows.length,3);assert.ok(roles.rows.every(x=>!x.rolsuper&&!x.rolbypassrls));assert.deepEqual(roles.rows.filter(x=>x.rolcanlogin).map(x=>x.rolname),["p4_r82_ci_runtime"]);
  const tables=await admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='p4_r82_ci'::regnamespace AND relkind='r'");assert.equal(tables.rows.length,6);assert.ok(tables.rows.every(x=>x.relrowsecurity&&x.relforcerowsecurity));
  await admin.query("UPDATE p4_r82_ci.memberships SET active=false,revision=revision+1 WHERE organization_id=$1 AND user_id=$2",[a,u]);assert.equal(await reader.read({identity,organizationId:a}),null);
  await admin.query("UPDATE p4_r82_ci.memberships SET active=true WHERE organization_id=$1 AND user_id=$2",[a,u]);assert.deepEqual(await reader.read({identity,organizationId:a}),expected);
  await admin.query("UPDATE p4_r82_ci.identity_subjects SET verified=false WHERE user_id=$1",[u]);assert.equal(await reader.read({identity,organizationId:a}),null);
  await admin.query("UPDATE p4_r82_ci.identity_subjects SET verified=true WHERE user_id=$1",[u]);
  await admin.query("UPDATE p4_r82_ci.organizations SET active=false WHERE id=$1",[a]);assert.equal(await reader.read({identity,organizationId:a}),null);
  process.stdout.write("R82 UUIDv4, composite FK, FORCE RLS, real restricted login and exact provider/tenant lookup revocation PASS; NO_GO\n");
 }finally{await Promise.all([reader.close(),admin.end(),direct.end()]);}
}
main().catch(e=>{process.stderr.write("R82 smoke failed "+String(e?.name)+" code="+String(e?.code??"none")+"\n");process.exitCode=1;});
