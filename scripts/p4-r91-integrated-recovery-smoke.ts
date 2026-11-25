/** Integrated restore rehearsal. Only the disposable GitHub Actions cluster. */
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createHash,randomUUID} from "node:crypto";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "../backend/src/platform/p4-v1-ci-prisma.js";
import {CI_ISSUER} from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
const source="zoho_clone_synthetic_ci",target="zoho_clone_synthetic_ci_restore_r91";
const schemas=["p4_r82_ci","p4_r84_ci","p4_r85_ci","p4_r86_ci","p4_r87_ci","p4_r88_ci"];
const conn={host:"127.0.0.1",port:5432,password:"fake_ci_not_for_real_accounts",connectionTimeoutMillis:3000,statement_timeout:5000};
const a="91000000-0000-4000-8000-000000000001",b="91000000-0000-4000-8000-000000000002",u="91000000-0000-4000-8000-000000000003",v="91000000-0000-4000-8000-000000000004",pa="91000000-0000-4000-8000-000000000005",pb="91000000-0000-4000-8000-000000000006";
const subA="auth0|r91-rep-a",subB="auth0|r91-rep-b";
const fa="91000000-0000-4000-8000-000000000007",fb="91000000-0000-4000-8000-000000000008";
const hash=()=>createHash("sha256").update(randomUUID()).digest("hex");
const deny=(code:string)=>(e:unknown)=>!!e&&typeof e==="object"&&"code" in e&&e.code===code;
function docker(args:string[],input?:Buffer){
 const r=spawnSync("docker",args,{input,timeout:60000,maxBuffer:16*1024*1024,stdio:["pipe","pipe","pipe"]});
 if(r.error||r.status!==0||!Buffer.isBuffer(r.stdout))throw Error("R91_DOCKER_OPERATION_FAILED");return r.stdout;
}
function pool(database:string,user:string){return new pg.Pool({...conn,database,user,max:2});}
async function snapshot(db:pg.Pool){
 const q=await db.query("SELECT n.nspname AS schema,c.relname AS name,c.relrowsecurity AS rls,c.relforcerowsecurity AS forced FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1::text[]) AND c.relkind='r' ORDER BY n.nspname,c.relname",[schemas]);
 assert.equal(q.rows.length,16);const tables=[];
 for(const t of q.rows){
  assert.ok(schemas.includes(t.schema)&&/^[a-z_]+$/.test(t.name)&&t.rls&&t.forced);
  // All data fictional; compare canonical row digests, never log rows.
  const r=await db.query("SELECT count(*)::int AS count, encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text, chr(10) ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest FROM "+t.schema+"."+t.name+" t");
  tables.push({schema:t.schema,name:t.name,...r.rows[0]});
 }
 return tables;
}
async function membership(db:pg.Pool,sub:string,org:string){
 return (await db.query("SELECT actor_id::text,organization_id::text,membership_role FROM p4_r82_ci.membership_check($1,$2,$3)",[CI_ISSUER,sub,org])).rows;
}
async function command(db:pg.Pool,sub:string,org:string,op:string,file:string|null,parent:string|null=null,content:string|null=null,digest:string|null=null){
 return (await db.query("SELECT p4_r85_ci.command($1,$2,$3,$4,$5,$6,$7,$8,$9) AS result",[CI_ISSUER,sub,org,op,file,parent,content,digest,null])).rows[0]?.result;
}
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const cid=process.env.P4_R91_CI_POSTGRES_CONTAINER??"";
 if(!/^[a-f0-9]{64}$/.test(cid))throw Error("R91_DISPOSABLE_CONTAINER_REQUIRED");
 const cfg=JSON.parse(docker(["inspect","--format","{{json .Config}}",cid]).toString("utf8"));
 if(cfg.Image!=="postgres:17"||!Array.isArray(cfg.Env)||!cfg.Env.includes("POSTGRES_DB="+source)||!cfg.Env.includes("POSTGRES_USER=demo_ci")||!cfg.Env.includes("POSTGRES_PASSWORD=fake_ci_not_for_real_accounts"))throw Error("R91_CONTAINER_SCOPE_DENIED");
 const admin=pool(source,"demo_ci"),runtime=pool(source,"p4_r82_ci_runtime"),scanner=pool(source,"p4_r85_ci_scanner");
 let archive:Buffer|undefined,created=false,stage="setup";
 const opened:pg.Pool[]=[];
 try{
  const pre=await admin.query("SELECT current_database() AS db,current_user AS role,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS super");assert.deepEqual(pre.rows,[{db:source,role:"demo_ci",super:true}]);
  assert.equal((await admin.query("SELECT 1 FROM pg_database WHERE datname=$1",[target])).rowCount,0);
  await admin.query("INSERT INTO p4_r82_ci.users(id) VALUES($1),($2)",[u,v]);
  await admin.query("INSERT INTO p4_r82_ci.identity_subjects(issuer,external_subject,user_id,verified) VALUES($1,$2,$3,true),($1,$4,$5,true)",[CI_ISSUER,subA,u,subB,v]);
  await admin.query("INSERT INTO p4_r82_ci.organizations(id,slug,display_name,created_by) VALUES($1,'demo-r91-a','Demo R91 A',$3),($2,'demo-r91-b','Demo R91 B',$4)",[a,b,u,v]);
  await admin.query("INSERT INTO p4_r82_ci.memberships(organization_id,user_id,role) VALUES($1,$3,'MEMBER'),($2,$4,'MEMBER')",[a,b,u,v]);
  await admin.query("INSERT INTO p4_r84_ci.app_entitlements VALUES($1,'platform',true),($1,'crm',true),($2,'platform',true),($2,'crm',true)",[a,b]);
  await admin.query("INSERT INTO p4_r84_ci.sales_roles VALUES($1,$3,'SALES_REP',true),($2,$4,'SALES_REP',true)",[a,b,u,v]);
  await admin.query("INSERT INTO p4_r85_ci.attachment_parents VALUES($1,$3,$5,true),($2,$4,$6,true)",[a,b,pa,pb,u,v]);
  const create=async(org:string,sub:string,file:string,parent:string,content:string)=>{
   const x=await command(runtime,sub,org,"create",file,parent,content);assert.equal(x.state,"quarantined");
   assert.equal((await scanner.query("SELECT p4_r85_ci.scan_fixture($1,$2,0) AS state",[org,file])).rows[0].state,"scan_clean");
  };
  await create(a,subA,fa,pa,"Demo attachment recovery A");await create(b,subB,fb,pb,"Demo attachment recovery B");
  const oldA=hash(),oldB=hash();
  await command(runtime,subA,a,"grant",fa,null,null,oldA);await command(runtime,subB,b,"grant",fb,null,null,oldB);
  const jobs=(await admin.query("SELECT organization_id::text AS org,id::text,attempts FROM p4_r86_ci.outbox WHERE file_id IN ($1,$2) AND status='pending' ORDER BY organization_id",[fa,fb])).rows;
  assert.equal(jobs.length,2);assert.deepEqual(jobs.map(x=>x.org),[a,b]);assert.ok(jobs.every(x=>x.attempts===0));
  stage="backup";
  const before=await snapshot(admin);
  const start=Date.now();archive=docker(["exec",cid,"pg_dump","-U","demo_ci","--format=custom",...schemas.map(s=>"--schema="+s),"--dbname="+source]);
  const backupMs=Date.now()-start;assert.equal(archive.subarray(0,5).toString("ascii"),"PGDMP");
  const digest=createHash("sha256").update(archive).digest("hex");
  stage="post-snapshot-revocation";
  // Deliberate synthetic change after snapshot; no automatic live reconciliation.
  assert.equal((await admin.query("UPDATE p4_r82_ci.memberships SET active=false,revision=revision+1 WHERE organization_id=$1 AND user_id=$2",[a,u])).rowCount,1);
  assert.deepEqual(await membership(runtime,subA,a),[]);
  stage="restore";
  await admin.query("CREATE DATABASE zoho_clone_synthetic_ci_restore_r91 TEMPLATE template0");created=true;
  assert.equal(createHash("sha256").update(archive).digest("hex"),digest);
  const rs=Date.now();docker(["exec","-i",cid,"pg_restore","-U","demo_ci","--exit-on-error","--single-transaction","--dbname="+target],archive);
  const restoreMs=Date.now()-rs;
  const ra=pool(target,"demo_ci"),rr=pool(target,"p4_r82_ci_runtime"),rw=pool(target,"p4_r86_ci_worker");
  opened.push(ra,rr,rw);
  assert.deepEqual(await snapshot(ra),before);
  const scope=await rr.query("SELECT current_database() AS db,session_user AS role,(SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS privileged");
  assert.deepEqual(scope.rows,[{db:target,role:"p4_r82_ci_runtime",privileged:false}]);
  // Only inspect the quarantined restored snapshot. No external service or delivery yet.
  assert.equal((await membership(rr,subA,a)).length,1);assert.deepEqual(await membership(rr,subA,b),[]);
  stage="reconcile-before-resume";
  // Read the exact post-backup fixture state from the authoritative source,
  // then atomically apply it and invalidate every pre-recovery download grant.
  const changed=(await admin.query("SELECT active,revision FROM p4_r82_ci.memberships WHERE organization_id=$1 AND user_id=$2",[a,u])).rows[0];
  assert.deepEqual(changed,{active:false,revision:1});
  const rc=await ra.connect();
  try{await rc.query("BEGIN");assert.equal((await rc.query("UPDATE p4_r82_ci.memberships SET active=$1,revision=$2 WHERE organization_id=$3 AND user_id=$4",[changed.active,changed.revision,a,u])).rowCount,1);
   await rc.query("UPDATE p4_r88_ci.epochs SET epoch=epoch+1");await rc.query("COMMIT");
  }catch(e){await rc.query("ROLLBACK");throw e;}finally{rc.release();}
  assert.deepEqual(await membership(rr,subA,a),[]);
  assert.equal((await membership(rr,subB,b)).length,1);assert.deepEqual(await membership(rr,subB,a),[]);
  await assert.rejects(command(rr,subA,a,"redeem",fa,null,null,oldA),deny("P4003"));
  await assert.rejects(command(rr,subB,b,"redeem",fb,null,null,oldB),deny("P4003"));
  await assert.rejects(rr.query("SELECT * FROM p4_r85_ci.files"),deny("42501"));
  await assert.rejects(rw.query("SELECT * FROM p4_r86_ci.outbox"),deny("42501"));
  await assert.rejects(rr.query("SELECT p4_r87_ci.deliver_job($1,$2,0)",[a,jobs[0].id]),deny("42501"));
  stage="resume-exact-jobs";
  const deliver=async(org:string,id:string)=>(await rw.query("SELECT p4_r87_ci.deliver_job($1,$2,0) AS state",[org,id])).rows[0].state;
  assert.equal(await deliver(a,jobs[0].id),"cancelled");
  assert.equal(await deliver(b,jobs[1].id),"delivered");assert.equal(await deliver(b,jobs[1].id),"empty");
  const inbox=await rr.query("SELECT p4_r86_ci.inbox($1,$2,$3,'list',NULL) AS items",[CI_ISSUER,subB,b]);assert.equal(inbox.rows[0].items.length,1);
  const fresh=hash();await command(rr,subB,b,"grant",fb,null,null,fresh);
  assert.deepEqual(await command(rr,subB,b,"redeem",fb,null,null,fresh),{content:"Demo attachment recovery B"});
  await assert.rejects(command(rr,subB,b,"redeem",fb,null,null,fresh),deny("P4003"));
  // Neither restored worker execution nor data reconciliation mutates source.
  assert.deepEqual(await membership(runtime,subA,a),[]);
  assert.deepEqual((await admin.query("SELECT status FROM p4_r86_ci.outbox WHERE file_id IN ($1,$2) ORDER BY organization_id",[fa,fb])).rows,[{status:"pending"},{status:"pending"}]);
  console.log(JSON.stringify({rehearsal:"R91",scope:"disposable-ci",schemas:schemas.length,tables:before.length,archiveSha256:digest,backupMs,restoreMs,rowDigests:"PASS",replayedRevocation:"PASS",preRecoveryGrants:"DENIED",revokedJob:"CANCELLED",authorizedJob:"DELIVERED_ONCE",sourceIsolation:"PASS",release:"NO_GO"}));
 }catch(e){console.error("R91 failure stage="+stage+" type="+(e instanceof Error?e.name:"unknown")+" code="+(e&&typeof e==="object"&&"code" in e?String(e.code):"none"));throw Error("R91_RECOVERY_FAILED");}
 finally{archive?.fill(0);await Promise.allSettled([...opened.map(p=>p.end()),runtime.end(),scanner.end()]);try{if(created)await admin.query("DROP DATABASE zoho_clone_synthetic_ci_restore_r91");}finally{await admin.end();}}
}
main().catch(()=>{process.exitCode=1;});
