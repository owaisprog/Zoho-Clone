/** R83: real backup/restore into a second disposable database in the CI Postgres
 * service container. No network other than the fixed CI loopback and Docker service.
 * Neither source nor target is a staging database. No production rollback claim.
 */
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "../backend/src/platform/p4-v1-ci-prisma.js";
import {P4R82CiTenantReader} from "../backend/src/platform/p4-r82-ci-tenant-reader.js";
import {requireCanonicalUuidV4} from "../backend/src/platform/p4-approved-uuid.js";
const source="zoho_clone_synthetic_ci",target="zoho_clone_synthetic_ci_restore_r83";
const a=requireCanonicalUuidV4("82000000-0000-4000-8000-000000000001"),b=requireCanonicalUuidV4("82000000-0000-4000-8000-000000000002"),u=requireCanonicalUuidV4("82000000-0000-4000-8000-000000000003");
const identity={issuer:"https://fixture.us.auth0.com/",subject:"auth0|r82-member"};
const conn={host:"127.0.0.1",port:5432,password:"fake_ci_not_for_real_accounts",connectionTimeoutMillis:3000};
function docker(args:readonly string[],input?:Buffer):Buffer{
 const result=spawnSync("docker",[...args],{input,timeout:45_000,maxBuffer:8*1024*1024,stdio:["pipe","pipe","pipe"]});
 if(result.error||result.status!==0||!Buffer.isBuffer(result.stdout))throw Error("R83_DOCKER_OPERATION_FAILED");
 return result.stdout;
}
const denied=(e:unknown)=>!!e&&typeof e==="object"&&"code" in e&&e.code==="42501";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const cid=process.env.P4_R83_CI_POSTGRES_CONTAINER??"";
 if(!/^[a-f0-9]{64}$/.test(cid))throw Error("R83_DISPOSABLE_CONTAINER_REQUIRED");
 const inspect=JSON.parse(docker(["inspect","--format","{{json .Config}}",cid]).toString("utf8"));
 if(inspect.Image!=="postgres:17"||!Array.isArray(inspect.Env)||!inspect.Env.includes("POSTGRES_DB="+source)||!inspect.Env.includes("POSTGRES_USER=demo_ci")||!inspect.Env.includes("POSTGRES_PASSWORD=fake_ci_not_for_real_accounts"))throw Error("R83_CONTAINER_SCOPE_DENIED");
 const admin=new pg.Pool({...conn,database:source,user:"demo_ci"}),reader=new P4R82CiTenantReader();
 let created=false,changed=false;let restored:pg.Pool|undefined,restoredAdmin:pg.Pool|undefined,archive:Buffer|undefined;
 try{
  const pre=await admin.query("SELECT current_database() AS db,current_user AS role,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS super");
  assert.deepEqual(pre.rows,[{db:source,role:"demo_ci",super:true}]);
  const existing=await admin.query("SELECT 1 FROM pg_database WHERE datname=$1",[target]);assert.equal(existing.rowCount,0);
  // R82 leaves the source fixture inactive. Make the exact disposable row active
  // for a pre-cutover snapshot; leave every other schema untouched.
  const prior=await admin.query("SELECT active FROM p4_r82_ci.organizations WHERE id=$1",[a]);assert.deepEqual(prior.rows,[{active:false}]);
  const membership=await admin.query("SELECT active,revision FROM p4_r82_ci.memberships WHERE organization_id=$1 AND user_id=$2",[a,u]);assert.deepEqual(membership.rows,[{active:true,revision:1}]);
  assert.equal((await admin.query("UPDATE p4_r82_ci.organizations SET active=true WHERE id=$1",[a])).rowCount,1);changed=true;
  const expected={actorId:u,organizationId:a,role:"MEMBER"};
  assert.deepEqual(await reader.read({identity,organizationId:a}),expected);
  assert.equal(await reader.read({identity,organizationId:b}),null);
  archive=docker(["exec",cid,"pg_dump","-U","demo_ci","--format=custom","--schema=p4_r82_ci","--dbname="+source]);
  assert.ok(archive.length>100);assert.equal(archive.subarray(0,5).toString("ascii"),"PGDMP");
  const digest=createHash("sha256").update(archive).digest("hex");
  const counts=await admin.query("SELECT (SELECT count(*)::int FROM p4_r82_ci.users) AS users,(SELECT count(*)::int FROM p4_r82_ci.organizations) AS organizations,(SELECT count(*)::int FROM p4_r82_ci.memberships) AS memberships,(SELECT count(*)::int FROM p4_r82_ci.identity_subjects) AS identities,(SELECT count(*)::int FROM p4_r82_ci.teams) AS teams,(SELECT count(*)::int FROM p4_r82_ci.team_memberships) AS team_memberships");
  // Failure rehearsal: revoke a real membership after the backup.
  assert.equal((await admin.query("UPDATE p4_r82_ci.memberships SET active=false,revision=revision+1 WHERE organization_id=$1 AND user_id=$2",[a,u])).rowCount,1);
  assert.equal(await reader.read({identity,organizationId:a}),null);
  await admin.query("CREATE DATABASE zoho_clone_synthetic_ci_restore_r83 TEMPLATE template0");created=true;
  assert.equal(createHash("sha256").update(archive).digest("hex"),digest);
  docker(["exec","-i",cid,"pg_restore","-U","demo_ci","--exit-on-error","--single-transaction","--dbname="+target],archive);
  restoredAdmin=new pg.Pool({...conn,database:target,user:"demo_ci"});
  restored=new pg.Pool({...conn,database:target,user:"p4_r82_ci_runtime"});
  const role=await restored.query("SELECT current_database() AS db,session_user AS role,(SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS privileged");
  assert.deepEqual(role.rows,[{db:target,role:"p4_r82_ci_runtime",privileged:false}]);
  const lookup=async(issuer:string,subject:string,org:string)=>(await restored!.query('SELECT actor_id::text AS "actorId",organization_id::text AS "organizationId",membership_role AS role FROM p4_r82_ci.membership_check($1,$2,$3)',[issuer,subject,org])).rows;
  assert.deepEqual(await lookup(identity.issuer,identity.subject,a),[expected]);
  assert.deepEqual(await lookup(identity.issuer,identity.subject,b),[]);
  assert.deepEqual(await lookup(identity.issuer,"auth0|r82-unverified",b),[]);
  await assert.rejects(restored.query("SELECT * FROM p4_r82_ci.identity_subjects"),denied);
  await assert.rejects(restored.query("UPDATE p4_r82_ci.memberships SET role='OWNER'"),denied);
  await assert.rejects(restored.query("SET ROLE p4_r82_ci_lookup"),denied);
  const restoredCounts=await restoredAdmin.query("SELECT (SELECT count(*)::int FROM p4_r82_ci.users) AS users,(SELECT count(*)::int FROM p4_r82_ci.organizations) AS organizations,(SELECT count(*)::int FROM p4_r82_ci.memberships) AS memberships,(SELECT count(*)::int FROM p4_r82_ci.identity_subjects) AS identities,(SELECT count(*)::int FROM p4_r82_ci.teams) AS teams,(SELECT count(*)::int FROM p4_r82_ci.team_memberships) AS team_memberships");
  assert.deepEqual(restoredCounts.rows,counts.rows);
  const tables=await restoredAdmin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='p4_r82_ci'::regnamespace AND relkind='r'");assert.equal(tables.rowCount,6);assert.ok(tables.rows.every(x=>x.relrowsecurity&&x.relforcerowsecurity));
  assert.equal(await reader.read({identity,organizationId:a}),null); // source remains isolated
  process.stdout.write(JSON.stringify({rehearsal:"R83",scope:"disposable-ci",archiveSha256:digest,restoredTables:6,restore:"PASS",restrictedLogin:"PASS",foreignTenant:"DENIED",release:"NO_GO",deploymentPerformed:false})+"\n");
 }finally{
  archive?.fill(0);
  await Promise.allSettled([restored?.end(),restoredAdmin?.end(),reader.close()]);
  try{
   if(created)await admin.query("DROP DATABASE zoho_clone_synthetic_ci_restore_r83");
   if(changed){await admin.query("UPDATE p4_r82_ci.memberships SET active=true,revision=1 WHERE organization_id=$1 AND user_id=$2",[a,u]);await admin.query("UPDATE p4_r82_ci.organizations SET active=false WHERE id=$1",[a]);}
  }finally{await admin.end();}
 }
}
main().catch(()=>{process.stderr.write("R83 guarded disposable backup/restore FAILED; release NO_GO\n");process.exitCode=1;});
