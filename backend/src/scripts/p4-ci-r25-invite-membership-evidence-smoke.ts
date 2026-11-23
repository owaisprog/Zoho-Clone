/**
 * P4 R25: disposable PG/Prisma invite status and membership lifecycle evidence.
 * No token verification, no external routes, no customer data or production DB.
 */
import assert from "node:assert/strict";
import pg from "pg";
import {
  createP4R7CiPrismaClient,P4R7CiReadDeniedError,
} from "../platform/p4-r7-ci-prisma-reader.js";
import {assertP4V1CiPrismaEnvironment} from "../platform/p4-v1-ci-prisma.js";
import {
  readP4R13CiTeams,readP4R13CiInviteLifecycle,
} from "../platform/p4-r13-ci-team-invite-reader.js";
const ORCHID="20000000-0000-4000-8000-000000000001";
const CEDAR="20000000-0000-4000-8000-000000000002";
const ALICE="10000000-0000-4000-8000-0000000000a1";
const EMMA="10000000-0000-4000-8000-0000000000e1";
const DANA="10000000-0000-4000-8000-0000000000d1";
const CHARLIE="10000000-0000-4000-8000-0000000000c1";
const scope=(organizationId:string,actorId:string)=>({organizationId,actorId});
async function main() {
  assertP4V1CiPrismaEnvironment(process.env);
  const prisma=createP4R7CiPrismaClient(process.env);
  const setup=new pg.Pool({host:"127.0.0.1",port:5432,
    database:"zoho_clone_synthetic_ci",user:"demo_ci",
    password:"fake_ci_not_for_real_accounts",max:1});
  try {
    const orchid=await readP4R13CiTeams(prisma,scope(ORCHID,ALICE),20,process.env);
    const cedar=await readP4R13CiTeams(prisma,scope(CEDAR,ALICE),20,process.env);
    assert.deepEqual(orchid,[{
      id:"30000000-0000-4000-8000-000000000001",
      name:"Demo Orchid Team",memberCount:2,isManager:false,
    }]);
    assert.deepEqual(cedar,[{
      id:"30000000-0000-4000-8000-000000000002",
      name:"Demo Cedar Team",memberCount:0,isManager:false,
    }]);
    assert.equal((await readP4R13CiTeams(prisma,scope(ORCHID,EMMA),20,
      process.env)).length,1);
    for(const actor of [DANA,CHARLIE]) {
      await assert.rejects(readP4R13CiTeams(prisma,scope(ORCHID,actor),20,
        process.env),P4R7CiReadDeniedError);
    }
    await assert.rejects(readP4R13CiTeams(prisma,scope(CEDAR,EMMA),20,
      process.env),P4R7CiReadDeniedError);

    const before=await readP4R13CiInviteLifecycle(prisma,scope(ORCHID,ALICE),
      "2029-12-31T00:00:00.000Z",20,process.env);
    const expired=await readP4R13CiInviteLifecycle(prisma,scope(ORCHID,ALICE),
      "2030-01-01T00:00:00.000Z",20,process.env);
    assert.equal(before[0]?.status,"pending");
    assert.equal(expired[0]?.status,"expired");
    assert.equal(JSON.stringify(expired).includes("token_hash"),false);
    assert.equal(JSON.stringify(expired).includes("recipient_email"),false);
    for(const actor of [DANA,CHARLIE]){
      await assert.rejects(readP4R13CiInviteLifecycle(prisma,scope(ORCHID,actor),
        "2030-01-01T00:00:00.000Z",20,process.env),P4R7CiReadDeniedError);
    }
    try{
      await setup.query("UPDATE p4_r7_ci.memberships SET active=false"+
        " WHERE organization_id=$1 AND actor_id=$2",[ORCHID,EMMA]);
      await assert.rejects(readP4R13CiTeams(prisma,scope(ORCHID,EMMA),20,
        process.env),P4R7CiReadDeniedError);
    } finally {
      await setup.query("UPDATE p4_r7_ci.memberships SET active=true"+
        " WHERE organization_id=$1 AND actor_id=$2",[ORCHID,EMMA]);
    }
    try{
      await setup.query("UPDATE p4_r7_ci.app_grants SET active=false"+
        " WHERE organization_id=$1 AND app_code='platform'",[ORCHID]);
      await assert.rejects(readP4R13CiTeams(prisma,scope(ORCHID,ALICE),20,
        process.env),P4R7CiReadDeniedError);
    } finally {
      await setup.query("UPDATE p4_r7_ci.app_grants SET active=true"+
        " WHERE organization_id=$1 AND app_code='platform'",[ORCHID]);
    }
    // R25 boundary: no persisted expiration. The instant supplied to the
    // projection decides pending vs expired without changing the SQL row.
    const atBoundary=await readP4R13CiInviteLifecycle(prisma,
      scope(ORCHID,ALICE),"2030-01-01T00:00:00.000Z",20,process.env);
    const justBefore=await readP4R13CiInviteLifecycle(prisma,
      scope(ORCHID,ALICE),"2029-12-31T23:59:59.999Z",20,process.env);
    assert.equal(justBefore[0]?.status,"pending");
    assert.equal(atBoundary[0]?.status,"expired");
    const persisted=await setup.query(
      "SELECT status,token_hash_private,recipient_email_private"+
      " FROM p4_r11_ci.invitation_status WHERE organization_id=$1",
      [ORCHID]);
    assert.equal(persisted.rows[0]?.status,"pending");
    assert.equal(atBoundary.length,1);
    assert.deepEqual(Object.keys(atBoundary[0]??{}).sort(),
      ["expiresAt","id","roleCode","status"]);
    const serialized=JSON.stringify(atBoundary);
    for(const hidden of [persisted.rows[0]?.token_hash_private,
      persisted.rows[0]?.recipient_email_private,"recipient_email_private",
      "token_hash_private","issued_by"]){
      assert.equal(serialized.includes(String(hidden)),false);
    }
    // Preserve terminal statuses even when the supplied read clock is later.
    for(const status of ["accepted","revoked","expired"] as const){
      try{
        await setup.query("UPDATE p4_r11_ci.invitation_status SET status=$1"+
          " WHERE organization_id=$2",[status,ORCHID]);
        const page=await readP4R13CiInviteLifecycle(prisma,
          scope(ORCHID,ALICE),"2031-01-01T00:00:00.000Z",20,process.env);
        assert.equal(page[0]?.status,status);
      }finally{
        await setup.query("UPDATE p4_r11_ci.invitation_status SET status='pending'"+
          " WHERE organization_id=$1",[ORCHID]);
      }
    }
    // Revocation affects both team and invite metadata immediately.
    try{
      await setup.query("UPDATE p4_r7_ci.memberships SET active=false"+
        " WHERE organization_id=$1 AND actor_id=$2",[ORCHID,EMMA]);
      await assert.rejects(readP4R13CiInviteLifecycle(prisma,
        scope(ORCHID,EMMA),"2030-01-01T00:00:00.000Z",20,process.env),
        P4R7CiReadDeniedError);
    }finally{
      await setup.query("UPDATE p4_r7_ci.memberships SET active=true"+
        " WHERE organization_id=$1 AND actor_id=$2",[ORCHID,EMMA]);
    }
    // Org-admin sees only their tenant's invitation status, never Cedar.
    assert.equal((await readP4R13CiInviteLifecycle(prisma,
      scope(ORCHID,EMMA),"2030-01-01T00:00:00.000Z",20,process.env)).length,1);
    await assert.rejects(readP4R13CiInviteLifecycle(prisma,
      scope(CEDAR,EMMA),"2030-01-01T00:00:00.000Z",20,process.env),
      P4R7CiReadDeniedError);
    for(const actor of [DANA,CHARLIE]){
      await assert.rejects(readP4R13CiInviteLifecycle(prisma,
        scope(ORCHID,actor),"2030-01-01T00:00:00.000Z",20,process.env),
        P4R7CiReadDeniedError);
    }
    // A disabled platform grants no invitation reads for otherwise valid users.
    try{
      await setup.query("UPDATE p4_r7_ci.app_grants SET active=false"+
        " WHERE organization_id=$1 AND app_code='platform'",[ORCHID]);
      await assert.rejects(readP4R13CiInviteLifecycle(prisma,
        scope(ORCHID,ALICE),"2030-01-01T00:00:00.000Z",20,process.env),
        P4R7CiReadDeniedError);
    }finally{
      await setup.query("UPDATE p4_r7_ci.app_grants SET active=true"+
        " WHERE organization_id=$1 AND app_code='platform'",[ORCHID]);
    }
    const context=await prisma.$queryRawUnsafe<Array<{
      role:string;tenant:string|null;actor:string|null;
    }>>('SELECT current_user AS role,'+
      "nullif(current_setting('app.tenant_id',true),'') AS tenant,"+
      "nullif(current_setting('app.actor_id',true),'') AS actor");
    assert.deepEqual(context,[{role:"demo_ci",tenant:null,actor:null}]);
    process.stdout.write("P4 R25 disposable restricted Prisma team and invite CI smoke PASS\n");
  } finally{
    await Promise.all([prisma.$disconnect(),setup.end()]);
  }
}
main().catch(()=>{
  process.stderr.write("P4 R25 disposable Prisma verification FAILED\n");
  process.exitCode=1;
});
