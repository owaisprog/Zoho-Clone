import assert from "node:assert/strict";
import { describe,it } from "node:test";
import type { PrismaClient } from "../src/generated/p4-r7-ci/client.js";
import { P4R7CiReadDeniedError } from "../src/platform/p4-r7-ci-prisma-reader.js";
import {
  readP4R11CiMembershipStatus,readP4R11CiInvitationStatus,
  readP4R11CiAuditMetadata,
} from "../src/platform/p4-r11-ci-iam-reader.js";
const ORG="20000000-0000-4000-8000-000000000001";
const FOREIGN="20000000-0000-4000-8000-000000000002";
const OWNER="10000000-0000-4000-8000-0000000000a1";
const MEMBER="10000000-0000-4000-8000-0000000000c1";
const INVITE="60000000-0000-4000-8000-000000000001";
const AUDIT="70000000-0000-4000-8000-000000000001";
const ENV={
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"5432",
  PGDATABASE:"zoho_clone_synthetic_ci",PGUSER:"demo_ci",
  PGPASSWORD:"fake_ci_not_for_real_accounts",
};
type Fixture={
  roles?:string[];noMember?:boolean;noPlatform?:boolean;
  privateField?:boolean;foreign?:boolean;invalidRole?:boolean;
  invalidStatus?:boolean;invalidTime?:boolean;tooMany?:boolean;
  returnedRoleCode?:string;
};
function mock(opts:Fixture={}) {
  let safeReads=0;
  let started=0;
  const tx={
    async $executeRawUnsafe(){return 0;},
    async $queryRawUnsafe(sql:string){
      if(sql.includes("set_config("))return [{}];
      if(sql.includes("current_user AS role")){
        return [{role:"p4_v1_ci_runtime",privileged:false,isOwner:false,
          canReadLabel:true,canReadPrivate:false,canWrite:false}];
      }
      safeReads++;
      const many=opts.tooMany?21:1;
      if(sql.includes("read_member_roles()")){
        return Array.from({length:many},()=>({
          actorId:MEMBER,roleCode:opts.invalidRole?"EVIL":opts.returnedRoleCode??"SALES_REP",
          active:true,privateSubject:"auth0|PRIVATE",
        }));
      }
      if(sql.includes("invitation_status")){
        return Array.from({length:many},()=>({
          orgId:opts.foreign?FOREIGN:ORG,id:INVITE,
          roleCode:"SALES_REP",status:opts.invalidStatus?"unknown":"pending",
          expiresAt:opts.invalidTime?"invalid":new Date("2030-01-01T00:00:00Z"),
          token_hash_private:"SECRET",recipient_email_private:"private@example.invalid",
        }));
      }
      return Array.from({length:many},()=>({
        orgId:opts.foreign?FOREIGN:ORG,id:AUDIT,actorId:OWNER,
        action:"role_grant.revoked",
        occurredAt:opts.invalidTime?"invalid":new Date("2026-11-20T10:00:00Z"),
        raw_payload_private:"SECRET",
      }));
    },
    r7Membership:{async findUnique(){
      return opts.noMember?null:{active:true};
    }},
    r7RoleGrant:{async findMany(){
      return (opts.roles??["ORG_OWNER"]).map(roleCode=>({roleCode,active:true}));
    }},
    r7AppGrant:{async findMany(){
      return opts.noPlatform?[]:[{appCode:"platform",active:true}];
    }},
    r7TeamGrant:{async findMany(){return [];}},
  };
  const prisma={
    async $transaction<T>(fn:(client:typeof tx)=>Promise<T>):Promise<T>{
      started++;return fn(tx);
    },
  } as unknown as PrismaClient;
  return {prisma,get safeReads(){return safeReads;},
    get started(){return started;}};
}
const owner={organizationId:ORG,actorId:OWNER};
describe("P4 Batch 11 safe IAM projections",()=>{
  it("returns ONLY safe membership fields from a restricted transaction",async()=>{
    const f=mock();
    const data=await readP4R11CiMembershipStatus(f.prisma,owner,20,ENV);
    assert.deepEqual(data,[{userId:MEMBER,roleCode:"SALES_REP",active:true}]);
    assert.equal(JSON.stringify(data).includes("PRIVATE"),false);
    assert.ok(Object.isFrozen(data));
    assert.ok(Object.isFrozen(data[0]));
    assert.equal(f.safeReads,1);
  });
  it("returns invite metadata without private tokens or recipient emails",async()=>{
    const f=mock();
    const v=await readP4R11CiInvitationStatus(f.prisma,owner,20,ENV);
    assert.deepEqual(v,[{
      id:INVITE,roleCode:"SALES_REP",status:"pending",
      expiresAt:"2030-01-01T00:00:00.000Z",
    }]);
    assert.equal(JSON.stringify(v).includes("private@example"),false);
    assert.equal(JSON.stringify(v).includes("SECRET"),false);
  });
  it("returns audit safe fields only; no payload or external actor subject",async()=>{
    const f=mock();
    const v=await readP4R11CiAuditMetadata(f.prisma,owner,20,ENV);
    assert.deepEqual(v,[{
      id:AUDIT,actorId:OWNER,action:"role_grant.revoked",
      occurredAt:"2026-11-20T10:00:00.000Z",
    }]);
    assert.equal(JSON.stringify(v).includes("SECRET"),false);
  });
  it("respects P1.06 admin and reviewer read scopes and denies sales reps",async()=>{
    for(const resource of [
      readP4R11CiMembershipStatus,readP4R11CiInvitationStatus,
      readP4R11CiAuditMetadata,
    ]) {
      const f=mock({roles:["SALES_REP"]});
      await assert.rejects(resource(f.prisma,owner,20,ENV),P4R7CiReadDeniedError);
      assert.equal(f.safeReads,0);
    }
    const admin=mock({roles:["ORG_ADMIN"]});
    assert.equal((await readP4R11CiInvitationStatus(admin.prisma,owner,20,ENV)).length,1);
    await assert.rejects(readP4R11CiAuditMetadata(admin.prisma,owner,20,ENV),
      P4R7CiReadDeniedError);
    const reviewer=mock({roles:["SECURITY_REVIEWER"]});
    assert.equal((await readP4R11CiAuditMetadata(reviewer.prisma,owner,20,ENV)).length,1);
    await assert.rejects(readP4R11CiInvitationStatus(reviewer.prisma,owner,20,ENV),
      P4R7CiReadDeniedError);
  });
  it("denies malformed tenant data, unauthorized fields and invalid timestamp",async()=>{
    for(const opts of [
      {foreign:true},{invalidStatus:true},{invalidTime:true},{tooMany:true},
    ]) {
      const f=mock(opts);
      await assert.rejects(readP4R11CiInvitationStatus(f.prisma,owner,20,ENV),
        P4R7CiReadDeniedError);
    }
    for(const opts of [{foreign:true},{invalidTime:true},{tooMany:true}]){
      const f=mock(opts);
      await assert.rejects(readP4R11CiAuditMetadata(f.prisma,owner,20,ENV),
        P4R7CiReadDeniedError);
    }
    const f=mock({invalidRole:true});
    await assert.rejects(readP4R11CiMembershipStatus(f.prisma,owner,20,ENV),
      P4R7CiReadDeniedError);
  });
  it("does not show restricted owner/security roles to a plain org admin",async()=>{
    const f=mock({roles:["ORG_ADMIN"]});
    // A malicious DB adapter returned an owner role despite SQL masking.
    const invalid=mock({roles:["ORG_ADMIN"],returnedRoleCode:"ORG_OWNER"});
    await assert.rejects(readP4R11CiMembershipStatus(invalid.prisma,owner,20,ENV),
      P4R7CiReadDeniedError);
  });
  it("revoked membership or platform entitlement prevents ALL IAM queries",async()=>{
    for(const opts of [{noMember:true},{noPlatform:true}]){
      for(const func of [readP4R11CiMembershipStatus,
        readP4R11CiInvitationStatus,readP4R11CiAuditMetadata]){
        const f=mock(opts);
        await assert.rejects(func(f.prisma,owner,20,ENV),P4R7CiReadDeniedError);
        assert.equal(f.safeReads,0);
      }
    }
  });
  it("fails closed before starting a DB transaction on invalid limit or non-CI env",async()=>{
    for(const limit of [0,21,1.1,NaN,-1,Infinity]){
      const f=mock();
      await assert.rejects(readP4R11CiAuditMetadata(f.prisma,owner,limit,ENV),
        P4R7CiReadDeniedError);
      assert.equal(f.started,0);
    }
    for(const env of [{...ENV,CI:"false"},{...ENV,PGHOST:"owner.neon.tech"},
      {...ENV,PGDATABASE:"prod"}]){
      const f=mock();
      await assert.rejects(readP4R11CiInvitationStatus(f.prisma,owner,20,env),
        P4R7CiReadDeniedError);
      assert.equal(f.safeReads,0);
    }
  });
  it("membership details are strictly three-field immutable output",async()=>{
    const f=mock();const rows=await readP4R11CiMembershipStatus(
      f.prisma,owner,20,ENV);
    assert.deepEqual(Object.keys(rows[0]??{}).sort(),
      ["active","roleCode","userId"]);
    assert.equal(JSON.stringify(rows).includes("privateSubject"),false);
    assert.equal(JSON.stringify(rows).includes("auth0|PRIVATE"),false);
    assert.ok(Object.isFrozen(rows)&&Object.isFrozen(rows[0]));
  });
  it("all three IAM readers fail closed on revoked membership",async()=>{
    for(const read of [readP4R11CiMembershipStatus,
      readP4R11CiInvitationStatus,readP4R11CiAuditMetadata]){
      const m=mock({noMember:true});
      await assert.rejects(read(m.prisma,owner,20,ENV),P4R7CiReadDeniedError);
      assert.equal(m.safeReads,0);
    }
  });
  it("all three IAM readers fail closed on disabled platform entitlement",async()=>{
    for(const read of [readP4R11CiMembershipStatus,
      readP4R11CiInvitationStatus,readP4R11CiAuditMetadata]){
      const m=mock({noPlatform:true});
      await assert.rejects(read(m.prisma,owner,20,ENV),P4R7CiReadDeniedError);
      assert.equal(m.safeReads,0);
    }
  });
  it("owner and admin membership projections never become implicit invite and audit rights",async()=>{
    const admin=mock({roles:["ORG_ADMIN"]});
    const memberships=await readP4R11CiMembershipStatus(
      admin.prisma,owner,20,ENV);
    assert.equal(memberships.length,1);
    await assert.rejects(readP4R11CiAuditMetadata(admin.prisma,owner,20,ENV),
      P4R7CiReadDeniedError);
    const reviewer=mock({roles:["SECURITY_REVIEWER"]});
    assert.equal((await readP4R11CiMembershipStatus(
      reviewer.prisma,owner,20,ENV)).length,1);
    await assert.rejects(readP4R11CiInvitationStatus(
      reviewer.prisma,owner,20,ENV),P4R7CiReadDeniedError);
  });
  it("does not grant reader rights when actor has unknown forged business role",async()=>{
    const f=mock({roles:["SALES_REP","FAKE_ROOT"]});
    await assert.rejects(readP4R11CiAuditMetadata(f.prisma,owner,20,ENV),
      P4R7CiReadDeniedError);
    assert.equal(f.safeReads,0);
  });
});
