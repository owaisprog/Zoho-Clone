/**
 * P4 R40 disposable PostgreSQL + real signed fictional JWT + Express test.
 * Never connects to owner Neon, Auth0 live JWKS, staging or production.
 */
import assert from "node:assert/strict";
import {generateKeyPairSync,randomBytes,sign} from "node:crypto";
import express from "express";
import request from "supertest";
import pg from "pg";
import {assertP4V1CiPrismaEnvironment} from "../platform/p4-v1-ci-prisma.js";
import {P4R40CiMemberRoles} from "../platform/p4-r40-ci-member-roles.js";
import {P4R32CiOutboxIssuer} from "../platform/p4-r32-ci-outbox.js";
import {P4R30CiAcceptanceService}
 from "../platform/p4-r30-ci-invitation-acceptance.js";
import {P4R33CiActorMapper,createP4R33CiVerifiedWorkflowRouter}
 from "../platform/p4-r33-ci-verified-workflow.js";
import {CI_ISSUER,CI_AUDIENCE,type P4R33CiJwk}
 from "../platform/p4-r33-ci-jwt-verifier.js";

const O1="10000000-0000-4000-8000-000000000001";
const O2="10000000-0000-4000-8000-000000000002";
const BOB="user_demo_bob",ALICE="user_demo_alice";
let phase="init";
async function main(){
 assertP4V1CiPrismaEnvironment(process.env);
 const pool=new pg.Pool({host:"127.0.0.1",port:5432,
  database:"zoho_clone_synthetic_ci",user:"demo_ci",
  password:"fake_ci_not_for_real_accounts",max:6});
 const keys=generateKeyPairSync("rsa",{modulusLength:2048});
 const jwk={...keys.publicKey.export({format:"jwk"}),kid:"r33-ci-key-r40",
  alg:"RS256" as const,use:"sig" as const} as P4R33CiJwk;
 const now=Math.floor(Date.now()/1000);
 const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const make=(subject:string,override:Record<string,unknown>={})=>{
  const header=encode({alg:"RS256",typ:"JWT",kid:jwk.kid});
  const payload=encode({iss:CI_ISSUER,aud:CI_AUDIENCE,sub:subject,
   iat:now-5,exp:now+300,email_verified:true,...override});
  const signed=header+"."+payload;
  return signed+"."+sign("RSA-SHA256",Buffer.from(signed),keys.privateKey)
   .toString("base64url");
 };
 const alice=make("auth0|demo-alice"),bob=make("auth0|demo-bob");
 const aliceAuth={Authorization:"Bearer "+alice};
 const bobAuth={Authorization:"Bearer "+bob};
 const service=new P4R40CiMemberRoles(pool,process.env);
 const mapper=new P4R33CiActorMapper(pool,[jwk],()=>now,process.env);
 const key=randomBytes(32);
 const app=express();app.use(express.json({limit:"16kb"}));
 app.use("/_p4_r40_ci",createP4R33CiVerifiedWorkflowRouter({
  mapper,issuer:new P4R32CiOutboxIssuer(pool,key,process.env),
  acceptance:new P4R30CiAcceptanceService(pool,process.env),
  roles:service,
 },process.env));
 const route=(org:string=O1)=>"/_p4_r40_ci/owner/"+org+"/members";
 const edit=(org:string=O1)=>route(org)+"/"+BOB+"/role";
 const update=(role:string,expectedRevision:number)=>
  ({role,expectedRevision});
 try{
  // Bob's original CI mapping is intentionally unverified until this test.
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=true,canonical_email='bob@example.com'"+
   " WHERE user_id=$1",[BOB]);
  phase="ci-schema-and-privileges";
  const grants=await pool.query(
   "SELECT has_table_privilege('p4_synthetic_ci_runtime',"+
   " 'p4_r40_ci.sales_roles','SELECT') AS read_role,"+
   " has_table_privilege('p4_synthetic_ci_runtime',"+
   " 'p4_r40_ci.sales_roles','UPDATE') AS write_role,"+
   " has_table_privilege('p4_synthetic_ci_runtime',"+
   " 'p4_r40_ci.role_events','INSERT') AS write_event");
  assert.deepEqual(grants.rows,[{
   read_role:false,write_role:false,write_event:false,
  }]);
  const rls=await pool.query(
   "SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class"+
   " WHERE oid IN ('p4_r40_ci.sales_roles'::regclass,"+
   " 'p4_r40_ci.role_events'::regclass) ORDER BY relname");
  assert.equal(rls.rows.length,2);
  assert.ok(rls.rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
  phase="owner-read-and-tenant";
  const initial=await request(app).get(route()).set(aliceAuth);
  if(initial.status!==200){
   // Diagnostic is intentionally limited to fixed HTTP and SQLSTATE codes.
   process.stderr.write("P4 R40 OWNER_HTTP_STATUS="+initial.status+
    " CODE="+String(initial.body?.error?.code??"UNKNOWN")+"\\n");
   const probe=await pool.connect();
   try{
    await probe.query("BEGIN");
    await probe.query("SET LOCAL ROLE p4_synthetic_ci_runtime");
    await probe.query("SELECT set_config('app.actor_id',$1,true),"+
     "set_config('app.tenant_id',$2,true)",[ALICE,O1]);
    try{
     const result=await probe.query(
      "SELECT user_id,role_code,revision FROM p4_r40_ci.list_member_sales_roles($1)",[O1]);
     process.stderr.write("P4 R40 DIRECT_DB_ROWS="+result.rows.length+"\\n");
    }catch(e){
     const state=e&&typeof e==="object"&&"code" in e?String(e.code):"UNKNOWN";
     process.stderr.write("P4 R40 DIRECT_SQLSTATE="+state+"\\n");
    }
   }finally{try{await probe.query("ROLLBACK");}finally{probe.release();}}
  }
  assert.equal(initial.status,200,"R40_OWNER_READ_"+initial.status+"_"+String(initial.body?.error?.code??"UNKNOWN"));
  assert.equal(initial.headers["cache-control"],"no-store, private");
  assert.deepEqual(initial.body.data,[{userId:BOB,role:"SALES_REP",revision:0}]);
  const other=await request(app).get(route(O2)).set(aliceAuth);
  assert.equal(other.status,200);assert.deepEqual(other.body.data,[]);
  phase="authentication-and-non-owner-denial";
  const unauthed=await request(app).get(route()).set("x-user-id",ALICE)
   .set("x-role","OWNER");
  assert.equal(unauthed.status,401);
  const memberGet=await request(app).get(route()).set(bobAuth)
   .set("x-role","OWNER");
  assert.equal(memberGet.status,403);
  const memberEdit=await request(app).patch(edit()).set(bobAuth)
   .send(update("SALES_MANAGER",0));
  assert.equal(memberEdit.status,403);
  const fake=alice.split(".");
  fake[1]=encode({iss:CI_ISSUER,aud:CI_AUDIENCE,
   sub:"auth0|demo-bob",iat:now-5,exp:now+300,email_verified:true});
  assert.equal((await request(app).patch(edit())
   .set("Authorization","Bearer "+fake.join("."))
   .send(update("SALES_MANAGER",0))).status,401);
  assert.equal((await request(app).patch(edit())
   .set("Authorization","Bearer "+make("auth0|demo-alice",
    {aud:"urn:wrong"})).send(update("SALES_MANAGER",0))).status,401);
  phase="reject-boundary";
  assert.equal((await request(app).patch(edit(O2)).set(aliceAuth)
   .send(update("SALES_MANAGER",0))).status,403);
  assert.equal((await request(app).patch(route()+"/"+ALICE+"/role")
   .set(aliceAuth).send(update("SALES_MANAGER",0))).status,403);
  assert.equal((await request(app).patch(route()+"/user_demo_notfound/role")
   .set(aliceAuth).send(update("SALES_MANAGER",0))).status,403);
  assert.equal((await request(app).patch(edit()).set(aliceAuth)
   .send(update("ORG_OWNER",0))).status,400);
  assert.equal((await request(app).patch(edit()).set(aliceAuth)
   .send({...update("SALES_MANAGER",0),actorId:ALICE})).status,400);
  assert.equal((await request(app).patch(edit()).set(aliceAuth)
   .send(update("SALES_MANAGER",-1))).status,400);
  phase="atomic-role-change";
  const promoted=await request(app).patch(edit()).set(aliceAuth)
   .send(update("SALES_MANAGER",0));
  assert.equal(promoted.status,200);
  assert.deepEqual(promoted.body.data,{
   userId:BOB,role:"SALES_MANAGER",revision:1,
  });
  const stale=await request(app).patch(edit()).set(aliceAuth)
   .send(update("SALES_REP",0));
  assert.equal(stale.status,409);
  const duplicate=await request(app).patch(edit()).set(aliceAuth)
   .send(update("SALES_MANAGER",1));
  assert.equal(duplicate.status,409);
  phase="concurrent-cas";
  const [a,b]=await Promise.all([
   request(app).patch(edit()).set(aliceAuth).send(update("SALES_REP",1)),
   request(app).patch(edit()).set(aliceAuth).send(update("SALES_REP",1)),
  ]);
  assert.deepEqual([a.status,b.status].sort(),[200,409]);
  const read=await request(app).get(route()).set(aliceAuth);
  assert.deepEqual(read.body.data,[{userId:BOB,role:"SALES_REP",revision:2}]);
  phase="audit-atomic-and-redaction";
  const events=await pool.query(
   "SELECT actor_user_id,target_user_id,before_role,after_role,revision"+
   " FROM p4_r40_ci.role_events WHERE org_id=$1 ORDER BY revision",[O1]);
  assert.deepEqual(events.rows,[
   {actor_user_id:ALICE,target_user_id:BOB,before_role:"SALES_REP",
    after_role:"SALES_MANAGER",revision:1},
   {actor_user_id:ALICE,target_user_id:BOB,before_role:"SALES_MANAGER",
    after_role:"SALES_REP",revision:2},
  ]);
  for(const res of [initial,other,unauthed,memberGet,memberEdit,promoted,stale,
   duplicate,a,b,read]){
   const raw=JSON.stringify(res.body);
   for(const secret of [alice,bob,"token_hash","auth0|","postgresql://",
    "role_events","request_id"])assert.equal(raw.includes(secret),false);
  }
  phase="revocation-and-pool-context";
  await pool.query("UPDATE p4_synthetic.memberships SET active=false"+
   " WHERE org_id=$1 AND user_id=$2",[O1,BOB]);
  assert.deepEqual((await request(app).get(route()).set(aliceAuth)).body.data,[]);
  assert.equal((await request(app).patch(edit()).set(aliceAuth)
   .send(update("SALES_MANAGER",2))).status,403);
  const unchanged=await pool.query(
   "SELECT role_code,revision FROM p4_r40_ci.sales_roles"+
   " WHERE org_id=$1 AND user_id=$2",[O1,BOB]);
  assert.deepEqual(unchanged.rows,[{role_code:"SALES_REP",revision:2}]);
  const context=await pool.query("SELECT current_user AS role,"+
   " nullif(current_setting('app.actor_id',true),'') AS actor,"+
   " nullif(current_setting('app.tenant_id',true),'') AS tenant");
  assert.deepEqual(context.rows,[{role:"demo_ci",actor:null,tenant:null}]);
  process.stdout.write("P4 R40 real signed fictional owner, concurrent CAS, denied member and tenant, atomic role audit PASS; NO_GO\n");
 }finally{
  // Other tests use disposable shared fixtures; restore regardless of failure.
  await pool.query("UPDATE p4_synthetic.memberships SET active=true"+
   " WHERE org_id=$1 AND user_id=$2",[O1,BOB]);
  await pool.query("UPDATE p4_synthetic.identity_subjects"+
   " SET email_verified=false,canonical_email='alice@example.com'"+
   " WHERE user_id=$1",[BOB]);
  key.fill(0);await pool.end();
 }
}
main().catch(()=>{
 process.stderr.write("P4 R40 signed member role integration FAILED at "+phase+"\n");
 process.exitCode=1;
});
