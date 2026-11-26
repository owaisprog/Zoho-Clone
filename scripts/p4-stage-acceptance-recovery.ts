/** Real disposable permission/audit/restore rehearsal; never a live database migration. */
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "../backend/src/platform/p4-v1-ci-prisma.js";
import {CI_ISSUER} from "../backend/src/platform/p4-r33-ci-jwt-verifier.js";
import {CiStageRoleGrants} from "../backend/src/platform/p4-ci-stage-role-grants.js";
import {CiStageTeamGrants} from "../backend/src/platform/p4-ci-stage-team-grants.js";
import {CiStageAppAccess} from "../backend/src/platform/p4-ci-stage-app-access.js";
const source="zoho_clone_synthetic_ci",target="zoho_clone_synthetic_ci_restore_stage";
const common={host:"127.0.0.1",port:5432,password:"fake_ci_not_for_real_accounts",connectionTimeoutMillis:3000,statement_timeout:5000,max:2};
const tables=["app_entitlements","grant_audit","identity_subjects","lead_read_fixtures","memberships","organizations","sales_grants","team_grants","teams","users"];
const id=(n:number)=>"99200000-0000-4000-8000-"+String(n).padStart(12,"0");
const a=id(1),b=id(2),owner=id(3),member=id(4),ownerB=id(5),memberB=id(6),team=id(7),teamB=id(8),lead=id(9),leadB=id(10);
const oa={issuer:CI_ISSUER,subject:"auth0|stage-recovery-owner-a"},ma={issuer:CI_ISSUER,subject:"auth0|stage-recovery-member-a"};
const ob={issuer:CI_ISSUER,subject:"auth0|stage-recovery-owner-b"},mb={issuer:CI_ISSUER,subject:"auth0|stage-recovery-member-b"};
type Identity=typeof oa;
const denied=(code:string)=>(e:unknown)=>!!e&&typeof e==="object"&&"code" in e&&e.code===code;
const digest=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
function pool(database:string,user:string){return new pg.Pool({...common,database,user});}
function docker(args:string[],input?:Buffer){
 const r=spawnSync("docker",args,{input,timeout:60000,maxBuffer:16*1024*1024,stdio:["pipe","pipe","pipe"]});
 if(r.error||r.status!==0||!Buffer.isBuffer(r.stdout))throw Error("P4_STAGE_RECOVERY_DOCKER_FAILED");
 return r.stdout;
}
async function snapshot(db:pg.Pool){
 const q=await db.query("SELECT c.relname AS name,c.relrowsecurity AS rls,c.relforcerowsecurity AS forced,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='platform_stage' AND c.relkind='r' ORDER BY c.relname");
 assert.deepEqual(q.rows.map(x=>x.name),tables);
 const out=[];
 for(const row of q.rows){
  assert.ok(tables.includes(row.name)&&row.rls===true&&row.forced===true&&row.owner==="p4_stage_owner");
  const r=await db.query("SELECT count(*)::int AS count,encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,chr(10) ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest FROM platform_stage."+row.name+" t");
  out.push({name:row.name,...r.rows[0]});
 }
 return out;
}
async function readonly<T>(db:pg.Pool,fn:(c:pg.PoolClient)=>Promise<T>){
 const c=await db.connect();
 try{await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");const x=await fn(c);await c.query("COMMIT");return x;}
 catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
}
const audit=(db:pg.Pool,x:Identity,org:string,after:string|null=null)=>readonly(db,async c=>(await c.query("SELECT request_id::text,actor_id::text,action,occurred_at FROM platform_stage.grant_audit_page($1,$2,$3,$4)",[x.issuer,x.subject,org,after])).rows);
const membership=async(db:pg.Pool,x:Identity,org:string)=>(await db.query("SELECT membership_role FROM platform_stage.membership_check($1,$2,$3)",[x.issuer,x.subject,org])).rows;
const teamCheck=async(db:pg.Pool,x:Identity,org:string,t:string)=>(await db.query("SELECT platform_stage.team_membership_check($1,$2,$3,$4) AS allowed",[x.issuer,x.subject,org,t])).rows[0].allowed;
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 if(process.env.VERCEL!==undefined||process.env.VERCEL_ENV!==undefined||process.env.P4_STAGE_RECOVERY_CI!=="true")throw Error("DISPOSABLE_ONLY");
 const cid=process.env.P4_STAGE_CI_POSTGRES_CONTAINER??"";
 if(!/^[a-f0-9]{64}$/.test(cid))throw Error("DISPOSABLE_CONTAINER_REQUIRED");
 const cfg=JSON.parse(docker(["inspect","--format","{{json .Config}}",cid]).toString("utf8"));
 if(cfg.Image!=="postgres:17"||!Array.isArray(cfg.Env)||!cfg.Env.includes("POSTGRES_DB="+source)||!cfg.Env.includes("POSTGRES_USER=demo_ci")||!cfg.Env.includes("POSTGRES_PASSWORD=fake_ci_not_for_real_accounts"))throw Error("DISPOSABLE_CONTAINER_REQUIRED");
 const admin=pool(source,"demo_ci"),runtime=pool(source,"p4_stage_runtime"),writer=pool(source,"p4_stage_grant_writer");
 const roles=new CiStageRoleGrants({...process.env,P4_STAGE_GRANTS_CI:"true"});
 const teams=new CiStageTeamGrants({...process.env,P4_STAGE_TEAMS_CI:"true"});
 const app=new CiStageAppAccess({...process.env,P4_STAGE_APP_ACCESS_CI:"true"});
 const opened:pg.Pool[]=[];let archive:Buffer|undefined,created=false,stage="setup";
 try{
  assert.deepEqual((await admin.query("SELECT current_database() AS db,current_user AS role,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS super")).rows,[{db:source,role:"demo_ci",super:true}]);
  assert.equal((await admin.query("SELECT 1 FROM pg_database WHERE datname=$1",[target])).rowCount,0);
  await admin.query("INSERT INTO platform_stage.users(id) VALUES($1),($2),($3),($4)",[owner,member,ownerB,memberB]);
  await admin.query("INSERT INTO platform_stage.organizations(id) VALUES($1),($2)",[a,b]);
  for(const [x,u] of [[oa,owner],[ma,member],[ob,ownerB],[mb,memberB]] as const)
   await admin.query("INSERT INTO platform_stage.identity_subjects(issuer,subject,user_id,verified) VALUES($1,$2,$3,true)",[x.issuer,x.subject,u]);
  await admin.query("INSERT INTO platform_stage.memberships(organization_id,user_id,role) VALUES($1,$2,'OWNER'),($1,$3,'MEMBER'),($4,$5,'OWNER'),($4,$6,'MEMBER')",[a,owner,member,b,ownerB,memberB]);
  for(const [org,u,t,l] of [[a,member,team,lead],[b,memberB,teamB,leadB]]){
   await admin.query("INSERT INTO platform_stage.app_entitlements VALUES($1,'platform',true),($1,'crm',true)",[org]);
   await admin.query("INSERT INTO platform_stage.sales_grants(organization_id,user_id,role_code) VALUES($1,$2,'SALES_REP')",[org,u]);
   await admin.query("INSERT INTO platform_stage.teams(organization_id,id) VALUES($1,$2)",[org,t]);
   await admin.query("INSERT INTO platform_stage.team_grants(organization_id,user_id,team_id) VALUES($1,$2,$3)",[org,u,t]);
   await admin.query("INSERT INTO platform_stage.lead_read_fixtures(organization_id,id,owner_id,team_id,label) VALUES($1,$2,$3,$4,'Demo Recovery Lead')",[org,l,u,t]);
  }
  const role=(active:boolean,revision:number,key:string)=>({role:"SALES_REP",expectedActive:!active,nextActive:active,expectedRevision:revision,requestId:key});
  const link=(t:string,active:boolean,revision:number,key:string)=>({teamId:t,expectedActive:!active,nextActive:active,expectedRevision:revision,requestId:key});
  stage="security";
  for(const [x,org,u,t,k] of [[oa,a,member,team,20],[ob,b,memberB,teamB,30]] as const){
   assert.equal(await roles.toggle(x,org,u,role(true,0,id(k))),"applied");
   assert.equal(await teams.toggle(x,org,u,link(t,true,0,id(k+1))),"applied");
  }
  assert.deepEqual(await app.read(ma,a,"lead",null,lead),{id:lead,label:"Demo Recovery Lead"});
  await assert.rejects(app.read(oa,a,"leads"),{status:403});
  await assert.rejects(app.read(ma,a,"lead",null,leadB),{status:404});
  await assert.rejects(app.read(ma,b,"leads"),{status:403});
  console.log("P4_ACCEPTANCE_CASE PERM-T008 PASS_ENGINEERING_ONLY");
  console.log("P4_ACCEPTANCE_CASE PERM-T010 PARTIAL_READ_DENIAL");
  await admin.query("UPDATE platform_stage.organizations SET active=false WHERE id=$1",[a]);
  await assert.rejects(app.read(ma,a,"leads"),{status:403});
  assert.equal(await roles.toggle(oa,a,member,role(false,1,id(22))),"denied");
  await admin.query("UPDATE platform_stage.organizations SET active=true WHERE id=$1",[a]);
  console.log("P4_ACCEPTANCE_CASE AC-107 PASS_ENGINEERING_ONLY");
  await admin.query("UPDATE platform_stage.app_entitlements SET active=false WHERE organization_id=$1 AND app_code='platform'",[a]);
  await assert.rejects(app.read(ma,a,"leads"),{status:403});
  await assert.rejects(roles.list(oa,a,member),denied("42501"));
  assert.equal(await teams.toggle(oa,a,member,link(team,false,1,id(22))),"denied");
  await assert.rejects(audit(runtime,oa,a),denied("42501"));
  await admin.query("UPDATE platform_stage.app_entitlements SET active=true WHERE organization_id=$1 AND app_code='platform'",[a]);
  console.log("P4_ACCEPTANCE_CASE AC-108 PASS_ENGINEERING_ONLY");
  stage="audit";
  const rows=await audit(runtime,oa,a);
  assert.deepEqual(rows.map(x=>({request_id:x.request_id,actor_id:x.actor_id,action:x.action})),[{request_id:id(20),actor_id:owner,action:"role_grant"},{request_id:id(21),actor_id:owner,action:"team_grant"}]);
  assert.ok(rows.every(x=>Object.keys(x).sort().join(",")==="action,actor_id,occurred_at,request_id"&&x.occurred_at instanceof Date));
  assert.equal((await audit(runtime,oa,a,id(20))).length,1);
  await assert.rejects(audit(runtime,ma,a),denied("42501"));
  await assert.rejects(audit(runtime,oa,b),denied("42501"));
  await assert.rejects(runtime.query("SELECT * FROM platform_stage.grant_audit"),denied("42501"));
  await assert.rejects(writer.query("DELETE FROM platform_stage.grant_audit WHERE organization_id=$1",[a]),denied("42501"));
  await assert.rejects(admin.query("UPDATE platform_stage.grant_audit SET after_active=false WHERE organization_id=$1 AND request_id=$2",[a,id(20)]));
  assert.equal(await roles.toggle(oa,a,member,role(true,0,id(20))),"replay");
  assert.equal((await audit(runtime,oa,a)).length,2);
  console.log("P4_ACCEPTANCE_CASE AC-058 PASS_ENGINEERING_ONLY");
  console.log("P4_ACCEPTANCE_CASE PERM-T027 PASS_ENGINEERING_ONLY");
  console.log("P4_ACCEPTANCE_CASE DOM-T010 PASS_ENGINEERING_ONLY");
  stage="backup";
  const before=await snapshot(admin);
  archive=docker(["exec",cid,"pg_dump","-U","demo_ci","--format=custom","--schema=platform_stage","--dbname="+source]);
  assert.equal(archive.subarray(0,5).toString("ascii"),"PGDMP");
  const sha=digest(archive);
  stage="post-backup-revocation";
  assert.equal(await roles.toggle(oa,a,member,role(false,1,id(22))),"applied");
  assert.equal(await teams.toggle(oa,a,member,link(team,false,1,id(23))),"applied");
  assert.equal((await admin.query("UPDATE platform_stage.memberships SET active=false,revision=revision+1 WHERE organization_id=$1 AND user_id=$2",[a,member])).rowCount,1);
  await admin.query("UPDATE platform_stage.app_entitlements SET active=false WHERE organization_id=$1 AND app_code='crm'",[a]);
  await assert.rejects(app.read(ma,a,"leads"),{status:403});
  assert.equal(await teamCheck(runtime,ma,a,team),false);
  assert.deepEqual(await membership(runtime,ma,a),[]);
  const authoritative=await snapshot(admin);
  stage="restore";
  await admin.query("CREATE DATABASE zoho_clone_synthetic_ci_restore_stage TEMPLATE template0");created=true;
  assert.equal(digest(archive),sha);
  docker(["exec","-i",cid,"pg_restore","-U","demo_ci","--exit-on-error","--single-transaction","--dbname="+target],archive);
  const ra=pool(target,"demo_ci"),rr=pool(target,"p4_stage_runtime"),rw=pool(target,"p4_stage_grant_writer");opened.push(ra,rr,rw);
  assert.deepEqual(await snapshot(ra),before);
  assert.deepEqual(await membership(rr,ma,a),[{membership_role:"MEMBER"}]);assert.equal(await teamCheck(rr,ma,a,team),true);
  // Restored copy is quarantined: application and writer functions refuse this database.
  await assert.rejects(readonly(rr,c=>c.query("SELECT platform_stage.app_read($1,$2,$3,'leads',NULL,NULL)",[ma.issuer,ma.subject,a])),denied("42501"));
  const wc=await rw.connect();
  try{await wc.query("BEGIN ISOLATION LEVEL SERIALIZABLE");assert.equal((await wc.query("SELECT platform_stage.toggle_sales_grant($1,$2,$3,$4,'SALES_REP',true,false,1,$5) AS result",[oa.issuer,oa.subject,a,member,id(24)])).rows[0].result,"denied");await wc.query("ROLLBACK");}finally{wc.release();}
  stage="reconcile";
  // Copy only known post-backup revocations and their immutable audit records
  // from the authoritative disposable source. Never resume from stale grants.
  const sr=(await admin.query("SELECT active,revision FROM platform_stage.sales_grants WHERE organization_id=$1 AND user_id=$2 AND role_code='SALES_REP'",[a,member])).rows[0];
  const tr=(await admin.query("SELECT active,revision FROM platform_stage.team_grants WHERE organization_id=$1 AND user_id=$2 AND team_id=$3",[a,member,team])).rows[0];
  const mr=(await admin.query("SELECT active,revision FROM platform_stage.memberships WHERE organization_id=$1 AND user_id=$2",[a,member])).rows[0];
  const er=(await admin.query("SELECT active FROM platform_stage.app_entitlements WHERE organization_id=$1 AND app_code='crm'",[a])).rows[0];
  assert.deepEqual(sr,{active:false,revision:2});assert.deepEqual(tr,sr);assert.deepEqual(mr,{active:false,revision:1});assert.deepEqual(er,{active:false});
  const delta=(await admin.query("SELECT organization_id,request_id,actor_id,target_id,kind,target_ref,before_active,after_active,previous_revision,applied_at::text AS applied_at FROM platform_stage.grant_audit WHERE organization_id=$1 AND request_id=ANY($2::uuid[]) ORDER BY request_id",[a,[id(22),id(23)]])).rows;
  assert.equal(delta.length,2);assert.ok(delta.every(x=>x.organization_id===a&&x.actor_id===owner&&x.target_id===member&&x.before_active===true&&x.after_active===false&&x.previous_revision===1));
  const rc=await ra.connect();
  try{
   await rc.query("BEGIN");
   assert.equal((await rc.query("UPDATE platform_stage.sales_grants SET active=$1,revision=$2 WHERE organization_id=$3 AND user_id=$4 AND role_code='SALES_REP' AND revision=1",[sr.active,sr.revision,a,member])).rowCount,1);
   assert.equal((await rc.query("UPDATE platform_stage.team_grants SET active=$1,revision=$2 WHERE organization_id=$3 AND user_id=$4 AND team_id=$5 AND revision=1",[tr.active,tr.revision,a,member,team])).rowCount,1);
   assert.equal((await rc.query("UPDATE platform_stage.memberships SET active=$1,revision=$2 WHERE organization_id=$3 AND user_id=$4 AND revision=0",[mr.active,mr.revision,a,member])).rowCount,1);
   assert.equal((await rc.query("UPDATE platform_stage.app_entitlements SET active=$1 WHERE organization_id=$2 AND app_code='crm'",[er.active,a])).rowCount,1);
   for(const x of delta)await rc.query("INSERT INTO platform_stage.grant_audit(organization_id,request_id,actor_id,target_id,kind,target_ref,before_active,after_active,previous_revision,applied_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[x.organization_id,x.request_id,x.actor_id,x.target_id,x.kind,x.target_ref,x.before_active,x.after_active,x.previous_revision,x.applied_at]);
   await rc.query("COMMIT");
  }catch(e){await rc.query("ROLLBACK");throw e;}finally{rc.release();}
  stage="verify-recovery";
  assert.deepEqual(await snapshot(ra),authoritative);
  assert.deepEqual(await snapshot(admin),authoritative);
  assert.deepEqual(await membership(rr,ma,a),[]);assert.equal(await teamCheck(rr,ma,a,team),false);
  assert.deepEqual(await membership(rr,mb,b),[{membership_role:"MEMBER"}]);assert.equal(await teamCheck(rr,mb,b,teamB),true);
  assert.deepEqual(await membership(rr,mb,a),[]);
  await assert.rejects(rr.query("SELECT * FROM platform_stage.lead_read_fixtures"),denied("42501"));
  await assert.rejects(rw.query("SELECT * FROM platform_stage.grant_audit"),denied("42501"));
  await assert.rejects(readonly(rr,c=>c.query("SELECT platform_stage.app_read($1,$2,$3,'leads',NULL,NULL)",[mb.issuer,mb.subject,b])),denied("42501"));
  assert.deepEqual(await app.read(mb,b,"lead",null,leadB),{id:leadB,label:"Demo Recovery Lead"});
  console.log(JSON.stringify({marker:"P4_STAGE_ACCEPTANCE_RECOVERY_PASS",scope:"disposable-ci",tables:tables.length,archiveSha256:sha,restoredRowDigests:"PASS",postBackupRevocations:"RECONCILED",audit:"RECONCILED",quarantinedApplication:"DENIED",sourceIsolation:"PASS",formalAccepted:false,release:"NO_GO"}));
 }catch(e){console.error("P4_STAGE_ACCEPTANCE_RECOVERY_FAIL stage="+stage+" type="+(e instanceof Error?e.name:"unknown")+" code="+(e&&typeof e==="object"&&"code" in e&&/^[A-Z0-9]{5}$/.test(String(e.code))?String(e.code):"none"));throw Error("P4_STAGE_ACCEPTANCE_RECOVERY_FAILED");}
 finally{archive?.fill(0);await Promise.allSettled([...opened.map(p=>p.end()),runtime.end(),writer.end(),roles.close(),teams.close(),app.close()]);try{if(created)await admin.query("DROP DATABASE zoho_clone_synthetic_ci_restore_stage");}finally{await admin.end();}}
}
main().catch(()=>{process.exitCode=1;});
