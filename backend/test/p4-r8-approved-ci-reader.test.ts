import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "../src/generated/p4-r7-ci/client.js";
import {
  createP4R7CiPrismaClient,
  readP4R7CiLeads, readP4R7CiLead, P4R7CiReadDeniedError,
} from "../src/platform/p4-r7-ci-prisma-reader.js";

const ORG="20000000-0000-4000-8000-000000000001";
const ACTOR="10000000-0000-4000-8000-0000000000c1";
const OTHER="10000000-0000-4000-8000-0000000000a1";
const TEAM="30000000-0000-4000-8000-000000000001";
const LEAD="80000000-0000-4000-8000-000000000001";
const ENV={
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
  PGPORT:"5432",PGDATABASE:"zoho_clone_synthetic_ci",PGUSER:"demo_ci",
  PGPASSWORD:"fake_ci_not_for_real_accounts",
};
type FakeOptions={
  membership?:boolean;
  roles?:string[];
  crmEnabled?:boolean;
  teamActive?:boolean;
  owner?:string;
  share?:string;
  recordOrg?:string;
  sqlError?:boolean;
  dbPrivileged?:boolean;
  dbCanReadPrivate?:boolean;
  fakeLeadMissing?:boolean;
};
function fakeClient(o:FakeOptions={}) {
  const statements:string[]=[];
  let leadQueries=0;
  const lead={
    orgId:o.recordOrg??ORG,id:LEAD,ownerUserId:o.owner??OTHER,
    teamId:TEAM,assignedUserId:null,displayName:"Demo Shared Orchid Lead",
    shareState:o.share??"explicit_team",confidentialNote:"Demo PRIVATE DO NOT LEAK",
  };
  const tx={
    async $executeRawUnsafe(sql:string){statements.push(sql);return 0;},
    async $queryRawUnsafe(sql:string){
      statements.push(sql);
      if(o.sqlError)throw new Error("password=FAKE_NEVER_IN_PUBLIC_RESPONSE");
      if(sql.includes("set_config("))return [{}];
      return [{role:"p4_v1_ci_runtime",privileged:o.dbPrivileged??false,
        isOwner:false,canReadLabel:true,canReadPrivate:o.dbCanReadPrivate??false,
        canWrite:false}];
    },
    r7Membership:{async findUnique(){return o.membership===false?null:{active:true};}},
    r7RoleGrant:{async findMany(){
      return (o.roles??["SALES_REP"]).map(roleCode=>({roleCode,active:true}));
    }},
    r7AppGrant:{async findMany(){
      return o.crmEnabled===false?[]:[{appCode:"crm",active:true}];
    }},
    r7TeamGrant:{async findMany(){
      return o.teamActive===false?[]:
        [{orgId:ORG,actorId:ACTOR,teamId:TEAM,active:true,managed:false}];
    }},
    r7Lead:{
      async findMany(){leadQueries++;return [lead];},
      async findUnique(){leadQueries++;return o.fakeLeadMissing?null:lead;},
    },
  };
  const prisma={
    async $transaction<T>(callback:(t:typeof tx)=>Promise<T>):Promise<T>{
      return callback(tx);
    },
  } as unknown as PrismaClient;
  return {prisma,statements,get leadQueries(){return leadQueries;}};
}
const scope={organizationId:ORG,actorId:ACTOR};
describe("ADR0008 CI-only Prisma read model: deny-by-default integration",()=>{
  it("refuses any nonlocal CI environment before Prisma instantiation",()=>{
    for(const fake of [
      {...ENV,CI:"false"}, {...ENV,GITHUB_ACTIONS:"false"},
      {...ENV,PGHOST:"user-db.neon.tech"},
      {...ENV,PGDATABASE:"zoho_clone_synthetic"},
      {...ENV,PGUSER:"neondb_owner"},
      {...ENV,NODE_ENV:"production"},
    ])assert.throws(()=>createP4R7CiPrismaClient(fake));
  });
  it("selects the nonprivileged PostgreSQL role before any user membership or lead read",async()=>{
    const f=fakeClient();
    const result=await readP4R7CiLeads(f.prisma,scope,ENV);
    assert.deepEqual(result,[{id:LEAD,displayName:"Demo Shared Orchid Lead"}]);
    assert.equal(f.statements[0],"SET LOCAL ROLE p4_v1_ci_runtime");
    assert.ok(f.statements[1]?.includes("set_config('app.tenant_id',$1,true)"));
    assert.equal(f.leadQueries,1);
    assert.equal(JSON.stringify(result).includes("PRIVATE"),false);
    assert.equal(Object.isFrozen(result),true);
  });
  it("ORG_OWNER does not inherit sales permissions even if a lead is owned by them",async()=>{
    const f=fakeClient({roles:["ORG_OWNER"],owner:ACTOR});
    await assert.rejects(readP4R7CiLeads(f.prisma,scope,ENV),
      P4R7CiReadDeniedError);
    assert.equal(f.leadQueries,0);
  });
  it("never reads business records for absent membership, role, entitlement or elevated role",async()=>{
    for(const opts of [
      {membership:false},{roles:[]},{roles:["PLATFORM_SUPPORT"]},
      {roles:["ORG_ADMIN"]},{roles:["SYS_ADMIN"]},{crmEnabled:false},
      {dbPrivileged:true},{dbCanReadPrivate:true},
    ]){
      const f=fakeClient(opts);
      await assert.rejects(readP4R7CiLeads(f.prisma,scope,ENV),
        P4R7CiReadDeniedError);
      assert.equal(f.leadQueries,0);
    }
  });
  it("a returned foreign or private record is rejected even if a mock DB bypasses RLS",async()=>{
    for(const opts of [
      {recordOrg:"20000000-0000-4000-8000-000000000002"},
      {share:"private"},
    ]){
      const f=fakeClient(opts);
      await assert.rejects(readP4R7CiLeads(f.prisma,scope,ENV),
        P4R7CiReadDeniedError);
      assert.equal(f.leadQueries,1);
    }
  });
  it("revoked team assignment immediately denies a previously explicitly shared record",async()=>{
    const f=fakeClient({teamActive:false});
    await assert.rejects(readP4R7CiLead(f.prisma,scope,LEAD,ENV),
      P4R7CiReadDeniedError);
  });
  it("direct foreign/malformed/missing record requests reveal no titles or SQL details",async()=>{
    for(const id of ["not-a-uuid","80000000-0000-1000-8000-000000000001"]){
      const f=fakeClient();
      await assert.rejects(readP4R7CiLead(f.prisma,scope,id,ENV),
        P4R7CiReadDeniedError);
      assert.equal(f.leadQueries,0);
    }
    for(const opts of [{fakeLeadMissing:true},{recordOrg:"20000000-0000-4000-8000-000000000002"}]){
      const f=fakeClient(opts);
      await assert.rejects(readP4R7CiLead(f.prisma,scope,LEAD,ENV),
        P4R7CiReadDeniedError);
    }
    const f=fakeClient({sqlError:true});
    await assert.rejects(readP4R7CiLeads(f.prisma,scope,ENV),(e:unknown)=>{
      assert.ok(e instanceof P4R7CiReadDeniedError);
      assert.ok(!String(e).includes("FAKE_NEVER_IN_PUBLIC_RESPONSE"));
      return true;
    });
  });
});
