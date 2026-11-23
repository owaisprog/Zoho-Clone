import assert from "node:assert/strict";
import {describe,it} from "node:test";
import type {PrismaClient} from "../src/generated/p4-r7-ci/client.js";
import {P4R7CiReadDeniedError} from "../src/platform/p4-r7-ci-prisma-reader.js";
import {readP4R13CiTeams,readP4R13CiInviteLifecycle}
  from "../src/platform/p4-r13-ci-team-invite-reader.js";
const ORG="20000000-0000-4000-8000-000000000001";
const OTHER="20000000-0000-4000-8000-000000000002";
const ACTOR="10000000-0000-4000-8000-0000000000a1";
const TEAM="30000000-0000-4000-8000-000000000001";
const INVITE="60000000-0000-4000-8000-000000000001";
const ENV={CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"5432",
  PGDATABASE:"zoho_clone_synthetic_ci",PGUSER:"demo_ci",
  PGPASSWORD:"fake_ci_not_for_real_accounts"};
type Opts={roles?:string[];entitled?:boolean;active?:boolean;foreign?:boolean;
  count?:unknown;teamId?:string;name?:string;manager?:boolean;limitOverflow?:boolean;
  inviteStatus?:string;invalidTime?:boolean};
function fixture(opts:Opts={}){
  let queryCount=0,transCount=0;
  const transaction={
    async $executeRawUnsafe(){return 0;},
    async $queryRawUnsafe(sql:string){
      if(sql.includes("set_config("))return [{}];
      if(sql.includes("current_user AS role"))return [{
        role:"p4_v1_ci_runtime",privileged:false,isOwner:false,
        canReadLabel:true,canReadPrivate:false,canWrite:false,
      }];
      queryCount++;
      const rows=Array.from({length:opts.limitOverflow?21:1},()=>({
        orgId:opts.foreign?OTHER:ORG,teamId:opts.teamId??TEAM,
        teamName:opts.name??"Demo Sales Team",
        memberCount:opts.count??2n,isManager:opts.manager??false,
      }));
      if(sql.includes("read_team_summaries"))return rows;
      if(sql.includes("invitation_status"))return [{
        orgId:ORG,id:INVITE,roleCode:"SALES_REP",status:opts.inviteStatus??"pending",
        expiresAt:opts.invalidTime?"bad":new Date("2030-01-01T00:00:00Z"),
      }];
      return [];
    },
    r7Membership:{async findUnique(){return opts.active===false?null:{active:true};}},
    r7RoleGrant:{async findMany(){return (opts.roles??["ORG_OWNER"])
      .map(roleCode=>({roleCode,active:true}));}},
    r7AppGrant:{async findMany(){return opts.entitled===false?[]:
      [{appCode:"platform",active:true}];}},
    r7TeamGrant:{async findMany(){return [];}}, 
  };
  const prisma={async $transaction<T>(fn:(transactionClient:typeof transaction)=>Promise<T>){
    transCount++;return fn(transaction);
  }} as unknown as PrismaClient;
  return {prisma,get queryCount(){return queryCount;},
    get transCount(){return transCount;}};
}
const scope={organizationId:ORG,actorId:ACTOR};
describe("P4 R13 scoped team reader and invite status",()=>{
  it("returns frozen safe fields from the restricted SQL function",async()=>{
    const f=fixture();
    const rows=await readP4R13CiTeams(f.prisma,scope,20,ENV);
    assert.deepEqual(rows,[{id:TEAM,name:"Demo Sales Team",memberCount:2,isManager:false}]);
    assert.ok(Object.isFrozen(rows)&&Object.isFrozen(rows[0]));
    assert.equal(f.queryCount,1);
  });
  it("allows owner/admin only; denies managers, reviewers and reps without new matrix approval",async()=>{
    for(const role of ["SALES_MANAGER","SECURITY_REVIEWER","SALES_REP"]){
      const f=fixture({roles:[role]});
      await assert.rejects(readP4R13CiTeams(f.prisma,scope,20,ENV),
        P4R7CiReadDeniedError);
      assert.equal(f.queryCount,0);
    }
    const admin=fixture({roles:["ORG_ADMIN"]});
    assert.equal((await readP4R13CiTeams(admin.prisma,scope,20,ENV)).length,1);
  });
  it("rejects different org and malformed or overbounded summaries",async()=>{
    for(const opt of [{foreign:true},{count:-1n},{count:1001n},
      {count:2},{name:"Private Team"},{teamId:"wrong"},{limitOverflow:true},
      {manager:true}]){
      const f=fixture(opt);
      await assert.rejects(readP4R13CiTeams(f.prisma,scope,20,ENV),
        P4R7CiReadDeniedError);
    }
  });
  it("never queries team rows with inactive membership or no entitlement",async()=>{
    for(const opt of [{active:false},{entitled:false}]){
      const f=fixture(opt);
      await assert.rejects(readP4R13CiTeams(f.prisma,scope,20,ENV),
        P4R7CiReadDeniedError);
      assert.equal(f.queryCount,0);
    }
  });
  it("denies invalid requested limits before transaction",async()=>{
    for(const limit of [0,-1,21,1.5,NaN]){
      const f=fixture();
      await assert.rejects(readP4R13CiTeams(f.prisma,scope,limit,ENV),
        P4R7CiReadDeniedError);
      assert.equal(f.transCount,0);
    }
  });
  it("derives expired invite only from sanitized R11 read, without state changes",async()=>{
    const f=fixture();
    const before=await readP4R13CiInviteLifecycle(
      f.prisma,scope,"2029-12-31T00:00:00.000Z",20,ENV);
    const after=await readP4R13CiInviteLifecycle(
      f.prisma,scope,"2030-01-01T00:00:00.000Z",20,ENV);
    assert.deepEqual(before,[{id:INVITE,roleCode:"SALES_REP",status:"pending",
      expiresAt:"2030-01-01T00:00:00.000Z"}]);
    assert.equal(after[0]?.status,"expired");
    assert.ok(Object.isFrozen(after)&&Object.isFrozen(after[0]));
  });
  it("does not reinterpret revoked status as expiration",async()=>{
    const f=fixture({inviteStatus:"revoked"});
    const data=await readP4R13CiInviteLifecycle(
      f.prisma,scope,"2031-01-01T00:00:00.000Z",20,ENV);
    assert.equal(data[0]?.status,"revoked");
  });
  it("rejects malformed evaluation time, private/inconsistent invite time, unauthorized role",async()=>{
    const f=fixture();
    await assert.rejects(readP4R13CiInviteLifecycle(f.prisma,scope,"yesterday",20,ENV),
      P4R7CiReadDeniedError);
    const bad=fixture({invalidTime:true});
    await assert.rejects(readP4R13CiInviteLifecycle(
      bad.prisma,scope,"2031-01-01T00:00:00.000Z",20,ENV),P4R7CiReadDeniedError);
    const rep=fixture({roles:["SALES_REP"]});
    await assert.rejects(readP4R13CiInviteLifecycle(
      rep.prisma,scope,"2031-01-01T00:00:00.000Z",20,ENV),P4R7CiReadDeniedError);
  });
  it("expiry is inclusive at exact timestamp but not one millisecond earlier",async()=>{
    const f=fixture();
    const before=await readP4R13CiInviteLifecycle(f.prisma,scope,
      "2029-12-31T23:59:59.999Z",20,ENV);
    const at=await readP4R13CiInviteLifecycle(f.prisma,scope,
      "2030-01-01T00:00:00.000Z",20,ENV);
    assert.equal(before[0]?.status,"pending");
    assert.equal(at[0]?.status,"expired");
    assert.equal(f.queryCount,2);
  });
  it("terminal accepted, revoked and expired invitations never become pending",async()=>{
    for(const status of ["accepted","revoked","expired"]){
      const f=fixture({inviteStatus:status});
      for(const now of ["2028-01-01T00:00:00.000Z",
        "2032-01-01T00:00:00.000Z"]){
        const records=await readP4R13CiInviteLifecycle(
          f.prisma,scope,now,20,ENV);
        assert.equal(records[0]?.status,status);
      }
    }
  });
  it("deny invalid clock and bounds before querying any SQL",async()=>{
    for(const asOf of ["2030-01-01","2030-01-01T00:00:00Z",
      "2030-02-30T00:00:00.000Z","2030-01-01T00:00:00.001+00:00",
      "yesterday","not-an-instant"]){
      const f=fixture();
      await assert.rejects(readP4R13CiInviteLifecycle(
        f.prisma,scope,asOf,20,ENV),P4R7CiReadDeniedError);
      assert.equal(f.transCount,0);
    }
  });
  it("invite metadata is immutable safe projection without email or token",async()=>{
    const f=fixture();
    const r=await readP4R13CiInviteLifecycle(f.prisma,scope,
      "2030-01-01T00:00:00.000Z",20,ENV);
    assert.deepEqual(Object.keys(r[0]??{}).sort(),
      ["expiresAt","id","roleCode","status"]);
    assert.equal(JSON.stringify(r).includes("token_hash_private"),false);
    assert.equal(JSON.stringify(r).includes("recipient_email_private"),false);
    assert.ok(Object.isFrozen(r)&&Object.isFrozen(r[0]));
  });
  it("refuses non-CI or owner Neon-style environments",async()=>{
    const f=fixture();
    await assert.rejects(readP4R13CiTeams(f.prisma,scope,20,
      {...ENV,PGHOST:"prod.neon.tech"}),P4R7CiReadDeniedError);
    assert.equal(f.queryCount,0);
  });
});
